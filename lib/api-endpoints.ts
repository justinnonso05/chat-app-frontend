export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const API_ENDPOINTS = {
  signaling: {
    roomStatus: (roomId: string) => `${API_BASE_URL}/room/${roomId}`,
    wsUrl: (roomId: string) =>
      `${API_BASE_URL.replace("http", "ws")}/ws/${roomId}`
  }
};
