// Cron-invoked edge function (every 15 min, see the pg_cron schedule in
// migration 0005) that sends the daily reminder and, on Fridays, a
// genuinely separate second push -- never a retimed replacement of the
// daily one (the user explicitly wants two notifications that day).
//
// All "what day/time is it for this user" logic goes through the same
// calendar-component-in-their-timezone approach as lib/dayKey.js on the
// client -- Deno's Intl support makes this straightforward without a
// date library. This is the one place outside the client that computes a
// day key, so it has to follow the same DST-safe rule the rest of the app
// does: never epoch-math a day, always ask Intl what day/time it actually
// is in that specific timezone.

// @deno-types="npm:web-push@3.6.7"
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:support@musalleen.app";
// This function is invoked only by the internal pg_cron schedule (see
// migration 0005), never by end users -- deployed with verify_jwt=false
// since a system cron tick has no user session to hold a JWT, so a shared
// secret is checked here instead of relying on Supabase's JWT gate.
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function localParts(tz: string, date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    hour: parseInt(parts.hour, 10),
    minute: parseInt(parts.minute, 10),
    isFriday: parts.weekday === "Fri",
  };
}

function withinWindow(hour: number, minute: number, targetTime: string | null, windowMinutes = 15) {
  if (!targetTime) return false;
  const [th, tm] = targetTime.split(":").map(Number);
  const nowMin = hour * 60 + minute;
  const targetMin = th * 60 + tm;
  const diff = nowMin - targetMin;
  return diff >= 0 && diff < windowMinutes;
}

const DAILY_COPY = { title: "Musalleen", body: "Send blessings on the Prophet ﷺ today.", url: "/", tag: "musalleen-daily" };
const FRIDAY_COPY = { title: "Musalleen — Jumu'ah Mubarak", body: "\"Increase your blessings upon me on Friday\" — today's salawat is presented to him ﷺ.", url: "/", tag: "musalleen-friday" };

async function sendToUser(userId: string, payload: typeof DAILY_COPY) {
  const { data: subs } = await supabase.from("push_subscriptions").select("*").eq("user_id", userId);
  for (const sub of subs || []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
    } catch (e) {
      // 404/410 means the subscription is dead (uninstalled, permission
      // revoked, etc.) -- clean it up so future ticks don't keep retrying it.
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      } else {
        console.error("push failed for", sub.id, e);
      }
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, timezone, daily_goal, reminder_enabled, reminder_time, friday_reminder_enabled, friday_reminder_time, last_reminded_day, last_reminded_friday_day")
    .or("reminder_enabled.eq.true,friday_reminder_enabled.eq.true");

  if (error) {
    console.error("profiles query failed", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let dailySent = 0, fridaySent = 0;

  for (const p of profiles || []) {
    const tz = p.timezone || "UTC";
    const { day, hour, minute, isFriday } = localParts(tz);

    if (p.reminder_enabled && p.last_reminded_day !== day && withinWindow(hour, minute, p.reminder_time)) {
      const { data: totalRow } = await supabase.from("daily_totals").select("total").eq("user_id", p.id).eq("day", day).maybeSingle();
      if ((totalRow?.total || 0) < (p.daily_goal || 100)) {
        await sendToUser(p.id, DAILY_COPY);
        await supabase.from("profiles").update({ last_reminded_day: day }).eq("id", p.id);
        dailySent++;
      }
    }

    if (isFriday && p.friday_reminder_enabled && p.last_reminded_friday_day !== day) {
      const target = p.friday_reminder_time || p.reminder_time;
      if (withinWindow(hour, minute, target)) {
        await sendToUser(p.id, FRIDAY_COPY);
        await supabase.from("profiles").update({ last_reminded_friday_day: day }).eq("id", p.id);
        fridaySent++;
      }
    }
  }

  return new Response(JSON.stringify({ checked: profiles?.length || 0, dailySent, fridaySent }), {
    headers: { "Content-Type": "application/json" },
  });
});
