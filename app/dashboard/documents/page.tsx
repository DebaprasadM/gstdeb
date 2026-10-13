"use client";
import { useEffect, useState } from "react";
import { Upload, ExternalLink } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { API_URL, apiFetch, currentPeriod } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button, Card, EmptyState, Field, PageHeader, Select, Skeleton, StatusBadge, TableShell, TextInput, statusTone } from "@/components/ui/primitives";

interface Doc { id: string; fileName: string; period: string; category: string; status: string; secureUrl: string | null; client: { businessName: string }; clientId: string; }

const CATS = ["SALES_INVOICE", "PURCHASE_BILL", "BANK_STATEMENT", "EXPENSE_RECORD", "OTHER"];

export default function DocumentsPage() {
  const { me } = useAuth();
  const { push } = useToast();
  const org = me?.organizations[0];
  const [rows, setRows] = useState<Doc[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; businessName: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ clientId: "", period: currentPeriod(), category: "OTHER" });
  const [clientFilter, setClientFilter] = useState(() =>
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("client") ?? "" : ""
  );
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!org) return;
    setLoading(true);
    try {
      const c = await apiFetch<{ data: Array<{ id: string; businessName: string }> }>(`/api/v1/organizations/${org.id}/clients?pageSize=100`);
      setClients(c.data);
      let fid = clientFilter;
      if (!fid || (fid !== "all" && !c.data.some((x) => x.id === fid))) {
        fid = c.data[0]?.id ?? "all";
        setClientFilter(fid);
      }
      const d = await apiFetch<{ data: Doc[] }>(`/api/v1/organizations/${org.id}/documents${fid !== "all" ? `?clientId=${fid}` : ""}`);
      setRows(d.data);
      if (!form.clientId && c.data[0]) setForm((f) => ({ ...f, clientId: fid !== "all" ? fid : c.data[0]!.id }));
    } finally { setLoading(false); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (org) void load(); }, [org?.id]);

  async function upload() {
    if (!file || !form.clientId) { push("error", "Pick a client and a file first."); return; }
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("period", form.period);
    fd.append("category", form.category);
    const csrf = document.cookie.match(/(?:^|; )csrf=([^;]*)/)?.[1];
    try {
      const res = await fetch(`${API_URL}/api/v1/organizations/${org!.id}/clients/${form.clientId}/documents`, { method: "POST", credentials: "include", headers: csrf ? { "x-csrf-token": decodeURIComponent(csrf) } : {}, body: fd });
      if (!res.ok) { const b = await res.json().catch(() => null); push("error", b?.error?.message ?? `Upload failed (${res.status})`); return; }
      setFile(null);
      push("success", "Document received.");
      void load();
    } finally { setBusy(false); }
  }

  if (!org) return <EmptyState title="No organization" hint="Your account has no firm attached." />;
  return (
    <div className="space-y-5">
      <PageHeader title="Documents" sub="Bills and records received — via upload or shopkeeper links" />
      <div className="flex flex-wrap items-center gap-2">
        <Select value={clientFilter} onChange={(e) => { setClientFilter(e.target.value); if (e.target.value !== "all") setForm((f) => ({ ...f, clientId: e.target.value })); }} className="!w-auto">
          <option value="all">All clients</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.businessName}</option>)}
        </Select>
        <Button size="sm" variant="outline" onClick={load}>Apply</Button>
      </div>
      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.4fr_auto]">
          <Field label="Client"><Select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>{clients.map((c) => <option key={c.id} value={c.id}>{c.businessName}</option>)}</Select></Field>
          <Field label="Period"><TextInput value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="2026-09" /></Field>
          <Field label="Category"><Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="File · PDF / JPG / PNG / XLS / CSV"><input type="file" accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full text-sm text-ink-soft file:mr-2 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-primary" /></Field>
          <div className="flex items-end"><Button onClick={upload} disabled={busy} className="w-full lg:w-auto"><Upload size={15} /> {busy ? "Uploading…" : "Upload"}</Button></div>
        </div>
      </Card>
      {loading ? <Skeleton /> : rows.length === 0 ? <EmptyState title="No documents yet" hint="Upload bills you received on WhatsApp, or share a submission link from the client page." /> :
        <TableShell head={["Client", "File", "Period", "Status", "Preview"]}>
          {rows.map((d) => (
            <tr key={d.id}>
              <td className="font-medium text-ink">{d.client.businessName}</td>
              <td className="max-w-[220px] truncate text-ink-soft">{d.fileName}</td>
              <td className="tnum text-ink-soft">{d.period}</td>
              <td><StatusBadge label={d.status} tone={statusTone(d.status)} /></td>
              <td>{d.secureUrl ? <a className="inline-flex items-center gap-1 text-primary hover:underline" href={d.secureUrl} target="_blank" rel="noreferrer">Open <ExternalLink size={13} /></a> : <span className="text-ink-faint">—</span>}</td>
            </tr>
          ))}
        </TableShell>}
    </div>
  );
}
