"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiFetch, ApiError, currentPeriod } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button, Card, EmptyState, Field, PageHeader, Select, Skeleton, StatusBadge, TableShell, TextInput, statusTone } from "@/components/ui/primitives";

export default function TasksPage() {
  const { me } = useAuth();
  const { push } = useToast();
  const org = me?.organizations[0];
  const [rows, setRows] = useState<any[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; businessName: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState(() =>
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("client") ?? "" : ""
  );
  const [form, setForm] = useState({ clientId: "", returnType: "GSTR-1", period: currentPeriod(), dueDate: "2026-10-11" });

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
      const params = new URLSearchParams();
      if (filter === "overdue") params.set("overdue", "1");
      else if (filter !== "all") params.set("status", filter);
      if (fid !== "all") params.set("clientId", fid);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const t = await apiFetch<{ data: any[] }>(`/api/v1/organizations/${org.id}/tasks${qs}`);
      setRows(t.data);
      if (!form.clientId && c.data[0]) setForm((f) => ({ ...f, clientId: fid !== "all" ? fid : c.data[0]!.id }));
    } finally { setLoading(false); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (org) void load(); }, [org?.id, filter]);

  async function add() {
    if (!form.clientId) { push("error", "Pick a client first."); return; }
    try {
      await apiFetch(`/api/v1/organizations/${org!.id}/tasks`, { method: "POST", body: JSON.stringify({ ...form, financialYear: "2026-27" }) });
      push("success", "Deadline tracked.");
      void load();
    } catch (e) { push("error", e instanceof ApiError ? e.message : "Failed"); }
  }

  async function advance(id: string, status: string, label: string) {
    try {
      await apiFetch(`/api/v1/organizations/${org!.id}/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      push("success", label);
      void load();
    } catch (e) { push("error", e instanceof ApiError ? e.message : "Failed"); }
  }

  if (!org) return <EmptyState title="No organization" hint="Your account has no firm attached." />;
  return (
    <div className="space-y-5">
      <PageHeader title="Filing deadlines" sub="Guarded workflow: Pending → Prepared → Filed" />
      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
          <Field label="Client"><Select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>{clients.map((c) => <option key={c.id} value={c.id}>{c.businessName}</option>)}</Select></Field>
          <Field label="Return"><Select value={form.returnType} onChange={(e) => setForm({ ...form, returnType: e.target.value })}><option>GSTR-1</option><option>GSTR-3B</option></Select></Field>
          <Field label="Period"><TextInput value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} /></Field>
          <Field label="Due date"><TextInput type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
          <div className="flex items-end"><Button onClick={add}><Plus size={15} /> Add task</Button></div>
        </div>
      </Card>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={clientFilter} onChange={(e) => { setClientFilter(e.target.value); if (e.target.value !== "all") setForm((f) => ({ ...f, clientId: e.target.value })); }} className="!w-auto">
          <option value="all">All clients</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.businessName}</option>)}
        </Select>
        {[["all", "All"], ["PENDING", "Pending"], ["PREPARED", "Prepared"], ["FILED", "Filed"], ["overdue", "Overdue"]].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${filter === v ? "bg-primary text-white" : "bg-white text-ink-soft ring-1 ring-inset ring-slate-200 hover:ring-primary"}`}>{l}</button>
        ))}
      </div>
      {loading ? <Skeleton /> : rows.length === 0 ? <EmptyState title="All clear" hint="No tasks match this filter. Add filing tasks per client and period above." /> :
        <TableShell head={["Client", "Return", "Period", "Due", "Status", "Action"]}>
          {rows.map((t) => (
            <tr key={t.id}>
              <td className="font-medium text-ink">{t.client?.businessName}</td>
              <td>{t.returnType}</td>
              <td className="tnum">{t.period}</td>
              <td className="tnum text-ink-soft">{String(t.dueDate).slice(0, 10)}</td>
              <td><StatusBadge label={t.status} tone={statusTone(t.status)} /></td>
              <td>{t.status === "PENDING" ? <button className="font-medium text-primary hover:underline" onClick={() => void advance(t.id, "PREPARED", "Marked prepared.")}>Mark prepared</button> : t.status === "PREPARED" ? <button className="font-medium text-secondary hover:underline" onClick={() => void advance(t.id, "FILED", "Marked filed.")}>Mark filed</button> : <span className="text-ink-faint">—</span>}</td>
            </tr>
          ))}
        </TableShell>}
    </div>
  );
}
