import Link from "next/link";
import { Button } from "@/components/ui/primitives";

const FEATURES: Array<[string, string]> = [
  ["Multi-client command center", "Every shopkeeper client — documents, registers, deadlines and fees — in one calm dashboard."],
  ["WhatsApp-friendly collection", "Shopkeepers send photos and PDFs on WhatsApp; you upload in seconds or share an expiring link. No client login needed."],
  ["Decimal-safe GST prep", "GSTR-1 and GSTR-3B preparation summaries computed server-side with verified arithmetic and ITC review flags."],
  ["Deadlines that never slip", "Filing tasks with due dates, overdue flags and guarded status transitions across all clients."],
  ["Fee tracking built in", "Bills, UPI/cash payments and outstanding reports per client — separate from your SaaS subscription."],
  ["Firm-grade isolation", "Strict organization-level data separation, audit logs and role-based access for staff."]
];

const PLANS: Array<[string, string, string, string, string[]]> = [
  ["Starter", "₹399", "/mo", "25 clients", ["Client management", "Document uploads", "Manual entries", "Excel/CSV import", "GST prep reports"]],
  ["Professional", "₹799", "/mo", "100 clients", ["Everything in Starter", "Bulk imports", "ITC review tools", "Staff access", "Audit history"]],
  ["CA Firm", "₹1,499", "/mo", "300 clients", ["Everything in Professional", "Multiple staff + tasks", "Advanced reporting", "Priority support"]]
];

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-lg font-bold text-white">হি</span>
            <div>
              <p className="text-[15px] font-bold leading-none text-ink">HisabKitab</p>
              <p className="text-[11px] text-ink-faint">GST Practice Suite</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-lg px-3.5 py-2 text-sm font-medium text-ink-soft hover:bg-slate-100">Login</Link>
            <Link href="/signup"><Button size="sm">Start free trial</Button></Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 pb-14 pt-14 text-center sm:pt-20">
          <p className="inline-flex items-center gap-2 rounded-full border border-secondary/25 bg-secondary-50 px-3.5 py-1 text-xs font-semibold text-secondary-700">
            <span className="h-1.5 w-1.5 rounded-full bg-secondary" /> Built for Indian GST accountants & CA firms
          </p>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight text-ink sm:text-5xl">
            Every client. Every bill. Every deadline. <span className="text-primary">One dashboard.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft sm:text-base">
            HisabKitab helps accountants manage dozens of shopkeeper clients — collecting documents over
            WhatsApp, preparing GSTR-1 &amp; GSTR-3B summaries, tracking filings and getting paid on time.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup"><Button>Start 14-day free trial</Button></Link>
            <Link href="/login"><Button variant="outline">Accountant login</Button></Link>
          </div>
          <p className="mt-3 text-xs text-ink-faint">No credit card · Your clients need no login · Works on mobile</p>
        </section>

        <section className="border-y border-slate-200/70 bg-white">
          <div className="mx-auto grid max-w-6xl gap-px px-5 py-12 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(([t, d]) => (
              <div key={t} className="rounded-card p-5 transition-colors hover:bg-background">
                <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary">✦</div>
                <h3 className="text-[15px] font-semibold text-ink">{t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-14">
          <h2 className="text-center text-2xl font-bold tracking-tight text-ink">Simple launch pricing</h2>
          <p className="mt-1 text-center text-sm text-ink-soft">Monthly or annual. Upgrade as your practice grows.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {PLANS.map(([name, price, per, clients, feats]) => (
              <div key={name} className={`rounded-card border bg-white p-6 shadow-card ${name === "Professional" ? "border-primary ring-2 ring-primary/20" : "border-slate-200/80"}`}>
                <p className="text-sm font-semibold text-primary">{name}</p>
                <p className="tnum mt-1 text-3xl font-bold text-ink">{price}<span className="text-sm font-normal text-ink-faint">{per}</span></p>
                <p className="text-[13px] text-ink-soft">{clients} · annual plans available</p>
                <ul className="mt-4 space-y-1.5 text-sm text-ink-soft">{(feats as string[]).map((f) => <li key={f}>✓ {f}</li>)}</ul>
                <div className="mt-5"><Link href="/signup"><Button variant={name === "Professional" ? "primary" : "outline"} size="sm">Choose {name}</Button></Link></div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200/70 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-5 text-[13px] text-ink-faint">
          <p>© 2026 HisabKitab · Preparation assistance only — returns are filed by you on the GST portal.</p>
          <div className="flex gap-4"><Link href="/login" className="hover:text-primary">Login</Link><Link href="/admin" className="hover:text-primary">Admin</Link></div>
        </div>
      </footer>
    </div>
  );
}
