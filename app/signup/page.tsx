"use client";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/toast";
import { Button, Field, TextInput } from "@/components/ui/primitives";

const schema = z.object({
  name: z.string().min(2, "Tell us your name"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Minimum 8 characters"),
  firmName: z.string().min(2, "Name your practice")
});

export default function SignupPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const { push } = useToast();
  const [serverError, setServerError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  async function onSubmit(values: z.infer<typeof schema>) {
    setServerError("");
    try {
      await apiFetch("/api/v1/auth/signup", { method: "POST", body: JSON.stringify(values) });
      await refresh();
      push("success", "Firm created — 14-day trial started!");
      router.push("/dashboard");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Signup failed";
      setServerError(msg);
      push("error", msg);
    }
  }

  return (
    <main className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-primary-800 p-10 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-lg font-bold">হি</span>
          <p className="font-bold">HisabKitab</p>
        </div>
        <div>
          <h2 className="max-w-md text-3xl font-bold leading-tight">14 days free. Your first 25 clients included.</h2>
          <ul className="mt-4 space-y-2 text-sm text-white/80">
            <li>✓ Import clients from Excel in minutes</li>
            <li>✓ Collect bills over WhatsApp + share links</li>
            <li>✓ GSTR-1 / GSTR-3B prep with ITC review</li>
          </ul>
        </div>
        <p className="text-xs text-white/60">No credit card required</p>
      </div>
      <div className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold tracking-tight text-ink">Create your firm</h1>
          <p className="mt-1 text-sm text-ink-soft">Set up in under a minute.</p>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4 rounded-card border border-slate-200/80 bg-white p-6 shadow-card">
            <Field label="Your name" error={errors.name?.message}><TextInput autoComplete="name" placeholder="Anirban Dutta" {...register("name")} /></Field>
            <Field label="Work email" error={errors.email?.message}><TextInput type="email" autoComplete="email" placeholder="you@firm.in" {...register("email")} /></Field>
            <Field label="Password" error={errors.password?.message}><TextInput type="password" autoComplete="new-password" placeholder="Min. 8 characters" {...register("password")} /></Field>
            <Field label="Firm / practice name" error={errors.firmName?.message}><TextInput placeholder="Dutta & Associates" {...register("firmName")} /></Field>
            {serverError ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p> : null}
            <Button disabled={isSubmitting} className="w-full">{isSubmitting ? "Creating…" : "Create firm & start trial"}</Button>
            <p className="text-center text-sm text-ink-soft">Have an account? <Link href="/login" className="font-medium text-primary underline underline-offset-2">Sign in</Link></p>
          </form>
        </div>
      </div>
    </main>
  );
}
