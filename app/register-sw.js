"use client";
import { useEffect } from "react";

export default function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Was this page already being controlled by a worker when it loaded?
    // Distinguishes "a fresh deploy just took over this open tab" (reload —
    // otherwise the tab keeps running old JS that can reference chunks a
    // later deploy has already GC'd) from "this is a brand new install"
    // (don't reload — there's nothing stale to recover from).
    const hadController = !!navigator.serviceWorker.controller;

    navigator.serviceWorker.register("/sw.js").catch(() => {});

    let reloaded = false;
    const onControllerChange = () => {
      if (!hadController || reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);
  return null;
}
