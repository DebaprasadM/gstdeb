"use client";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/toast";
import { Button, Field, TextInput } from "@/components/ui/primitives";

const schema = z.object({ email: z.string().email(), password: z.string().min(1, "Required") });

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const { push } = useToast();
  const [serverError, setServerError] = useState("");
  const [expiredNote, setExpiredNote] = useState(false);
  const [diag, setDiag] = useState<string | null>(null);
  const [diagBusy, setDiagBusy] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("reason") === "session") {
      setExpiredNote(true);
    }
  }, []);

  async function runDiagnostics() {
    setDiagBusy(true);
    setDiag(null);
    try {
      const r = await apiFetch<{ data: Record<string, unknown> }>("/api/v1/auth/session-check");
      const d = r.data;
      setDiag(
        `sid cookie: ${d.sidCookieReceived ? "OK ✅" : "MISSING ❌"} · csrf cookie: ${d.csrfCookieReceived ? "OK ✅" : "MISSING ❌"} · session: ${d.sessionValid ? "VALID ✅" : "DEAD ❌ (" + d.sessionReason + ")"}`
      );
    } catch {
      setDiag("API unreachable ❌ — check internet / adblock / VPN.");
    } finally {
      setDiagBusy(false);
    }
  }
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  async function onSubmit(values: z.infer<typeof schema>) {
    setServerError("");
    try {
      await apiFetch("/api/v1/auth/login", { method: "POST", body: JSON.stringify(values) });
      await refresh();
      push("success", "Welcome back!");
      router.push("/dashboard");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Login failed";
      setServerError(msg);
      push("error", msg);
    }
  }

  return (
    <main className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-primary p-10 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-lg font-bold">হি</span>
          <p className="font-bold">HisabKitab</p>
        </div>
        <div>
          <h2 className="max-w-md text-3xl font-bold leading-tight">Your entire practice, ready when the day starts.</h2>
          <p className="mt-3 max-w-md text-sm text-white/75">Deadlines, documents, GST prep and fees — organized client by client, from Kolkata to Kochi.</p>
        </div>
        <p className="text-xs text-white/60">Preparation assistance only · You file on the GST portal</p>
      </div>
      <div className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold tracking-tight text-ink">Welcome back</h1>
          <p className="mt-1 text-sm text-ink-soft">Sign in to your firm workspace.</p>
          {expiredNote ? <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">Your session expired — please sign in again. Your data is safe.</p> : null}
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4 rounded-card border border-slate-200/80 bg-white p-6 shadow-card">
            <Field label="Email" error={errors.email?.message}>
              <TextInput type="email" placeholder="you@firm.in" autoComplete="email" {...register("email")} />
            </Field>
            <Field label="Password" error={errors.password?.message}>
              <TextInput type="password" placeholder="••••••••" autoComplete="current-password" {...register("password")} />
            </Field>
            {serverError ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p> : null}
            <Button disabled={isSubmitting} className="w-full"><LogIn size={16} /> {isSubmitting ? "Signing in…" : "Sign in"}</Button>
            <p className="text-center text-sm text-ink-soft">New firm? <Link href="/signup" className="font-medium text-primary underline underline-offset-2">Start free trial</Link></p>
            <div className="border-t border-slate-100 pt-3 text-center">
              <button type="button" onClick={() => void runDiagnostics()} disabled={diagBusy} className="text-xs font-medium text-ink-faint underline underline-offset-2 hover:text-primary">
                {diagBusy ? "Testing…" : "Login trouble? Test connection"}
              </button>
              {diag ? <p className="mt-2 rounded-lg bg-background px-3 py-2 text-left text-xs text-ink">{diag}</p> : null}
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
