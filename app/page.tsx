"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { API_ENDPOINTS } from "@/lib/api-endpoints";

export default function Home() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleJoinOrCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setError("");
    setLoading(true);

    // Save anonymous display name & create UUID for this session
    localStorage.setItem("displayName", displayName.trim());
    if (!localStorage.getItem("deviceId")) {
      localStorage.setItem("deviceId", crypto.randomUUID());
    }

    const roomToJoin = roomId.trim() ? roomId.trim().toUpperCase() : Math.random().toString(36).substring(2, 8).toUpperCase();

    // If attempting to join an existing room, check if it's full FIRST
    if (roomId.trim()) {
      try {
        const res = await fetch(API_ENDPOINTS.signaling.roomStatus(roomToJoin));
        if (res.ok) {
          const data = await res.json();
          if (data.is_full) {
            setError(`Room ${roomToJoin} is full (3/3). Please create a new one.`);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn("Status fetch failed - continuing natively", err);
        // If the fetch fails because backend isn't up, just let the WebSocket timeout handle it gracefully
      }
    }

    router.push(`/chat/${roomToJoin}`);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 flex-col">
      <div className="w-full max-w-md bg-panel-bg border border-panel-border rounded-2xl shadow-sm p-8 flex flex-col items-center z-10">

        <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2 text-center">Local File Share & Chat</h1>
        <p className="text-sm text-text-muted mb-6 text-center px-4">Zero-download, completely anonymous transfer hub over your local Wi-Fi router.</p>

        {error && (
          <div className="w-full p-4 mb-6 bg-error/10 border border-error/20 rounded-xl text-center">
            <p className="text-sm text-error font-medium">{error}</p>
          </div>
        )}

        <form className="w-full space-y-4" onSubmit={handleJoinOrCreate}>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Display Name (Visible to peers)</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="E.g., MacBook Pro"
              className="w-full bg-secondary border border-transparent focus:border-primary focus:bg-background rounded-xl px-4 py-3 text-sm text-foreground outline-none transition-all"
            />
          </div>

          <div className="space-y-1 pt-2">
            <label className="text-sm font-medium text-foreground">Room ID (Optional)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                placeholder="Leave blank to create a new room"
                className="w-full bg-secondary border border-transparent focus:border-primary focus:bg-background rounded-xl px-4 py-3 text-sm text-foreground outline-none transition-all uppercase"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl px-4 py-3 mt-6 transition-colors shadow-sm flex justify-center items-center gap-2 disabled:opacity-75"
          >
            {loading ? "Connecting..." : (roomId.trim() ? "Join Room" : "Create New Room")}
            {!loading && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>}
          </button>
        </form>

      </div>
    </div>
  );
}
