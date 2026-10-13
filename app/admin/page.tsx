"use client";
import { useEffect, useState } from "react";
import { Building2, CreditCard, Database, LifeBuoy, TrendingUp, UserPlus } from "lucide-react";
import { apiFetch, inr } from "@/lib/api";
import { Card, CardHeader, ErrorState, Skeleton, Stat } from "@/components/ui/primitives";

export default function AdminOverview() {
  const [m, setM] = useState<any>(null);
  const [err, setErr] = useState("");
  async function load() {
    try { const r = await apiFetch<{ data: unknown }>("/api/v1/admin/metrics"); setM(r.data); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, []);
  if (err) return <ErrorState message={err} retry={load} />;
  if (!m) return <Skeleton lines={4} />;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-ink">Platform overview</h1>
        <p className="mt-0.5 text-sm text-ink-soft">Revenue, firms and system health.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Accountant users" value={String(m.accountants)} icon={<UserPlus size={17} />} />
        <Stat label="Firms" value={String(m.orgsTotal)} sub={`${m.orgsSuspended} suspended`} icon={<Building2 size={17} />} />
        <Stat label="Active subscriptions" value={String(m.activeSubscriptions)} sub={`${m.trials} trials · ${m.expired} expired`} icon={<CreditCard size={17} />} />
        <Stat label="MRR estimate" value={inr(Number(m.mrrEstimate))} sub={`${m.newLast30d} new in 30 days`} accent icon={<TrendingUp size={17} />} />
        <Stat label="Storage used" value={`${m.storageMb} MB`} sub={`${m.documents} documents`} icon={<Database size={17} />} />
        <Stat label="Open support" value={String(m.openSupport)} icon={<LifeBuoy size={17} />} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Subscriptions by plan" />
          <div className="space-y-1.5 text-sm">{Object.entries(m.byPlan as Record<string, number>).map(([k, v]) => <div key={k} className="flex justify-between"><span className="text-ink-soft">{k}</span><strong className="tnum text-ink">{String(v)}</strong></div>)}</div>
        </Card>
        <Card>
          <CardHeader title="Recent audit events" />
          <div className="space-y-1.5 text-sm">{m.recentAudit.map((a: { id: string; action: string; createdAt: string }) => <div key={a.id} className="flex justify-between gap-2"><span className="text-ink">{a.action}</span><span className="tnum shrink-0 text-ink-faint">{String(a.createdAt).slice(0, 16).replace("T", " ")}</span></div>)}</div>
        </Card>
      </div>
    </div>
  );
}
