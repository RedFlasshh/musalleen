"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { Mail, LogOut, X, Flame } from "lucide-react";
import { deviceTz, dayKeyInTz } from "../lib/dayKey";
import { useOfflineCountQueue } from "../hooks/useOfflineCountQueue";

/* ------------------------------------------------------------------ */
/* Design tokens — Phase 2 keeps this static; the level-driven theme    */
/* system (const C = level.theme, matching Mustaghfirin's pattern) is   */
/* explicitly Phase 3 work, built once the habit-engine columns are     */
/* actually read from somewhere.                                        */
/* ------------------------------------------------------------------ */
const C = {
  bg: "#0B1917", surface: "#122622", surface2: "#1A332D", line: "#22423A",
  gold: "#C9A24B", goldBright: "#E8CD86", ivory: "#F4EFE2",
  muted: "#8BA79A", faint: "#5C776C", warn: "#D98F4E",
};

const APP_NAME = "Musalleen";
const NATIVE_REDIRECT_URL = "musalleen://login-callback";
const GUEST_KEY = "musalleen-guest-mode";
const GUEST_TODAY_KEY = "musalleen-guest-today"; // { day, count } — device-only

// Function, not a module-level constant: Capacitor's bridge (window.Capacitor)
// attaches asynchronously, and this module can finish evaluating before it
// does — a constant computed once at parse time would freeze in as `false`
// and never notice the bridge arriving a moment later. (Exact bug Mustaghfirin
// had to fix reactively — see sakinah commit 48902da — done right from the
// start here.)
const isNativeApp = () => typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();

const ALIAS_WORDS = ["Traveler", "Seeker", "Wayfarer", "Servant", "Wanderer", "Pilgrim"];
const generateAlias = () => {
  const word = ALIAS_WORDS[Math.floor(Math.random() * ALIAS_WORDS.length)];
  const n = Math.floor(100 + Math.random() * 900);
  return `${word}-${n}`;
};

