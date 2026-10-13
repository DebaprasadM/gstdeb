"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { cn } from "@/lib/cn";

interface Toast { id: number; kind: "success" | "error" | "info"; text: string; }
const Ctx = createContext<{ push: (kind: Toast["kind"], text: string) => void }>({ push: () => {} });
export const useToast = () => useContext(Ctx);

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = nextId++;
    setItems((xs) => [...xs, { id, kind, text }]);
    setTimeout(() => setItems((xs) => xs.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[min(92vw,360px)] flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "toast-in pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-white px-4 py-3 text-sm shadow-pop",
              t.kind === "success" ? "border-emerald-200" : t.kind === "error" ? "border-red-200" : "border-slate-200"
            )}
          >
            <span className={cn("mt-0.5 text-base leading-none", t.kind === "success" ? "text-emerald-600" : t.kind === "error" ? "text-red-600" : "text-primary")}>
              {t.kind === "success" ? "✓" : t.kind === "error" ? "!" : "i"}
            </span>
            <p className="text-ink">{t.text}</p>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
