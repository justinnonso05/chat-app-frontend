import { useRef, useState, useCallback, useEffect } from 'react';

const CHUNK_SIZE = 16 * 1024;
const BUFFER_THRESHOLD = CHUNK_SIZE * 8;

// ── IndexedDB helpers ────────────────────────────────────────────────────────
const DB_NAME = 'voxs-files';
const STORE = 'received-files';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'fileId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveReceivedFile(fileId: string, blob: Blob, meta: {
  fileName: string; fileType: string; fileSize: number; senderName: string;
}) {
  try {
    const db = await openDB();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ fileId, blob, savedAt: Date.now(), ...meta });
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (e) {
    console.warn('[FileTransfer] IndexedDB save failed', e);
  }
}

async function loadReceivedFiles(): Promise<Array<{
  fileId: string; blob: Blob; fileName: string; fileType: string;
  fileSize: number; senderName: string; savedAt: number;
}>> {
  try {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => res(req.result ?? []);
      req.onerror = () => rej(req.error);
    });
  } catch {
    return [];
  }
}

async function deleteReceivedFile(fileId: string) {
  try {
    const db = await openDB();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(fileId);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch { /* swallow */ }
}

// ── localStorage helpers for sent-file metadata ──────────────────────────────
const SENT_KEY = (roomId: string) => `sent-files-${roomId}`;

interface SentFileMeta {
  fileId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  senderName: string;
  savedAt: number;
}

function loadSentFiles(roomId: string): SentFileMeta[] {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY(roomId)) ?? '[]');
  } catch {
    return [];
  }
}

function saveSentFile(roomId: string, meta: SentFileMeta) {
  const existing = loadSentFiles(roomId);
  // Limit to last 50 sent entries per room
  const updated = [...existing.filter(f => f.fileId !== meta.fileId), meta].slice(-50);
  localStorage.setItem(SENT_KEY(roomId), JSON.stringify(updated));
}

function deleteSentFile(roomId: string, fileId: string) {
  const updated = loadSentFiles(roomId).filter(f => f.fileId !== fileId);
  localStorage.setItem(SENT_KEY(roomId), JSON.stringify(updated));
}

// ── Types ────────────────────────────────────────────────────────────────────
export type TransferDirection = 'sending' | 'receiving';

export type FileTransferState = {
  fileId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  progress: number;
  speedBps: number;
  direction: TransferDirection;
  senderName?: string;
  done: boolean;
  blobUrl?: string;
  error?: string;
};

// ── Binary framing ────────────────────────────────────────────────────────────
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
  const header = new ArrayBuffer(1 + 1 + idEncoded.byteLength + 4);
  const hView = new DataView(header);
  hView.setUint8(0, CHUNK_MAGIC);
  hView.setUint8(1, idEncoded.byteLength);
  new Uint8Array(header).set(idEncoded, 2);
  hView.setUint32(2 + idEncoded.byteLength, chunkIndex);
  const combined = new Uint8Array(header.byteLength + data.byteLength);
  combined.set(new Uint8Array(header), 0);
  combined.set(new Uint8Array(data), header.byteLength);
  return combined.buffer;
}

function parseIncoming(buf: ArrayBuffer) {
  const view = new DataView(buf);
  if (view.byteLength < 1) return null;
  const magic = view.getUint8(0);

  if (magic === HEADER_MAGIC) {
    const text = new TextDecoder().decode(buf.slice(1));
    try { return { type: 'header' as const, payload: JSON.parse(text) }; } catch { return null; }
  }

  if (magic === CHUNK_MAGIC) {
    const idLen = view.getUint8(1);
    const fileId = new TextDecoder().decode(buf.slice(2, 2 + idLen));
    const chunkIndex = view.getUint32(2 + idLen);
    const data = buf.slice(2 + idLen + 4);
    return { type: 'chunk' as const, fileId, chunkIndex, data };
  }

  return null;
}

// ── Hook ─────────────────────────────────────────────────────────────────────
type IncomingFile = {
  fileName: string; fileSize: number; fileType: string;
  totalChunks: number; senderName: string;
  chunks: (ArrayBuffer | null)[];
  receivedChunks: number; bytesReceived: number;
  startTime: number; lastBytes: number; lastTime: number;
};