const inputStyle = { width: "100%", background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 14px", color: C.ivory, fontSize: 15 };
const goldBtn = { background: C.gold, color: "#1B1508", fontWeight: 700, border: "none", borderRadius: 10, padding: "12px 18px", fontSize: 15, cursor: "pointer", width: "100%" };

const Shell = ({ children }) => (
  <div style={{ background: C.bg, minHeight: "100vh", color: C.ivory, position: "relative" }}>
    {children}
  </div>
);

export default function Musalleen() {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(undefined);
  const [format, setFormat] = useState(null);
  const [todayCount, setTodayCount] = useState(0);
  const [dataReady, setDataReady] = useState(false);
  const [guest, setGuest] = useState(false);
  const [pending, setPending] = useState(0);
  const [authBusy, setAuthBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [ripples, setRipples] = useState([]);

  const today = dayKeyInTz(profile?.timezone || deviceTz());

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
    if (data) setProfile(data);
  }, [session]);

  const { queueDelta, scheduleFlush, pendingCount } = useOfflineCountQueue({
    session,
    onFlushed: () => { setPending(pendingCount()); refreshProfile(); },
  });

  /* ------- guest mode init ------- */
  useEffect(() => {
    try { if (localStorage.getItem(GUEST_KEY) === "1") setGuest(true); } catch (e) {}
  }, []);

  /* ------- auth session ------- */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Native app: Google sign-in opens in an in-app browser tab (Chrome Custom
  // Tabs via @capacitor/browser) since Google blocks its OAuth screen inside
  // embedded WebViews. This listens for the custom-scheme redirect back into
  // the app once that flow completes, and exchanges the PKCE code for a
  // session in the app's own WebView storage.
  useEffect(() => {
    if (!isNativeApp() || !window.Capacitor?.Plugins?.App) return;
    const handle = window.Capacitor.Plugins.App.addListener("appUrlOpen", async ({ url }) => {
      if (!url || !url.includes("login-callback")) return;
      try {
        const code = new URL(url).searchParams.get("code");
        if (code) await supabase.auth.exchangeCodeForSession(code);
      } catch (e) {
        console.error("Native sign-in exchange failed:", e);
      } finally {
        window.Capacitor.Plugins.Browser?.close();
      }
    });
    return () => { handle?.then?.((h) => h.remove()); };
  }, []);

  /* ------- load the one seeded salawat format (Phase 2: no picker yet) ------- */
  useEffect(() => {
    supabase.from("salawat_formats").select("*").eq("is_active", true).order("sort_order").limit(1).maybeSingle()
      .then(({ data }) => setFormat(data));
  }, []);

  /* ------- load / create profile, load today's total ------- */
  useEffect(() => {
    if (guest) {
      setDataReady(false);
      try {
        const cached = JSON.parse(localStorage.getItem(GUEST_TODAY_KEY) || "null");
        const todayKey = dayKeyInTz(deviceTz());
        setTodayCount(cached && cached.day === todayKey ? cached.count : 0);
      } catch (e) { setTodayCount(0); }
      setDataReady(true);
      return;
    }
    if (session === undefined) return;
    if (!session?.user) { setProfile(undefined); setDataReady(false); return; }

    (async () => {
      setDataReady(false);
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      let p = prof;
      if (!p) {
        const { data: created, error } = await supabase.from("profiles").insert({
          id: session.user.id,
          alias: generateAlias(),
          timezone: deviceTz(),
        }).select().single();
        if (error) { console.error("profile create failed", error); setDataReady(true); return; }
        p = created;
      }
      setProfile(p);

      const todayKey = dayKeyInTz(p.timezone || deviceTz());
      const { data: totalRow } = await supabase.from("daily_totals").select("total").eq("user_id", session.user.id).eq("day", todayKey).maybeSingle();
      setTodayCount(totalRow?.total || 0);
      setPending(pendingCount());
      setDataReady(true);
    })();
  }, [session, guest, pendingCount]);

  /* ------- actions ------- */
  const enterGuest = () => {
    setGuest(true);
    try { localStorage.setItem(GUEST_KEY, "1"); } catch (e) {}
  };

  const signInGoogle = async () => {
    setAuthBusy(true);
    try {
      if (isNativeApp()) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: NATIVE_REDIRECT_URL, skipBrowserRedirect: true },
        });
        if (error) throw error;
        if (data?.url) await window.Capacitor?.Plugins?.Browser?.open({ url: data.url });
      } else {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: window.location.origin },
        });
        if (error) throw error;
      }
    } catch (e) {
      console.error("Google sign-in failed:", e);
      setAuthBusy(false);
    }
  };

  const signInEmail = async () => {
    if (!email.trim()) return;
    setAuthBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: isNativeApp() ? undefined : window.location.origin },
      });
      if (error) throw error;
      setEmailSent(true);
    } catch (e) {
      console.error("Email sign-in failed:", e);
    } finally {
      setAuthBusy(false);
    }
  };

  const signOut = async () => { await supabase.auth.signOut(); setProfile(undefined); };
  const exitApp = () => window.Capacitor?.Plugins?.App?.exitApp();

  const tapCount = () => {
    const id = Date.now();
    setRipples((r) => [...r, id]);
    setTimeout(() => setRipples((r) => r.filter((x) => x !== id)), 900);

    if (guest) {
      setTodayCount((c) => {
        const next = c + 1;
        try { localStorage.setItem(GUEST_TODAY_KEY, JSON.stringify({ day: dayKeyInTz(deviceTz()), count: next })); } catch (e) {}
        return next;
      });
      return;
    }
    if (!session?.user || !format) return;
    setTodayCount((c) => c + 1);
    queueDelta(today, format.id, 1);
    setPending((p) => p + 1);
    scheduleFlush();
  };

  /* ================================================================ */

  if (guest === false && session === undefined) {
    return <Shell><div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>Opening…</div></Shell>;
  }

  /* ------- login ------- */
  if (!guest && !session) {
    return (
      <Shell>
        <div style={{ maxWidth: 420, margin: "0 auto", padding: "calc(60px + env(safe-area-inset-top)) 22px calc(40px + env(safe-area-inset-bottom))" }} className="fadeUp">
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div className="amiri" style={{ fontSize: 34, color: C.goldBright, lineHeight: 1.7 }}>اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ</div>
            <div className="display" style={{ fontSize: 34, fontWeight: 600, marginTop: 8 }}>{APP_NAME}</div>
            <div style={{ fontSize: 12, color: C.faint, letterSpacing: 2, textTransform: "uppercase", marginTop: 4 }}>Those Who Send Blessings Upon the Prophet ﷺ</div>
          </div>

          <button onClick={signInGoogle} disabled={authBusy}
            style={{ ...goldBtn, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, opacity: authBusy ? 0.7 : 1 }}>
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#1B1508" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.3 0 6.3 1.2 8.6 3.2l6-6C34.9 4.5 29.7 2.5 24 2.5 12.1 2.5 2.5 12.1 2.5 24S12.1 45.5 24 45.5c11 0 21-8 21-21.5 0-1.4-.2-2.7-.5-4z"/></svg>
            Continue with Google
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0", color: C.faint, fontSize: 12 }}>
            <div style={{ flex: 1, height: 1, background: C.line }} /> or <div style={{ flex: 1, height: 1, background: C.line }} />
          </div>

          {!emailSent ? (
            <>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com"
                onKeyDown={(e) => e.key === "Enter" && signInEmail()} style={{ ...inputStyle, marginBottom: 10 }} />
              <button onClick={signInEmail} disabled={authBusy}
                style={{ ...goldBtn, background: C.surface2, color: C.ivory, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Mail size={16} /> Email me a sign-in link
              </button>
            </>
          ) : (
            <div style={{ background: C.surface2, border: `1px solid ${C.gold}44`, borderRadius: 14, padding: 18, textAlign: "center", fontSize: 14, lineHeight: 1.6 }}>
              ✉️ Link sent to <b>{email}</b>. Open it on this device.
            </div>
          )}

          <div style={{ textAlign: "center", marginTop: 22 }}>
            <button onClick={enterGuest}
              style={{ background: "transparent", border: "none", color: C.gold, fontSize: 13.5, cursor: "pointer", textDecoration: "underline" }}>
              Continue as guest
            </button>
            <div style={{ fontSize: 11, color: C.faint, marginTop: 5 }}>Start counting now — no account needed.</div>
          </div>
        </div>
      </Shell>
    );
  }

  if (!guest && session && (profile === undefined || !dataReady || !format)) {
    return <Shell><div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>Loading…</div></Shell>;
  }

  const goal = profile?.daily_goal || 100;
  const pct = Math.min(todayCount / goal, 1);

  /* ------- main counter screen ------- */
  return (
    <Shell>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "calc(20px + env(safe-area-inset-top)) 18px calc(40px + env(safe-area-inset-bottom))", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <div className="display" style={{ fontSize: 20, fontWeight: 600 }}>{APP_NAME}</div>
            {!guest && (
              <div style={{ fontSize: 11, color: C.faint, display: "flex", alignItems: "center", gap: 4 }}>
                <Flame size={12} color={profile?.streak_current > 0 ? C.warn : C.faint} />
                {profile?.streak_current || 0} day streak
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {pending > 0 && <span style={{ fontSize: 11, color: C.faint }}>{pending} syncing…</span>}
            {isNativeApp() && (
              <button onClick={exitApp} aria-label="Exit app" style={{ background: "none", border: "none", color: C.faint, cursor: "pointer", padding: 4 }}><X size={18} /></button>
            )}
            {!guest && session && (
              <button onClick={signOut} aria-label="Sign out" style={{ background: "none", border: "none", color: C.faint, cursor: "pointer", padding: 4 }}><LogOut size={18} /></button>
            )}
          </div>
        </header>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <div className="amiri" style={{ fontSize: 22, color: C.goldBright, lineHeight: 2, marginBottom: 8, direction: "rtl" }}>
            {format?.arabic_text}
          </div>
          {format?.transliteration && (
            <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, marginBottom: 28, maxWidth: 360 }}>{format.transliteration}</div>
          )}

          <button onClick={tapCount} style={{
            position: "relative", width: 220, height: 220, borderRadius: "50%",
            background: `conic-gradient(${C.gold} ${pct * 360}deg, ${C.surface2} 0deg)`,
            border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ width: 190, height: 190, borderRadius: "50%", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span className="display" style={{ fontSize: 48, fontWeight: 600, color: C.ivory }}>{todayCount}</span>
              <span style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>of {goal} today</span>
            </div>
            {ripples.map((id) => (
              <div key={id} style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${C.goldBright}`, animation: "rippleOut .9s ease-out forwards" }} />
            ))}
          </button>

          <div style={{ fontSize: 12.5, color: C.faint, marginTop: 24, maxWidth: 300, lineHeight: 1.6 }}>
            Tap for each salawat. Set a number you can keep up daily — consistency matters more than quantity.
          </div>

          {guest && (
            <div style={{ marginTop: 20, fontSize: 11.5, color: C.faint, maxWidth: 300, lineHeight: 1.6 }}>
              Counting as a guest — saved on this device only.
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes rippleOut { from { opacity: .9; transform: scale(1); } to { opacity: 0; transform: scale(1.12); } }
      `}</style>
    </Shell>
  );
}
