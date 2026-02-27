import { useRef, useState, useCallback } from 'react';

const CHUNK_SIZE = 16 * 1024; // 16 KB
const BUFFER_THRESHOLD = CHUNK_SIZE * 8; // pause sending if buffer exceeds this

export type TransferDirection = 'sending' | 'receiving';

export type FileTransferState = {
  fileId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  progress: number;      // 0 – 1
  speedBps: number;      // bytes per second
  direction: TransferDirection;
  senderName?: string;
  done: boolean;
  blobUrl?: string;      // available on receiver when done
  error?: string;
};

type IncomingFile = {
  fileName: string;
  fileSize: number;
  fileType: string;
  totalChunks: number;
  senderName: string;
  chunks: (ArrayBuffer | null)[];
  receivedChunks: number;
  bytesReceived: number;
  startTime: number;
  lastBytes: number;
  lastTime: number;
};

// Header is plain text JSON prefixed with a magic byte (0x01) to distinguish from raw chunk data
const HEADER_MAGIC = 0x01;
const CHUNK_MAGIC = 0x02;

function encodeHeader(payload: object): ArrayBuffer {
  const json = JSON.stringify(payload);
  const encoded = new TextEncoder().encode(json);
  const buf = new ArrayBuffer(1 + encoded.byteLength);
  const view = new Uint8Array(buf);
  view[0] = HEADER_MAGIC;
  view.set(encoded, 1);
  return buf;
}

function encodeChunk(fileId: string, chunkIndex: number, data: ArrayBuffer): ArrayBuffer {
  const idEncoded = new TextEncoder().encode(fileId);
  // Layout: [magic(1)] [idLen(1)] [id(idLen)] [chunkIndex(4)] [data]
  const header = new ArrayBuffer(1 + 1 + idEncoded.byteLength + 4);
  const hView = new DataView(header);
  hView.setUint8(0, CHUNK_MAGIC);
  hView.setUint8(1, idEncoded.byteLength);
  new Uint8Array(header).set(idEncoded, 2);
  hView.setUint32(2 + idEncoded.byteLength, chunkIndex);

  // Concatenate header + chunk data
  const combined = new Uint8Array(header.byteLength + data.byteLength);
  combined.set(new Uint8Array(header), 0);
  combined.set(new Uint8Array(data), header.byteLength);
  return combined.buffer;
}

function parseIncoming(buf: ArrayBuffer): { type: 'header'; payload: any } | { type: 'chunk'; fileId: string; chunkIndex: number; data: ArrayBuffer } | null {
  const view = new DataView(buf);
  if (view.byteLength < 1) return null;
  const magic = view.getUint8(0);

  if (magic === HEADER_MAGIC) {
    const text = new TextDecoder().decode(buf.slice(1));
    try {
      return { type: 'header', payload: JSON.parse(text) };
    } catch { return null; }
  }

  if (magic === CHUNK_MAGIC) {
    const idLen = view.getUint8(1);
    const fileId = new TextDecoder().decode(buf.slice(2, 2 + idLen));
    const chunkIndex = view.getUint32(2 + idLen);
    const data = buf.slice(2 + idLen + 4);
    return { type: 'chunk', fileId, chunkIndex, data };
  }

  return null;
}

