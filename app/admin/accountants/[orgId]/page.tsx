"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button, Card, CardHeader, PageHeader, Select, Skeleton, StatusBadge, TextInput } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/modal";

type Pending = { kind: "suspend" | "reactivate" | "plan" | "note"; body?: unknown } | null;

export default function AdminAccountantDetail() {
  const { orgId } = useParams<{ orgId: string }>();
  const { push } = useToast();
  const [d, setD] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [planId, setPlanId] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [a, p] = await Promise.all([
      apiFetch<{ data: unknown }>(`/api/v1/admin/accountants/${orgId}`),
      apiFetch<{ data: unknown[] }>(`/api/v1/admin/plans`)
    ]);
    setD(a.data); setPlans(p.data as never[]);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [orgId]);

  async function run() {
    if (!pending) return;
    setBusy(true);
    const path = pending.kind === "note" ? "notes" : pending.kind;
    try {
      await apiFetch(`/api/v1/admin/accountants/${orgId}/${path}`, { method: "POST", body: pending.body ? JSON.stringify(pending.body) : undefined });
      push("success", "Action recorded in the audit log.");
      setPending(null); setNote("");
      void load();
    } catch (e) { push("error", e instanceof ApiError ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  const copy: Record<string, { title: string; body: string; label: string; danger?: boolean }> = {
    suspend: { title: "Suspend this firm?", body: "They lose access to everything immediately — dashboard, clients, documents. Use for abuse or non-payment only.", label: "Suspend firm", danger: true },
    reactivate: { title: "Reactivate this firm?", body: "Their access is restored right away.", label: "Reactivate" },
    plan: { title: "Change plan?", body: "A new ACTIVE subscription starts immediately; history is preserved.", label: "Apply plan" },
    note: { title: "Save admin note?", body: "Notes are visible to other admins in the audit trail.", label: "Save note" }
  };

  if (!d) return <Skeleton lines={3} />;
  return (
    <div className="space-y-5">
      <PageHeader title={d.name} sub={`Joined ${String(d.createdAt).slice(0, 10)}`} actions={d.suspended ? <StatusBadge label="SUSPENDED" tone="red" /> : <StatusBadge label="ACTIVE" tone="green" />} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Members" />
          {d.members.map((m: { id: string; user: { email: string; role: string } }) => <p key={m.id} className="py-1 text-sm text-ink">{m.user.email} <span className="text-ink-faint">· {m.user.role}</span></p>)}
        </Card>
        <Card>
          <CardHeader title="Usage & billing" />
          <p className="text-sm text-ink">Clients {d._count.clients} · Docs {d._count.documents} · Sales {d._count.sales}</p>
          <div className="mt-2 space-y-1">{d.subscriptions.map((s: { id: string; plan: { name: string }; status: string; billingCycle: string }) => <p key={s.id} className="text-sm text-ink-soft">{s.plan.name} · {s.status} · {s.billingCycle}</p>)}</div>
        </Card>
        <Card>
          <CardHeader title="Admin notes" />
          {d.adminNotes.length === 0 ? <p className="text-sm text-ink-faint">No notes yet.</p> : d.adminNotes.map((n: { text: string; createdAt: string }, i: number) => <p key={i} className="py-1 text-sm text-ink">“{n.text}”</p>)}
          <div className="mt-3 flex gap-2">
            <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" />
            <Button size="sm" variant="outline" onClick={() => note.trim() && setPending({ kind: "note", body: { text: note.trim() } })}>Save</Button>
          </div>
        </Card>
      </div>
      <Card>
        <CardHeader title="High-impact actions" sub="Each one asks for confirmation and is audit-logged" />
        <div className="flex flex-wrap items-center gap-2">
          {d.suspended
            ? <Button onClick={() => setPending({ kind: "reactivate" })}>Reactivate firm</Button>
            : <Button variant="danger" onClick={() => setPending({ kind: "suspend" })}>Suspend firm</Button>}
          <Select value={planId} onChange={(e) => setPlanId(e.target.value)} className="!w-auto">
            <option value="">Change plan…</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          {planId ? <Button variant="outline" onClick={() => setPending({ kind: "plan", body: { planId, billingCycle: "MONTHLY" } })}>Apply plan</Button> : null}
        </div>
      </Card>
      {pending ? (
        <ConfirmDialog
          title={copy[pending.kind].title} body={copy[pending.kind].body} confirmLabel={copy[pending.kind].label}
          danger={copy[pending.kind].danger} busy={busy} onCancel={() => setPending(null)} onConfirm={run}
        />
      ) : null}
    </div>
  );
}
