"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Link2, Copy, Check, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiFetch, ApiError, inr } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button, Card, CardHeader, Field, PageHeader, Select, Skeleton, Stat, TextInput } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { me } = useAuth();
  const { push } = useToast();
  const org = me?.organizations[0];
  const [detail, setDetail] = useState<any>(null);
  const [charge, setCharge] = useState("");
  const [chargeSet, setChargeSet] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [payAmt, setPayAmt] = useState("");
  const [payMethod, setPayMethod] = useState("UPI");
  const [paying, setPaying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [editSaving, setEditSaving] = useState(false);

  function reload() {
    if (!org) return;
    apiFetch<{ data: unknown }>(`/api/v1/organizations/${org.id}/clients/${id}`).then((r) => setDetail(r.data)).catch(() => {});
  }
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!org) return;
    apiFetch<{ data: unknown }>(`/api/v1/organizations/${org.id}/clients/${id}`).then((r) => {
      setDetail(r.data);
      const fee = (r.data as { serviceFee?: string | null }).serviceFee;
      if (!chargeSet) setCharge(fee ? String(fee) : "");
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id, id]);

  function openEdit() {
    const d = detail;
    setEditForm({
      businessName: d.businessName ?? "", contactPerson: d.contactPerson ?? "", gstin: d.gstin ?? "",
      pan: d.pan ?? "", phone: d.phone ?? "", email: d.email ?? "", address: d.address ?? "",
      state: d.state ?? "", stateCode: d.stateCode ?? "", businessType: d.businessType ?? "",
      registrationType: d.registrationType ?? "", filingFrequency: d.filingFrequency ?? "",
      financialYear: d.financialYear ?? "", notes: d.notes ?? "", status: d.status ?? "ACTIVE"
    });
    setEditing(true);
  }

  async function saveEdit() {
    if (!editForm.businessName.trim()) { push("error", "Business name is required."); return; }
    setEditSaving(true);
    try {
      const body: Record<string, unknown> = { businessName: editForm.businessName.trim() };
      for (const k of ["contactPerson", "phone", "email", "address", "state", "stateCode", "businessType", "registrationType", "filingFrequency", "financialYear", "notes"] as const) {
        body[k] = editForm[k].trim() || null;
      }
      body.gstin = editForm.gstin.trim() || null;
      body.pan = editForm.pan.trim() || null;
      body.status = editForm.status;
      const res = await apiFetch<{ data: unknown }>(`/api/v1/organizations/${org!.id}/clients/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      setDetail({ ...detail, ...(res.data as object) });
      setEditing(false);
      push("success", "Client profile updated.");
    } catch (e) { push("error", e instanceof ApiError ? e.message : "Update failed"); }
    finally { setEditSaving(false); }
  }

  async function recordBillPayment(feeId: string, due: number) {
    const amt = Number(payAmt);
    if (!(amt > 0)) { push("error", "Enter an amount."); return; }
    if (amt > due) { push("error", `Amount exceeds due ${inr(due)}.`); return; }
    setPaying(true);
    try {
      await apiFetch(`/api/v1/organizations/${org!.id}/fees/${feeId}/payments`, { method: "POST", body: JSON.stringify({ amountPaid: amt, paymentMethod: payMethod }) });
      push("success", `Payment of ${inr(amt)} recorded.`);
      setPayAmt("");
      setExpanded(null);
      reload();
    } catch (e) { push("error", e instanceof ApiError ? e.message : "Failed"); }
    finally { setPaying(false); }
  }

  async function createLink() {
    setBusy(true);
    try {
      const res = await apiFetch<{ data: { token: string } }>(`/api/v1/organizations/${org!.id}/clients/${id}/links`, { method: "POST", body: JSON.stringify({ expiresInHours: 72, maxUploads: 20 }) });
      setLink(`${window.location.origin}/submit/${res.data.token}`);
      push("success", "Link created — valid 72 hours, 20 uploads.");
    } catch (e) { push("error", e instanceof ApiError ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  function copy() {
    void navigator.clipboard.writeText(link);
    setCopied(true);
    push("info", "Link copied — share it on WhatsApp.");
    setTimeout(() => setCopied(false), 2000);
  }

  if (!detail) return <Skeleton />;
  const outstanding = Number(detail.stats.billed ?? 0) - Number(detail.stats.paid ?? 0);
  const history: Array<{ id: string; period: string; amountBilled: string; amountPaid: string; paymentDate: string | null; paymentMethod: string | null; reference: string | null }> = detail.feeHistory ?? [];

  async function saveCharge() {
    if (charge.trim() !== "" && !(Number(charge) >= 0)) { push("error", "Enter a valid amount."); return; }
    try {
      const res = await apiFetch<{ data: { serviceFee: string | null } }>(`/api/v1/organizations/${org!.id}/clients/${id}`, {
        method: "PATCH", body: JSON.stringify({ serviceFee: charge.trim() === "" ? null : Number(charge) })
      });
      setDetail({ ...detail, serviceFee: res.data.serviceFee });
      setChargeSet(true);
      push("success", res.data.serviceFee ? `Monthly charge set to ${inr(Number(res.data.serviceFee))}.` : "Monthly charge cleared.");
    } catch (e) { push("error", e instanceof ApiError ? e.message : "Failed"); }
  }
  return (
    <div className="space-y-5">
      <PageHeader title={detail.businessName} sub={`${detail.gstin ?? "No GSTIN on file"}${detail.phone ? ` · ${detail.phone}` : ""}`} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Link href={`/dashboard/fees?client=${id}`} className="transition-transform hover:-translate-y-0.5"><Stat label="Monthly charge" value={detail.serviceFee ? inr(Number(detail.serviceFee)) : "Not set"} sub="What you bill this client" /></Link>
        <Link href={`/dashboard/fees?client=${id}`} className="transition-transform hover:-translate-y-0.5"><Stat label="Outstanding" value={inr(outstanding)} sub={`Billed ${inr(Number(detail.stats.billed ?? 0))}`} accent={outstanding > 0} /></Link>
        <Link href={`/dashboard/documents?client=${id}`} className="transition-transform hover:-translate-y-0.5"><Stat label="Documents" value={String(detail.stats.documents)} /></Link>
        <Link href={`/dashboard/sales?client=${id}`} className="transition-transform hover:-translate-y-0.5"><Stat label="Sales entries" value={String(detail.stats.sales)} /></Link>
        <Link href={`/dashboard/purchases?client=${id}`} className="transition-transform hover:-translate-y-0.5"><Stat label="Purchase entries" value={String(detail.stats.purchases)} /></Link>
        <Link href={`/dashboard/tasks?client=${id}`} className="transition-transform hover:-translate-y-0.5"><Stat label="Open tasks" value={String(detail.stats.openTasks)} /></Link>
      </div>
      <Card>
        <CardHeader
          title="Business profile"
          sub="Contact, address, GST registration and filing setup"
          action={<Button size="sm" variant="outline" onClick={openEdit}>Edit profile</Button>}
        />
        <dl className="grid gap-x-8 gap-y-2.5 text-sm sm:grid-cols-2">
          {[
            ["Contact person", detail.contactPerson], ["Phone", detail.phone], ["Email", detail.email],
            ["Address", detail.address], ["State", detail.state ? `${detail.state}${detail.stateCode ? ` (${detail.stateCode})` : ""}` : null],
            ["PAN", detail.pan], ["Business type", detail.businessType], ["Registration", detail.registrationType],
            ["Filing frequency", detail.filingFrequency], ["Financial year", detail.financialYear],
            ["Return types", (detail.returnTypes ?? []).join(", ") || null], ["Status", detail.status]
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-slate-100 py-1.5">
              <dt className="shrink-0 text-ink-faint">{k}</dt>
              <dd className="text-right font-medium text-ink">{(v as string) || "—"}</dd>
            </div>
          ))}
        </dl>
        {detail.notes ? <p className="mt-3 rounded-lg bg-background px-3 py-2 text-[13px] text-ink-soft">📝 {detail.notes}</p> : null}
      </Card>
      <Card>
        <CardHeader title="Monthly service charge" sub="Used to auto-fill bills and the bill-all run" />
        <div className="flex max-w-sm gap-2">
          <TextInput inputMode="decimal" value={charge} onChange={(e) => { setCharge(e.target.value); setChargeSet(true); }} placeholder="e.g. 1500" />
          <Button size="sm" onClick={saveCharge}>Save</Button>
        </div>
      </Card>
      <Card>
        <CardHeader
          title="Billing history — who paid what, when"
          sub={`Total billed ${inr(Number(detail.stats.billed ?? 0))} · received ${inr(Number(detail.stats.paid ?? 0))} · due ${inr(outstanding)}`}
          action={<Link href={`/dashboard/fees?client=${id}`} className="text-[13px] font-medium text-primary hover:underline">Open fees</Link>}
        />
        {history.length === 0 ? <p className="text-sm text-ink-faint">No bills raised yet for this client.</p> : (
          <div className="space-y-2">
            {history.map((h) => {
              const due = Number(h.amountBilled) - Number(h.amountPaid);
              const open = expanded === h.id;
              return (
                <div key={h.id} className="rounded-lg bg-background text-sm">
                  <button onClick={() => { setExpanded(open ? null : h.id); setPayAmt(""); }} className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-slate-100/70 rounded-lg">
                    <div>
                      <p className="tnum font-semibold text-ink">{h.period} · billed {inr(Number(h.amountBilled))}</p>
                      <p className="text-xs text-ink-soft">
                        {Number(h.amountPaid) > 0
                          ? `Paid ${inr(Number(h.amountPaid))}${h.paymentDate ? ` on ${String(h.paymentDate).slice(0, 10)}` : ""}${h.paymentMethod ? ` via ${h.paymentMethod}` : ""}${h.reference ? ` (${h.reference})` : ""}`
                          : "Not paid yet"}
                      </p>
                    </div>
                    <span className="flex items-center gap-2">
                      {due > 0
                        ? <span className="tnum rounded-full bg-amber-50 px-2.5 py-0.5 text-[12px] font-bold text-amber-800 ring-1 ring-inset ring-amber-200">Due {inr(due)}</span>
                        : <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[12px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">Settled</span>}
                      <span className="text-ink-faint">{open ? "▴" : "▾"}</span>
                    </span>
                  </button>
                  {open && (
                    <div className="border-t border-slate-200/70 px-3 py-3">
                      {due > 0 ? (
                        <div className="flex flex-wrap items-end gap-2">
                          <Field label={`Amount (due ${inr(due)})`}><TextInput inputMode="decimal" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} placeholder={String(due)} className="!w-36" /></Field>
                          <Field label="Method"><Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="!w-auto"><option>UPI</option><option>Cash</option><option>Bank transfer</option><option>Cheque</option></Select></Field>
                          <Button size="sm" variant="secondary" disabled={paying} onClick={() => void recordBillPayment(h.id, due)}>{paying ? "Recording…" : "Record payment"}</Button>
                        </div>
                      ) : (
                        <p className="text-[13px] text-ink-soft">Fully paid — no action needed. Receipt details above.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <div className="flex flex-wrap gap-2">
        <Link href={`/dashboard/gst?client=${id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary">GST workspace <ArrowRight size={14} /></Link>
        <Link href={`/dashboard/fees?client=${id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary">Fees & payments <ArrowRight size={14} /></Link>
      </div>
      <Card>
        <CardHeader title="Collect documents without a client login" sub="Expiring, revocable link — the shopkeeper just opens it and sends photos or PDFs." />
        <div className="flex flex-wrap gap-2">
          <Button onClick={createLink} disabled={busy}><Link2 size={15} /> {busy ? "Creating…" : "Generate submission link"}</Button>
          {link ? <Button variant="outline" onClick={copy}>{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy link"}</Button> : null}
        </div>
        {link ? <p className="mt-3 break-all rounded-lg bg-background px-3 py-2.5 text-[13px] text-primary">{link}</p> : null}
      </Card>
      {editing ? (
        <Modal title="Edit client profile" onClose={() => setEditing(false)} wide>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Shop / business name *"><TextInput value={editForm.businessName} onChange={(e) => setEditForm({ ...editForm, businessName: e.target.value })} /></Field>
            <Field label="Contact person"><TextInput value={editForm.contactPerson} onChange={(e) => setEditForm({ ...editForm, contactPerson: e.target.value })} /></Field>
            <Field label="GSTIN"><TextInput value={editForm.gstin} onChange={(e) => setEditForm({ ...editForm, gstin: e.target.value.toUpperCase() })} /></Field>
            <Field label="PAN"><TextInput value={editForm.pan} onChange={(e) => setEditForm({ ...editForm, pan: e.target.value.toUpperCase() })} /></Field>
            <Field label="Phone"><TextInput value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></Field>
            <Field label="Email"><TextInput value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></Field>
            <Field label="Address"><TextInput value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} /></Field>
            <Field label="State"><TextInput value={editForm.state} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} /></Field>
            <Field label="State code"><TextInput value={editForm.stateCode} onChange={(e) => setEditForm({ ...editForm, stateCode: e.target.value })} /></Field>
            <Field label="Business type"><TextInput value={editForm.businessType} onChange={(e) => setEditForm({ ...editForm, businessType: e.target.value })} placeholder="Grocery, Electronics…" /></Field>
            <Field label="Registration type"><Select value={editForm.registrationType} onChange={(e) => setEditForm({ ...editForm, registrationType: e.target.value })}><option value="">—</option><option>Regular</option><option>Composition</option><option>Unregistered</option></Select></Field>
            <Field label="Filing frequency"><Select value={editForm.filingFrequency} onChange={(e) => setEditForm({ ...editForm, filingFrequency: e.target.value })}><option value="">—</option><option>Monthly</option><option>Quarterly</option></Select></Field>
            <Field label="Financial year"><TextInput value={editForm.financialYear} onChange={(e) => setEditForm({ ...editForm, financialYear: e.target.value })} placeholder="2026-27" /></Field>
            <Field label="Status"><Select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}><option>ACTIVE</option><option>ARCHIVED</option></Select></Field>
          </div>
          <Field label="Notes"><TextInput value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Internal notes…" /></Field>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            <Button disabled={editSaving} onClick={saveEdit}>{editSaving ? "Saving…" : "Save changes"}</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
