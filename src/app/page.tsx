export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6">
      <div className="w-full max-w-sm rounded-lg border-4 border-blue-frame bg-navy-deep p-6 shadow-[6px_6px_0_var(--color-ink-px)]">
        <h1 className="font-pixel text-center text-2xl leading-relaxed text-cream">
          SPIDEY
          <span className="text-coral"> 🕷 </span>
          SHELF
        </h1>

        <div className="mt-6 rounded border-2 border-ink-px bg-lcd-bg px-4 py-3 text-center">
          <p className="font-pixel text-xs tracking-widest text-lcd-glow">12 / 117</p>
          <p className="font-pixel mt-2 text-[8px] text-lcd-glow/70">SPIDEY CANON COLLECTED</p>
        </div>

        <p className="font-pixel mt-6 text-center text-[10px] leading-relaxed text-amber">
          UNDER CONSTRUCTION
        </p>
        <p className="mt-3 text-center text-sm text-cream/70">
          The vault is being assembled. Sightings will appear here soon.
        </p>
      </div>
    </main>
  );
}
