"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useWebRTC } from '@/hooks/useWebRTC';

export default function ChatDashboard() {
  const { roomId } = useParams();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("Anonymous Peer");
  const [deviceId, setDeviceId] = useState("");
  const [text, setText] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const [showSidebar, setShowSidebar] = useState(false);

  // Initialize from LocalStorage defensively
  useEffect(() => {
    const name = localStorage.getItem("displayName");
    const id = localStorage.getItem("deviceId");

    if (!name || !id) {
      router.push("/");
      return;
    }
    setDisplayName(name);
    setDeviceId(id);
  }, [router]);

  // Pass properly sanitized IDs to WebRTC engine
  const { messages, sendMessage, peers, isConnected, error } = useWebRTC(roomId as string, deviceId, displayName);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      sendMessage(text);
      setText("");
    }
  };

  return (
    <div className="h-screen w-full flex p-0 md:p-4 lg:p-6 gap-0 md:gap-4 lg:gap-6 bg-background relative overflow-hidden">
      
      {/* Mobile Sidebar Overlay */}
      {showSidebar && (
        <div 
          className="absolute inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside className={`absolute md:static z-30 inset-y-0 left-0 w-80 bg-panel-bg md:border border-panel-border md:rounded-2xl shadow-xl md:shadow-sm flex flex-col transition-transform duration-300 ${showSidebar ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 h-full`}>

        {/* Profile Header */}
        <div className="p-4 border-b border-panel-border flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-200 flex items-center justify-center font-bold text-orange-600 shrink-0">
              {displayName.charAt(0).toUpperCase() || "A"}
            </div>
            <div className="overflow-hidden">
              <h3 className="font-medium text-foreground truncate">{displayName}</h3>
              <p className="text-xs text-text-muted">You (Local Device)</p>
            </div>
          </div>
          <button onClick={() => setShowSidebar(false)} className="md:hidden p-2 text-text-muted hover:text-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        {/* QR Code / Share Room Info */}
        <div className="p-4 border-b border-panel-border bg-accent/50">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Connect Peers</p>
          <div className="flex bg-panel-bg p-3 rounded-xl border border-panel-border items-center justify-between">
            <div>
              <span className="text-xs text-text-muted">Room Code:</span>
              <p className="font-mono font-bold text-primary tracking-widest text-lg">{roomId}</p>
            </div>
            <button className="h-10 w-10 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground flex justify-center items-center rounded-lg transition-colors" title="Show QR Code">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="5" height="5" x="3" y="3" rx="1" /><rect width="5" height="5" x="16" y="3" rx="1" /><rect width="5" height="5" x="3" y="16" rx="1" /><path d="M21 16h-3a2 2 0 0 0-2 2v3" /><path d="M21 21v.01" /><path d="M12 7v3a2 2 0 0 1-2 2H7" /><path d="M3 12h.01" /><path d="M12 3h.01" /><path d="M12 16v.01" /><path d="M16 12h1" /><path d="M21 12v.01" /><path d="M12 21v-1" /></svg>
            </button>
          </div>
        </div>

        {/* Connected Mesh Peers list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Local Mesh Network</h4>
            <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full font-medium">{peers.length + 1} / 3 connected</span>
          </div>

          {peers.length === 0 && !error ? (
            <div className="flex items-center gap-3 p-2 -mx-2 rounded-lg opacity-50">
              <div className="w-10 h-10 rounded-full border border-dashed border-panel-border flex items-center justify-center">
                <span className="w-2 h-2 rounded-full animate-pulse bg-text-muted"></span>
              </div>
              <div className="flex-1 min-w-0">
                <h5 className="font-medium text-sm text-foreground truncate">Waiting for peers to join...</h5>
              </div>
            </div>
          ) : (
            peers.map(peer => (
              <div key={peer.id} className="flex items-center gap-3 p-2 -mx-2 rounded-lg transition-colors bg-secondary/30">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-indigo-700 bg-indigo-200 shadow-sm border-2 ${peer.isConnected ? 'border-success' : 'border-dashed border-panel-border opacity-50'}`}>
                  {peer.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="font-medium text-sm text-foreground truncate">{peer.name}</h5>
                  <p className={`text-xs ${peer.isConnected ? 'text-success' : 'text-text-muted'}`}>
                    {peer.isConnected ? 'Connected via P2P' : 'Negotiating bridge...'}
                  </p>
                </div>
              </div>
            ))
          )}

          {error && (
            <div className="p-3 bg-error/10 border border-error/20 rounded-lg">
              <p className="text-xs text-error font-medium">{error}</p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 bg-panel-bg md:border border-panel-border md:rounded-2xl shadow-sm flex flex-col overflow-hidden h-full">
        <header className="p-3 md:p-4 border-b border-panel-border flex justify-between items-center bg-panel-bg">
          <div className="flex items-center gap-2 md:gap-3">
            <button onClick={() => setShowSidebar(true)} className="md:hidden p-2 text-text-muted hover:text-foreground">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
            </button>
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><path d="M8 13h2" /><path d="M8 17h2" /><path d="M14 13h2" /><path d="M14 17h2" /></svg>
            </div>
            <div className="overflow-hidden">
              <h2 className="font-semibold text-foreground text-sm md:text-base truncate">Local Room: {roomId}</h2>
              <p className="text-[10px] md:text-xs text-text-muted truncate">Direct P2P Encrypted Channel</p>
            </div>
          </div>
          <div className="flex gap-2 md:gap-4 text-text-muted items-center shrink-0">
            <ThemeToggle />
          </div>
        </header>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex justify-center w-full my-4">
            <span className="text-xs px-4 py-1.5 bg-secondary text-text-muted rounded-full">
              End-to-End Encrypted. Messages are strictly bound to this browser window.
            </span>
          </div>

          {messages.map((msg, index) => {
            const isMe = msg.senderId === deviceId;
            return isMe ? (
              <div key={index} className="flex justify-end w-full">
                <div className="max-w-[80%] lg:max-w-[70%]">
                  <div className="flex justify-end items-baseline gap-2 mb-1">
                    <span className="font-medium text-sm text-foreground">You</span>
                    <span className="text-xs text-text-muted">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="bg-primary text-primary-foreground p-4 rounded-2xl rounded-tr-none text-sm leading-relaxed shadow-sm">
                    {msg.text}
                  </div>
                </div>
              </div>
            ) : (
              <div key={index} className="flex gap-3 max-w-[80%]">
                <div className="w-8 h-8 rounded-full bg-indigo-200 shrink-0 mt-1 flex items-center justify-center font-bold text-indigo-700 text-xs">
                  {msg.senderName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-medium text-sm text-foreground">{msg.senderName}</span>
                    <span className="text-xs text-text-muted">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="bg-secondary text-secondary-foreground p-3 rounded-2xl rounded-tl-none text-sm shadow-sm border border-panel-border/50">
                    {msg.text}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Chat Input */}
        <form onSubmit={handleSend} className="p-4 border-t border-panel-border bg-panel-bg z-20">
          <div className="bg-secondary rounded-full h-12 flex items-center px-2 cursor-text focus-within:ring-2 focus-within:ring-primary focus-within:ring-opacity-50 transition-all">
            <button type="button" className="text-text-muted hover:bg-panel-bg hover:text-foreground hover:shadow-sm rounded-full transition-all p-2 m-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
            </button>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={isConnected ? "Send a message locally..." : (peers.length > 0 ? "Negotiating bridge..." : "Waiting for peer connection...")}
              disabled={!isConnected}
              className="flex-1 bg-transparent border-none focus:outline-none text-foreground px-2 text-sm max-w-full disabled:opacity-50"
            />
            <button type="submit" disabled={!text.trim() || !isConnected} className="text-primary p-2 m-1 hover:bg-panel-bg hover:shadow-sm rounded-full transition-all shrink-0 disabled:opacity-50 disabled:hover:bg-transparent">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
            </button>
          </div>
        </form>
      </main>

    </div>
  );
}
