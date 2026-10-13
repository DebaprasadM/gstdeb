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
  const [match, setMatch] = useState<any>(null);
  const [matchMsg, setMatchMsg] = useState("");
  const [t3b, setT3b] = useState<any>(null);

  useEffect(() => {
    if (!org) return;
    apiFetch<{ data: Array<{ id: string; businessName: string }> }>(`/api/v1/organizations/${org.id}/clients?pageSize=100`).then((r) => { setClients(r.data); if (!clientId || !r.data.some((x) => x.id === clientId)) { if (r.data[0]) setClientId(r.data[0].id); } }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id]);

  async function load() {
    try {
      const res = await apiFetch<{ data: unknown }>(`/api/v1/organizations/${org!.id}/clients/${clientId}/gst?period=${period}`);
      setData(res.data);
      const b3 = await apiFetch<{ data: unknown }>(`/api/v1/organizations/${org!.id}/clients/${clientId}/gst/gstr3b?period=${period}`);
      setT3b(b3.data);
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

  async function loadMatch() {
    if (!clientId) return;
    setMatchMsg("");
    try {
      const res = await apiFetch<{ data: unknown }>(`/api/v1/organizations/${org!.id}/clients/${clientId}/itc-match?period=${period}`);
      setMatch(res.data);
    } catch (e) { setMatchMsg(e instanceof ApiError ? e.message : "Match failed"); }
  }

  async function import2B(f: File | undefined) {
    if (!f || !clientId) { push("error", "Pick a client and a 2B file first."); return; }
    const fd = new FormData();
    fd.append("file", f);
    fd.append("period", period);
    const csrf = document.cookie.match(/(?:^|; )csrf=([^;]*)/)?.[1];
    const res = await fetch(`${API_URL}/api/v1/organizations/${org!.id}/clients/${clientId}/gstr2b/import`, { method: "POST", credentials: "include", headers: csrf ? { "x-csrf-token": decodeURIComponent(csrf) } : {}, body: fd });
    const body = await res.json().catch(() => null);
    if (!res.ok) { push("error", body?.error?.message ?? "2B import failed"); return; }
    push("success", `2B: ${body.data.imported} rows in, ${body.data.errorCount} errors.`);
    void loadMatch();
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
          {data ? <a className="inline-flex items-center rounded-lg border border-primary/40 bg-primary-50 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary-100" href={`${API_URL}/api/v1/organizations/${org.id}/clients/${clientId}/gst/gstr1.json?period=${period}`}>GSTR-1 JSON</a> : null}
        </div>
        <details className="mt-3 rounded-lg bg-background px-3 py-2 text-[13px] text-ink-soft">
          <summary className="cursor-pointer font-medium text-ink">How to file with this JSON</summary>
          <ol className="mt-1.5 list-decimal space-y-1 pl-5">
            <li><strong>GSTR-1 JSON</strong> matches the portal offline-tool format (B2B / B2CL / B2CS + HSN summary).</li>
            <li>Open the <strong>official GST offline tool</strong>, import it and run its validation.</li>
            <li>Fix anything flagged there, generate the summary file in the tool.</li>
            <li>Upload on <strong>gst.gov.in</strong> → submit → file. Then mark the return Filed here.</li>
          </ol>
          <p className="mt-1.5">We never file for you and never fake a filing — preparation data only.</p>
        </details>
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
          {t3b ? (
          <Card>
            <CardHeader
              title="GSTR-3B tables — ready to copy to portal"
              sub="Estimates from books · verify zero-rated/import/exempt lines manually"
              action={<a className="rounded border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-medium text-ink" href={`${API_URL}/api/v1/organizations/${org!.id}/clients/${clientId}/gst/gstr3b?period=${period}&format=csv`}>3B CSV</a>}
            />
            <div className="overflow-x-auto">
              <table className="table-premium w-full min-w-[560px] text-sm">
                <thead><tr><th>Table</th><th>Line</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Cess</th></tr></thead>
                <tbody>
                  {[
                    ["3.1", "a · outward taxable", t3b.table31.a_outward_taxable],
                    ["3.1", "c · reverse charge", t3b.table31.c_reverse_charge],
                    ["4", "B · ITC available (ELIGIBLE only)", { ...t3b.table4.b_itc_available, taxable: "—" }],
                    ["4", "C · ineligible", { ...t3b.table4.c_ineligible, taxable: "—" }],
                    ["6.1", "Cash payable", { ...t3b.table61.cash_payable, taxable: "—" }]
                  ].map(([t, l, r]: any) => (
                    <tr key={`${t}-${l}`}>
                      <td className="font-semibold">{t}</td><td className="text-ink-soft">{l}</td>
                      <td className="tnum">{r.taxable}</td><td className="tnum">{r.cgst}</td>
                      <td className="tnum">{r.sgst}</td><td className="tnum">{r.igst}</td><td className="tnum">{r.cess}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-ink-faint">Pending-ITC purchases excluded by design · imports need bill-of-entry data · RCM outward in 3.1(c).</p>
          </Card>
          ) : null}
          <Card>
            <CardHeader
              title="ITC match — books vs GSTR-2B"
              sub="Upload the portal 2B download; suppliers who didn't report put your ITC at risk"
              action={<Button size="sm" variant="outline" onClick={loadMatch}>Run match</Button>}
            />
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-ink-soft">2B file (CSV/Excel from portal):</span>
              <input type="file" accept=".csv,.xls,.xlsx" onChange={(e) => void import2B(e.target.files?.[0])} />
            </div>
            {matchMsg ? <p className="text-sm text-red-600">{matchMsg}</p> : null}
            {!match ? <p className="text-sm text-ink-faint">Import the 2B file (auto-runs match) or press Run match.</p> : !match.has2B ? (
              <p className="text-sm text-ink-faint">No 2B rows for {match.period} yet — import the portal download above.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Matched" value={String(match.summary.matched)} />
                  <Stat label="Value gaps" value={String(match.summary.mismatch)} />
                  <Stat label="Missing in 2B" value={String(match.summary.missingIn2b)} />
                  <Stat label="ITC at risk" value={inr(Number(match.summary.itcAtRisk))} accent />
                </div>
                {Number(match.summary.itcUnclaimed) > 0 ? <p className="mt-2 text-sm text-ink-soft">Unclaimed in books (present in 2B only): <strong className="text-ink">{inr(Number(match.summary.itcUnclaimed))}</strong> — enter these purchases.</p> : null}
                <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto">
                  {(match.results as Array<{ invoiceNumber: string; supplier: string | null; status: string; itcAmount: string; taxableDiff: string; taxDiff: string }>).filter((r) => r.status !== "MATCHED").map((r) => (
                    <div key={`${r.status}-${r.invoiceNumber}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background px-3 py-2 text-sm">
                      <p className="font-medium text-ink">{r.invoiceNumber} <span className="font-normal text-ink-soft">· {r.supplier ?? "—"}</span></p>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${r.status === "MISSING_IN_2B" ? "bg-red-50 text-red-700" : r.status === "VALUE_MISMATCH" ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-700"}`}>
                        {r.status === "MISSING_IN_2B" ? `Not reported · ITC ${inr(Number(r.itcAmount))} at risk` : r.status === "VALUE_MISMATCH" ? `Diff tax ${inr(Number(r.taxDiff))}` : `Not in books · ITC ${inr(Number(r.itcAmount))}`}
                      </span>
                    </div>
                  ))}
                  {(match.results as Array<{ status: string }>).every((r) => r.status === "MATCHED") ? <p className="text-sm text-emerald-700">✓ Everything matched — ITC is safe for this period.</p> : null}
                </div>
                <p className="mt-2 text-xs text-ink-faint">Advisory only — claim ITC for invoices present in 2B (Sec 16(2)). Tolerance ₹1.</p>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
