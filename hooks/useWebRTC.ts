import { useEffect, useRef, useState, useCallback } from 'react';
import { API_ENDPOINTS } from '@/lib/api-endpoints';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    // STUN — fast path for same-NAT pairs
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },

    // OpenRelay TURN — UDP + TCP + TLS (crosses most carrier NATs)
    { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turns:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },

    // Metered.ca free TURN (different pool from openrelay)
    { urls: "turn:a.relay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:a.relay.metered.ca:80?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turn:a.relay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
    { urls: "turns:a.relay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
  ],
  // Gather all candidates before connecting — improves cross-NAT success rate
  iceCandidatePoolSize: 10,
};

export type MessageInfo = {
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
};

export type PeerInfo = {
  id: string;
  name: string;
  isConnected: boolean;
};

export function useWebRTC(
  roomId: string,
  deviceId: string,
  displayName: string,
  onBinaryMessage?: (data: ArrayBuffer, peerId: string, peerName: string) => void
) {
  const [messages, setMessages] = useState<MessageInfo[]>([]);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<{ [peerId: string]: RTCPeerConnection }>({});
  const channelRef = useRef<{ [peerId: string]: RTCDataChannel }>({});
  const onBinaryMessageRef = useRef(onBinaryMessage);
  onBinaryMessageRef.current = onBinaryMessage;

  // Track remote description status to prevent ICE candidate race conditions
  const isRemoteDescSet = useRef<{ [peerId: string]: boolean }>({});
  const pendingCandidates = useRef<{ [peerId: string]: RTCIceCandidateInit[] }>({});

  // Track peer names for binary message attribution
  const peerNames = useRef<{ [peerId: string]: string }>({});

  // Initialize saved messages and save room to local storage
  useEffect(() => {
    if (typeof window !== 'undefined' && roomId && deviceId && displayName) {
      const savedRooms = JSON.parse(localStorage.getItem('savedRooms') || '{}');
      if (!savedRooms[roomId]) {
        savedRooms[roomId] = { roomId, name: roomId, messages: [], lastAccessed: Date.now() };
      }
      if (savedRooms[roomId].messages && savedRooms[roomId].messages.length > 0) {
        setMessages(savedRooms[roomId].messages);
      }
      savedRooms[roomId].lastAccessed = Date.now();
      localStorage.setItem('savedRooms', JSON.stringify(savedRooms));
    }
  }, [roomId, deviceId, displayName]);

  const sendSignaling = (data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  };

  const updatePeerStatus = (peerId: string, peerName: string, isConnected: boolean) => {
    peerNames.current[peerId] = peerName;
    setPeers(prev => {
      const exists = prev.find(p => p.id === peerId);
      if (exists) {
        return prev.map(p => p.id === peerId ? { ...p, isConnected, name: peerName || p.name } : p);
      }
      return [...prev, { id: peerId, name: peerName, isConnected }];
    });
  };

  const persistMessage = (msgData: MessageInfo) => {
    setMessages((prev) => {
      const newMessages = [...prev, msgData];
      if (typeof window !== 'undefined' && roomId) {
        const savedRooms = JSON.parse(localStorage.getItem('savedRooms') || '{}');
        if (savedRooms[roomId]) {
          savedRooms[roomId].messages = newMessages;
          savedRooms[roomId].lastAccessed = Date.now();
          localStorage.setItem('savedRooms', JSON.stringify(savedRooms));
        }
      }
      return newMessages;
    });
  };

  const setupChannel = (channel: RTCDataChannel, peerId: string, peerName: string) => {
    channel.binaryType = 'arraybuffer';

    channel.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        onBinaryMessageRef.current?.(e.data, peerId, peerNames.current[peerId] ?? peerName);
      } else {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'chat') {
            updatePeerStatus(peerId, peerName, true);
            persistMessage(msg.data);
          }
        } catch {
          console.warn('Received non-JSON text data', e.data);
        }
      }
    };
  };

  const flushPendingCandidates = async (peerId: string, pc: RTCPeerConnection) => {
    if (pendingCandidates.current[peerId] && pendingCandidates.current[peerId].length > 0) {
      for (const candidate of pendingCandidates.current[peerId]) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding pending ice candidate', e);
        }
      }
      pendingCandidates.current[peerId] = [];
    }
  };

  const createPeerConnection = (peerId: string, peerName: string, isInitiator: boolean) => {
    if (pcRef.current[peerId]) {
      pcRef.current[peerId].close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current[peerId] = pc;
    isRemoteDescSet.current[peerId] = false;
    pendingCandidates.current[peerId] = [];

    updatePeerStatus(peerId, peerName, false);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignaling({
          type: 'candidate',
          candidate: event.candidate,
          targetId: peerId,
          senderId: deviceId,
          senderName: displayName,
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === 'failed') {
        // Restart ICE instead of requiring a full page refresh
        console.log(`[WebRTC] ICE failed for ${peerId}, restarting ICE...`);
        pc.restartIce();
      } else if (state === 'disconnected' || state === 'closed') {
        updatePeerStatus(peerId, peerName, false);
      } else if (state === 'connected' || state === 'completed') {
        updatePeerStatus(peerId, peerName, true);
      }
    };

    if (isInitiator) {
      const channel = pc.createDataChannel('chat');
      channelRef.current[peerId] = channel;
      channel.onopen = () => updatePeerStatus(peerId, peerName, true);
      channel.onclose = () => updatePeerStatus(peerId, peerName, false);
      setupChannel(channel, peerId, peerName);
    } else {
      pc.ondatachannel = (event) => {
        const channel = event.channel;
        channelRef.current[peerId] = channel;
        if (channel.readyState === 'open') {
          updatePeerStatus(peerId, peerName, true);
        } else {
          channel.onopen = () => updatePeerStatus(peerId, peerName, true);
        }
        channel.onclose = () => updatePeerStatus(peerId, peerName, false);
        setupChannel(channel, peerId, peerName);
      };
    }

    return pc;
  };

  useEffect(() => {
    if (!roomId || !deviceId || !displayName) return;

    const ws = new WebSocket(API_ENDPOINTS.signaling.wsUrl(roomId));
    wsRef.current = ws;

    ws.onopen = () => {
      sendSignaling({ type: 'join', senderId: deviceId, senderName: displayName });
      // Re-announce after 3s — picks up peers who joined just before us and missed our initial message
      setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          sendSignaling({ type: 'join', senderId: deviceId, senderName: displayName });
        }
      }, 3000);
    };

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'join' && data.senderId !== deviceId) {
        const existingPc = pcRef.current[data.senderId];
        const alreadyConnected = existingPc &&
          (existingPc.iceConnectionState === 'connected' || existingPc.iceConnectionState === 'completed');

        if (!alreadyConnected) {
          // New peer or a peer whose connection failed — (re-)initiate
          const pc = createPeerConnection(data.senderId, data.senderName, true);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignaling({
            type: 'offer',
            offer: pc.localDescription,
            targetId: data.senderId,
            senderId: deviceId,
            senderName: displayName,
          });
        }
      }

      if (data.targetId && data.targetId !== deviceId) return;

      if (data.type === 'offer') {
        const pc = createPeerConnection(data.senderId, data.senderName, false);
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        isRemoteDescSet.current[data.senderId] = true;
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await flushPendingCandidates(data.senderId, pc);
        sendSignaling({
          type: 'answer',
          answer: pc.localDescription,
          targetId: data.senderId,
          senderId: deviceId,
          senderName: displayName,
        });
      }

      if (data.type === 'answer') {
        const pc = pcRef.current[data.senderId];
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          isRemoteDescSet.current[data.senderId] = true;
          await flushPendingCandidates(data.senderId, pc);
        }
      }

      if (data.type === 'candidate') {
        // ALWAYS queue first — PC or remote desc may not exist yet
        if (!pendingCandidates.current[data.senderId]) {
          pendingCandidates.current[data.senderId] = [];
        }
        const pc = pcRef.current[data.senderId];
        if (pc && isRemoteDescSet.current[data.senderId]) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (e) {
            console.error('[WebRTC] Error adding ice candidate', e);
          }
        } else {
          // PC not created yet or remote desc not set — will be flushed later
          pendingCandidates.current[data.senderId].push(data.candidate);
        }
      }
    };

    ws.onclose = (event) => {
      if (event.code === 1008) setError(event.reason);
    };

    return () => {
      ws?.close();
      Object.keys(pcRef.current).forEach(id => pcRef.current[id].close());
      pcRef.current = {};
      channelRef.current = {};
      setPeers([]);
    };
  }, [roomId, deviceId, displayName]);

  const sendMessage = useCallback((text: string) => {
    const msgData: MessageInfo = {
      senderId: deviceId,
      senderName: displayName,
      text,
      timestamp: new Date().toISOString(),
    };
    persistMessage(msgData);
    Object.values(channelRef.current).forEach(channel => {
      if (channel.readyState === 'open') {
        channel.send(JSON.stringify({ type: 'chat', data: msgData }));
      }
    });
  }, [deviceId, displayName]);

  const isConnected = peers.some(p => p.isConnected);

  return {
    messages,
    sendMessage,
    peers,
    isConnected,
    error,
    channelRef,
    pcRef,
  };
}
