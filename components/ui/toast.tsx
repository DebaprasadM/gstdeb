"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

interface Toast { id: number; kind: "success" | "error" | "info"; text: string; }
const Ctx = createContext<{ push: (kind: Toast["kind"], text: string) => void }>({ push: () => {} });
export const useToast = () => useContext(Ctx);

let nextId = 1;
const LIFE_MS = 4200;

const STYLE: Record<Toast["kind"], { chip: string; bar: string; Icon: typeof Info }> = {
  success: { chip: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500", Icon: CheckCircle2 },
  error: { chip: "bg-red-100 text-red-600", bar: "bg-red-500", Icon: AlertTriangle },
  info: { chip: "bg-primary-50 text-primary", bar: "bg-primary", Icon: Info }
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((t) => t.id !== id)), []);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = nextId++;
    setItems((xs) => [...xs.slice(-2), { id, kind, text }]);
    setTimeout(() => setItems((xs) => xs.filter((t) => t.id !== id)), LIFE_MS);
  }, []);
  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed left-1/2 top-3 z-[100] flex w-[min(92vw,400px)] flex-col items-stretch gap-2 sm:top-5" aria-live="polite">
        {items.map((t) => {
          const s = STYLE[t.kind];
          return (
            <div
              key={t.id}
              className="toast-in-top pointer-events-auto relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/97 py-3 pl-3.5 pr-9 shadow-pop backdrop-blur"
            >
              <div className="flex items-start gap-2.5">
                <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", s.chip)}>
                  <s.Icon size={16} strokeWidth={2.4} />
                </span>
                <p className="pt-1 text-[13.5px] font-medium leading-snug text-ink">{t.text}</p>
              </div>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="absolute right-2 top-2 rounded-full p-1 text-ink-faint transition-colors hover:bg-slate-100 hover:text-ink"
              >
                <X size={14} />
              </button>
              <span className={cn("toast-bar absolute bottom-0 left-0 h-[3px]", s.bar)} />
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
