"use client";

import React from "react";
import type { FileTransferState } from "@/hooks/useFileTransfer";

// Same palette as chat page for consistent avatar colours
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

const FILE_ICONS: Record<string, React.ReactElement> = {
  image: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
  ),
  video: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8z" /><rect width="14" height="12" x="2" y="6" rx="2" /></svg>
  ),
  audio: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
  ),
  default: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>
  ),
};

function getIcon(fileType: string) {
  if (fileType.startsWith("image/")) return FILE_ICONS.image;
  if (fileType.startsWith("video/")) return FILE_ICONS.video;
  if (fileType.startsWith("audio/")) return FILE_ICONS.audio;
  return FILE_ICONS.default;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatSpeed(bps: number) {
  if (bps < 1024) return `${Math.round(bps)} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
}

interface FileMessageProps {
  transfer: FileTransferState;
  isMe: boolean;
  onDismiss?: (fileId: string) => void;
}

export function FileMessage({ transfer, isMe, onDismiss }: FileMessageProps) {
  const { fileId, fileName, fileSize, fileType, progress, speedBps, direction, done, blobUrl, senderName } = transfer;
  const name = senderName ?? (isMe ? "You" : "Peer");
  const isImage = fileType.startsWith("image/") && done && blobUrl;

  const FileBubble = (
    <>
      {isImage ? (
        <div className="relative w-fit max-w-full rounded-2xl overflow-hidden shadow-md border border-white/10">
          <img src={blobUrl} alt={fileName} className="max-w-full max-h-64 object-cover block" />
          <a
            href={blobUrl}
            download={fileName}
            className="absolute bottom-2 right-2 bg-black/60 text-white text-[11px] px-2.5 py-1 rounded-full backdrop-blur-md hover:bg-black/80 transition-colors"
          >
            Save
          </a>
        </div>
      ) : (
        <div
          className="w-fit max-w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-foreground border shadow-sm"
          style={
            isMe
              ? { background: "rgba(37,99,235,0.15)", borderColor: "rgba(37,99,235,0.25)" }
              : { background: "var(--bubble-glass)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderColor: "rgba(255,255,255,0.15)" }
          }
        >
          {/* File type icon */}
          <div className="w-10 h-10 rounded-xl bg-secondary/60 flex items-center justify-center text-primary shrink-0">
            {getIcon(fileType)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate leading-tight">{fileName}</p>
            <p className="text-[11px] text-text-muted mt-0.5">
              {formatBytes(fileSize)}
              {!done && speedBps > 0 && ` · ${formatSpeed(speedBps)}`}
              {done && direction === "receiving" ? " · Received" : done ? " · Sent" : ""}
            </p>
            {!done && (
              <div className="mt-2 h-1 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-150"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            )}
          </div>

          {/* Download button */}
          {done && blobUrl && direction === "receiving" && (
            <a
              href={blobUrl}
              download={fileName}
              className="w-9 h-9 rounded-xl bg-primary/10 hover:bg-primary/20 flex items-center justify-center text-primary transition-colors shrink-0"
              title="Download"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
            </a>
          )}

          {!done && (
            <div className="text-[11px] font-semibold text-primary shrink-0 min-w-[36px] text-right">
              {Math.round(progress * 100)}%
            </div>
          )}
        </div>
      )}
    </>
  );

  if (isMe) {
    // Sent — align right, no avatar (matches chat bubble "me" style)
    return (
      <div className="flex justify-end w-full">
        <div className="max-w-[80%] sm:max-w-[60%]">
          <div className="flex items-center justify-end gap-1.5 mb-1 pr-1">
            <span className="text-[10px] text-text-muted">You</span>
          </div>
          {FileBubble}
        </div>
      </div>
    );
  }

  // Received — show avatar + name (matches chat bubble "peer" style)
  return (
    <div className="flex items-end gap-2 max-w-[80%] sm:max-w-[60%]">
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 ${avatarColor(name)}`}>
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1 pl-1">
          <span className="text-[11px] font-semibold text-foreground">{name}</span>
          <span className="text-[10px] text-text-muted">File</span>
        </div>
        {FileBubble}
      </div>
    </div>
  );
}
