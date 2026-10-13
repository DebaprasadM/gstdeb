"use client";
import { useEffect, useState } from "react";
import { Plus, Upload, Trash2, ReceiptText } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { API_URL, apiFetch, ApiError, inr, currentPeriod, todayISO } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button, EmptyState, Field, PageHeader, SearchInput, Select, Skeleton, TableShell, TextInput } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";

const RATES = [0, 5, 12, 18, 28];

interface Line { description: string; hsn: string; quantity: string; rate: string; }
const blankLine = (): Line => ({ description: "", hsn: "", quantity: "", rate: "" });
const lineAmount = (l: Line) => (Number(l.quantity) || 0) * (Number(l.rate) || 0);

function RegisterPage({ kind }: { kind: "sales" | "purchases" }) {
  const { me } = useAuth();
  const { push } = useToast();
  const org = me?.organizations[0];
  const [rows, setRows] = useState<any[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; businessName: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ clientId: "", invoiceNumber: "", invoiceDate: todayISO(), gstRate: "18", period: currentPeriod(), party: "", partyGstin: "" });
  // Deep-link: ?client=<id> preselects (e.g. from the client detail page)
  const [clientFilter, setClientFilter] = useState(() =>
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("client") ?? "" : ""
  );
  const [periodFilter, setPeriodFilter] = useState(() => currentPeriod());
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [viewing, setViewing] = useState<any>(null);

  const itemsTotal = lines.reduce((a, l) => a + lineAmount(l), 0);
  const partyLabel = kind === "sales" ? "Customer" : "Supplier";

  async function load(opts?: { period?: string }) {
    if (!org) return;
    setLoading(true);
    try {
      const c = await apiFetch<{ data: Array<{ id: string; businessName: string }> }>(`/api/v1/organizations/${org.id}/clients?pageSize=100`);
      setClients(c.data);
      // Default: first client only (per-client working view). "All clients" stays one click away.
      let fid = clientFilter;
      if (!fid || (fid !== "all" && !c.data.some((x) => x.id === fid))) {
        fid = c.data[0]?.id ?? "all";
        setClientFilter(fid);
      }
      const per = opts?.period ?? periodFilter;
      const params = new URLSearchParams();
      if (fid !== "all") params.set("clientId", fid);
      if (/^\d{4}-\d{2}$/.test(per)) params.set("period", per);
      if (invoiceSearch.trim()) params.set("q", invoiceSearch.trim());
      const qs = params.toString() ? `?${params.toString()}` : "";
      const r = await apiFetch<{ data: any[] }>(`/api/v1/organizations/${org.id}/${kind}${qs}`);
      setRows(r.data);
      if (!form.clientId && c.data[0]) setForm((f) => ({ ...f, clientId: fid !== "all" ? fid : c.data[0]!.id }));
      // Smart fallback: current month empty → jump to the latest month that has entries.
      if (!opts && r.data.length === 0 && !invoiceSearch.trim() && /^\d{4}-\d{2}$/.test(per)) {
        const scope = fid !== "all" ? `&clientId=${fid}` : "";
        const latest = await apiFetch<{ data: Array<{ period: string }> }>(`/api/v1/organizations/${org.id}/${kind}?pageSize=1${scope}`);
        const p = latest.data[0]?.period;
        if (p && p !== per) {
          setPeriodFilter(p);
          push("info", `No entries in ${per} — showing ${p} instead.`);
          await load({ period: p });
        }
      }
    } finally { setLoading(false); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (org) void load(); }, [org?.id]);

  function setLine(i: number, patch: Partial<Line>) {
    setLines((xs) => xs.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  async function add() {
    const filled = lines.filter((l) => l.description.trim());
    if (!form.clientId || !form.invoiceNumber.trim() || filled.length === 0) {
      push("error", "Client, invoice no. and at least one item are required.");
      return;
    }
    if (filled.some((l) => !(Number(l.quantity) > 0) || !(Number(l.rate) >= 0))) {
      push("error", "Each item needs a quantity and rate.");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        clientId: form.clientId, invoiceNumber: form.invoiceNumber.trim(), invoiceDate: form.invoiceDate,
        taxableValue: Math.round(itemsTotal * 100) / 100, gstRate: Number(form.gstRate), period: form.period,
        items: filled.map((l) => ({ description: l.description.trim(), hsn: l.hsn.trim() || null, quantity: Number(l.quantity), rate: Number(l.rate) }))
      };
      if (kind === "sales") {
        body.customerName = form.party.trim() || null;
        body.customerGstin = form.partyGstin.trim() || null;
      } else {
        body.supplierName = form.party.trim() || "Supplier";
        body.supplierGstin = form.partyGstin.trim() || null;
      }
      await apiFetch(`/api/v1/organizations/${org!.id}/${kind}`, { method: "POST", body: JSON.stringify(body) });
      setForm({ ...form, invoiceNumber: "", party: "", partyGstin: "" });
      setLines([blankLine()]);
      setShowForm(false);
      push("success", `Saved — ${filled.length} item(s), taxes computed server-side.`);
      void load();
    } catch (e) { push("error", e instanceof ApiError ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  async function importFile(f: File | undefined) {
    if (!f || !form.clientId) { push("error", "Pick a client first."); return; }
    const fd = new FormData();
    fd.append("file", f);
    fd.append("clientId", form.clientId);
    const csrf = document.cookie.match(/(?:^|; )csrf=([^;]*)/)?.[1];
    const res = await fetch(`${API_URL}/api/v1/organizations/${org!.id}/${kind}/import`, { method: "POST", credentials: "include", headers: csrf ? { "x-csrf-token": decodeURIComponent(csrf) } : {}, body: fd });
    const body = await res.json().catch(() => null);
    if (!res.ok) { push("error", body?.error?.message ?? "Import failed"); return; }
    push(body.data.errorCount ? "info" : "success", `Imported ${body.data.imported} · ${body.data.errorCount} row errors`);
    if (body.data.errors?.length) console.table(body.data.errors);
    void load();
  }

  if (!org) return <EmptyState title="No organization" hint="Your account has no firm attached." />;
  const title = kind === "sales" ? "Sales register" : "Purchase register";
  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        sub="Who bought what, line by line · taxes split server-side"
        actions={<><Button size="sm" onClick={() => setShowForm(true)}><Plus size={15} /> New invoice</Button><label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary"><Upload size={15} /> Import Excel/CSV<input type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={(e) => void importFile(e.target.files?.[0])} /></label></>}
      />
      {showForm ? (
      <Modal title={`New ${kind === "sales" ? "sales" : "purchase"} invoice`} onClose={() => setShowForm(false)} wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Client"><Select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>{clients.map((c) => <option key={c.id} value={c.id}>{c.businessName}</option>)}</Select></Field>
          <Field label="Invoice no."><TextInput value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} placeholder="S-1024" /></Field>
          <Field label="Date"><TextInput type="date" value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} /></Field>
          <Field label={`${partyLabel} name`}><TextInput value={form.party} onChange={(e) => setForm({ ...form, party: e.target.value })} placeholder={kind === "sales" ? "Anup General Store" : "Metro Wholesale"} /></Field>
          <Field label={`${partyLabel} GSTIN (optional)`}><TextInput value={form.partyGstin} onChange={(e) => setForm({ ...form, partyGstin: e.target.value.toUpperCase() })} placeholder="19…" /></Field>
        </div>
        <div className="mt-4 space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid gap-2 rounded-lg bg-background p-2.5 sm:grid-cols-[1.6fr_0.7fr_0.6fr_0.7fr_0.7fr_auto]">
              <TextInput value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder={`Item ${i + 1} — e.g. Basmati Rice 25kg`} />
              <TextInput value={l.hsn} onChange={(e) => setLine(i, { hsn: e.target.value })} placeholder="HSN" />
              <TextInput inputMode="decimal" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} placeholder="Qty" />
              <TextInput inputMode="decimal" value={l.rate} onChange={(e) => setLine(i, { rate: e.target.value })} placeholder="Rate ₹" />
              <div className="tnum flex items-center px-1 text-sm font-medium text-ink">{inr(lineAmount(l))}</div>
              <button onClick={() => setLines((xs) => xs.length > 1 ? xs.filter((_, j) => j !== i) : [blankLine()])} className="rounded-lg p-2 text-ink-faint hover:bg-red-50 hover:text-red-600" title="Remove line"><Trash2 size={15} /></button>
            </div>
          ))}
          <button onClick={() => setLines((xs) => [...xs, blankLine()])} className="text-[13px] font-medium text-primary hover:underline">+ Add another item</button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <Field label="GST %"><Select value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: e.target.value })}>{RATES.map((r) => <option key={r} value={r}>{r}</option>)}</Select></Field>
          <Field label="Period"><TextInput value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} /></Field>
          <p className="tnum text-sm text-ink-soft">Items total: <strong className="text-ink">{inr(itemsTotal)}</strong></p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={add} disabled={saving}><Plus size={15} /> {saving ? "Saving…" : "Save invoice"}</Button>
          </div>
        </div>
      </Modal>
      ) : null}
      {loading ? <Skeleton /> : rows.length === 0 ? <EmptyState title={`No ${kind} yet`} hint="Save your first invoice above, or import a month's bills from Excel/CSV." /> :
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={clientFilter} onChange={(e) => { setClientFilter(e.target.value); if (e.target.value !== "all") setForm((f) => ({ ...f, clientId: e.target.value })); }} className="!w-auto">
              <option value="all">All clients</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.businessName}</option>)}
            </Select>
            <div className="w-56"><SearchInput value={invoiceSearch} onChange={setInvoiceSearch} placeholder="Search invoice no…" /></div>
            <TextInput type="month" value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)} className="!w-auto" aria-label="Filter by month" />
            <Button size="sm" variant="outline" onClick={() => void load()}>Apply filters</Button>
          </div>
          <TableShell head={["Invoice", "Client", partyLabel, "Items", "Taxable", "CGST", "SGST", "IGST", "Total"]}>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-medium text-ink">{r.invoiceNumber}<span className="block text-[11px] font-normal text-ink-faint">{String(r.invoiceDate).slice(0, 10)}</span></td>
                <td><span className="inline-flex items-center rounded-full bg-secondary-50 px-2.5 py-0.5 text-[12px] font-semibold text-secondary-700 ring-1 ring-inset ring-secondary-100">{r.client?.businessName}</span></td>
                <td className="max-w-[180px] truncate text-ink-soft" title={kind === "sales" ? (r.customerName ?? "") : r.supplierName}>{kind === "sales" ? (r.customerName ?? "—") : r.supplierName}</td>
              <td><button onClick={() => setViewing(r)} className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-[12px] font-medium text-primary hover:bg-primary-100"><ReceiptText size={13} /> {r.items?.length ?? 0} item{(r.items?.length ?? 0) === 1 ? "" : "s"}</button></td>
              <td className="tnum">{inr(Number(r.taxableValue))}</td>
              <td className="tnum text-ink-soft">{inr(Number(r.cgst))}</td>
              <td className="tnum text-ink-soft">{inr(Number(r.sgst))}</td>
              <td className="tnum text-ink-soft">{inr(Number(r.igst))}</td>
              <td className="tnum font-semibold text-ink">{inr(Number(r.totalValue))}</td>
            </tr>
          ))}
        </TableShell>
        </>}
      {viewing ? (
        <Modal title={`${viewing.invoiceNumber} — ${(kind === "sales" ? viewing.customerName : viewing.supplierName) ?? ""}`} onClose={() => setViewing(null)} wide>
          <div className="space-y-2">
            {(viewing.items ?? []).map((it: { id: string; description: string; hsn: string | null; quantity: string; rate: string; amount: string }) => (
              <div key={it.id} className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2.5 text-sm">
                <div><p className="font-medium text-ink">{it.description}</p><p className="text-xs text-ink-faint">{it.hsn ? `HSN ${it.hsn} · ` : ""}{it.quantity} × {inr(Number(it.rate))}</p></div>
                <p className="tnum font-semibold text-ink">{inr(Number(it.amount))}</p>
              </div>
            ))}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

export default RegisterPage;
