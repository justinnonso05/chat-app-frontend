"use client";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      // Only show if not already installed (standalone) and not dismissed before
      const dismissed = sessionStorage.getItem("pwa-prompt-dismissed");
      if (!dismissed && !window.matchMedia("(display-mode: standalone)").matches) {
        setTimeout(() => setShow(true), 2000); // slight delay feels more natural
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!show || !prompt) return null;

  const handleInstall = async () => {
    prompt.prompt();
    const result = await prompt.userChoice;
    if (result.outcome === "accepted") setShow(false);
  };

  const handleDismiss = () => {
    sessionStorage.setItem("pwa-prompt-dismissed", "1");
    setShow(false);
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm">
      <div
        className="rounded-2xl shadow-2xl border border-white/10 dark:border-white/6 overflow-hidden"
        style={{
          background: "var(--panel-bg-solid)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
        }}
      >
        <div className="flex items-center gap-4 p-4">
          {/* Icon */}
          <img src="/icon-192.png" alt="LocalMesh" className="w-14 h-14 rounded-[14px] shadow-md shrink-0" />

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[15px] text-foreground leading-tight">Install LocalMesh</p>
            <p className="text-[12px] text-text-muted mt-0.5 leading-snug">
              Add to home screen for a full app experience — works offline.
            </p>
          </div>

          {/* Close */}
          <button
            onClick={handleDismiss}
            className="text-text-muted hover:text-foreground p-1.5 rounded-lg transition-colors shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </button>
        </div>

        {/* Install button */}
        <div className="px-4 pb-4">
          <button
            onClick={handleInstall}
            className="w-full bg-primary text-white font-semibold text-[14px] py-2.5 rounded-xl hover:bg-primary/90 transition-colors"
          >
            Install App
          </button>
        </div>
      </div>
    </div>
  );
}
