"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Upload, Trash2, ReceiptText } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { API_URL, apiFetch, ApiError, inr, currentPeriod, todayISO } from "@/lib/api";
import { scanInvoice, prewarmOcr, cancelScan, ScanCancelled, type ScannedInvoice } from "@/lib/ocr";
import { useToast } from "@/components/ui/toast";
import { Button, Card, EmptyState, Field, PageHeader, SearchInput, Select, Skeleton, TableShell, TextInput } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";

const RATES = ["0", "0.1", "0.25", "1", "1.5", "3", "5", "7.5", "12", "18", "28"];

interface Line { description: string; hsn: string; quantity: string; rate: string; gstRate: string; }
const blankLine = (): Line => ({ description: "", hsn: "", quantity: "", rate: "", gstRate: "18" });
const lineAmount = (l: Line) => (Number(l.quantity) || 0) * (Number(l.rate) || 0);

function RegisterPage({ kind }: { kind: "sales" | "purchases" }) {
  const { me } = useAuth();
  const { push } = useToast();
  const org = me?.organizations[0];
  const [rows, setRows] = useState<any[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; businessName: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ clientId: "", invoiceNumber: "", invoiceDate: todayISO(), period: currentPeriod(), party: "", partyGstin: "", placeOfSupply: "", invoiceType: "B2B", discount: "", reverseCharge: false, shipToName: "", shipToGstin: "", shipToAddress: "", transporterName: "", transporterId: "", vehicleNo: "", ewayBillNo: "" });
  const [showShip, setShowShip] = useState(false);
  // "" = not chosen yet: user picks a client first, then rows load.
  // Deep-link (?client=<id>) preselects, e.g. from the client detail page.
  const [clientFilter, setClientFilter] = useState(() =>
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("client") ?? "" : ""
  );
  const [periodFilter, setPeriodFilter] = useState(() => currentPeriod());
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saveDraft, setSaveDraft] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<any>(null);
  const [suggest, setSuggest] = useState<Array<{ description: string; hsn: string | null; rate: string; gstRate: string }>>([]);
  const [cloneNum, setCloneNum] = useState("");
  const [cloneDate, setCloneDate] = useState(() => todayISO());
  const [scan, setScan] = useState<{ pct: number; status: string } | null>(null);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanText, setScanText] = useState("");
  const [fieldConf, setFieldConf] = useState<Record<string, number>>({});

  const itemsTotal = lines.reduce((a, l) => a + lineAmount(l), 0);
  const partyLabel = kind === "sales" ? "Customer" : "Supplier";

  async function loadClients() {
    if (!org) return [];
    const c = await apiFetch<{ data: Array<{ id: string; businessName: string }> }>(`/api/v1/organizations/${org.id}/clients?pageSize=100`);
    setClients(c.data);
    return c.data;
  }

  function chooseClient(fid: string) {
    setClientFilter(fid);
    if (fid !== "all") setForm((f) => ({ ...f, clientId: fid }));
    void load({ clientId: fid });
  }

  async function load(opts?: { period?: string; clientId?: string; retried?: boolean }) {
    if (!org) return;
    const fid = opts?.clientId ?? clientFilter;
    if (!fid) return; // nothing chosen yet — rows stay empty until user picks
    setLoading(true);
    try {
      const per = opts?.period ?? periodFilter;
      const params = new URLSearchParams();
      if (fid !== "all") params.set("clientId", fid);
      if (/^\d{4}-\d{2}$/.test(per)) params.set("period", per);
      if (invoiceSearch.trim()) params.set("q", invoiceSearch.trim());
      const qs = params.toString() ? `?${params.toString()}` : "";
      const r = await apiFetch<{ data: any[] }>(`/api/v1/organizations/${org.id}/${kind}${qs}`);
      setRows(r.data);
      // Smart fallback: chosen month empty → jump to latest month with entries.
      if (!opts?.retried && r.data.length === 0 && !invoiceSearch.trim() && /^\d{4}-\d{2}$/.test(per)) {
        const scope = fid !== "all" ? `&clientId=${fid}` : "";
        const latest = await apiFetch<{ data: Array<{ period: string }> }>(`/api/v1/organizations/${org.id}/${kind}?pageSize=1${scope}`);
        const p = latest.data[0]?.period;
        if (p && p !== per) {
          setPeriodFilter(p);
          push("info", `No entries in ${per} — showing ${p} instead.`);
          await load({ period: p, clientId: fid, retried: true });
        }
      }
    } finally { setLoading(false); }
  }
  // Warm the OCR engine while the modal is open so Scan starts instantly.
  useEffect(() => {
    if (showForm && !editingId) {
      const t = setTimeout(() => prewarmOcr(), 800);
      return () => clearTimeout(t);
    }
  }, [showForm, editingId]);
  useEffect(() => {
    if (!org) return;
    void loadClients().then((list) => {
      const deep = new URLSearchParams(window.location.search).get("client") ?? "";
      if (deep && (deep === "all" || list.some((x) => x.id === deep))) {
        setClientFilter(deep);
        if (deep !== "all") setForm((f) => ({ ...f, clientId: deep }));
        void load({ clientId: deep });
      } else setLoading(false);
    });
  }, [org?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function setLine(i: number, patch: Partial<Line>) {
    setLines((xs) => xs.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  function openNew() {
    setEditingId(null);
    setLines([blankLine()]);
    setSaveDraft(false);
    setScanFile(null);
    setScanText("");
    setFieldConf({});
    setShowForm(true);
  }

  function openEdit(inv: any) {
    setEditingId(inv.id);
    setForm({
      clientId: inv.clientId, invoiceNumber: inv.invoiceNumber,
      invoiceDate: String(inv.invoiceDate).slice(0, 10), period: inv.period,
      party: kind === "sales" ? (inv.customerName ?? "") : (inv.supplierName ?? ""),
      partyGstin: kind === "sales" ? (inv.customerGstin ?? "") : (inv.supplierGstin ?? ""),
      placeOfSupply: inv.placeOfSupply ?? "", invoiceType: inv.invoiceType ?? "B2B",
      discount: inv.discount ? String(inv.discount) : "", reverseCharge: Boolean(inv.reverseCharge),
      shipToName: inv.shipToName ?? "", shipToGstin: inv.shipToGstin ?? "",
      shipToAddress: inv.shipToAddress ?? "", transporterName: inv.transporterName ?? "",
      transporterId: inv.transporterId ?? "", vehicleNo: inv.vehicleNo ?? "", ewayBillNo: inv.ewayBillNo ?? ""
    });
    setLines((inv.items ?? []).map((l: { description: string; hsn: string | null; quantity: string; rate: string; gstRate: string }) => ({
      description: l.description, hsn: l.hsn ?? "",
      quantity: String(l.quantity), rate: String(l.rate), gstRate: String(l.gstRate)
    })));
    setSaveDraft(inv.status === "DRAFT");
    setViewing(null);
    setShowForm(true);
  }

  // Item master suggestions (auto-learned from saved bills).
  async function fetchSuggest(q: string) {
    if (!org || q.trim().length < 2) { setSuggest([]); return; }
    try {
      const res = await apiFetch<{ data: Array<{ description: string; hsn: string | null; rate: string; gstRate: string }> }>(
        `/api/v1/organizations/${org.id}/items-master?q=${encodeURIComponent(q.trim())}`
      );
      setSuggest(res.data);
    } catch { /* suggestions are best-effort */ }
  }

  async function startScan(file: File | undefined) {
    if (!file) return;
    if (!form.clientId) { push("error", "Pick a client first, then scan."); return; }
    setScanFile(file);
    setScan({ pct: 0, status: "Loading OCR engine (one-time download)…" });
    try {
      const s: ScannedInvoice = await scanInvoice(file, (pct, status) => setScan({ pct, status }));
      applyScan(s);
      push(s.overall >= 60 ? "success" : "info", `Scanned (${s.overall}%) — verify highlighted fields, then Save.`);
    } catch (e) {
      if (e instanceof ScanCancelled) return;
      push("error", e instanceof Error ? e.message : "Could not read this photo — enter manually; the photo stays attached below.");
    } finally {
      setScan(null);
    }
  }

  function applyScan(s: ScannedInvoice) {
    const conf: Record<string, number> = {
      invoiceNumber: s.invoiceNumber.confidence,
      invoiceDate: s.invoiceDate.confidence,
      party: s.partyName.confidence,
      partyGstin: s.partyGstin.confidence
    };
    setFieldConf(conf);
    setScanText(s.rawText);
    setForm((f) => ({
      ...f,
      invoiceNumber: s.invoiceNumber.value || f.invoiceNumber,
      invoiceDate: s.invoiceDate.value || f.invoiceDate,
      party: s.partyName.value || f.party,
      partyGstin: s.partyGstin.value || f.partyGstin
    }));
    if (s.lines.length) {
      setLines(s.lines.map((l) => ({
        description: l.description.value,
        hsn: l.hsn.value,
        quantity: l.quantity.value ? String(l.quantity.value) : "",
        rate: l.rate.value ? String(l.rate.value) : "",
        gstRate: l.gstRate.value ? String(l.gstRate.value) : "18"
      })));
    }
  }

  const confRing = (key: string) =>
    fieldConf[key] !== undefined && fieldConf[key]! < 60 ? " !border-amber-400 !ring-2 !ring-amber-200" : "";

  function pickSuggestion(i: number, desc: string) {
    const hit = suggest.find((s) => s.description.toLowerCase() === desc.trim().toLowerCase());
    if (hit) setLine(i, { description: hit.description, hsn: hit.hsn ?? "", rate: String(hit.rate), gstRate: String(hit.gstRate) });
    setTimeout(() => setSuggest([]), 150);
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
        taxableValue: Math.round(itemsTotal * 100) / 100, period: form.period,
        invoiceType: form.invoiceType, discount: Number(form.discount || 0), reverseCharge: form.reverseCharge,
        placeOfSupply: form.placeOfSupply.trim() || null,
        status: saveDraft ? "DRAFT" : "POSTED",
        shipToName: form.shipToName.trim() || null, shipToGstin: form.shipToGstin.trim() || null,
        shipToAddress: form.shipToAddress.trim() || null,
        transporterName: form.transporterName.trim() || null, transporterId: form.transporterId.trim() || null,
        vehicleNo: form.vehicleNo.trim() || null, ewayBillNo: form.ewayBillNo.trim() || null,
        items: filled.map((l) => ({ description: l.description.trim(), hsn: l.hsn.trim() || null, quantity: Number(l.quantity), rate: Number(l.rate), gstRate: Number(l.gstRate) }))
      };
      if (kind === "sales") {
        body.customerName = form.party.trim() || null;
        body.customerGstin = form.partyGstin.trim() || null;
      } else {
        body.supplierName = form.party.trim() || "Supplier";
        body.supplierGstin = form.partyGstin.trim() || null;
      }
      if (editingId) {
        await apiFetch(`/api/v1/organizations/${org!.id}/${kind}/${editingId}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiFetch(`/api/v1/organizations/${org!.id}/${kind}`, { method: "POST", body: JSON.stringify(body) });
        await attachScanPhoto(form.clientId, form.period);
      }
      setForm({ ...form, invoiceNumber: "", party: "", partyGstin: "" });
      setLines([blankLine()]);
      setSaveDraft(false);
      setEditingId(null);
      setShowForm(false);
      push("success", editingId ? "Invoice updated — taxes recomputed." : saveDraft ? "Draft saved — post it to include in GST." : `Saved — ${filled.length} item(s), taxes computed server-side.`);
      void load();
    } catch (e) { push("error", e instanceof ApiError ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  async function postInvoice(id: string) {
    try {
      await apiFetch(`/api/v1/organizations/${org!.id}/${kind}/${id}`, { method: "PATCH", body: JSON.stringify({ status: "POSTED" }) });
      push("success", "Posted — now included in GST.");
      setViewing(null);
      void load();
    } catch (e) { push("error", e instanceof ApiError ? e.message : "Failed"); }
  }

  async function cloneInvoice() {
    if (!viewing || !cloneNum.trim()) { push("error", "Enter a new invoice number."); return; }
    try {
      await apiFetch(`/api/v1/organizations/${org!.id}/${kind}/${viewing.id}/clone`, {
        method: "POST", body: JSON.stringify({ invoiceNumber: cloneNum.trim(), invoiceDate: cloneDate, period: form.period })
      });
      push("success", "Cloned as draft — review and post it.");
      setViewing(null);
      setCloneNum("");
      void load();
    } catch (e) { push("error", e instanceof ApiError ? e.message : "Clone failed"); }
  }

  async function attachScanPhoto(clientId: string, period: string) {
    if (!scanFile || !org) return;
    try {
      const fd = new FormData();
      fd.append("file", scanFile);
      fd.append("period", period);
      fd.append("category", kind === "sales" ? "SALES_INVOICE" : "PURCHASE_BILL");
      fd.append("description", "Scanned bill photo (OCR source)");
      const csrf = document.cookie.match(/(?:^|; )csrf=([^;]*)/)?.[1];
      const res = await fetch(`${API_URL}/api/v1/organizations/${org.id}/clients/${clientId}/documents`, {
        method: "POST", credentials: "include",
        headers: csrf ? { "x-csrf-token": decodeURIComponent(csrf) } : {}, body: fd
      });
      if (res.ok) push("info", "Bill photo attached to documents.");
    } catch { /* attachment is best-effort */ }
    finally { setScanFile(null); }
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
  // Client column only matters when rows span multiple clients.
  const showClientCol = clientFilter === "all" || !clientFilter;
  const totals = rows.reduce(
    (a, r) => ({
      taxable: a.taxable + Number(r.taxableValue),
      tax: a.tax + Number(r.cgst) + Number(r.sgst) + Number(r.igst) + Number(r.cess ?? 0),
      total: a.total + Number(r.totalValue)
    }),
    { taxable: 0, tax: 0, total: 0 }
  );
  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        sub="Who bought what, line by line · taxes split server-side"
        actions={<><Button size="sm" onClick={openNew}><Plus size={15} /> New invoice</Button><label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary"><Upload size={15} /> Import Excel/CSV<input type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={(e) => void importFile(e.target.files?.[0])} /></label></>}
      />
      <Card className="!p-3 sm:!p-4">
        <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-end">
          <Field label="Client">
            <Select value={clientFilter} onChange={(e) => chooseClient(e.target.value)}>
              <option value="">Select a client…</option>
              <option value="all">All clients</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.businessName}</option>)}
            </Select>
          </Field>
          <Field label="Invoice no."><SearchInput value={invoiceSearch} onChange={setInvoiceSearch} placeholder="Search…" /></Field>
          <Field label="Month"><TextInput type="month" value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)} aria-label="Filter by month" /></Field>
          <Button size="sm" variant="outline" onClick={() => void load()}>Apply</Button>
        </div>
      </Card>
      {showForm ? (
      <Modal title={editingId ? `Edit ${kind === "sales" ? "sales" : "purchase"} invoice` : `New ${kind === "sales" ? "sales" : "purchase"} invoice`} onClose={() => { setShowForm(false); setEditingId(null); }} wide>
        {!editingId ? (
        <div className="mb-3 rounded-xl border border-dashed border-slate-300 bg-background px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-semibold text-white">
              📷 Camera
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void startScan(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-primary/40 bg-primary-50 px-3 py-1.5 text-[13px] font-semibold text-primary">
              🖼️ Gallery
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { void startScan(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            {scanFile ? <span className="max-w-[200px] truncate text-xs text-ink-soft">📎 {scanFile.name}</span> : <span className="text-xs text-ink-faint">Printed bills · auto-shrunk for speed · free on-device</span>}
          </div>
          {scan ? (
          <div className="mt-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-ink-soft">{scan.status}</p>
              <button onClick={() => { cancelScan(); setScan(null); }} className="shrink-0 text-xs font-semibold text-red-600 underline underline-offset-2">Cancel</button>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${scan.pct}%` }} /></div>
          </div>
          ) : null}
          {scanText ? (
          <details className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
            <summary className="cursor-pointer font-medium text-ink-soft">What the camera read (debug — share if items miss)</summary>
            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-ink-faint">{scanText}</pre>
          </details>
          ) : null}
        </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Client"><Select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>{clients.map((c) => <option key={c.id} value={c.id}>{c.businessName}</option>)}</Select></Field>
          <Field label="Invoice no."><TextInput value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} placeholder="S-1024" className={confRing("invoiceNumber")} /></Field>
          <Field label="Date"><TextInput type="date" value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} className={confRing("invoiceDate")} /></Field>
          <Field label={`${partyLabel} name`}><TextInput value={form.party} onChange={(e) => setForm({ ...form, party: e.target.value })} placeholder={kind === "sales" ? "Anup General Store" : "Metro Wholesale"} className={confRing("party")} /></Field>
          <Field label={`${partyLabel} GSTIN (optional)`}><TextInput value={form.partyGstin} onChange={(e) => setForm({ ...form, partyGstin: e.target.value.toUpperCase() })} placeholder="19…" className={confRing("partyGstin")} /></Field>
          <Field label="Invoice type"><Select value={form.invoiceType} onChange={(e) => setForm({ ...form, invoiceType: e.target.value })}><option>B2B</option><option>B2C</option><option>SEZ</option><option>EXPORT</option><option>DEEMED</option><option>RCM</option></Select></Field>
          <Field label="Place of supply (state code)"><TextInput value={form.placeOfSupply} onChange={(e) => setForm({ ...form, placeOfSupply: e.target.value })} placeholder="19 = WB, blank = same state" /></Field>
          <Field label="Discount ₹"><TextInput inputMode="decimal" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} placeholder="0" /></Field>
          <label className="flex items-center gap-2 text-sm text-ink-soft"><input type="checkbox" checked={form.reverseCharge} onChange={(e) => setForm({ ...form, reverseCharge: e.target.checked })} className="h-4 w-4 accent-primary" /> Reverse charge (RCM)</label>
        </div>
        {kind === "sales" ? (
        <div className="mt-3 rounded-lg border border-slate-200">
          <button onClick={() => setShowShip(!showShip)} className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium text-ink">
            🚚 Ship-to & transport (optional — e-way ready) <span>{showShip ? "▴" : "▾"}</span>
          </button>
          {showShip ? (
          <div className="grid gap-3 border-t border-slate-100 p-3 sm:grid-cols-2">
            <Field label="Consignee name"><TextInput value={form.shipToName} onChange={(e) => setForm({ ...form, shipToName: e.target.value })} /></Field>
            <Field label="Consignee GSTIN"><TextInput value={form.shipToGstin} onChange={(e) => setForm({ ...form, shipToGstin: e.target.value.toUpperCase() })} placeholder="Different from buyer, if any" /></Field>
            <Field label="Ship-to address"><TextInput value={form.shipToAddress} onChange={(e) => setForm({ ...form, shipToAddress: e.target.value })} /></Field>
            <Field label="Transporter"><TextInput value={form.transporterName} onChange={(e) => setForm({ ...form, transporterName: e.target.value })} /></Field>
            <Field label="Transporter ID"><TextInput value={form.transporterId} onChange={(e) => setForm({ ...form, transporterId: e.target.value })} /></Field>
            <Field label="Vehicle no."><TextInput value={form.vehicleNo} onChange={(e) => setForm({ ...form, vehicleNo: e.target.value.toUpperCase() })} /></Field>
            <Field label="E-way bill no. (reference)"><TextInput value={form.ewayBillNo} onChange={(e) => setForm({ ...form, ewayBillNo: e.target.value })} /></Field>
          </div>
          ) : null}
        </div>
        ) : null}
        <div className="mt-4 space-y-2">
          <p className="text-[13px] font-medium text-ink-soft">Items — each line can carry its own GST rate</p>
          {lines.map((l, i) => (
            <div key={i} className="grid gap-2 rounded-lg bg-background p-2.5 sm:grid-cols-[1.5fr_0.6fr_0.5fr_0.6fr_0.6fr_0.7fr_auto]">
              <div>
                <TextInput
                  value={l.description}
                  list={`master-${i}`}
                  onChange={(e) => { setLine(i, { description: e.target.value }); void fetchSuggest(e.target.value); }}
                  onBlur={(e) => pickSuggestion(i, e.target.value)}
                  placeholder={`Item ${i + 1} — e.g. Basmati Rice 25kg`}
                />
                <datalist id={`master-${i}`}>
                  {suggest.map((s) => <option key={s.description} value={s.description}>{s.hsn ? `HSN ${s.hsn} · ` : ""}₹{s.rate} · {s.gstRate}%</option>)}
                </datalist>
              </div>
              <TextInput value={l.hsn} onChange={(e) => setLine(i, { hsn: e.target.value })} placeholder="HSN" />
              <TextInput inputMode="decimal" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} placeholder="Qty" />
              <TextInput inputMode="decimal" value={l.rate} onChange={(e) => setLine(i, { rate: e.target.value })} placeholder="Rate ₹" />
              <Select value={l.gstRate} onChange={(e) => setLine(i, { gstRate: e.target.value })} aria-label="GST %">{RATES.map((r) => <option key={r} value={r}>{r}%</option>)}</Select>
              <div className="tnum flex items-center px-1 text-sm font-medium text-ink">{inr(lineAmount(l))}</div>
              <button onClick={() => setLines((xs) => xs.length > 1 ? xs.filter((_, j) => j !== i) : [blankLine()])} className="rounded-lg p-2 text-ink-faint hover:bg-red-50 hover:text-red-600" title="Remove line"><Trash2 size={15} /></button>
            </div>
          ))}
          <button onClick={() => setLines((xs) => [...xs, blankLine()])} className="text-[13px] font-medium text-primary hover:underline">+ Add another item</button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <Field label="Period"><TextInput value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} /></Field>
          <p className="tnum text-sm text-ink-soft">Items total: <strong className="text-ink">{inr(itemsTotal)}</strong></p>
          <label className="flex items-center gap-2 text-sm text-ink-soft"><input type="checkbox" checked={saveDraft} onChange={(e) => setSaveDraft(e.target.checked)} className="h-4 w-4 accent-primary" /> Save as draft</label>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>
            <Button onClick={add} disabled={saving}><Plus size={15} /> {saving ? "Saving…" : editingId ? "Update invoice" : "Save invoice"}</Button>
          </div>
        </div>
      </Modal>
      ) : null}
      {loading ? <Skeleton /> : !clientFilter ? (
        <EmptyState
          title={`Whose ${kind} do you want to see?`}
          hint="Choose a client from the dropdown above — their bills will load here. Or choose All clients."
        />
      ) : rows.length === 0 ? <EmptyState title={`No ${kind} yet`} hint="Save your first invoice above, or import a month's bills from Excel/CSV." /> :
        <>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-2xl p-3 text-white shadow-card" style={{ background: "linear-gradient(135deg,#0EA5E9,#2563EB)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wide text-white/80 sm:text-[11px]">{rows.length} bills</p>
              <p className="tnum mt-0.5 break-words text-[15px] font-bold sm:text-lg">{inr(totals.taxable)}</p>
              <p className="text-[10px] text-white/80 sm:text-[11px]">taxable</p>
            </div>
            <div className="rounded-2xl p-3 text-white shadow-card" style={{ background: "linear-gradient(135deg,#8B5CF6,#6D28D9)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wide text-white/80 sm:text-[11px]">GST</p>
              <p className="tnum mt-0.5 break-words text-[15px] font-bold sm:text-lg">{inr(totals.tax)}</p>
              <p className="text-[10px] text-white/80 sm:text-[11px]">total tax</p>
            </div>
            <div className="rounded-2xl p-3 text-white shadow-card" style={{ background: "linear-gradient(135deg,#10B981,#047857)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wide text-white/80 sm:text-[11px]">Total</p>
              <p className="tnum mt-0.5 break-words text-[15px] font-bold sm:text-lg">{inr(totals.total)}</p>
              <p className="text-[10px] text-white/80 sm:text-[11px]">invoice value</p>
            </div>
          </div>
          {/* Mobile cards */}
          <div className="space-y-2.5 lg:hidden">
          {rows.map((r) => {
            const party = kind === "sales" ? (r.customerName ?? "Walk-in") : r.supplierName;
            return (
            <button key={r.id} onClick={() => setViewing(r)} className="w-full overflow-hidden rounded-2xl border border-slate-200/70 bg-white text-left shadow-card transition-transform active:scale-[0.99]">
              <div className="h-1" style={{ background: r.status === "DRAFT" ? "linear-gradient(90deg,#94A3B8,#64748B)" : "linear-gradient(90deg,#0EA5E9,#8B5CF6,#10B981)" }} />
              <div className="p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 text-[15px] font-bold text-primary-800">
                    <span className="whitespace-nowrap">{r.invoiceNumber}</span>
                    {r.status === "DRAFT" ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-ink-soft">DRAFT</span> : null}
                  </p>
                  <p className="tnum mt-0.5 text-xs text-ink-faint">{String(r.invoiceDate).slice(0, 10)}{showClientCol && r.client?.businessName ? ` · ${r.client.businessName}` : ""}</p>
                </div>
                <p className="tnum shrink-0 text-[17px] font-bold text-emerald-700">{inr(Number(r.totalValue))}</p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="max-w-[45%] truncate rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800">{party}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 font-medium text-primary"><ReceiptText size={12} /> {r.items?.length ?? 0}</span>
                <span className="tnum ml-auto text-ink-faint">Taxable {inr(Number(r.taxableValue))} · GST {inr(Number(r.cgst) + Number(r.sgst) + Number(r.igst))}</span>
              </div>
              </div>
            </button>
            );
          })}
          </div>
          <div className="hidden lg:block">
          <TableShell head={showClientCol ? ["Invoice", "Client", partyLabel, "Items", "Taxable", "CGST", "SGST", "IGST", "Total"] : ["Invoice", partyLabel, "Items", "Taxable", "CGST", "SGST", "IGST", "Total"]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap font-bold text-primary-800">{r.invoiceNumber}{r.status === "DRAFT" ? <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-ink-soft">DRAFT</span> : null}<span className="block text-[11px] font-normal text-ink-faint">{String(r.invoiceDate).slice(0, 10)}</span></td>
              {showClientCol ? <td><span className="inline-flex items-center rounded-full bg-secondary-50 px-2.5 py-0.5 text-[12px] font-semibold text-secondary-700 ring-1 ring-inset ring-secondary-100">{r.client?.businessName}</span></td> : null}
                <td className="max-w-[180px] truncate text-ink-soft" title={kind === "sales" ? (r.customerName ?? "") : r.supplierName}>{kind === "sales" ? (r.customerName ?? "—") : r.supplierName}</td>
              <td><button onClick={() => setViewing(r)} className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-[12px] font-medium text-primary hover:bg-primary-100"><ReceiptText size={13} /> {r.items?.length ?? 0} item{(r.items?.length ?? 0) === 1 ? "" : "s"}</button></td>
              <td className="tnum">{inr(Number(r.taxableValue))}</td>
              <td className="tnum text-ink-soft">{inr(Number(r.cgst))}</td>
              <td className="tnum text-ink-soft">{inr(Number(r.sgst))}</td>
              <td className="tnum text-ink-soft">{inr(Number(r.igst))}</td>
              <td className="tnum font-bold text-emerald-700">{inr(Number(r.totalValue))}</td>
            </tr>
          ))}
        </TableShell>
          </div>
        </>}
      {viewing ? (
        <Modal title={`${viewing.invoiceNumber} — ${(kind === "sales" ? viewing.customerName : viewing.supplierName) ?? ""}`} onClose={() => setViewing(null)} wide>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            {viewing.status === "DRAFT" ? <span className="rounded-full bg-slate-200 px-2.5 py-1 font-bold text-ink">DRAFT — excluded from GST</span> : null}
            {viewing.gstrCategory ? <span className="rounded-full bg-primary-50 px-2.5 py-1 font-semibold text-primary">GSTR: {viewing.gstrCategory}</span> : null}
            {viewing.supplyType ? <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-ink-soft">{viewing.supplyType === "INTER" ? "IGST (inter-state)" : "CGST+SGST (intra-state)"}</span> : null}
            {viewing.reverseCharge ? <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">RCM</span> : null}
            {viewing.ewayBillNo ? <span className="rounded-full bg-secondary-50 px-2.5 py-1 font-semibold text-secondary-700">E-way: {viewing.ewayBillNo}</span> : null}
          </div>
          {viewing.shipToName || viewing.transporterName || viewing.vehicleNo ? (
            <p className="mb-3 rounded-lg bg-background px-3 py-2 text-[13px] text-ink-soft">
              🚚 {[viewing.shipToName, viewing.shipToGstin ? `GSTIN ${viewing.shipToGstin}` : null, viewing.transporterName ? `via ${viewing.transporterName}` : null, viewing.vehicleNo].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          <div className="space-y-2">
            {(viewing.items ?? []).map((it: { id: string; description: string; hsn: string | null; quantity: string; rate: string; amount: string; gstRate?: string | number }) => (
              <div key={it.id} className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2.5 text-sm">
                <div><p className="font-medium text-ink">{it.description}</p><p className="text-xs text-ink-faint">{it.hsn ? `HSN ${it.hsn} · ` : ""}{it.quantity} × {inr(Number(it.rate))}{it.gstRate !== undefined ? ` · GST ${it.gstRate}%` : ""}</p></div>
                <p className="tnum font-semibold text-ink">{inr(Number(it.amount))}</p>
              </div>
            ))}
          </div>
          <div className="tnum mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
            <div className="flex justify-between text-ink-soft"><span>Taxable</span><span>{inr(Number(viewing.taxableValue))}</span></div>
            {Number(viewing.discount) > 0 ? <div className="flex justify-between text-ink-soft"><span>Discount</span><span>− {inr(Number(viewing.discount))}</span></div> : null}
            <div className="flex justify-between text-ink-soft"><span>CGST + SGST + IGST</span><span>{inr(Number(viewing.cgst) + Number(viewing.sgst) + Number(viewing.igst))}</span></div>
            {Number(viewing.roundOff) !== 0 ? <div className="flex justify-between text-ink-soft"><span>Round-off</span><span>{inr(Number(viewing.roundOff))}</span></div> : null}
            <div className="flex justify-between text-base font-bold text-ink"><span>Total</span><span>{inr(Number(viewing.totalValue))}</span></div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <Button size="sm" variant="outline" onClick={() => openEdit(viewing)}>✏️ Edit invoice</Button>
            {viewing.status === "DRAFT" ? <Button size="sm" variant="secondary" onClick={() => void postInvoice(viewing.id)}>Post invoice</Button> : null}
            {kind === "sales" ? <Link href={`/dashboard/sales/print/${viewing.id}`}><Button size="sm" variant="outline">🖨 Print / PDF</Button></Link> : null}
            <div className="flex items-center gap-1.5 text-sm">
              <TextInput value={cloneNum} onChange={(e) => setCloneNum(e.target.value)} placeholder="New no." className="!w-28" />
              <TextInput type="date" value={cloneDate} onChange={(e) => setCloneDate(e.target.value)} className="!w-auto" />
              <Button size="sm" variant="outline" onClick={cloneInvoice}>Clone as draft</Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

export default RegisterPage;