export function useFileTransfer(
  channelRef: React.MutableRefObject<{ [peerId: string]: RTCDataChannel }>,
  deviceId: string,
  displayName: string,
  roomId: string,
  onFileReceived: (transfer: FileTransferState) => void
) {
  const [transfers, setTransfers] = useState<FileTransferState[]>([]);
  const incomingRef = useRef<{ [fileId: string]: IncomingFile }>({});
  const blobUrlsRef = useRef<{ [fileId: string]: string }>({});

  // Load persisted history on mount
  useEffect(() => {
    if (!roomId) return;
    const restored: FileTransferState[] = [];

    // Sent metadata from localStorage
    const sent = loadSentFiles(roomId);
    sent.forEach(meta => {
      restored.push({
        fileId: meta.fileId, fileName: meta.fileName, fileSize: meta.fileSize,
        fileType: meta.fileType, progress: 1, speedBps: 0, direction: 'sending',
        senderName: meta.senderName, done: true,
      });
    });

    // Received blobs from IndexedDB
    loadReceivedFiles().then(files => {
      const received: FileTransferState[] = files.map(f => {
        const url = URL.createObjectURL(f.blob);
        blobUrlsRef.current[f.fileId] = url;
        return {
          fileId: f.fileId, fileName: f.fileName, fileSize: f.fileSize,
          fileType: f.fileType, progress: 1, speedBps: 0, direction: 'receiving',
          senderName: f.senderName, done: true, blobUrl: url,
        };
      });
      setTransfers(prev => {
        // Merge: start from persisted, overwrite any that are already in state (active ones win)
        const active = prev.filter(t => !t.done);
        const allDone = [...restored, ...received];
        return [...allDone, ...active];
      });
    });

    if (restored.length > 0) setTransfers(restored);

    return () => {
      // Revoke all blob URLs on unmount
      Object.values(blobUrlsRef.current).forEach(url => URL.revokeObjectURL(url));
      blobUrlsRef.current = {};
    };
  }, [roomId]);

  const updateTransfer = (fileId: string, patch: Partial<FileTransferState>) => {
    setTransfers(prev => prev.map(t => t.fileId === fileId ? { ...t, ...patch } : t));
  };

  const handleBinaryMessage = useCallback((data: ArrayBuffer, _peerId: string, peerName: string) => {
    const parsed = parseIncoming(data);
    if (!parsed) return;

    if (parsed.type === 'header') {
      const { fileId, fileName, fileSize, fileType, totalChunks, senderName } = parsed.payload;
      incomingRef.current[fileId] = {
        fileName, fileSize, fileType, totalChunks, senderName,
        chunks: new Array(totalChunks).fill(null),
        receivedChunks: 0, bytesReceived: 0,
        startTime: Date.now(), lastBytes: 0, lastTime: Date.now(),
      };
      setTransfers(prev => [...prev, {
        fileId, fileName, fileSize, fileType, progress: 0,
        speedBps: 0, direction: 'receiving', senderName, done: false,
      }]);
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
      let speedBps = 0;
      if (elapsed > 0.2) {
        speedBps = (incoming.bytesReceived - incoming.lastBytes) / elapsed;
        incoming.lastBytes = incoming.bytesReceived;
        incoming.lastTime = now;
      }

      const progress = incoming.receivedChunks / incoming.totalChunks;
      updateTransfer(fileId, { progress, speedBps });

      if (incoming.receivedChunks === incoming.totalChunks) {
        const validChunks = incoming.chunks.filter(Boolean) as ArrayBuffer[];
        const blob = new Blob(validChunks, { type: incoming.fileType });
        const blobUrl = URL.createObjectURL(blob);
        blobUrlsRef.current[fileId] = blobUrl;

        const done: FileTransferState = {
          fileId, fileName: incoming.fileName, fileSize: incoming.fileSize,
          fileType: incoming.fileType, progress: 1, speedBps: 0,
          direction: 'receiving', senderName: incoming.senderName, done: true, blobUrl,
        };

        updateTransfer(fileId, done);
        onFileReceived(done);

        // Persist to IndexedDB so it survives reload
        saveReceivedFile(fileId, blob, {
          fileName: incoming.fileName, fileType: incoming.fileType,
          fileSize: incoming.fileSize, senderName: incoming.senderName,
        });

        delete incomingRef.current[fileId];
      }
    }
  }, [onFileReceived]);

  const sendFile = useCallback(async (file: File) => {
    const channels = Object.values(channelRef.current).filter(ch => ch.readyState === 'open');
    if (channels.length === 0) return;

    const fileId = crypto.randomUUID();
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    const newTransfer: FileTransferState = {
      fileId, fileName: file.name, fileSize: file.size,
      fileType: file.type || 'application/octet-stream',
      progress: 0, speedBps: 0, direction: 'sending', senderName: displayName, done: false,
    };
    setTransfers(prev => [...prev, newTransfer]);

    const header = encodeHeader({
      fileId, fileName: file.name, fileSize: file.size,
      fileType: file.type || 'application/octet-stream',
      totalChunks, senderName: displayName, senderId: deviceId,
    });
    channels.forEach(ch => ch.send(header));

    const buf = await file.arrayBuffer();
    let bytesSent = 0, lastBytes = 0, lastTime = Date.now();

    for (let i = 0; i < totalChunks; i++) {
      const chunk = buf.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const encoded = encodeChunk(fileId, i, chunk);

      for (const ch of channels) {
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
      updateTransfer(fileId, { progress: (i + 1) / totalChunks, speedBps });
    }

    updateTransfer(fileId, { progress: 1, speedBps: 0, done: true });

    // Persist sent metadata to localStorage
    saveSentFile(roomId, {
      fileId, fileName: file.name, fileType: file.type || 'application/octet-stream',
      fileSize: file.size, senderName: displayName, savedAt: Date.now(),
    });
  }, [channelRef, deviceId, displayName, roomId]);

  const clearTransfer = useCallback((fileId: string) => {
    setTransfers(prev => {
      const t = prev.find(x => x.fileId === fileId);
      if (t?.blobUrl) {
        URL.revokeObjectURL(t.blobUrl);
        delete blobUrlsRef.current[fileId];
      }
      return prev.filter(x => x.fileId !== fileId);
    });
    // Remove from persistence
    deleteReceivedFile(fileId);
    deleteSentFile(roomId, fileId);
  }, [roomId]);

  return { transfers, sendFile, handleBinaryMessage, clearTransfer };
}
