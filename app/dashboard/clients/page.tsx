"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { API_URL, apiFetch, ApiError, inr } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button, Card, EmptyState, ErrorState, Field, PageHeader, SearchInput, Select, Skeleton, StatusBadge, TableShell, TextInput, statusTone } from "@/components/ui/primitives";

interface Client { id: string; businessName: string; gstin: string | null; phone: string | null; status: string; serviceFee: string | null; }

export default function ClientsPage() {
  const { me } = useAuth();
  const { push } = useToast();
  const org = me?.organizations[0];
  const [rows, setRows] = useState<Client[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ businessName: "", gstin: "", phone: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!org) return;
    setLoading(true); setErr("");
    try {
      const res = await apiFetch<{ data: Client[] }>(`/api/v1/organizations/${org.id}/clients?q=${encodeURIComponent(q)}`);
      setRows(res.data);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (org) void load(); }, [org?.id]);

  async function add() {
    if (!form.businessName.trim()) { push("error", "Enter the shop / business name."); return; }
    setSaving(true);
    try {
      await apiFetch(`/api/v1/organizations/${org!.id}/clients`, { method: "POST", body: JSON.stringify({ businessName: form.businessName.trim(), gstin: form.gstin.trim() || null, phone: form.phone.trim() || null }) });
      setForm({ businessName: "", gstin: "", phone: "" });
      push("success", "Client added.");
      void load();
    } catch (e) { push("error", e instanceof ApiError ? e.message : "Add failed"); }
    finally { setSaving(false); }
  }

  async function importFile(f: File | undefined) {
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    const csrf = document.cookie.match(/(?:^|; )csrf=([^;]*)/)?.[1];
    const res = await fetch(`${API_URL}/api/v1/organizations/${org!.id}/clients/import`, { method: "POST", credentials: "include", headers: csrf ? { "x-csrf-token": decodeURIComponent(csrf) } : {}, body: fd });
    const body = await res.json().catch(() => null);
    if (!res.ok) { push("error", body?.error?.message ?? "Import failed"); return; }
    push(body.data.errorCount ? "info" : "success", `Imported ${body.data.imported} · ${body.data.errorCount} row errors`);
    if (body.data.errors?.length) console.table(body.data.errors);
    void load();
  }

  if (!org) return <EmptyState title="No organization" hint="Your account has no firm attached." />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clients"
        sub={`${rows.length} on this page · search across name, GSTIN and phone`}
        actions={<label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary"><Upload size={15} /> Import Excel/CSV<input type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={(e) => void importFile(e.target.files?.[0])} /></label>}
      />
      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_auto]">
          <Field label="Shop / business name"><TextInput value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} placeholder="Sharma Store" /></Field>
          <Field label="GSTIN (optional)"><TextInput value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} placeholder="19ABCDE1234F1Z5" /></Field>
          <Field label="Phone"><TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="98765…" /></Field>
          <div className="flex items-end"><Button onClick={add} disabled={saving} className="w-full sm:w-auto"><Plus size={15} /> {saving ? "Adding…" : "Add Client"}</Button></div>
        </div>
      </Card>
      <div className="max-w-sm"><SearchInput value={q} onChange={setQ} placeholder="Search clients…" /></div>
      <div><Button variant="outline" size="sm" onClick={load}>Apply search</Button></div>
      {loading ? <Skeleton /> : err ? <ErrorState message={err} retry={load} /> : rows.length === 0 ?
        <EmptyState title="No clients yet" hint="Add your first shopkeeper client above, or import a list from Excel/CSV." /> :
        <TableShell head={["Business", "GSTIN", "Phone", "Monthly charge", "Status"]}>
          {rows.map((c) => (
            <tr key={c.id}>
              <td><Link className="font-medium text-primary hover:underline" href={`/dashboard/clients/${c.id}`}>{c.businessName}</Link></td>
              <td className="tnum text-ink-soft">{c.gstin ?? "—"}</td>
              <td className="tnum text-ink-soft">{c.phone ?? "—"}</td>
              <td className="tnum font-medium text-ink">{c.serviceFee ? `${inr(Number(c.serviceFee))}/mo` : <span className="text-ink-faint">Not set</span>}</td>
              <td><StatusBadge label={c.status} tone={statusTone(c.status)} /></td>
            </tr>
          ))}
        </TableShell>}
    </div>
  );
}
