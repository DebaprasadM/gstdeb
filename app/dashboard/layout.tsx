"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Users, FileUp, ShoppingCart, Receipt, FileBarChart, CalendarClock, Wallet, CreditCard, LogOut, X, House, Ellipsis
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/ui/primitives";
import { DashboardSkeleton } from "@/components/ui/dashboard-skeleton";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/clients", label: "Clients", icon: Users },
  { href: "/dashboard/documents", label: "Documents", icon: FileUp },
  { href: "/dashboard/sales", label: "Sales", icon: ShoppingCart },
  { href: "/dashboard/purchases", label: "Purchases", icon: Receipt },
  { href: "/dashboard/gst", label: "GST Prep", icon: FileBarChart },
  { href: "/dashboard/tasks", label: "Deadlines", icon: CalendarClock },
  { href: "/dashboard/fees", label: "Fees", icon: Wallet },
  { href: "/dashboard/subscription", label: "Billing", icon: CreditCard }
];

const TABS = [
  { href: "/dashboard", label: "Home", icon: House },
  { href: "/dashboard/clients", label: "Clients", icon: Users },
  { href: "/dashboard/documents", label: "Docs", icon: FileUp },
  { href: "/dashboard/tasks", label: "Tasks", icon: CalendarClock }
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { me, loading, logout } = useAuth();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  if (loading) return <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8"><DashboardSkeleton /></main>;
  if (!me) { if (typeof window !== "undefined") window.location.href = "/login"; return null; }
  const org = me.organizations[0];
  const isActive = (href: string) => (href === "/dashboard" ? path === href : path.startsWith(href));

  const drawer = (
    <nav className="slim-scroll flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2">
      {NAV.map((n) => {
        const Icon = n.icon;
        return (
          <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className={cn("side-link", isActive(n.href) && "active")}>
            <Icon size={17} strokeWidth={2.1} /> {n.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-slate-200/70 bg-white lg:flex">
        <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-base font-bold text-white">হি</span>
          <div>
            <p className="text-[15px] font-bold leading-none text-ink">HisabKitab</p>
            <p className="mt-0.5 max-w-[150px] truncate text-[11px] text-ink-faint">{org?.name ?? me.email}</p>
          </div>
        </div>
        {drawer}
        <div className="border-t border-slate-200/70 p-3">
          <div className="flex items-center gap-2.5 rounded-xl bg-background px-3 py-2.5">
            <Avatar name={me.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-ink">{me.name}</p>
              <p className="truncate text-[11px] text-ink-faint">{me.email}</p>
            </div>
            <button onClick={() => void logout()} title="Sign out" className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-slate-200 hover:text-ink">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-[10px] text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)" }}>হি</span>
            <p className="text-[15px] font-bold tracking-tight text-ink">HisabKitab</p>
          </div>
          <Avatar name={me.name} />
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-32 pt-6 sm:px-6 lg:px-8 lg:pb-8">{children}</main>

      {/* Mobile bottom tab bar + More sheet */}
      {open && (
        <div className="fade-in fixed inset-0 z-50 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-ink/40" />
          <div className="modal-in absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-[1.75rem] bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-200" />
            <p className="px-1 py-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">All modules</p>
            {NAV.map((n) => {
              const Icon = n.icon;
              return (
                <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className={cn("side-link !py-2.5", isActive(n.href) && "active")}>
                  <Icon size={18} strokeWidth={2.1} /> {n.label}
                </Link>
              );
            })}
            <button
              onClick={() => void logout()}
              className="side-link mt-1 w-full !py-2.5 text-red-600"
            >
              <LogOut size={18} /> Sign out
            </button>
          </div>
        </div>
      )}
      <nav className="fixed inset-x-3 bottom-3 z-40 lg:hidden">
        <div className="grid grid-cols-5 rounded-[1.4rem] border border-slate-200/70 bg-white/95 px-1 py-1.5 shadow-pop backdrop-blur">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = isActive(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] transition-all active:scale-95",
                  active ? "font-semibold text-violet-700" : "font-medium text-slate-400"
                )}
              >
                <span className={cn("flex h-8 w-12 items-center justify-center rounded-full transition-colors", active && "bg-violet-100")}>
                  <Icon size={21} strokeWidth={active ? 2.4 : 2} />
                </span>
                {t.label}
                <span className={cn("h-1 w-1 rounded-full", active ? "bg-violet-600" : "bg-transparent")} />
              </Link>
            );
          })}
          <button
            onClick={() => setOpen(!open)}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] transition-all active:scale-95",
              open ? "font-semibold text-violet-700" : "font-medium text-slate-400"
            )}
            aria-label="More"
          >
            <span className={cn("flex h-8 w-12 items-center justify-center rounded-full transition-colors", open && "bg-violet-100")}>
              {open ? <X size={21} /> : <Ellipsis size={21} />}
            </span>
            More
            <span className={cn("h-1 w-1 rounded-full", open ? "bg-violet-600" : "bg-transparent")} />
          </button>
        </div>
      </nav>
    </div>
  );
}
