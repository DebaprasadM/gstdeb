"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { apiFetch, ApiError, inr, currentPeriod } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button, Card, CardHeader, EmptyState, Field, PageHeader, Select, Skeleton } from "@/components/ui/primitives";

export default function FeesPage() {
  const { me } = useAuth();
  const { push } = useToast();
  const org = me?.organizations[0];
  const [rows, setRows] = useState<any[]>([]);
  const [out, setOut] = useState<Array<{ clientId: string; businessName: string; outstanding: string }>>([]);
  const [clients, setClients] = useState<Array<{ id: string; businessName: string; serviceFee?: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ clientId: "", period: currentPeriod(), amountBilled: "" });
  const [clientFilter, setClientFilter] = useState(() =>
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("client") ?? "" : ""
  );
  const [pay, setPay] = useState({ feeId: "", amountPaid: "", paymentMethod: "UPI" });

  async function load() {
    if (!org) return;
    setLoading(true);
    try {
      const c = await apiFetch<{ data: Array<{ id: string; businessName: string; serviceFee?: string | null }> }>(`/api/v1/organizations/${org.id}/clients?pageSize=100`);
      setClients(c.data);
      let fid = clientFilter;
      if (!fid || (fid !== "all" && !c.data.some((x) => x.id === fid))) {
        fid = c.data[0]?.id ?? "all";
        setClientFilter(fid);
      }
      const feeQs = fid !== "all" ? `?clientId=${fid}` : "";
      const [f, o] = await Promise.all([
        apiFetch<{ data: any[] }>(`/api/v1/organizations/${org.id}/fees${feeQs}`),
        apiFetch<{ data: Array<{ clientId: string; businessName: string; outstanding: string }> }>(`/api/v1/organizations/${org.id}/fees/outstanding`)
      ]);
      setRows(f.data);
      setOut(fid !== "all" ? o.data.filter((x) => x.clientId === fid) : o.data);
      if (!form.clientId && c.data[0]) {
        const firstId = fid !== "all" ? fid : c.data[0]!.id;
        const first = c.data.find((x) => x.id === firstId);
        setForm((x) => ({ ...x, clientId: firstId, amountBilled: x.amountBilled || (first?.serviceFee ? String(first.serviceFee) : "") }));
      }
    } finally { setLoading(false); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (org) void load(); }, [org?.id]);

  async function bill() {
    if (!form.clientId || !form.amountBilled) { push("error", "Pick a client and amount."); return; }
    try {
      await apiFetch(`/api/v1/organizations/${org!.id}/fees`, { method: "POST", body: JSON.stringify({ clientId: form.clientId, period: form.period, amountBilled: Number(form.amountBilled) }) });
      setForm({ ...form, amountBilled: "" });
      push("success", "Bill raised.");
      void load();
    } catch (e) { push("error", e instanceof ApiError ? e.message : "Failed"); }
  }

  async function recordPay() {
    if (!pay.feeId || !pay.amountPaid) { push("error", "Pick a bill and amount."); return; }
    try {
      await apiFetch(`/api/v1/organizations/${org!.id}/fees/${pay.feeId}/payments`, { method: "POST", body: JSON.stringify({ amountPaid: Number(pay.amountPaid), paymentMethod: pay.paymentMethod }) });
      setPay({ ...pay, amountPaid: "" });
      push("success", "Payment recorded.");
      void load();
    } catch (e) { push("error", e instanceof ApiError ? e.message : "Failed"); }
  }

  // Monthly run: one bill per active client that has a charge set, for the chosen period.
  async function billAll() {
    const withCharge = clients.filter((c) => c.serviceFee && Number(c.serviceFee) > 0);
    if (!withCharge.length) { push("error", "No client has a monthly charge set. Set it on the client page first."); return; }
    if (!window.confirm(`Raise ${form.period} bills for ${withCharge.length} clients from their monthly charges?`)) return;
    let created = 0, skipped = 0;
    for (const c of withCharge) {
      try {
        await apiFetch(`/api/v1/organizations/${org!.id}/fees`, { method: "POST", body: JSON.stringify({ clientId: c.id, period: form.period, amountBilled: Number(c.serviceFee) }) });
        created++;
      } catch {
        skipped++; // e.g. bill already exists — counted separately below
      }
    }
    push(created ? "success" : "info", `Billing run done: ${created} billed${skipped ? `, ${skipped} skipped (check for duplicates)` : ""}.`);
    void load();
  }

  if (!org) return <EmptyState title="No organization" hint="Your account has no firm attached." />;
  const totalOut = out.reduce((a, o) => a + Number(o.outstanding), 0);
  return (
    <div className="space-y-5">
      <PageHeader
        title="Service fees"
        sub={`Total outstanding: ${inr(totalOut)}`}
        actions={<Button size="sm" variant="secondary" onClick={billAll}>Bill all clients · {form.period}</Button>}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Select value={clientFilter} onChange={(e) => { setClientFilter(e.target.value); if (e.target.value !== "all") setForm((x) => ({ ...x, clientId: e.target.value })); }} className="!w-auto">
          <option value="all">All clients</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.businessName}</option>)}
        </Select>
        <Button size="sm" variant="outline" onClick={load}>Apply</Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Raise a bill" />
          <div className="grid gap-3">
            <Field label="Client"><Select value={form.clientId} onChange={(e) => {
              const c = clients.find((x) => x.id === e.target.value);
              setForm({ ...form, clientId: e.target.value, amountBilled: c?.serviceFee ? String(c.serviceFee) : "" });
            }}>{clients.map((c) => <option key={c.id} value={c.id}>{c.businessName}{c.serviceFee ? ` · ${inr(Number(c.serviceFee))}/mo` : ""}</option>)}</Select></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Period"><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} /></Field>
              <Field label="Amount ₹"><input className="tnum w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" inputMode="decimal" value={form.amountBilled} onChange={(e) => setForm({ ...form, amountBilled: e.target.value })} placeholder="2000" /></Field>
            </div>
            <Button onClick={bill}>Raise bill</Button>
          </div>
        </Card>
        <Card>
          <CardHeader title="Record a payment" sub="Only explicit payment events — never auto-marked" />
          <div className="grid gap-3">
            <Field label="Bill (unpaid only)"><Select value={pay.feeId} onChange={(e) => setPay({ ...pay, feeId: e.target.value })}><option value="">Select a bill…</option>{rows.filter((r) => Number(r.amountBilled) - Number(r.amountPaid) > 0).map((r) => <option key={r.id} value={r.id}>{r.client?.businessName} · {r.period} · due {inr(Number(r.amountBilled) - Number(r.amountPaid))}</option>)}</Select></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount ₹"><input className="tnum w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" inputMode="decimal" value={pay.amountPaid} onChange={(e) => setPay({ ...pay, amountPaid: e.target.value })} /></Field>
              <Field label="Method"><Select value={pay.paymentMethod} onChange={(e) => setPay({ ...pay, paymentMethod: e.target.value })}><option>UPI</option><option>Cash</option><option>Bank transfer</option><option>Cheque</option></Select></Field>
            </div>
            <Button variant="secondary" onClick={recordPay}>Record payment</Button>
          </div>
        </Card>
      </div>
      <Card>
        <CardHeader title="Outstanding by client" />
        {loading ? <Skeleton lines={2} /> : out.length === 0 ? <p className="text-sm text-ink-faint">Nothing pending — all collected. 🎉</p> :
          <div className="space-y-2">{out.map((o) => <div key={o.clientId} className="flex items-center justify-between gap-2 text-sm"><span className="font-medium text-ink">{o.businessName}</span><span className="tnum font-bold text-amber-700">{inr(Number(o.outstanding))}</span></div>)}</div>}
      </Card>
    </div>
  );
}
