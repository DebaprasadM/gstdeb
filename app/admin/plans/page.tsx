"use client";
import { useEffect, useState } from "react";
import { apiFetch, ApiError, inr } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button, Card, CardHeader, Field, PageHeader, Skeleton, TextInput } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

export default function AdminPlans() {
  const { push } = useToast();
  const [plans, setPlans] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", monthlyPrice: "", annualPrice: "", maxClients: "25", maxStaff: "1", maxStorageMb: "2048" });
  async function load() {
    const r = await apiFetch<{ data: unknown[] }>("/api/v1/admin/plans");
    setPlans(r.data as never[]);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, []);
  async function save() {
    try {
      await apiFetch("/api/v1/admin/plans", { method: "POST", body: JSON.stringify({ ...form, monthlyPrice: Number(form.monthlyPrice), annualPrice: Number(form.annualPrice), maxClients: Number(form.maxClients), maxStaff: Number(form.maxStaff), maxStorageMb: Number(form.maxStorageMb), features: [] }) });
      push("success", "Plan created.");
      setForm({ name: "", monthlyPrice: "", annualPrice: "", maxClients: "25", maxStaff: "1", maxStorageMb: "2048" });
      void load();
    } catch (e) { push("error", e instanceof ApiError ? e.message : "Failed"); }
  }
  async function toggle(p: { id: string; active: boolean; name: string }) {
    await apiFetch(`/api/v1/admin/plans/${p.id}`, { method: "PATCH", body: JSON.stringify({ active: !p.active }) });
    push("info", `${p.name} ${p.active ? "disabled" : "enabled"}.`);
    void load();
  }
  if (!plans.length) return <Skeleton />;
  return (
    <div className="space-y-5">
      <PageHeader title="Subscription plans" sub="Prices and limits apply instantly to enforcement" />
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.id} className={cn(!p.active && "opacity-70")}>
            <div className="flex items-center justify-between"><p className="font-bold text-ink">{p.name}</p>{!p.active ? <span className="text-xs font-semibold text-ink-faint">DISABLED</span> : null}</div>
            <p className="tnum mt-1 text-2xl font-bold text-ink">{inr(Number(p.monthlyPrice))}<span className="text-sm font-normal text-ink-faint">/mo</span></p>
            <p className="tnum text-sm text-ink-soft">{inr(Number(p.annualPrice))}/yr · {p.maxClients} clients · {p.maxStaff} staff · {p.maxStorageMb} MB</p>
            <div className="mt-3"><Button size="sm" variant="outline" onClick={() => void toggle(p)}>{p.active ? "Disable" : "Enable"}</Button></div>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader title="New plan" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Name"><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Growth" /></Field>
          <Field label="Monthly ₹"><TextInput inputMode="numeric" value={form.monthlyPrice} onChange={(e) => setForm({ ...form, monthlyPrice: e.target.value })} /></Field>
          <Field label="Annual ₹"><TextInput inputMode="numeric" value={form.annualPrice} onChange={(e) => setForm({ ...form, annualPrice: e.target.value })} /></Field>
          <Field label="Max clients"><TextInput inputMode="numeric" value={form.maxClients} onChange={(e) => setForm({ ...form, maxClients: e.target.value })} /></Field>
          <Field label="Max staff"><TextInput inputMode="numeric" value={form.maxStaff} onChange={(e) => setForm({ ...form, maxStaff: e.target.value })} /></Field>
          <Field label="Storage MB"><TextInput inputMode="numeric" value={form.maxStorageMb} onChange={(e) => setForm({ ...form, maxStorageMb: e.target.value })} /></Field>
        </div>
        <div className="mt-3"><Button onClick={save}>Create plan</Button></div>
      </Card>
    </div>
  );
}
