export interface WebRTCMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'peer_left';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  senderId?: string;
}

export interface ChatMessage {
  id: string;
  senderName: string;
  senderId: string;
  content: string;
  timestamp: string;
  isSelf: boolean;
}

export interface FileChunk {
  fileName: string;
  chunkIndex: number;
  totalChunks: number;
  data: ArrayBuffer;
}
