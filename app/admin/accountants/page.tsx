"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Button, EmptyState, PageHeader, SearchInput, Skeleton, StatusBadge, TableShell } from "@/components/ui/primitives";

export default function AdminAccountants() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    try {
      const r = await apiFetch<{ data: any[] }>(`/api/v1/admin/accountants?q=${encodeURIComponent(q)}`);
      setRows(r.data);
    } finally { setLoading(false); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, []);
  return (
    <div className="space-y-5">
      <PageHeader title="Accountant firms" sub="Search, inspect, suspend or move plans" />
      <div className="flex max-w-md gap-2">
        <div className="flex-1"><SearchInput value={q} onChange={setQ} placeholder="Search firm or owner email…" /></div>
        <Button variant="outline" onClick={load}>Search</Button>
      </div>
      {loading ? <Skeleton /> : rows.length === 0 ? <EmptyState title="No firms found" hint="Nobody matches that search yet." /> :
        <TableShell head={["Firm", "Owner", "Plan", "Clients", "Docs", "State"]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td><Link className="font-medium text-primary hover:underline" href={`/admin/accountants/${r.id}`}>{r.name}</Link></td>
              <td className="text-ink-soft">{r.owner?.email ?? "—"}</td>
              <td className="text-ink-soft">{r.subscription ? `${r.subscription.plan.name} · ${r.subscription.status}` : "—"}</td>
              <td className="tnum">{r.clientCount}</td>
              <td className="tnum">{r.docCount}</td>
              <td>{r.suspended ? <StatusBadge label="SUSPENDED" tone="red" /> : <StatusBadge label="ACTIVE" tone="green" />}</td>
            </tr>
          ))}
        </TableShell>}
    </div>
  );
}
