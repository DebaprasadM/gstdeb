"use client";
import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const url = "/sw.js";
    window.addEventListener("load", () => {
      navigator.serviceWorker.register(url).catch(() => {});
    });
  }, []);
  return null;
}
