import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/* ---------- Card ---------- */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-card border border-slate-200/80 bg-white p-5 shadow-card sm:p-6", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {sub ? <p className="mt-0.5 text-[13px] text-ink-soft">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

/* ---------- Buttons ---------- */
type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "accent";

const variants: Record<Variant, string> = {
  primary: "bg-gradient-to-b from-primary-500 to-primary-800 text-white shadow-sm hover:brightness-110",
  secondary: "bg-gradient-to-b from-secondary-500 to-secondary-800 text-white shadow-sm hover:brightness-110",
  accent: "bg-gradient-to-b from-accent-400 to-accent-600 text-primary-950 shadow-sm hover:brightness-105",
  outline: "border border-slate-300 bg-white text-ink hover:border-primary hover:text-primary",
  ghost: "text-ink-soft hover:bg-slate-100 hover:text-ink",
  danger: "bg-gradient-to-b from-red-500 to-red-700 text-white shadow-sm hover:brightness-110"
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]",
        size === "sm" ? "px-3 py-1.5 text-[13px]" : "px-4 py-2 text-sm",
        variants[variant],
        props.className
      )}
    >
      {children}
    </button>
  );
}

/* ---------- Forms ---------- */
export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[13px] font-medium text-ink-soft">{label}</label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function TextInput(props, ref) {
  return (
    <input
      ref={ref}
      {...props}
      className={cn(
        "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink placeholder:text-slate-400",
        "transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15",
        props.className
      )}
    />
  );
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(props, ref) {
  return (
    <select
      ref={ref}
      {...props}
      className={cn(
        "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink",
        "transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15",
        props.className
      )}
    />
  );
});

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
      <TextInput value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-8" />
    </div>
  );
}

/* ---------- Badges ---------- */
type Tone = "slate" | "green" | "amber" | "red" | "blue";
const tones: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-primary-50 text-primary ring-primary-100"
};

export function StatusBadge({ label, tone = "slate" }: { label: string; tone?: Tone }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset", tones[tone])}>
      {label}
    </span>
  );
}

export function statusTone(status: string): Tone {
  if (["FILED", "PROCESSED", "ACTIVE", "ELIGIBLE", "RESOLVED"].includes(status)) return "green";
  if (["OVERDUE", "FAILED", "SUSPENDED", "NEEDS_CORRECTION"].includes(status)) return "red";
  if (["PENDING", "PREPARED", "RECEIVED", "UNDER_REVIEW", "OPEN", "TRIAL"].includes(status)) return "amber";
  return "blue";
}

/* ---------- Page header ---------- */
export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="break-words text-xl font-bold tracking-tight text-ink sm:text-[22px]">{title}</h1>
        {sub ? <p className="mt-0.5 text-sm text-ink-soft">{sub}</p> : null}
      </div>
      {actions ? <div className="flex w-full flex-wrap gap-2 sm:w-auto">{actions}</div> : null}
    </div>
  );
}

/* ---------- Stat ---------- */
export function Stat({ label, value, sub, icon, accent = false }: { label: string; value: string; sub?: string; icon?: ReactNode; accent?: boolean }) {
  return (
    <div className={cn("min-w-0 rounded-card border bg-white p-4 shadow-card transition-shadow hover:shadow-pop sm:p-5", accent ? "border-accent/60" : "border-slate-200/80")}>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[13px] font-medium text-ink-soft">{label}</p>
        {icon ? <span className={cn("shrink-0 rounded-lg p-1.5", accent ? "bg-accent-50 text-accent-600" : "bg-primary-50 text-primary")}>{icon}</span> : null}
      </div>
      <p className="tnum mt-1.5 break-words text-[20px] font-bold tracking-tight text-ink sm:text-[26px]">{value}</p>
      {sub ? <p className="mt-0.5 truncate text-xs text-ink-faint">{sub}</p> : null}
    </div>
  );
}

/* ---------- Table shell ---------- */
export function TableShell({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="max-w-full overflow-x-auto rounded-card border border-slate-200/80 bg-white shadow-card">
      <table className="table-premium w-full min-w-[680px] text-sm">
        <thead>
          <tr>{head.map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/* ---------- States ---------- */
export function EmptyState({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary-50 text-lg text-primary">✦</div>
      <p className="font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">{hint}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton-shimmer h-16 rounded-card border border-slate-100" />
      ))}
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="rounded-card border border-red-200 bg-red-50/70 p-5 text-sm text-red-700">
      <p className="font-medium">Something went wrong</p>
      <p className="mt-0.5">{message}</p>
      {retry ? <button onClick={retry} className="mt-2 font-medium underline underline-offset-2">Try again</button> : null}
    </div>
  );
}

/* ---------- Progress ---------- */
export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.max(0, (value / Math.max(1, max)) * 100));
  const over = value > max;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={cn("h-full rounded-full transition-all", over ? "bg-red-500" : pct > 80 ? "bg-accent" : "bg-secondary")} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ---------- Avatar ---------- */
export function Avatar({ name }: { name: string }) {
  const initials = name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join("");
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
      {initials}
    </span>
  );
}
