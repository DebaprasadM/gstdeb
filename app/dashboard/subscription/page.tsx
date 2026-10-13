"use client";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { API_URL, apiFetch, ApiError, inr } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button, Card, CardHeader, EmptyState, PageHeader, ProgressBar, Skeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

export default function SubscriptionPage() {
  const { me } = useAuth();
  const { push } = useToast();
  const org = me?.organizations[0];
  const [cur, setCur] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [cycle, setCycle] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");
  const [busy, setBusy] = useState("");

  async function load() {
    if (!org) return;
    const [c, p, h] = await Promise.all([
      apiFetch<{ data: unknown }>(`/api/v1/organizations/${org.id}/subscription/current`),
      apiFetch<{ data: unknown[] }>(`/api/v1/organizations/${org.id}/subscription/plans`),
      apiFetch<{ data: unknown[] }>(`/api/v1/organizations/${org.id}/subscription/history`)
    ]);
    setCur(c.data as never); setPlans(p.data as never[]); setHistory(h.data as never[]);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (org) void load(); }, [org?.id]);

  async function checkout(planId: string, planName: string) {
    setBusy(planId);
    try {
      const res = await apiFetch<{ data: { payment: { providerId: string }; devMode: boolean; note: string } }>(
        `/api/v1/organizations/${org!.id}/subscription/checkout`, { method: "POST", body: JSON.stringify({ planId, billingCycle: cycle }) });
      if (res.data.devMode) {
        await fetch(`${API_URL}/api/v1/billing/webhook`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ providerId: res.data.payment.providerId, devConfirm: true }) });
        push("success", `${planName} activated (DEV MODE — not a real payment).`);
      } else push("info", res.data.note);
      void load();
    } catch (e) { push("error", e instanceof ApiError ? e.message : "Checkout failed"); }
    finally { setBusy(""); }
  }

  if (!org) return <EmptyState title="No organization" hint="Your account has no firm attached." />;
  if (!cur) return <Skeleton lines={3} />;
  return (
    <div className="space-y-5">
      <PageHeader title="Subscription & billing" sub={cur.subscription?.status === "TRIAL" ? "You are on a free trial" : `Renews ${cur.subscription?.renewsAt?.slice(0, 10) ?? "—"}`} />
      <Card>
        <CardHeader title={`${cur.plan?.planName} · ${cur.subscription?.billingCycle}`} action={<span className="rounded-full bg-secondary-50 px-3 py-1 text-xs font-semibold text-secondary-700 ring-1 ring-inset ring-secondary-100">{cur.subscription?.status}</span>} />
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["Clients", cur.usage.clients, cur.plan?.maxClients],
            ["Staff seats", Math.max(0, cur.usage.staff - 1), cur.plan?.maxStaff],
            ["Storage MB", cur.usage.storageMb, cur.plan?.maxStorageMb]
          ].map(([label, used, max]) => (
            <div key={label as string}>
              <p className="tnum text-sm text-ink"><strong>{used as number}</strong> <span className="text-ink-faint">/ {max as number} {label as string}</span></p>
              <div className="mt-1.5"><ProgressBar value={Number(used)} max={Number(max)} /></div>
            </div>
          ))}
        </div>
      </Card>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-ink-soft">Billing period:</span>
        {(["MONTHLY", "ANNUAL"] as const).map((c) => (
          <button key={c} onClick={() => setCycle(c)} className={cn("rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors", cycle === c ? "bg-primary text-white" : "bg-white text-ink-soft ring-1 ring-inset ring-slate-200")}>{c === "MONTHLY" ? "Monthly" : "Annual · save 2 months"}</button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const current = p.name === cur.plan?.planName;
          return (
            <Card key={p.id} className={cn(current && "ring-2 ring-primary/30")}>
              <div className="flex items-center justify-between"><p className="font-bold text-ink">{p.name}</p>{current ? <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-[11px] font-bold text-primary">CURRENT</span> : null}</div>
              <p className="tnum mt-1 text-[28px] font-bold tracking-tight text-ink">{inr(cycle === "ANNUAL" ? Number(p.annualPrice) : Number(p.monthlyPrice))}<span className="text-sm font-normal text-ink-faint">/{cycle === "ANNUAL" ? "yr" : "mo"}</span></p>
              <ul className="mt-3 space-y-1.5 text-[13px] text-ink-soft">
                <li className="flex gap-1.5"><Check size={14} className="mt-0.5 shrink-0 text-secondary" />{p.maxClients} active clients</li>
                <li className="flex gap-1.5"><Check size={14} className="mt-0.5 shrink-0 text-secondary" />{p.maxStaff} staff seats · {p.maxStorageMb} MB</li>
                {(p.features as string[]).slice(0, 3).map((f: string) => <li key={f} className="flex gap-1.5"><Check size={14} className="mt-0.5 shrink-0 text-secondary" />{f}</li>)}
              </ul>
              <div className="mt-4"><Button variant={current ? "outline" : "primary"} size="sm" disabled={busy === p.id || current} onClick={() => void checkout(p.id, p.name)} className="w-full">{current ? "Current plan" : busy === p.id ? "Working…" : `Choose ${p.name}`}</Button></div>
            </Card>
          );
        })}
      </div>
      <Card>
        <CardHeader title="Billing history" />
        <div className="space-y-1.5 text-sm">{history.length === 0 ? <p className="text-ink-faint">No records yet.</p> : history.map((s: { id: string; plan: { name: string }; status: string; billingCycle: string }) => <p key={s.id} className="text-ink-soft"><strong className="text-ink">{s.plan.name}</strong> · {s.status} · {s.billingCycle}</p>)}</div>
      </Card>
    </div>
  );
}
