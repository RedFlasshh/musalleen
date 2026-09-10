"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { Mail, LogOut, X, Flame, Target, BookOpen, Sparkles, Check, Map } from "lucide-react";
import { deviceTz, dayKeyInTz } from "../lib/dayKey";
import { useOfflineCountQueue } from "../hooks/useOfflineCountQueue";
import { LEVELS, levelFor, MILESTONES } from "../lib/levels";

/* ------------------------------------------------------------------ */
/* Module-level C = Wahda's (level 1) theme exactly, so the login/       */
/* loading screens — rendered before any level is known — match the     */
/* very first authenticated view with no visual jump. Once inside the   */
/* main component, `const C = level.theme` shadows this for the rest of */
/* the render (see below), and every C.xxx reference in this file       */
/* — there are many — picks up the current level's palette automatically*/
/* via normal JS scoping. Same pattern proven in Mustaghfirin.          */
/* ------------------------------------------------------------------ */
const C = {
  bg: "#0A1A20", surface: "#10262E", surface2: "#16333C", line: "#1F4550",
  gold: "#C9A24B", goldBright: "#E8CD86", ivory: "#F4EFE2",
  muted: "#8BA79A", faint: "#5C776C", warn: "#D98F4E",
};

const CAT_COLOR = { quran: "#C9A24B", hadith: "#3FAE7C", scholar: "#7FB3D5", friday: "#D98F4E", reflection: "#B08FC9" };
const CAT_LABEL = { quran: "Quran", hadith: "Hadith", scholar: "Scholars", friday: "Friday", reflection: "Reflection" };

const APP_NAME = "Musalleen";
const NATIVE_REDIRECT_URL = "musalleen://login-callback";
const GUEST_KEY = "musalleen-guest-mode";
const GUEST_TODAY_KEY = "musalleen-guest-today"; // { day, count } — device-only
const GUEST_FORMAT_KEY = "musalleen-guest-format"; // format id — device-only
const GUEST_TOTAL_KEY = "musalleen-guest-total"; // lifetime count integer — device-only, drives guest-mode levels
const LEVEL_SEEN_KEY = "musalleen-level-seen"; // highest level id already celebrated, so the level-up modal fires once per level

