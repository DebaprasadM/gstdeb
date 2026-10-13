"use client";
import { useEffect, useState } from "react";
import { TriangleAlert, CircleCheck, Circle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { API_URL, apiFetch, ApiError, inr, currentPeriod } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button, Card, CardHeader, EmptyState, Field, PageHeader, Select, Skeleton, Stat, TextInput } from "@/components/ui/primitives";

export default function GstPage() {
  const { me } = useAuth();
  const { push } = useToast();
  const org = me?.organizations[0];
  const [clients, setClients] = useState<Array<{ id: string; businessName: string }>>([]);
  const [clientId, setClientId] = useState(() =>
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("client") ?? "" : ""
  );
  const [period, setPeriod] = useState(() => currentPeriod());
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!org) return;
    apiFetch<{ data: Array<{ id: string; businessName: string }> }>(`/api/v1/organizations/${org.id}/clients?pageSize=100`).then((r) => { setClients(r.data); if (!clientId || !r.data.some((x) => x.id === clientId)) { if (r.data[0]) setClientId(r.data[0].id); } }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id]);

  async function load() {
    if (!clientId) { push("error", "Pick a client first."); return; }
    try {
      const res = await apiFetch<{ data: unknown }>(`/api/v1/organizations/${org!.id}/clients/${clientId}/gst?period=${period}`);
      setData(res.data);
    } catch (e) { push("error", e instanceof ApiError ? e.message : "Failed"); }
  }

  async function markPrepared() {
    setBusy(true);
    try {
      await apiFetch(`/api/v1/organizations/${org!.id}/clients/${clientId}/returns`, { method: "PUT", body: JSON.stringify({ returnType: "GSTR-3B", financialYear: "2026-27", period, status: "PREPARED", summary: data }) });
      push("success", "Marked PREPARED. File on the GST portal, then confirm FILED explicitly.");
      void load();
    } catch (e) { push("error", e instanceof ApiError ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  if (!org) return <EmptyState title="No organization" hint="Your account has no firm attached." />;
  return (
    <div className="space-y-5">
      <PageHeader title="GST preparation" sub="Estimates only — not filed returns. ITC subject to verification." />
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1"><Field label="Client"><Select value={clientId} onChange={(e) => setClientId(e.target.value)}>{clients.map((c) => <option key={c.id} value={c.id}>{c.businessName}</option>)}</Select></Field></div>
          <Field label="Period"><TextInput value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-09" /></Field>
          <Button onClick={load}>Generate summary</Button>
          {data ? <a className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary" href={`${API_URL}/api/v1/organizations/${org.id}/clients/${clientId}/gst/export?period=${period}`}>Export CSV</a> : null}
        </div>
      </Card>
      {!data ? <EmptyState title="Pick a client and period" hint="The workspace shows turnover, output tax, claimable ITC, warnings and a filing checklist." /> : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <Stat label="Taxable turnover" value={inr(Number(data.sales.taxable))} sub={`${data.sales.count} sales entries`} />
            <Stat label="Output tax" value={inr(Number(data.sales.outputTax))} sub={`CGST ${inr(Number(data.sales.cgst))} · SGST ${inr(Number(data.sales.sgst))} · IGST ${inr(Number(data.sales.igst))}`} />
            <Stat label="ITC claimable" value={inr(Number(data.liability.itcClaimable))} sub={`${data.purchases.pendingReview} purchases unreviewed`} />
            <Stat label="Net payable (est.)" value={inr(Number(data.liability.netPayable))} accent />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Warnings" sub={`${data.warnings.length} to review`} />
              {data.warnings.length === 0 ? <p className="text-sm text-ink-faint">Clean — nothing flagged.</p> :
                <ul className="space-y-2">{data.warnings.map((w: string) => <li key={w} className="flex items-start gap-2 text-sm text-amber-800"><TriangleAlert size={15} className="mt-0.5 shrink-0" />{w}</li>)}</ul>}
            </Card>
            <Card>
              <CardHeader title="Filing checklist" />
              <ul className="space-y-2 text-sm">{data.checklist.map((c: { item: string; done: boolean }) => <li key={c.item} className="flex items-center gap-2 text-ink">{c.done ? <CircleCheck size={16} className="text-secondary" /> : <Circle size={16} className="text-slate-300" />}{c.item}</li>)}</ul>
              {data.returns?.length ? (
                <div className="mt-3 space-y-1 border-t border-slate-100 pt-3">
                  {data.returns.map((r: { returnType: string; status: string; updatedAt: string }) => (
                    <p key={r.returnType} className="text-[13px] text-ink-soft">{r.returnType}: <strong className="text-ink">{r.status}</strong> · saved {String(r.updatedAt).slice(0, 10)}</p>
                  ))}
                </div>
              ) : null}
              <div className="mt-4"><Button onClick={markPrepared} disabled={busy}>{busy ? "Saving…" : "Mark GSTR-3B Prepared"}</Button></div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
