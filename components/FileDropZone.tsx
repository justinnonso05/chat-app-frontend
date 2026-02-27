"use client";

import React, { useRef, useState } from "react";

interface FileDropZoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export function FileDropZone({ onFiles, disabled, children }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.items.length > 0) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(files);
  };

  return (
    <div
      className="relative flex-1 flex flex-col min-h-0"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {/* Drop overlay */}
      {isDragging && !disabled && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-xl"
          style={{ background: "rgba(37,99,235,0.12)", border: "2px dashed rgba(37,99,235,0.5)" }}
        >
          <div className="flex flex-col items-center gap-3 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" x2="12" y1="3" y2="15" />
            </svg>
            <p className="font-semibold text-primary text-base">Drop files to send</p>
            <p className="text-xs text-text-muted">Any file type — sent directly peer to peer</p>
          </div>
        </div>
      )}
    </div>
  );
}
