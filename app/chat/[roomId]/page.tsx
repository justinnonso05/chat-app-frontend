"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useFileTransfer, type FileTransferState } from '@/hooks/useFileTransfer';
import { FileDropZone } from '@/components/FileDropZone';
import { FileMessage } from '@/components/FileMessage';

// --- Icon helpers ---
const Icon = {
  menu: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>,
  close: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>,
  info: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>,
  logout: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>,
  plus: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>,
  send: <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>,
  copy: <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>,
  network: <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="3" /><circle cx="5" cy="19" r="3" /><circle cx="19" cy="19" r="3" /><path d="M12 8v5m-4.2 3.2L12 13m4.2 3.2L12 13" /></svg>,
  attach: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>,
};

const avatarColors: Record<string, string> = {};
const palette = ["bg-blue-500", "bg-violet-500", "bg-rose-500", "bg-amber-500", "bg-emerald-500", "bg-sky-500", "bg-pink-500", "bg-indigo-500"];
function avatarColor(name: string): string {
  if (!avatarColors[name]) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h += name.charCodeAt(i);
    avatarColors[name] = palette[h % palette.length];
  }
  return avatarColors[name];
}

const HEADER_H = "h-[64px]";

export default function ChatDashboard() {
  const params = useParams();
  const roomId = Array.isArray(params.roomId) ? params.roomId[0] : (params.roomId ?? "");
  const router = useRouter();

  const [displayName, setDisplayName] = useState("Anonymous Peer");
  const [deviceId, setDeviceId] = useState("");
  const [text, setText] = useState("");
  const [savedRooms, setSavedRooms] = useState<{ roomId: string }[]>([]);
  const [copied, setCopied] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const [roomRole, setRoomRole] = useState<"host" | "member">("member");

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const name = localStorage.getItem("displayName");
    const id = localStorage.getItem("deviceId");
    if (!name || !id) { router.push("/"); return; }
    setDisplayName(name);
    setDeviceId(id);

    const rooms = JSON.parse(localStorage.getItem("savedRooms") || "{}");
    const list = Object.values(rooms)
      .sort((a: any, b: any) => b.lastAccessed - a.lastAccessed)
      .map((r: any) => ({ roomId: r.roomId }));
    setSavedRooms(list);

    const role = sessionStorage.getItem("roomRole") as "host" | "member" | null;
    setRoomRole(role ?? "member");

    setIsDark(document.documentElement.classList.contains("dark"));
    const obs = new MutationObserver(() => setIsDark(document.documentElement.classList.contains("dark")));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, [router, roomId]);

  // useFileTransfer needs to be declared before useWebRTC so handleBinaryMessage ref is stable
  const onFileReceived = useCallback((_transfer: FileTransferState) => { }, []);

  // Temporary stable ref so we can pass it to useWebRTC before useFileTransfer is called
  const binaryHandlerRef = useRef<(data: ArrayBuffer, peerId: string, peerName: string) => void>(() => { });

  const { messages, sendMessage, peers, isConnected, error, channelRef } = useWebRTC(
    roomId, deviceId, displayName,
    (data, peerId, peerName) => binaryHandlerRef.current(data, peerId, peerName)
  );

  const { transfers, sendFile, handleBinaryMessage, clearTransfer } = useFileTransfer(
    channelRef, deviceId, displayName, roomId, onFileReceived
  );

  // Wire the real handler after both hooks are initialized
  binaryHandlerRef.current = handleBinaryMessage;

  // Stage files for preview before sending
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const stageFiles = useCallback((files: File[]) => {
    setPendingFiles(prev => [...prev, ...files]);
  }, []);

  const sendPendingFiles = useCallback(() => {
    pendingFiles.forEach(f => sendFile(f));
    setPendingFiles([]);
  }, [pendingFiles, sendFile]);

  const removePending = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const activeTransfers = transfers.filter(t => !t.done);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, transfers]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) { sendMessage(text.trim()); setText(""); }
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const sidebarBase =
    "absolute inset-y-0 z-30 flex flex-col border-r border-[var(--panel-border)] w-72 xl:w-64 transition-transform duration-300 ease-in-out xl:relative xl:translate-x-0 xl:z-0 h-full";

  return (
    <div className="h-[100dvh] w-full flex overflow-hidden text-foreground relative">

      {/* Fixed wallpaper layer */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed", inset: 0, zIndex: -1,
          backgroundImage: `url(/${isDark ? "dark" : "light"}.jpg)`,
          backgroundSize: "cover", backgroundPosition: "center",
          backgroundRepeat: "no-repeat", filter: "brightness(0.9)",
        }}
      />
      <div aria-hidden="true" className="fixed inset-0 z-0 pointer-events-none bg-background/88 dark:bg-background/90" />

      {/* Mobile tap-away */}
      {(showLeft || showRight) && (
        <div
          className="xl:hidden absolute inset-0 z-20 bg-black/40"
          onClick={() => { setShowLeft(false); setShowRight(false); }}
        />
      )}

      {/* ── LEFT SIDEBAR ── */}
      <aside
        className={`${sidebarBase} left-0 ${showLeft ? "translate-x-0" : "-translate-x-full"}`}
        style={{ backgroundColor: isDark ? "#18181b" : "#ffffff", backdropFilter: "none", WebkitBackdropFilter: "none" }}
      >
        <div className={`${HEADER_H} flex items-center justify-between px-5 border-b border-[var(--glass-border)] shrink-0`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 ${avatarColor(displayName)}`}>
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate leading-tight">{displayName}</p>
              <p className="text-[11px] text-text-muted leading-tight">Local Device</p>
            </div>
          </div>
          <button onClick={() => setShowLeft(false)} className="xl:hidden text-text-muted hover:text-foreground p-1.5 rounded-lg transition-colors">
            {Icon.close}
          </button>
        </div>

        <div className="px-4 py-3 border-b border-[var(--glass-border)] shrink-0">
          <button
            onClick={() => router.push("/")}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-colors border border-primary/15"
          >
            {Icon.plus} Create / Join Network
          </button>
        </div>

        <div className="flex-1 overflow-y-auto thin-scrollbar px-3 py-3 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted px-2 pb-2">Saved Networks</p>
          {savedRooms.map(r => (
            <button
              key={r.roomId}
              onClick={() => { setShowLeft(false); if (r.roomId !== roomId) router.push(`/chat/${r.roomId}`); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${r.roomId === roomId
                ? "bg-primary/12 border border-primary/20 text-primary"
                : "hover:bg-secondary text-foreground border border-transparent"}`}
            >
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm ${r.roomId === roomId ? "bg-primary/15 text-primary" : "bg-secondary text-text-muted"}`}>
                {Icon.network}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate leading-tight">{r.roomId}</p>
                <p className="text-[10px] text-text-muted truncate">P2P Bridge</p>
              </div>
            </button>
          ))}
          {savedRooms.length === 0 && (
            <p className="text-[13px] text-text-muted text-center py-8">No saved rooms yet</p>
          )}
        </div>

        <div className="px-4 py-3 border-t border-[var(--glass-border)] shrink-0">
          <ThemeToggle />
        </div>
      </aside>

      {/* ── MAIN CHAT ── */}
      <main
        className="flex-1 min-w-0 relative z-10"
        style={{ display: "grid", gridTemplateRows: "auto 1fr auto auto", height: "100dvh" }}
      >
        {/* Header */}
        <div
          className={`${HEADER_H} shrink-0 border-b border-white/10 dark:border-white/5 flex items-center justify-between px-4 gap-3 relative z-10`}
          style={{ background: "var(--chat-header-glass)", backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)" }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => setShowLeft(true)} className="xl:hidden text-text-muted hover:text-foreground p-2 rounded-xl hover:bg-secondary transition-colors shrink-0">
              {Icon.menu}
            </button>
            <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
              {String(roomId).charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate leading-tight">{roomId}</p>
              <p className="text-[11px] text-text-muted flex items-center gap-1.5 leading-tight mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isConnected ? "bg-success" : "bg-warning animate-pulse"}`} />
                {isConnected ? "Bridge Active" : peers.length > 0 ? "Connecting..." : "Waiting for peers"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => router.push("/")}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-error text-sm font-medium hover:bg-error/10 border border-error/15 transition-colors"
            >
              {Icon.logout} Leave
            </button>
            <button onClick={() => setShowRight(true)} className="xl:hidden text-text-muted hover:text-foreground p-2 rounded-xl hover:bg-secondary transition-colors">
              {Icon.info}
            </button>
          </div>
        </div>

        {/* Messages */}
        <FileDropZone onFiles={stageFiles} disabled={!isConnected}>
          <div className="overflow-y-auto overflow-x-hidden no-scrollbar px-4 md:px-8 py-6 space-y-3 relative z-10 h-full">
            <div className="flex justify-center mb-4">
              <span className="text-[11px] px-3 py-1 rounded-full glass border border-[var(--glass-border)] text-text-muted">
                End-to-End Encrypted · Saved locally
              </span>
            </div>

            {error && (
              <div className="flex justify-center">
                <span className="text-[12px] px-4 py-1.5 rounded-full bg-error/10 border border-error/20 text-error">{error}</span>
              </div>
            )}

            {messages.map((msg, i) => {
              const isMe = msg.senderId === deviceId;
              const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              return isMe ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[75%] sm:max-w-[60%]">
                    <div className="flex items-center justify-end gap-1.5 mb-1 pr-1">
                      <span className="text-[10px] text-text-muted">{time}</span>
                    </div>
                    <div className="bg-primary text-white px-4 py-2.5 rounded-2xl rounded-br-md text-sm leading-relaxed shadow-sm">
                      {msg.text}
                    </div>
                  </div>
                </div>
              ) : (
                <div key={i} className="flex items-end gap-2 max-w-[75%] sm:max-w-[60%]">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 ${avatarColor(msg.senderName)}`}>
                    {msg.senderName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1 pl-1">
                      <span className="text-[11px] font-semibold text-foreground">{msg.senderName}</span>
                      <span className="text-[10px] text-text-muted">{time}</span>
                    </div>
                    <div className="px-4 py-2.5 rounded-2xl rounded-bl-md text-sm leading-relaxed text-foreground border border-white/20 dark:border-white/8"
                      style={{ background: "var(--bubble-glass)", backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
                    >
                      {msg.text}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* File transfer messages */}
            {transfers.map(t => (
              <FileMessage key={t.fileId} transfer={t} isMe={t.direction === "sending"} onDismiss={clearTransfer} />
            ))}

            <div ref={bottomRef} />
          </div>
        </FileDropZone>

        {/* Active transfer progress strip */}
        {activeTransfers.length > 0 && (
          <div className="px-4 md:px-8 py-2 relative z-10 border-t border-white/5"
            style={{ background: "var(--chat-header-glass)", backdropFilter: "blur(20px)" }}
          >
            {activeTransfers.map(t => (
              <div key={t.fileId} className="flex items-center gap-3 py-0.5">
                <span className="text-[11px] text-text-muted shrink-0 max-w-[140px] truncate">{t.fileName}</span>
                <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-150" style={{ width: `${Math.round(t.progress * 100)}%` }} />
                </div>
                <span className="text-[10px] text-text-muted shrink-0">
                  {Math.round(t.progress * 100)}%
                  {t.speedBps > 0 && ` · ${t.speedBps >= 1048576 ? `${(t.speedBps / 1048576).toFixed(1)} MB/s` : `${(t.speedBps / 1024).toFixed(0)} KB/s`}`}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Input */}
        <div
          className="shrink-0 px-4 md:px-8 py-4 border-t border-white/10 dark:border-white/5 relative z-10"
          style={{ background: "var(--chat-header-glass)", backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)" }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => { if (e.target.files) stageFiles(Array.from(e.target.files)); e.target.value = ""; }}
          />

          {/* File preview tray */}
          {pendingFiles.length > 0 && (
            <div className="mb-3 max-w-4xl mx-auto">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-medium text-text-muted">{pendingFiles.length} file{pendingFiles.length > 1 ? "s" : ""} ready to send</span>
                <button type="button" onClick={() => setPendingFiles([])} className="text-[11px] text-error hover:underline ml-auto">Clear all</button>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {pendingFiles.map((f, i) => {
                  const isImg = f.type.startsWith("image/");
                  const sizeStr = f.size < 1048576 ? `${(f.size / 1024).toFixed(0)} KB` : `${(f.size / 1048576).toFixed(1)} MB`;
                  return (
                    <div key={i} className="relative flex items-center gap-2 bg-secondary/80 border border-[var(--glass-border)] rounded-xl px-3 py-2 max-w-[200px]">
                      {isImg
                        ? <img src={URL.createObjectURL(f)} alt={f.name} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                        : <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">{Icon.attach}</div>
                      }
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium truncate leading-tight">{f.name}</p>
                        <p className="text-[10px] text-text-muted">{sizeStr}</p>
                      </div>
                      <button type="button" onClick={() => removePending(i)} className="w-4 h-4 rounded-full bg-error/20 text-error flex items-center justify-center shrink-0 hover:bg-error/40 transition-colors" title="Remove">
                        <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={sendPendingFiles}
                disabled={!isConnected}
                className="w-full py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                Send {pendingFiles.length} file{pendingFiles.length > 1 ? "s" : ""}
              </button>
            </div>
          )}

          <form onSubmit={handleSend} className="flex items-center gap-2 max-w-4xl mx-auto">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!isConnected}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-text-muted hover:text-foreground hover:bg-secondary disabled:opacity-40 disabled:pointer-events-none transition-colors shrink-0"
              title="Send file"
            >
              {Icon.attach}
            </button>
            <div className="flex-1 flex items-center gap-2 bg-secondary/70 border border-[var(--glass-border)] rounded-2xl px-4 py-2.5 focus-within:border-primary/40 transition-all">
              <input
                type="text"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={isConnected ? "Message..." : peers.length > 0 ? "Connecting..." : "Waiting for peer..."}
                className="flex-1 bg-transparent border-none focus:outline-none text-sm text-foreground placeholder:text-text-muted"
              />
            </div>
            <button
              type="submit"
              disabled={!text.trim() || !isConnected}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary text-white hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none transition-colors shadow-sm shrink-0"
            >
              {Icon.send}
            </button>
          </form>
        </div>
      </main>

      {/* ── RIGHT SIDEBAR ── */}
      <aside
        className={`${sidebarBase.replace("border-r", "border-l")} right-0 left-auto ${showRight ? "translate-x-0" : "translate-x-full"}`}
        style={{ backgroundColor: isDark ? "#18181b" : "#ffffff", backdropFilter: "none", WebkitBackdropFilter: "none" }}
      >
        <div className={`${HEADER_H} flex items-center justify-between px-5 border-b border-[var(--glass-border)] shrink-0`}>
          <p className="font-semibold text-sm">Network Setup</p>
          <button onClick={() => setShowRight(false)} className="xl:hidden text-text-muted hover:text-foreground p-1.5 rounded-lg transition-colors">
            {Icon.close}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto thin-scrollbar px-4 py-5 space-y-6">
          {/* Access Key */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted mb-3">Access Key</p>
            <div className="bg-secondary/60 rounded-2xl border border-[var(--glass-border)] p-4 text-center">
              <p className="font-mono font-bold text-primary text-2xl tracking-widest mb-3">{roomId}</p>
              <button
                onClick={copyRoomId}
                className="inline-flex items-center gap-1.5 text-xs text-foreground bg-panel-bg hover:bg-secondary px-3 py-1.5 rounded-lg transition-colors border border-[var(--glass-border)]"
              >
                {Icon.copy} {copied ? "Copied!" : "Copy Code"}
              </button>
            </div>
          </section>

          {/* Members */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">Members</p>
              <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/15">{peers.length + 1} / 3</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-primary/6 border border-primary/10">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 ${avatarColor(displayName)}`}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{displayName}</p>
                  <p className="text-[10px] text-text-muted">{roomRole === "host" ? "You · Host" : "You · Member"}</p>
                </div>
              </div>
              {peers.map(peer => (
                <div key={peer.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary transition-colors">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 ${avatarColor(peer.name)} ${!peer.isConnected && "opacity-50"}`}>
                    {peer.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{peer.name}</p>
                    <p className={`text-[10px] font-medium ${peer.isConnected ? "text-success" : "text-warning"}`}>
                      {peer.isConnected ? "Connected" : "Connecting..."}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Device Settings */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted mb-3">Device Settings</p>
            <div className="bg-secondary/60 rounded-2xl border border-[var(--glass-border)] divide-y divide-[var(--glass-border)]">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-foreground">Max Capacity</span>
                <span className="text-xs font-mono text-text-muted">3 (Fixed)</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-foreground">Storage Mode</span>
                <span className="text-xs text-text-muted">Local Device</span>
              </div>
            </div>
          </section>

          {/* Leave */}
          <button
            onClick={() => router.push("/")}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-error text-sm font-medium border border-error/15 hover:bg-error/8 transition-colors"
          >
            {Icon.logout} Disconnect &amp; Leave
          </button>
        </div>
      </aside>
    </div>
  );
}
