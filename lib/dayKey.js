// Single source of truth for all "what calendar day is it, in this user's
// timezone" arithmetic — streak computation, chart ranges, and the Friday
// reminder check all import from here. Nothing else in the app should ever
// compute a day key or shift one by hand.
//
// The one rule that matters: shift days by walking Y/M/D calendar components
// in UTC-midnight space, never by adding offsetDays*86400000 to the current
// instant and reformatting into a timezone. A civil day can be 23h or 25h of
// real elapsed time across a DST transition, so instant-based arithmetic can
// silently skip or repeat a day. Calendar-component arithmetic in UTC has no
// DST to break, by construction. (This is the exact bug Mustaghfirin's
// shiftDayKey had to be rewritten to fix after shipping — see sakinah commit
// 3073feb — so it's being done correctly here from the first commit.)

export const deviceTz = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
  catch { return "UTC"; }
};

// "YYYY-MM-DD" for `date`, as seen in timezone `tz`.
export const dayKeyInTz = (tz, date = new Date()) => {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-CA").format(date);
  }
};

// Shift a "YYYY-MM-DD" key by a whole number of calendar days.
export const shiftDayKeyFrom = (dayKey, offsetDays) => {
  const [y, m, d] = dayKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d) + offsetDays * 86400000);
  const yyyy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export const shiftDayKey = (tz, offsetDays) => shiftDayKeyFrom(dayKeyInTz(tz), offsetDays);

// Whole-day difference between two "YYYY-MM-DD" keys (b - a), computed via
// the same UTC-midnight calendar arithmetic — used for grace-window checks
// (e.g. "was the user's last active day exactly yesterday, or the day
// before?") without ever touching an absolute instant.
export const daysBetweenKeys = (a, b) => {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
};

// Friday-ness, computed from the day-of-week of the ZONED calendar date, not
// UTC's — a user at UTC+13 can already be into Friday while UTC is still on
// Thursday, and the Friday-specific reminder must follow their own day.
export const isFridayInTz = (tz, date = new Date()) => {
  try {
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(date);
    return weekday === "Fri";
  } catch {
    return date.getDay() === 5;
  }
};
