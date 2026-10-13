"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { FileUp, Send } from "lucide-react";
import { API_URL } from "@/lib/api";
import { Button, Card, Field, TextInput } from "@/components/ui/primitives";

export default function PublicSubmitPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<{ businessName: string; remainingUploads: number; expiresAt: string } | null>(null);
  const [err, setErr] = useState("");
  const [period, setPeriod] = useState("2026-09");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/public/submit/${token}/info`).then(async (r) => {
      if (!r.ok) { setErr("This link is invalid or expired. Please ask your accountant for a fresh one."); return; }
      const b = await r.json();
      setInfo(b.data);
    }).catch(() => setErr("Could not load this link. Check your connection."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function send() {
    if (!file) { setMsg("Choose a photo, PDF or Excel file first."); return; }
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("period", period);
    try {
      const r = await fetch(`${API_URL}/api/v1/public/submit/${token}`, { method: "POST", body: fd });
      setMsg(r.ok ? "Received! Your accountant will review it. You can send more below." : "Upload failed — the link may have expired.");
      if (r.ok) setFile(null);
    } finally { setBusy(false); }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-base font-bold text-white">হি</span>
          <p className="font-bold text-ink">HisabKitab</p>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Send bills to your accountant</h1>
        <p className="mt-1 text-sm text-ink-soft">No login needed — just pick the month and attach.</p>
        {err ? <p className="mt-4 rounded-card border border-red-200 bg-red-50/70 p-4 text-sm text-red-700">{err}</p> : !info ? <p className="mt-4 text-sm text-ink-faint">Checking link…</p> : (
          <Card>
            <p className="text-sm text-ink-soft">Sending for <strong className="text-ink">{info.businessName}</strong> · {info.remainingUploads} uploads left</p>
            <div className="mt-4 space-y-3.5">
              <Field label="Which month? (YYYY-MM)"><TextInput value={period} onChange={(e) => setPeriod(e.target.value)} /></Field>
              <Field label="Photo / PDF / Excel of your bills">
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-card border border-dashed border-slate-300 bg-background px-4 py-7 text-center transition-colors hover:border-primary">
                  <FileUp size={22} className="text-primary" />
                  <span className="text-sm font-medium text-ink">{file ? file.name : "Tap to choose a file"}</span>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </label>
              </Field>
              <Button onClick={send} disabled={busy} className="w-full"><Send size={15} /> {busy ? "Sending…" : "Send to accountant"}</Button>
              {msg ? <p className="rounded-lg bg-secondary-50 px-3 py-2 text-sm text-secondary-700">{msg}</p> : null}
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}
