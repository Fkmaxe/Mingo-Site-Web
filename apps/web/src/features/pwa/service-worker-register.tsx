"use client";

import { useEffect } from "react";

/** Registers the service worker (production only: it would cache dev builds). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker non enregistré", error);
    });
  }, []);
  return null;
}

/** Removes cached personal pages (tickets…) from the device, e.g. on sign-out. */
export async function clearOfflinePages() {
  const registration = await navigator.serviceWorker?.getRegistration();
  registration?.active?.postMessage("clear-pages");
}
