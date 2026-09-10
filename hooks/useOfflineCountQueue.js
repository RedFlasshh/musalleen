"use client";
import { useRef, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

// Same pattern as Mustaghfirin's flushQueue (sakinah/app/page.js), pulled out
// into its own hook this time instead of living inline in the page component.
// The queue key packs day+format together since counting now happens
// per-format, not per-day alone.
const QUEUE_KEY = "musalleen-queue";

const readQueue = () => {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "{}"); } catch { return {}; }
};
const writeQueue = (q) => {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch {}
};
const packKey = (day, formatId) => `${day}|${formatId}`;
const unpackKey = (k) => { const [day, formatId] = k.split("|"); return { day, formatId }; };

export function useOfflineCountQueue({ session, onFlushed }) {
  // The debounce timer, the "online" event, and Capacitor's "resume" event
  // can all fire within the same tick (e.g. locking the phone right as
  // connectivity returns) — without this guard, two overlapping flushes
  // could both read the same pending delta before either deletes it, and
  // both submit it via increment_salawat_count, permanently double-counting.
  // This is the single most important lesson carried over from Mustaghfirin.
  const flushInFlightRef = useRef(false);
  const timerRef = useRef(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const queueDelta = useCallback((day, formatId, delta) => {
    const q = readQueue();
    const k = packKey(day, formatId);
    q[k] = (q[k] || 0) + delta;
    writeQueue(q);
  }, []);

  const flush = useCallback(async () => {
    if (!sessionRef.current?.user) return;
    if (flushInFlightRef.current) return;
    flushInFlightRef.current = true;
    try {
      const q = readQueue();
      const entries = Object.entries(q).filter(([, delta]) => delta !== 0);
      for (const [k, delta] of entries) {
        const { day, formatId } = unpackKey(k);
        try {
          const { error } = await supabase.rpc("increment_salawat_count", {
            p_format_id: formatId,
            p_day: day,
            p_delta: delta,
          });
          if (error) throw error;
          const cur = readQueue();
          delete cur[k];
          writeQueue(cur);
        } catch (e) {
          console.error("flush failed for", k, e);
          // Stop here — remaining entries stay queued for the next trigger.
          // Never silently drop a delta that hasn't been acknowledged.
          break;
        }
      }
      onFlushed?.();
    } finally {
      flushInFlightRef.current = false;
    }
  }, [onFlushed]);

  const scheduleFlush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { flush(); }, 1500);
  }, [flush]);

  useEffect(() => {
    const onOnline = () => flush();
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);

    // Capacitor's foreground/background transitions don't always fire the
    // web visibilitychange event reliably, so "resume" is watched too.
    let removeResumeListener = null;
    if (typeof window !== "undefined" && window.Capacitor?.isNativePlatform?.() && window.Capacitor?.Plugins?.App) {
      const handle = window.Capacitor.Plugins.App.addListener("resume", () => flush());
      removeResumeListener = () => handle?.then?.((h) => h.remove());
    }

    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
      removeResumeListener?.();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [flush]);

  const pendingCount = useCallback(() => {
    const q = readQueue();
    return Object.values(q).reduce((a, b) => a + Math.abs(b), 0);
  }, []);

  return { queueDelta, scheduleFlush, flush, pendingCount };
}
