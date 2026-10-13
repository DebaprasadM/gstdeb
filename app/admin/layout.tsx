"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gauge, Building2, Layers, ReceiptText, ScrollText, LifeBuoy } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Skeleton, Avatar } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/admin", label: "Overview", icon: Gauge },
  { href: "/admin/accountants", label: "Accountants", icon: Building2 },
  { href: "/admin/plans", label: "Plans", icon: Layers },
  { href: "/admin/payments", label: "Payments", icon: ReceiptText },
  { href: "/admin/audit", label: "Audit", icon: ScrollText },
  { href: "/admin/support", label: "Support", icon: LifeBuoy }
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  const path = usePathname();
  if (loading) return <main className="mx-auto max-w-6xl px-5 py-10"><Skeleton /></main>;
  if (!me) { if (typeof window !== "undefined") window.location.href = "/login"; return null; }
  if (me.role !== "SUPER_ADMIN") {
    return (
      <main className="mx-auto max-w-xl px-5 py-16 text-center">
        <h1 className="text-xl font-bold text-ink">Restricted area</h1>
        <p className="mt-1 text-sm text-ink-soft">Super Admin access only.</p>
      </main>
    );
  }
  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col bg-slate-900 lg:flex">
        <div className="px-5 pb-4 pt-5">
          <p className="text-[15px] font-bold text-white">HisabKitab Admin</p>
          <p className="mt-0.5 truncate text-[11px] text-slate-400">{me.email}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {NAV.map((n) => {
            const active = n.href === "/admin" ? path === n.href : path.startsWith(n.href);
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon size={17} /> {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4"><div className="flex items-center gap-2.5"><Avatar name={me.name} /><p className="truncate text-[13px] text-slate-300">{me.name}</p></div></div>
      </aside>
      <div className="sticky top-0 z-40 flex gap-1 overflow-x-auto border-b border-slate-800 bg-slate-900 px-3 py-2 lg:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px]", (n.href === "/admin" ? path === n.href : path.startsWith(n.href)) ? "bg-white/10 text-white" : "text-slate-400")}>
            {n.label}
          </Link>
        ))}
      </div>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
