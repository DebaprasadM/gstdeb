"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { EmptyState, PageHeader, Skeleton, StatusBadge, TableShell, statusTone } from "@/components/ui/primitives";

export default function AdminPayments() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    apiFetch<{ data: any[] }>("/api/v1/admin/payments").then((r) => { setRows(r.data); setLoading(false); }).catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (loading) return <Skeleton />;
  if (!rows.length) return (<div className="space-y-5"><PageHeader title="Payments" /><EmptyState title="No payments yet" hint="Verified and pending payment records will appear here." /></div>);
  return (
    <div className="space-y-5">
      <PageHeader title="Payments" sub="Order IDs masked · secrets never leave the server" />
      <TableShell head={["Firm", "Plan", "Amount", "Verified", "Mode", "Order"]}>
        {rows.map((p) => (
          <tr key={p.id}>
            <td className="font-medium text-ink">{p.subscription?.organization?.name}</td>
            <td className="text-ink-soft">{p.subscription?.plan?.name}</td>
            <td className="tnum font-semibold text-ink">₹{p.amount}</td>
            <td><StatusBadge label={p.verified ? "VERIFIED" : "PENDING"} tone={p.verified ? "green" : "amber"} /></td>
            <td><StatusBadge label={p.isDevMode ? "DEV" : "LIVE"} tone={p.isDevMode ? "slate" : "blue"} /></td>
            <td className="tnum text-ink-faint">{p.providerId}</td>
          </tr>
        ))}
      </TableShell>
    </div>
  );
}