export function useFileTransfer(
  channelRef: React.MutableRefObject<{ [peerId: string]: RTCDataChannel }>,
  deviceId: string,
  displayName: string,
  onFileReceived: (transfer: FileTransferState) => void
) {
  const [transfers, setTransfers] = useState<FileTransferState[]>([]);
  const incomingRef = useRef<{ [fileId: string]: IncomingFile }>({});

  const updateTransfer = (fileId: string, patch: Partial<FileTransferState>) => {
    setTransfers(prev =>
      prev.map(t => t.fileId === fileId ? { ...t, ...patch } : t)
    );
  };

  // Called by useWebRTC when binary data arrives on any channel
  const handleBinaryMessage = useCallback((data: ArrayBuffer, peerId: string, peerName: string) => {
    const parsed = parseIncoming(data);
    if (!parsed) return;

    if (parsed.type === 'header') {
      const { fileId, fileName, fileSize, fileType, totalChunks, senderName } = parsed.payload;
      incomingRef.current[fileId] = {
        fileName, fileSize, fileType, totalChunks, senderName,
        chunks: new Array(totalChunks).fill(null),
        receivedChunks: 0,
        bytesReceived: 0,
        startTime: Date.now(),
        lastBytes: 0,
        lastTime: Date.now(),
      };

      // Add to UI
      const newTransfer: FileTransferState = {
        fileId, fileName, fileSize, fileType,
        progress: 0, speedBps: 0,
        direction: 'receiving',
        senderName,
        done: false,
      };
      setTransfers(prev => [...prev, newTransfer]);
    }

    if (parsed.type === 'chunk') {
      const { fileId, chunkIndex, data: chunkData } = parsed;
      const incoming = incomingRef.current[fileId];
      if (!incoming) return;

      incoming.chunks[chunkIndex] = chunkData;
      incoming.receivedChunks++;
      incoming.bytesReceived += chunkData.byteLength;

      const now = Date.now();
      const elapsed = (now - incoming.lastTime) / 1000;
      const speedBps = elapsed > 0.2
        ? (incoming.bytesReceived - incoming.lastBytes) / elapsed
        : 0;

      if (elapsed > 0.2) {
        incoming.lastBytes = incoming.bytesReceived;
        incoming.lastTime = now;
      }

      const progress = incoming.receivedChunks / incoming.totalChunks;
      updateTransfer(fileId, { progress, speedBps });

      if (incoming.receivedChunks === incoming.totalChunks) {
        // Reassemble all chunks into one Blob
        const validChunks = incoming.chunks.filter(Boolean) as ArrayBuffer[];
        const blob = new Blob(validChunks, { type: incoming.fileType });
        const blobUrl = URL.createObjectURL(blob);

        const done: FileTransferState = {
          fileId,
          fileName: incoming.fileName,
          fileSize: incoming.fileSize,
          fileType: incoming.fileType,
          progress: 1,
          speedBps: 0,
          direction: 'receiving',
          senderName: incoming.senderName,
          done: true,
          blobUrl,
        };

        updateTransfer(fileId, done);
        onFileReceived(done);
        delete incomingRef.current[fileId];
      }
    }
  }, [onFileReceived]);

  const sendFile = useCallback(async (file: File) => {
    const channels = Object.values(channelRef.current).filter(ch => ch.readyState === 'open');
    if (channels.length === 0) return;

    const fileId = crypto.randomUUID();
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // Register outgoing transfer
    const newTransfer: FileTransferState = {
      fileId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || 'application/octet-stream',
      progress: 0,
      speedBps: 0,
      direction: 'sending',
      senderName: displayName,
      done: false,
    };
    setTransfers(prev => [...prev, newTransfer]);

    // Send header to all connected peers
    const header = encodeHeader({
      fileId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || 'application/octet-stream',
      totalChunks,
      senderName: displayName,
      senderId: deviceId,
    });
    channels.forEach(ch => ch.send(header));

    // Send chunks sequentially
    const buf = await file.arrayBuffer();
    let bytesSent = 0;
    let lastBytes = 0;
    let lastTime = Date.now();

    for (let i = 0; i < totalChunks; i++) {
      const chunk = buf.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const encoded = encodeChunk(fileId, i, chunk);

      for (const ch of channels) {
        // Backpressure: wait for buffer to drain before flooding
        while (ch.bufferedAmount > BUFFER_THRESHOLD) {
          await new Promise(r => setTimeout(r, 10));
        }
        ch.send(encoded);
      }

      bytesSent += chunk.byteLength;
      const now = Date.now();
      const elapsed = (now - lastTime) / 1000;
      let speedBps = 0;
      if (elapsed > 0.2) {
        speedBps = (bytesSent - lastBytes) / elapsed;
        lastBytes = bytesSent;
        lastTime = now;
      }

      updateTransfer(fileId, {
        progress: (i + 1) / totalChunks,
        speedBps,
      });
    }

    updateTransfer(fileId, { progress: 1, speedBps: 0, done: true });
  }, [channelRef, deviceId, displayName]);

  const clearTransfer = useCallback((fileId: string) => {
    setTransfers(prev => {
      const t = prev.find(x => x.fileId === fileId);
      if (t?.blobUrl) URL.revokeObjectURL(t.blobUrl);
      return prev.filter(x => x.fileId !== fileId);
    });
  }, []);

  return { transfers, sendFile, handleBinaryMessage, clearTransfer };
}
