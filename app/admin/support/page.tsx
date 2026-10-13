"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button, Card, CardHeader, EmptyState, PageHeader, Skeleton, StatusBadge, statusTone } from "@/components/ui/primitives";

export default function AdminSupport() {
  const { push } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    try {
      const r = await apiFetch<{ data: any[] }>("/api/v1/admin/support");
      setRows(r.data);
    } finally { setLoading(false); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, []);
  async function setStatus(id: string, status: string) {
    await apiFetch(`/api/v1/admin/support/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    push("success", `Ticket → ${status}.`);
    void load();
  }
  if (loading) return <Skeleton />;
  return (
    <div className="space-y-5">
      <PageHeader title="Support requests" sub="Triage accountant issues" />
      {rows.length === 0 ? <EmptyState title="Inbox zero" hint="No support requests right now." /> :
        <div className="grid gap-3">
          {rows.map((t) => (
            <Card key={t.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="font-semibold text-ink">{t.subject}</p><p className="text-xs text-ink-faint">{t.email} · {String(t.createdAt).slice(0, 10)}</p></div>
                <StatusBadge label={t.status} tone={statusTone(t.status)} />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t.body}</p>
              <div className="mt-3 flex flex-wrap gap-2">{["IN_PROGRESS", "RESOLVED", "CLOSED"].map((s) => <Button key={s} size="sm" variant="outline" onClick={() => void setStatus(t.id, s)}>{s}</Button>)}</div>
            </Card>
          ))}
        </div>}
    </div>
  );
}
