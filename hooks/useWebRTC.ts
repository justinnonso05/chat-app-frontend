import { useEffect, useRef, useState, useCallback } from 'react';
import { API_ENDPOINTS } from '@/lib/api-endpoints';

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    // Free TURN relay fallback — kicks in when direct P2P is blocked by NAT/firewall
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
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

export function useWebRTC(roomId: string, deviceId: string, displayName: string) {
  const [messages, setMessages] = useState<MessageInfo[]>([]);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<{ [peerId: string]: RTCPeerConnection }>({});
  const channelRef = useRef<{ [peerId: string]: RTCDataChannel }>({});

  // Track remote description status to prevent ICE candidate race conditions
  const isRemoteDescSet = useRef<{ [peerId: string]: boolean }>({});
  const pendingCandidates = useRef<{ [peerId: string]: RTCIceCandidateInit[] }>({});

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
    setPeers(prev => {
      const exists = prev.find(p => p.id === peerId);
      if (exists) {
        return prev.map(p => p.id === peerId ? { ...p, isConnected, name: peerName || p.name } : p);
      }
      return [...prev, { id: peerId, name: peerName, isConnected }];
    });
  };

  const removePeer = (peerId: string) => {
    setPeers(prev => prev.filter(p => p.id !== peerId));
    if (pcRef.current[peerId]) {
      pcRef.current[peerId].close();
      delete pcRef.current[peerId];
    }
    if (channelRef.current[peerId]) {
      delete channelRef.current[peerId];
    }
  };

  // Helper to persist new messages
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

  const handleReceiveMessage = (event: MessageEvent, peerId: string, peerName: string) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'chat') {
        updatePeerStatus(peerId, peerName, true);
        persistMessage(msg.data);
      }
    } catch (e) {
      console.warn("Received non-JSON data from data channel", event.data);
    }
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
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        updatePeerStatus(peerId, peerName, false);
      } else if (pc.iceConnectionState === 'connected') {
        updatePeerStatus(peerId, peerName, true);
      }
    };

    if (isInitiator) {
      const channel = pc.createDataChannel('chat');
      channelRef.current[peerId] = channel;

      channel.onopen = () => updatePeerStatus(peerId, peerName, true);
      channel.onclose = () => updatePeerStatus(peerId, peerName, false);
      channel.onmessage = (e) => handleReceiveMessage(e, peerId, peerName);
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
        channel.onmessage = (e) => handleReceiveMessage(e, peerId, peerName);
      };
    }

    return pc;
  };

  useEffect(() => {
    if (!roomId || !deviceId || !displayName) return;

    const ws = new WebSocket(API_ENDPOINTS.signaling.wsUrl(roomId));
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to signaling server');
      sendSignaling({ type: 'join', senderId: deviceId, senderName: displayName });
    };

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'join' && data.senderId !== deviceId) {
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
        const pc = pcRef.current[data.senderId];
        if (pc) {
          if (isRemoteDescSet.current[data.senderId]) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (e) {
              console.error('Error adding received ice candidate', e);
            }
          } else {
            // Queue pending candidates until remote description is set
            if (!pendingCandidates.current[data.senderId]) {
              pendingCandidates.current[data.senderId] = [];
            }
            pendingCandidates.current[data.senderId].push(data.candidate);
          }
        }
      }

      if (data.type === 'peer_left') {
        // We handle dropouts mostly via ICE states, but a dedicated message helps cleanup
      }
    };

    ws.onclose = (event) => {
      if (event.code === 1008) {
        setError(event.reason);
      }
    }

    return () => {
      ws?.close();
      Object.keys(pcRef.current).forEach(id => {
        pcRef.current[id].close();
      });
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
      timestamp: new Date().toISOString()
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
  };
}
