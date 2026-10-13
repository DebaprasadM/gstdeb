"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button, EmptyState, PageHeader, SearchInput, Skeleton, TableShell } from "@/components/ui/primitives";

export default function AdminAudit() {
  const [rows, setRows] = useState<any[]>([]);
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    try {
      const r = await apiFetch<{ data: any[] }>(`/api/v1/admin/audit${action ? `?action=${encodeURIComponent(action)}` : ""}`);
      setRows(r.data);
    } finally { setLoading(false); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, []);
  return (
    <div className="space-y-5">
      <PageHeader title="Audit log" sub="Security-sensitive actions across the platform" />
      <div className="flex max-w-md gap-2">
        <div className="flex-1"><SearchInput value={action} onChange={setAction} placeholder="Filter by action, e.g. admin.suspend" /></div>
        <Button variant="outline" onClick={load}>Filter</Button>
      </div>
      {loading ? <Skeleton /> : rows.length === 0 ? <EmptyState title="No events" hint="Nothing matches that filter." /> :
        <TableShell head={["When", "Action", "Entity"]}>
          {rows.map((a) => (
            <tr key={a.id}>
              <td className="tnum text-ink-soft">{String(a.createdAt).slice(0, 16).replace("T", " ")}</td>
              <td className="font-medium text-ink">{a.action}</td>
              <td className="text-ink-soft">{a.entity ?? "—"}</td>
            </tr>
          ))}
        </TableShell>}
    </div>
  );
}
