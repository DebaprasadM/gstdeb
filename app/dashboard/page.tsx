"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, FileUp, CalendarClock, Wallet, Plus, ArrowRight, AlarmClock } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "@/lib/auth";
import { apiFetch, inr } from "@/lib/api";
import { Card, CardHeader, EmptyState, ErrorState, Skeleton, Stat, StatusBadge, Button, statusTone } from "@/components/ui/primitives";

interface Dash {
  activeClients: number; docsPending: number; salesCount: number; purchaseCount: number;
  overdueTasks: number; filedCount: number; preparedCount: number; outstandingFees: number;
  upcomingDeadlines: Array<{ id: string; returnType: string; period: string; dueDate: string; client: { businessName: string } }>;
  recentDocuments: Array<{ id: string; fileName: string; period: string; status: string; client: { businessName: string } }>;
  recentSales: Array<{ id: string; invoiceNumber: string; totalValue: string; client: { businessName: string } }>;
  businessOverview: Array<{
    id: string; businessName: string; gstin: string | null;
    salesTotal: number; salesCount: number; purchaseTotal: number; purchaseCount: number;
    documents: number; openTasks: number; billed: number; paid: number; outstanding: number;
  }>;
}

interface Month { period: string; salesTotal: number; purchaseTotal: number; documents: number; }

