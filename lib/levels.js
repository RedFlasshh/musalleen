// Single source of truth for the level ladder. The whole app's theme reads
// from the current level's `theme` object (see `const C = level.theme` in
// app/page.js, which shadows the module-level default for the rest of the
// render — same pattern proven in Mustaghfirin, see sakinah/app/page.js:471).
// Any "milestones" display should be derived from this array (map/filter),
// never hand-maintained as a second list — Mustaghfirin needed three
// follow-up commits after an early version let two lists drift apart.
//
// Neutral/functional text tones stay fixed across every level for
// readability; only bg/surface/line/gold/ring shift per level.
const NEUTRALS = { ivory: "#F4EFE2", muted: "#8BA79A", faint: "#5C776C", warn: "#D98F4E" };

// Progression is based on total_lifetime_count across ALL durud formats
// (not per-format) -- see the architecture plan: the habit being built is
// "sending blessings daily," and per-format streaks would dilute the one
// motivating number and punish the format variety the Duruds tab is meant
// to encourage.
//
// Each level's name ties back to something real already cited in the
// virtues content (Ashara/Daraja reference the "tenfold return, ten
// degrees raised" hadith; Qurb references the "closest to me on the Day
// of Judgment" hadith; Wasilah references the station believers ask Allah
// to grant the Prophet ﷺ in the dua after adhan; Ridwan is the Quranic
// concept of Allah's good pleasure, 9:72) rather than invented imagery.
export const LEVELS = [
  { id: 1, name: "Wahda", en: "One", days: 0, ar: "وَاحِدَة",
    note: "Every chain of blessings begins with a single salawat. You have begun.",
    theme: { ...NEUTRALS, bg: "#0A1A20", surface: "#10262E", surface2: "#16333C", line: "#1F4550", ringTrack: "#1D3E48", gold: "#C9A24B", goldBright: "#E8CD86", ring: "#7FA8C4" } },
  { id: 2, name: "Ashara", en: "Tenfold", days: 100, ar: "عَشَرَة",
    note: "“Whoever sends blessings upon me once, Allah will send blessings upon him tenfold.” — Sahih Muslim",
    theme: { ...NEUTRALS, bg: "#1A1509", surface: "#26200D", surface2: "#382E12", line: "#4E4118", ringTrack: "#463A16", gold: "#D4AD52", goldBright: "#F0D591", ring: "#D9A24B" } },
  { id: 3, name: "Daraja", en: "A Degree Raised", days: 500, ar: "دَرَجَة",
    note: "Ten sins removed, ten degrees raised — for every salawat sent, per the fuller narration in An-Nasa'i.",
    theme: { ...NEUTRALS, bg: "#0A1B14", surface: "#10261C", surface2: "#163628", line: "#1F4A34", ringTrack: "#1D4230", gold: "#CBA84F", goldBright: "#EAD08A", ring: "#4FB88A" } },
  { id: 4, name: "Baraka", en: "Blessing", days: 1500, ar: "بَرَكَة",
    note: "What began as a habit has become a source of blessing you can no longer separate from the practice itself.",
    theme: { ...NEUTRALS, bg: "#1F0E14", surface: "#2B141C", surface2: "#3E1C28", line: "#5A2838", ringTrack: "#4C2230", gold: "#DEBB63", goldBright: "#F5DE9F", ring: "#D97093" } },
  { id: 5, name: "Rahma", en: "Mercy", days: 3500, ar: "رَحْمَة",
    note: "Allah and His angels already send mercy upon the Prophet ﷺ — every salawat is a small joining-in of something vast.",
    theme: { ...NEUTRALS, bg: "#0A1B1C", surface: "#10272A", surface2: "#16373A", line: "#1F4B4E", ringTrack: "#1D444A", gold: "#C9BE55", goldBright: "#E6DC94", ring: "#3ECBC0" } },
  { id: 6, name: "Qurb", en: "Nearness", days: 7000, ar: "قُرْب",
    note: "“The people closest to me on the Day of Resurrection will be those who sent the most blessings upon me.” — Tirmidhi",
    theme: { ...NEUTRALS, bg: "#0D1220", surface: "#161C30", surface2: "#212B45", line: "#303E5E", ringTrack: "#2B3852", gold: "#D8B45A", goldBright: "#F2D998", ring: "#6B7FE0" } },
  { id: 7, name: "Noor", en: "Light", days: 12000, ar: "نُور",
    note: "A tongue kept moist with salawat. The Prophet ﷺ described dhikr as light — you are carrying it now.",
    theme: { ...NEUTRALS, bg: "#1F1608", surface: "#2B1F0C", surface2: "#3E2C12", line: "#5A4118", ringTrack: "#4C3714", gold: "#E4C56D", goldBright: "#FBEFC0", ring: "#F5E6A0" } },
  { id: 8, name: "Shafa'ah", en: "Intercession", days: 20000, ar: "شَفَاعَة",
    note: "A constant, quiet hope carried across this many salawat: to be among those who receive his intercession.",
    theme: { ...NEUTRALS, bg: "#150F22", surface: "#201432", surface2: "#2E1D47", line: "#43305F", ringTrack: "#3A2A55", gold: "#DEBB63", goldBright: "#F5DE9F", ring: "#A987D9" } },
  { id: 9, name: "Wasilah", en: "The Waseela", days: 35000, ar: "وَسِيلَة",
    note: "Believers are taught to ask Allah to grant the Prophet ﷺ al-Wasilah — the highest station in Paradise, reserved for one alone.",
    theme: { ...NEUTRALS, bg: "#1A1206", surface: "#261B0A", surface2: "#382810", line: "#4E3916", ringTrack: "#463212", gold: "#E8C878", ring: "#E0B45E", goldBright: "#F7E4B0" } },
  { id: 10, name: "Ridwan", en: "Allah's Pleasure", days: 55000, ar: "رِضْوَان",
    note: "“Allah's pleasure is greater [than Paradise itself].” — Surah At-Tawbah 9:72. Every salawat sent in sincerity is a small reaching toward it.",
    theme: { ...NEUTRALS, bg: "#201C0A", surface: "#2E2810", surface2: "#423A18", line: "#5C5122", ringTrack: "#524A1E", gold: "#F0DE94", goldBright: "#FBF3D9", ring: "#FBF3D9" } },
];

export const levelFor = (totalLifetimeCount) => {
  let cur = LEVELS[0];
  for (const l of LEVELS) if (totalLifetimeCount >= l.days) cur = l;
  const next = LEVELS.find((l) => l.days > totalLifetimeCount) || null;
  return { cur, next };
};

// Derived directly from LEVELS (skipping Wahda/0, the starting point, not a
// milestone) so this can never drift out of sync with the level names.
export const MILESTONES = LEVELS.filter((l) => l.days > 0).map((l) => ({ threshold: l.days, label: `${l.name} — ${l.en}`, level: l }));
