"use client";
import { ShieldCheck } from "lucide-react";

/** Layout-mimicking shimmer loaders in HomeService style (hero + tiles skeleton). */
export function DashboardSkeleton() {
  return (
    <div className="animate-fade-up">
      {/* Mobile shape */}
      <div className="lg:hidden">
        <div className="-mx-4 -mt-6 px-4 pt-4 sm:-mx-6 sm:px-5">
          <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-violet-200 via-indigo-100 to-sky-100 px-5 pb-10 pt-5">
            <div className="flex items-center justify-between">
              <div className="h-6 w-36 animate-pulse rounded-full bg-white/70" />
              <div className="h-10 w-10 animate-pulse rounded-full bg-white/70" />
            </div>
            <div className="mt-4 h-4 w-28 animate-pulse rounded bg-white/70" />
            <div className="mt-2 h-7 w-48 animate-pulse rounded-lg bg-white/70" />
            <div className="mt-2 flex gap-2">
              <div className="h-8 w-28 animate-pulse rounded-full bg-white/70" />
              <div className="h-8 w-40 animate-pulse rounded-full bg-white/70" />
            </div>
          </div>
          <div className="relative -mt-7 rounded-t-[1.75rem] bg-background px-1 pt-5">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="h-[86px] animate-pulse rounded-2xl border border-slate-200/60 bg-white" />
              <div className="h-[86px] animate-pulse rounded-2xl border border-slate-200/60 bg-white" />
              <div className="h-[86px] animate-pulse rounded-2xl border border-slate-200/60 bg-white" />
              <div className="h-[86px] animate-pulse rounded-2xl border border-slate-200/60 bg-white" />
            </div>
            <div className="mt-2.5 h-14 animate-pulse rounded-2xl bg-gradient-to-r from-violet-200 to-indigo-200" />
          </div>
        </div>
      </div>
      {/* Desktop shape */}
      <div className="hidden space-y-4 lg:block">
        <div className="grid grid-cols-3 gap-4">
          <div className="h-24 animate-pulse rounded-card bg-white shadow-card" />
          <div className="h-24 animate-pulse rounded-card bg-white shadow-card" />
          <div className="h-24 animate-pulse rounded-card bg-white shadow-card" />
          <div className="h-24 animate-pulse rounded-card bg-white shadow-card" />
          <div className="h-24 animate-pulse rounded-card bg-white shadow-card" />
          <div className="h-24 animate-pulse rounded-card bg-white shadow-card" />
        </div>
        <div className="h-64 animate-pulse rounded-card bg-white shadow-card" />
      </div>
      <div className="mt-5 flex items-center justify-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-primary-800 shadow-lg shadow-primary/30">
          <ShieldCheck size={17} className="animate-bounce text-white" />
        </span>
        <span className="text-sm font-bold text-ink-soft">Loading your practice…</span>
      </div>
    </div>
  );
}