export default function DashboardHome() {
  const { me, loading } = useAuth();
  const [data, setData] = useState<Dash | null>(null);
  const [months, setMonths] = useState<Month[]>([]);
  const [err, setErr] = useState("");
  const [ovTab, setOvTab] = useState<"revenue" | "dues" | "activity">("revenue");
  const org = me?.organizations[0];

  async function load() {
    if (!org) return;
    setErr("");
    try {
      const [d, m] = await Promise.all([
        apiFetch<{ data: Dash }>(`/api/v1/organizations/${org.id}/dashboard`),
        apiFetch<{ data: Month[] }>(`/api/v1/organizations/${org.id}/dashboard/monthly?months=6`)
      ]);
      setData(d.data); setMonths(m.data);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed to load"); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (org) void load(); }, [org?.id]);

  if (loading) return <Skeleton lines={4} />;
  if (!org) return <EmptyState title="No organization" hint="Your account has no firm attached. Contact support." />;
  if (err) return <ErrorState message={err} retry={load} />;
  if (!data) return <Skeleton lines={4} />;

  const isNew = data.activeClients === 0 && data.salesCount === 0;
  const ov = data.businessOverview;
  const ovSum = {
    sales: ov.reduce((a, c) => a + c.salesTotal, 0),
    salesCount: ov.reduce((a, c) => a + c.salesCount, 0),
    purchases: ov.reduce((a, c) => a + c.purchaseTotal, 0),
    billed: ov.reduce((a, c) => a + c.billed, 0),
    paid: ov.reduce((a, c) => a + c.paid, 0),
    outstanding: ov.reduce((a, c) => a + c.outstanding, 0),
    docs: ov.reduce((a, c) => a + c.documents, 0),
    tasks: ov.reduce((a, c) => a + c.openTasks, 0)
  };
  const ovTabs: Array<[typeof ovTab, string]> = [["revenue", "💰 Revenue"], ["dues", "🧾 Payments Due"], ["activity", "📌 Activity"]];
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const greetIcon = hour < 12 ? "☀️" : hour < 17 ? "🌤️" : "🌙";
  const today = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date());

  const tiles = [
    { label: "Deadlines due", sub: "next 14 days", value: data.upcomingDeadlines.length, bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200", icon: "📅", href: "/dashboard/tasks" },
    { label: "Docs to review", sub: "received + corrections", value: data.docsPending, bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: "📎", href: "/dashboard/documents" },
    { label: "Overdue tasks", sub: "needs action now", value: data.overdueTasks, bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: "⚠️", href: "/dashboard/tasks" },
    { label: "Active clients", sub: "shopkeepers", value: data.activeClients, bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200", icon: "👥", href: "/dashboard/clients" }
  ];

  return (
    <>
    {/* ---------- Mobile app-style dashboard ---------- */}
    <div className="lg:hidden">
      <div className="-mx-4 -mt-6 px-4 pt-4 sm:-mx-6 sm:px-5">
        <div
          className="rounded-[1.75rem] px-5 pb-10 pt-5 text-white shadow-pop"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.30) 1.6px, transparent 1.6px), radial-gradient(120% 90% at 85% -10%, rgba(233,213,255,0.55) 0%, transparent 55%), radial-gradient(110% 85% at -10% 110%, rgba(165,243,252,0.4) 0%, transparent 60%), linear-gradient(140deg, #4C1D95 0%, #6D28D9 55%, #8B5CF6 130%)",
            backgroundSize: "20px 20px, cover, cover, cover"
          }}
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-white/10 px-3 py-1 text-xs font-medium text-white">📅 {today}</span>
            <Link href="/dashboard/tasks" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/50 bg-white/10 transition-transform active:scale-95">🔔</Link>
          </div>
          <p className="mt-5 text-[15px] text-white/85">{greetIcon} {greet},</p>
          <h1 className="text-[27px] font-bold leading-tight tracking-tight" style={{ textShadow: "0 2px 16px rgba(0,0,0,0.35)" }}>{me.name}</h1>
          <p className="mt-1 text-[13px] font-semibold uppercase tracking-[0.14em] text-violet-200">🏢 {org.name}</p>
          <div className="mt-3.5 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-white/10 px-3.5 py-1.5 text-[13px] font-semibold text-white"><span className="h-2 w-2 rounded-full bg-emerald-300" /> Accountant</span>
            <Link href="/dashboard/fees" className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/40 bg-emerald-300 px-3.5 py-1.5 text-[13px] font-bold text-emerald-950 transition-transform active:scale-95">💰 To collect: {inr(data.outstandingFees)}</Link>
          </div>
        </div>
        <div className="-mt-7 rounded-t-[1.75rem] bg-background px-1 pt-5">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink-faint"><span className="h-1.5 w-1.5 rounded-full bg-ink-faint" /> Needs your attention</p>
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            {tiles.map((t) => (
              <Link key={t.label} href={t.href} className={`${t.bg} rounded-2xl border ${t.border} p-2.5`}>
                <p className={`text-[12px] font-semibold ${t.text}`}>{t.icon} {t.label}</p>
                <p className={`tnum mt-0.5 text-[22px] font-bold ${t.text}`}>{t.value}</p>
                <p className={`text-[11px] ${t.text} opacity-70`}>{t.sub}</p>
              </Link>
            ))}
          </div>
          <Link href="/dashboard/fees" className="mt-2.5 flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5">
            <span className="text-sm font-semibold text-rose-700">💰 Fees to collect</span>
            <span className="tnum text-xl font-bold text-rose-700">{inr(data.outstandingFees)}</span>
          </Link>
          {data.businessOverview.length > 0 && (
          <div className="mt-3 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-bold text-ink">🏪 Business overview</p>
              <Link href="/dashboard/clients" className="text-[13px] font-medium text-primary hover:underline">All clients</Link>
            </div>
            <div className="mt-2.5 flex gap-1.5">
              {ovTabs.map(([v, l]) => (
                <button key={v} onClick={() => setOvTab(v)} className={`flex-1 rounded-full px-2 py-1.5 text-[12px] font-medium transition-colors ${ovTab === v ? "bg-primary text-white" : "bg-background text-ink-soft"}`}>{l}</button>
              ))}
            </div>
            <div className="mt-3 rounded-2xl bg-background p-4 text-center">
              {ovTab === "revenue" && (<><p className="tnum text-[26px] font-bold text-ink">{inr(ovSum.sales)}</p><p className="mt-0.5 text-xs text-ink-soft">{ovSum.salesCount} sales entries · purchases {inr(ovSum.purchases)}</p></>)}
              {ovTab === "dues" && (<><p className="tnum text-[26px] font-bold text-amber-700">{inr(ovSum.outstanding)}</p><p className="mt-0.5 text-xs text-ink-soft">due of {inr(ovSum.billed)} billed · {inr(ovSum.paid)} received</p></>)}
              {ovTab === "activity" && (<><p className="tnum text-[26px] font-bold text-ink">{ovSum.docs + ovSum.tasks} open</p><p className="mt-0.5 text-xs text-ink-soft">{ovSum.docs} documents · {ovSum.tasks} tasks pending</p></>)}
            </div>
          </div>
          )}
          {isNew ? (
            <div className="mt-3 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-card">
              <p className="text-[15px] font-bold text-ink">🧭 New here? 3 quick steps</p>
              <p className="text-[13px] text-ink-soft">Do these once — 5 minutes total.</p>
              <div className="mt-3 space-y-2.5">
                <div className="rounded-2xl bg-background p-3">
                  <p className="text-sm font-semibold text-ink"><span className="mr-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">1</span> Add your first client</p>
                  <Link href="/dashboard/clients" style={{ background: "linear-gradient(90deg, #7C3AED 0%, #4F46E5 100%)" }} className="mt-2 flex items-center justify-center gap-1.5 rounded-2xl py-3 text-[15px] font-bold text-white shadow-pop">＋ Add client</Link>
                </div>
                <div className="rounded-2xl bg-background p-3"><p className="text-sm font-semibold text-ink"><span className="mr-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">2</span> Upload their bills</p></div>
                <div className="rounded-2xl bg-background p-3"><p className="text-sm font-semibold text-ink"><span className="mr-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">3</span> Track filing deadlines</p></div>
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-card">
              <p className="text-[15px] font-bold text-ink">📌 Coming up</p>
              <div className="mt-2 space-y-2">
                {data.upcomingDeadlines.length === 0 ? <p className="text-sm text-ink-faint">Nothing due in 14 days. 🎉</p> :
                  data.upcomingDeadlines.slice(0, 3).map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-2 rounded-xl bg-background px-3 py-2 text-sm">
                      <p className="min-w-0 truncate font-medium text-ink">{t.client.businessName} <span className="font-normal text-ink-faint">· {t.returnType}</span></p>
                      <span className="tnum shrink-0 text-xs font-bold text-amber-700">{t.dueDate.slice(0, 10)}</span>
                    </div>
                  ))}
              </div>
              <Link href="/dashboard/tasks" style={{ background: "linear-gradient(90deg, #7C3AED 0%, #4F46E5 100%)" }} className="mt-3 flex items-center justify-center gap-1.5 rounded-2xl py-3 text-[15px] font-bold text-white shadow-pop">View all deadlines →</Link>
            </div>
          )}
        </div>
      </div>
    </div>
    {/* ---------- Desktop dashboard (unchanged) ---------- */}
    <div className="hidden space-y-6 lg:block">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-ink">{org.name}</h1>
          <p className="mt-0.5 text-sm text-ink-soft">Good day — here is your practice at a glance.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/clients"><Button size="sm"><Plus size={15} /> Add Client</Button></Link>
          <Link href="/dashboard/documents"><Button size="sm" variant="outline">Upload Docs</Button></Link>
          <Link href="/dashboard/tasks"><Button size="sm" variant="outline">Pending Tasks</Button></Link>
        </div>
      </div>

      {data.overdueTasks > 0 && (
        <div className="flex items-center gap-2.5 rounded-card border border-red-200 bg-red-50/70 px-4 py-3 text-sm text-red-800">
          <AlarmClock size={17} />
          <p><strong>{data.overdueTasks} overdue task{data.overdueTasks > 1 ? "s" : ""}</strong> need attention.
            <Link href="/dashboard/tasks" className="ml-1 font-medium underline underline-offset-2">Review now</Link></p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <Link href="/dashboard/clients" className="transition-transform hover:-translate-y-0.5"><Stat label="Active clients" value={String(data.activeClients)} icon={<Users size={17} />} /></Link>
        <Link href="/dashboard/documents" className="transition-transform hover:-translate-y-0.5"><Stat label="Docs needing review" value={String(data.docsPending)} icon={<FileUp size={17} />} /></Link>
        <Link href="/dashboard/tasks" className="transition-transform hover:-translate-y-0.5"><Stat label="Overdue tasks" value={String(data.overdueTasks)} icon={<AlarmClock size={17} />} /></Link>
        <Link href="/dashboard/tasks" className="transition-transform hover:-translate-y-0.5"><Stat label="Due in 14 days" value={String(data.upcomingDeadlines.length)} icon={<CalendarClock size={17} />} /></Link>
        <Link href="/dashboard/tasks" className="transition-transform hover:-translate-y-0.5"><Stat label="Filed / Prepared" value={`${data.filedCount} / ${data.preparedCount}`} icon={<ArrowRight size={17} />} /></Link>
        <Link href="/dashboard/fees" className="transition-transform hover:-translate-y-0.5"><Stat label="Outstanding fees" value={inr(data.outstandingFees)} sub="Across all clients" accent icon={<Wallet size={17} />} /></Link>
      </div>

      {isNew ? (
        <EmptyState
          title="Welcome to your new practice"
          hint="Add your first shopkeeper client, then upload their bills or share a submission link. It takes two minutes."
          action={<Link href="/dashboard/clients"><Button size="sm">Add first client</Button></Link>}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader title="Turnover trend" sub="Invoice totals · last 6 months" />
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={months} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`} width={44} />
                  <Tooltip formatter={(value) => inr(Number(value ?? 0))} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
                  <Area type="monotone" dataKey="salesTotal" name="Sales" stroke="#0F4C81" strokeWidth={2.5} fill="#0F4C81" fillOpacity={0.12} />
                  <Area type="monotone" dataKey="purchaseTotal" name="Purchases" stroke="#2E8B57" strokeWidth={2.5} fill="#2E8B57" fillOpacity={0.12} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader title="Upcoming deadlines" action={<Link href="/dashboard/tasks" className="text-[13px] font-medium text-primary hover:underline">View all</Link>} />
              <div className="space-y-2.5 text-sm">
                {data.upcomingDeadlines.length === 0 ? <p className="text-ink-faint">Nothing due in the next 14 days. 🎉</p> :
                  data.upcomingDeadlines.map((t) => (
                    <Link key={t.id} href="/dashboard/tasks" className="flex items-center justify-between gap-2 rounded-lg px-1 py-0.5 transition-colors hover:bg-background">
                      <div className="min-w-0"><p className="truncate font-medium text-ink">{t.client.businessName}</p><p className="text-xs text-ink-faint">{t.returnType} · {t.period}</p></div>
                      <span className="tnum shrink-0 text-xs font-semibold text-amber-700">{t.dueDate.slice(0, 10)}</span>
                    </Link>
                  ))}
              </div>
            </Card>
            <Card>
              <CardHeader title="Recent documents" action={<Link href="/dashboard/documents" className="text-[13px] font-medium text-primary hover:underline">View all</Link>} />
              <div className="space-y-2.5 text-sm">
                {data.recentDocuments.length === 0 ? <p className="text-ink-faint">No uploads yet.</p> :
                  data.recentDocuments.map((d) => (
                    <Link key={d.id} href="/dashboard/documents" className="flex items-center justify-between gap-2 rounded-lg px-1 py-0.5 transition-colors hover:bg-background">
                      <p className="min-w-0 truncate text-ink">{d.client.businessName} · <span className="text-ink-soft">{d.fileName}</span></p>
                      <StatusBadge label={d.status} tone={statusTone(d.status)} />
                    </Link>
                  ))}
              </div>
            </Card>
          </div>
        </div>
      )}
      </div>
      {!isNew && (
      <div className="hidden lg:block">
        <Card>
          <CardHeader
            title="Business overview"
            sub="Practice totals — client details live on the Clients page"
            action={<Link href="/dashboard/clients" className="text-[13px] font-medium text-primary hover:underline">All clients</Link>}
          />
          <div className="mb-4 flex flex-wrap gap-2">
            {ovTabs.map(([v, l]) => (
              <button key={v} onClick={() => setOvTab(v)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${ovTab === v ? "bg-primary text-white" : "bg-white text-ink-soft ring-1 ring-inset ring-slate-200 hover:ring-primary"}`}>{l}</button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {ovTab === "revenue" && (<>
              <Stat label="Total sales turnover" value={inr(ovSum.sales)} sub={`${ovSum.salesCount} entries`} />
              <Stat label="Total purchase inflow" value={inr(ovSum.purchases)} />
              <Stat label="Margin signal" value={inr(ovSum.sales - ovSum.purchases)} sub="Sales minus purchases" />
            </>)}
            {ovTab === "dues" && (<>
              <Stat label="Outstanding" value={inr(ovSum.outstanding)} accent />
              <Stat label="Billed" value={inr(ovSum.billed)} />
              <Stat label="Received" value={inr(ovSum.paid)} />
            </>)}
            {ovTab === "activity" && (<>
              <Stat label="Documents" value={String(ovSum.docs)} />
              <Stat label="Open tasks" value={String(ovSum.tasks)} />
              <Stat label="Active clients" value={String(data.activeClients)} />
            </>)}
          </div>
        </Card>
      </div>
      )}
    </>
  );
}
