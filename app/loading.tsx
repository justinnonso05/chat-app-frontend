export default function Loading() {
  return (
    <div className="h-[100dvh] w-full flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-5">
        <img
          src="/icon-512.png"
          alt="LocalMesh"
          className="w-20 h-20 rounded-[22px] shadow-xl animate-pulse"
        />
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce" />
        </div>
        <p className="text-sm text-text-muted font-medium tracking-wide">Connecting to mesh...</p>
      </div>
    </div>
  );
}