// Public by design — this is the VAPID *public* key, safe to ship in client
// code (it identifies the sender to the push service, it doesn't authorize
// anything). The private key never leaves the edge function's own secrets.
const VAPID_PUBLIC_KEY = "BD86iK6lOy7NFqY_DzMyU7cgNUDFT8nvgzj9I1YutkfPd9hemANHoyHfdeZ6g3EaZgUAdHK8r45wea8kJF5bXhk";

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

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
  const [formats, setFormats] = useState([]);
  const [format, setFormat] = useState(null);
  const [todayCount, setTodayCount] = useState(0);
  const [dataReady, setDataReady] = useState(false);
  const [guest, setGuest] = useState(false);
  const [pending, setPending] = useState(0);
  const [authBusy, setAuthBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [ripples, setRipples] = useState([]);
  const [tab, setTab] = useState("count");

  const [virtues, setVirtues] = useState([]);
  const [dailyIdx, setDailyIdx] = useState(0);
  const [browseIdx, setBrowseIdx] = useState(0);
  const [guestTotal, setGuestTotal] = useState(0);
  const [levelUp, setLevelUp] = useState(null); // level object, shown once when newly reached
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderNote, setReminderNote] = useState("");

  const today = dayKeyInTz(profile?.timezone || deviceTz());
  const totalLifetimeCount = guest ? guestTotal : (profile?.total_lifetime_count || 0);
  const { cur: level, next: nextLevel } = levelFor(totalLifetimeCount);
  // Shadows the module-level C for the rest of this render — every C.xxx
  // reference below (there are many) automatically reads the current
  // level's palette via normal JS scoping. inputStyle/goldBtn are
  // redeclared alongside it since they depend on C.
  const C = level.theme;
  const inputStyle = { width: "100%", background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 14px", color: C.ivory, fontSize: 15 };
  const goldBtn = { background: C.gold, color: "#1B1508", fontWeight: 700, border: "none", borderRadius: 10, padding: "12px 18px", fontSize: 15, cursor: "pointer", width: "100%" };

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

  /* ------- load all durud formats (Duruds tab + active-format selection) ------- */
  useEffect(() => {
    supabase.from("salawat_formats").select("*").eq("is_active", true).order("sort_order")
      .then(({ data }) => setFormats(data || []));
  }, []);

  /* ------- once formats + profile/guest state are known, pick the active one ------- */
  useEffect(() => {
    if (formats.length === 0) return;
    let preferredId = null;
    if (guest) {
      try { preferredId = localStorage.getItem(GUEST_FORMAT_KEY); } catch (e) {}
    } else if (profile?.preferred_format_id) {
      preferredId = profile.preferred_format_id;
    }
    const found = formats.find((f) => f.id === preferredId);
    setFormat(found || formats[0]);
  }, [formats, profile, guest]);

  /* ------- load virtues once (Benefits tab) ------- */
  useEffect(() => {
    supabase.from("virtues").select("*").order("sort_order").then(({ data }) => {
      const list = data || [];
      setVirtues(list);
      if (list.length) {
        const doy = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
        setDailyIdx(doy % list.length);
        setBrowseIdx(Math.floor(Math.random() * list.length));
      }
    });
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
      try {
        setGuestTotal(parseInt(localStorage.getItem(GUEST_TOTAL_KEY) || "0", 10));
      } catch (e) { setGuestTotal(0); }
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

  // Level-up announcement: the whole app's theme changes silently on its own
  // (see `const C = level.theme` above) unless we tell the user why. Fires
  // once per level actually reached — never for level 1 (Wahda), which is
  // everyone's starting point, not something to "congratulate". Waits for
  // dataReady so a fresh load can't misfire before the real total arrives.
  useEffect(() => {
    if (!dataReady || level.id <= 1) return;
    try {
      const seen = parseInt(localStorage.getItem(LEVEL_SEEN_KEY) || "0", 10);
      if (level.id > seen) {
        setLevelUp(level);
        localStorage.setItem(LEVEL_SEEN_KEY, String(level.id));
      }
    } catch (e) {}
  }, [dataReady, level.id]);

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
      setGuestTotal((t) => {
        const next = t + 1;
        try { localStorage.setItem(GUEST_TOTAL_KEY, String(next)); } catch (e) {}
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

  // Requests notification permission, subscribes this device via the
  // service worker's push manager, and saves the subscription so the
  // send-reminders edge function can find it. Only meaningful for signed-in
  // users -- the cron job looks up subscriptions by user_id, which guests
  // don't have.
  const subscribeToPush = async () => {
    if (!session?.user) return false;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setReminderNote("Push notifications aren't supported in this browser.");
      return false;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setReminderNote("Notification permission was not granted.");
        return false;
      }
      const registration = await navigator.serviceWorker.ready;
      let sub = await registration.pushManager.getSubscription();
      if (!sub) {
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      const json = sub.toJSON();
      const { error } = await supabase.from("push_subscriptions").upsert({
        user_id: session.user.id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      }, { onConflict: "endpoint" });
      if (error) throw error;
      return true;
    } catch (e) {
      console.error("push subscription failed", e);
      setReminderNote("Could not enable notifications on this device.");
      return false;
    }
  };

  const updateReminderSettings = async (updates) => {
    if (!session?.user) return;
    setReminderBusy(true);
    setReminderNote("");
    try {
      const enablingSomething = updates.reminder_enabled || updates.friday_reminder_enabled;
      if (enablingSomething) {
        const ok = await subscribeToPush();
        if (!ok) { setReminderBusy(false); return; }
      }
      setProfile((p) => (p ? { ...p, ...updates } : p));
      const { error } = await supabase.from("profiles").update(updates).eq("id", session.user.id);
      if (error) throw error;
    } catch (e) {
      console.error("reminder settings update failed", e);
      setReminderNote("Could not save reminder settings.");
    } finally {
      setReminderBusy(false);
    }
  };

  const selectFormat = async (f) => {
    setFormat(f);
    if (guest) {
      try { localStorage.setItem(GUEST_FORMAT_KEY, f.id); } catch (e) {}
      return;
    }
    if (!session?.user) return;
    setProfile((p) => (p ? { ...p, preferred_format_id: f.id } : p));
    const { error } = await supabase.from("profiles").update({ preferred_format_id: f.id }).eq("id", session.user.id);
    if (error) console.error("could not save preferred format", error);
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
  const daily = virtues[dailyIdx];
  const benefit = virtues[browseIdx];

  const NAV = [
    { id: "count", icon: Target, label: "Count" },
    { id: "duruds", icon: BookOpen, label: "Duruds" },
    { id: "benefits", icon: Sparkles, label: "Benefits" },
    { id: "journey", icon: Map, label: "Journey" },
  ];

  return (
    <Shell>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "calc(20px + env(safe-area-inset-top)) 18px calc(96px + env(safe-area-inset-bottom))", minHeight: "100vh" }}>
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

        {/* -------- COUNT -------- */}
        {tab === "count" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", minHeight: "calc(100vh - 220px)" }}>
            <div className="amiri" style={{ fontSize: 22, color: C.goldBright, lineHeight: 2, marginBottom: 8, direction: "rtl" }}>
              {format?.arabic_text}
            </div>
            {format?.transliteration && (
              <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, marginBottom: 8, maxWidth: 360 }}>{format.transliteration}</div>
            )}
            <button onClick={() => setTab("duruds")} style={{ background: "none", border: "none", color: C.gold, fontSize: 11.5, cursor: "pointer", marginBottom: 20, textDecoration: "underline" }}>
              Change durud
            </button>

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
        )}

        {/* -------- DURUDS -------- */}
        {tab === "duruds" && (
          <div>
            <div className="display" style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Duruds</div>
            <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
              Every form of salawat carries the same reward. Pick whichever moves you — the tap counter below always uses the one you choose here.
            </div>
            {formats.map((f) => {
              const active = format?.id === f.id;
              return (
                <div key={f.id} style={{ background: active ? C.surface2 : C.surface, border: `1px solid ${active ? C.gold : C.line}`, borderRadius: 16, padding: 18, marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: active ? C.goldBright : C.ivory }}>{f.title}</div>
                      <div style={{ fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", color: C.faint, marginTop: 2 }}>{f.category}</div>
                    </div>
                    <button onClick={() => selectFormat(f)}
                      style={{
                        display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700,
                        color: active ? "#1B1508" : C.gold, background: active ? C.gold : "transparent",
                        border: `1px solid ${C.gold}`, borderRadius: 999, padding: "5px 12px", cursor: "pointer", flexShrink: 0,
                      }}>
                      {active ? <><Check size={12} /> Active</> : "Use this"}
                    </button>
                  </div>
                  <div className="amiri" style={{ fontSize: 19, color: C.goldBright, lineHeight: 1.9, direction: "rtl", marginBottom: 8 }}>{f.arabic_text}</div>
                  {f.transliteration && <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.55, marginBottom: 6, fontStyle: "italic" }}>{f.transliteration}</div>}
                  {f.translation && <div style={{ fontSize: 13, color: C.ivory, lineHeight: 1.55, marginBottom: 8 }}>{f.translation}</div>}
                  {f.source_note && <div style={{ fontSize: 11.5, color: C.faint, lineHeight: 1.5 }}>{f.source_note}</div>}
                </div>
              );
            })}
            {formats.length === 0 && <div style={{ color: C.faint, fontSize: 13 }}>Loading…</div>}
          </div>
        )}

        {/* -------- BENEFITS -------- */}
        {tab === "benefits" && (
          <div>
            <div className="display" style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Benefits</div>
            <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
              Direct promises from the Quran and hadith are shown as such; general wisdom is clearly labelled Scholars or Reflection, never presented as scripture.
            </div>

            {daily && (
              <div style={{ background: C.surface2, border: `1px solid ${CAT_COLOR[daily.category]}55`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
                <div style={{ fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase", color: CAT_COLOR[daily.category], marginBottom: 6 }}>
                  Today's Reminder · {CAT_LABEL[daily.category]}
                </div>
                <div className="display" style={{ fontSize: 19, fontWeight: 600, marginBottom: 6 }}>{daily.title}</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.6, opacity: 0.92 }}>{daily.body}</div>
                <div style={{ fontSize: 11.5, color: C.faint, marginTop: 10, fontStyle: "italic" }}>{daily.source}</div>
              </div>
            )}

            {benefit && (
              <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18 }}>
                <div style={{ fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase", color: CAT_COLOR[benefit.category], marginBottom: 6 }}>
                  Browse · {CAT_LABEL[benefit.category]}
                </div>
                <div className="display" style={{ fontSize: 19, fontWeight: 600, marginBottom: 6 }}>{benefit.title}</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.6, opacity: 0.92 }}>{benefit.body}</div>
                <div style={{ fontSize: 11.5, color: C.faint, marginTop: 10, fontStyle: "italic" }}>{benefit.source}</div>
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button onClick={() => setBrowseIdx((browseIdx - 1 + virtues.length) % virtues.length)}
                    style={{ flex: 1, background: C.surface2, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 0", color: C.ivory, cursor: "pointer", fontSize: 13 }}>
                    ← Previous
                  </button>
                  <button onClick={() => {
                    let r = Math.floor(Math.random() * virtues.length);
                    if (r === browseIdx) r = (r + 1) % virtues.length;
                    setBrowseIdx(r);
                  }} style={{ flex: 1, background: C.gold, border: "none", borderRadius: 10, padding: "10px 0", color: "#1B1508", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                    Shuffle
                  </button>
                  <button onClick={() => setBrowseIdx((browseIdx + 1) % virtues.length)}
                    style={{ flex: 1, background: C.surface2, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 0", color: C.ivory, cursor: "pointer", fontSize: 13 }}>
                    Next →
                  </button>
                </div>
              </div>
            )}
            {virtues.length === 0 && <div style={{ color: C.faint, fontSize: 13 }}>Loading…</div>}
          </div>
        )}

        {/* -------- JOURNEY -------- */}
        {tab === "journey" && (
          <div>
            <div className="display" style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Your Journey</div>
            <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
              Measured in total salawat sent, across every durud you've counted.
            </div>

            <div style={{ background: C.surface2, border: `1px solid ${level.theme.ring}55`, borderRadius: 18, padding: 20, marginBottom: 12, textAlign: "center" }}>
              <div className="amiri" style={{ fontSize: 26, color: level.theme.ring, lineHeight: 1.6 }}>{level.ar}</div>
              <div className="display" style={{ fontSize: 26, fontWeight: 600, marginTop: 2 }}>{level.name}</div>
              <div style={{ fontSize: 11, letterSpacing: 2.5, textTransform: "uppercase", color: C.faint, marginTop: 2 }}>
                Level {level.id} · {level.en}
              </div>
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 10, lineHeight: 1.55, fontStyle: "italic" }}>{level.note}</div>

              {nextLevel ? (
                <div style={{ marginTop: 16 }}>
                  <div style={{ height: 8, background: C.ringTrack, borderRadius: 999, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${Math.min(((totalLifetimeCount - level.days) / (nextLevel.days - level.days)) * 100, 100)}%`,
                      background: `linear-gradient(90deg, ${level.theme.ring}, ${nextLevel.theme.ring})`,
                      borderRadius: 999, transition: "width .5s ease",
                    }} />
                  </div>
                  <div style={{ fontSize: 11.5, color: C.faint, marginTop: 6 }}>
                    {nextLevel.days - totalLifetimeCount} more to {nextLevel.name} ({nextLevel.en})
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: C.goldBright, marginTop: 14 }}>✦ Every level reached ✦</div>
              )}
            </div>

            <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: 20, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                <span className="display" style={{ fontSize: 34, fontWeight: 600, color: C.goldBright }}>{totalLifetimeCount.toLocaleString()}</span>
                <span style={{ fontSize: 13, color: C.muted }}>lifetime salawat</span>
              </div>
              {!guest && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: C.muted, marginTop: 8 }}>
                  <Flame size={14} color={profile?.streak_current > 0 ? C.warn : C.faint} />
                  {profile?.streak_current || 0} day streak · longest {profile?.streak_longest || 0}
                </div>
              )}
            </div>

            <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16 }}>
              <div style={{ fontSize: 10.5, letterSpacing: 1.5, textTransform: "uppercase", color: C.faint, marginBottom: 10 }}>Milestones</div>
              {MILESTONES.map((m) => {
                const done = totalLifetimeCount >= m.threshold;
                return (
                  <div key={m.threshold} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                    <span style={{ fontSize: 14, color: done ? C.goldBright : C.faint, width: 18 }}>{done ? "✦" : "○"}</span>
                    <span style={{ width: 9, height: 9, borderRadius: 99, background: done ? m.level.theme.ring : C.faint, flexShrink: 0 }} />
                    <span style={{ fontSize: 13.5, color: done ? C.ivory : C.faint, flex: 1 }}>{m.label}</span>
                    <span style={{ fontSize: 11.5, color: C.faint }}>{m.threshold.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, marginTop: 12 }}>
              <div style={{ fontSize: 10.5, letterSpacing: 1.5, textTransform: "uppercase", color: C.faint, marginBottom: 12 }}>Reminders</div>
              {guest ? (
                <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6 }}>Sign in to enable daily and Friday reminders.</div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, color: C.ivory }}>Daily reminder</div>
                      <div style={{ fontSize: 11.5, color: C.faint }}>Only sent if today's goal isn't met yet</div>
                    </div>
                    <button
                      onClick={() => updateReminderSettings({ reminder_enabled: !profile?.reminder_enabled, reminder_time: profile?.reminder_time || "20:00:00" })}
                      disabled={reminderBusy}
                      style={{
                        width: 44, height: 26, borderRadius: 999, border: "none", cursor: "pointer", position: "relative",
                        background: profile?.reminder_enabled ? C.gold : C.line, flexShrink: 0, opacity: reminderBusy ? 0.6 : 1,
                      }}>
                      <span style={{ position: "absolute", top: 3, left: profile?.reminder_enabled ? 21 : 3, width: 20, height: 20, borderRadius: "50%", background: C.ivory, transition: "left .15s ease" }} />
                    </button>
                  </div>
                  {profile?.reminder_enabled && (
                    <input type="time" value={(profile?.reminder_time || "20:00:00").slice(0, 5)}
                      onChange={(e) => updateReminderSettings({ reminder_time: `${e.target.value}:00` })}
                      style={{ ...inputStyle, marginBottom: 14, colorScheme: "dark" }} />
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, color: C.ivory }}>Friday reminder</div>
                      <div style={{ fontSize: 11.5, color: C.faint }}>A second, separate push — salawat is presented to him ﷺ on Fridays</div>
                    </div>
                    <button
                      onClick={() => updateReminderSettings({ friday_reminder_enabled: !profile?.friday_reminder_enabled, friday_reminder_time: profile?.friday_reminder_time || "12:00:00" })}
                      disabled={reminderBusy}
                      style={{
                        width: 44, height: 26, borderRadius: 999, border: "none", cursor: "pointer", position: "relative",
                        background: profile?.friday_reminder_enabled ? C.gold : C.line, flexShrink: 0, opacity: reminderBusy ? 0.6 : 1,
                      }}>
                      <span style={{ position: "absolute", top: 3, left: profile?.friday_reminder_enabled ? 21 : 3, width: 20, height: 20, borderRadius: "50%", background: C.ivory, transition: "left .15s ease" }} />
                    </button>
                  </div>
                  {profile?.friday_reminder_enabled && (
                    <input type="time" value={(profile?.friday_reminder_time || "12:00:00").slice(0, 5)}
                      onChange={(e) => updateReminderSettings({ friday_reminder_time: `${e.target.value}:00` })}
                      style={{ ...inputStyle, colorScheme: "dark" }} />
                  )}

                  {reminderNote && <div style={{ fontSize: 11.5, color: C.warn, marginTop: 10, lineHeight: 1.5 }}>{reminderNote}</div>}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {levelUp && (
        <div onClick={() => setLevelUp(null)}
          style={{ position: "fixed", inset: 0, zIndex: 51, background: "rgba(6,14,12,0.78)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 26 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 380, width: "100%", background: C.surface2, border: `1px solid ${levelUp.theme.ring}66`, borderRadius: 20, padding: 26, textAlign: "center" }} className="fadeUp">
            <div style={{ fontSize: 10.5, letterSpacing: 3, textTransform: "uppercase", color: levelUp.theme.ring, marginBottom: 10 }}>New Level Reached</div>
            <div className="amiri" style={{ fontSize: 34, color: levelUp.theme.ring, lineHeight: 1.5 }}>{levelUp.ar}</div>
            <div className="display" style={{ fontSize: 26, fontWeight: 600, marginTop: 4 }}>{levelUp.name}</div>
            <div style={{ fontSize: 11, letterSpacing: 2.5, textTransform: "uppercase", color: C.faint, marginTop: 2 }}>
              Level {levelUp.id} · {levelUp.en}
            </div>
            <div style={{ fontSize: 13.5, color: C.muted, marginTop: 14, lineHeight: 1.6, fontStyle: "italic" }}>{levelUp.note}</div>
            <div style={{ fontSize: 12.5, color: C.ivory, marginTop: 16, lineHeight: 1.6 }}>
              The whole app's colours have just changed to mark it — the deeper the journey, the richer the theme.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
              {[levelUp.theme.ring, levelUp.theme.gold, levelUp.theme.goldBright].map((c, i) => (
                <div key={i} style={{ width: 22, height: 22, borderRadius: 6, background: c }} />
              ))}
            </div>
            <button onClick={() => setLevelUp(null)}
              style={{ ...goldBtn, background: levelUp.theme.ring, marginTop: 22, width: "auto", padding: "10px 28px" }}>
              Continue
            </button>
          </div>
        </div>
      )}

      {/* -------- bottom nav -------- */}
      <nav style={{
        position: "fixed", left: 0, right: 0, bottom: 0, display: "flex",
        background: C.surface, borderTop: `1px solid ${C.line}`,
        padding: "10px 8px calc(10px + env(safe-area-inset-bottom))",
      }}>
        <div style={{ maxWidth: 460, margin: "0 auto", display: "flex", width: "100%" }}>
          {NAV.map(({ id, icon: Icon, label }) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => setTab(id)}
                style={{
                  flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  background: "none", border: "none", cursor: "pointer", padding: "4px 0",
                  color: active ? C.goldBright : C.faint,
                }}>
                <Icon size={20} />
                <span style={{ fontSize: 10.5 }}>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <style jsx global>{`
        @keyframes rippleOut { from { opacity: .9; transform: scale(1); } to { opacity: 0; transform: scale(1.12); } }
      `}</style>
    </Shell>
  );
}
