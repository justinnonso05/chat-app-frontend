const rawBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Auto-upgrade to secure variants when page is served over HTTPS
// This prevents "mixed content" browser blocks (ws:// from https:// is blocked)
const isSecure =
  typeof window !== "undefined"
    ? window.location.protocol === "https:"
    : rawBase.startsWith("https");

export const API_BASE_URL = isSecure
  ? rawBase.replace(/^http:\/\//, "https://")
  : rawBase;

const wsBase = isSecure
  ? rawBase.replace(/^https?:\/\//, "wss://")
  : rawBase.replace(/^https?:\/\//, "ws://");

export const API_ENDPOINTS = {
  signaling: {
    roomStatus: (roomId: string) => `${API_BASE_URL}/room/${roomId}`,
    wsUrl: (roomId: string) => `${wsBase}/ws/${roomId}`,
  },
};
