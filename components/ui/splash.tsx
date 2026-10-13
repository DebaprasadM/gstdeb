"use client";

const TIPS = [
  "Shopkeepers can send bills on WhatsApp — no login needed.",
  "Taxes are computed server-side with decimal-safe math.",
  "Mark a return Filed only after the GST portal confirms.",
  "Claim ITC only against GSTR-2B to avoid notices."
];

export function Splash({ message }: { message?: string }) {
  const tip = TIPS[Math.floor(Date.now() / 5000) % TIPS.length];
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-16 text-center">
      <div className="splash-float relative flex h-20 w-20 items-center justify-center">
        <span className="splash-ring absolute inset-0 rounded-[1.4rem] bg-primary/30" />
        <span
          className="flex h-16 w-16 items-center justify-center rounded-[1.2rem] text-2xl font-bold text-white shadow-pop"
          style={{ background: "linear-gradient(135deg, #155C96 0%, #0C3B64 100%)" }}
        >
          হি
        </span>
      </div>
      <p className="mt-5 text-lg font-bold tracking-tight text-ink">HisabKitab</p>
      <p className="mt-1 text-sm text-ink-soft">{message ?? "Getting your workspace ready"}</p>
      <p className="splash-dots mt-1 flex gap-1 text-lg leading-none text-primary">
        <span>•</span><span>•</span><span>•</span>
      </p>
      <div className="mt-5 h-1.5 w-44 overflow-hidden rounded-full bg-slate-200/70">
        <div className="splash-bar h-full w-1/3 rounded-full bg-gradient-to-r from-primary-500 to-secondary-500" />
      </div>
      <p className="mt-5 max-w-xs text-xs leading-relaxed text-ink-faint">💡 Tip: {tip}</p>
    </div>
  );
}

export function SplashScreen({ message }: { message?: string }) {
  return (
    <main className="min-h-screen bg-background">
      <Splash message={message} />
    </main>
  );
}
