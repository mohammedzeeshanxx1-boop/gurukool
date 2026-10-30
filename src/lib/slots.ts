// Weekend slot helpers. All availability is defined in Asia/Kolkata (IST, UTC+05:30, no DST).
// Timestamps are stored in MongoDB as UTC Dates.
export const TZ = "Asia/Kolkata";
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DURATIONS = [30, 45, 60, 90, 120];
export const BOOKING_LEAD_MS = 2 * 60 * 60 * 1000; // must book at least 2h ahead
export const BOOKING_WINDOW_DAYS = 28;

export type Availability = { day: string; start: string; end: string };
export type UpcomingSlot = { startAt: string; endAt: string; day: string; date: string; label: string; slotMinutes: number };

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export function fmtTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function fmtDateTimeIST(d: Date | string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(d)) + " IST";
}

/** Validate a weekend availability list. Returns an error string or null. */
export function validateAvailability(slots: unknown): string | null {
  if (!Array.isArray(slots)) return "Availability must be a list";
  if (slots.length > 16) return "At most 16 slots";
  const seen: Record<string, [number, number][]> = {};
  for (const s of slots) {
    if (!s || (s.day !== "Saturday" && s.day !== "Sunday")) return "Slots must be on Saturday or Sunday";
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.end)) return "Times must be HH:MM";
    const a = toMinutes(s.start), b = toMinutes(s.end);
    if (b - a < 30) return `${s.day} ${s.start}–${s.end}: a slot must be at least 30 minutes`;
    if (b - a > 180) return `${s.day} ${s.start}–${s.end}: a slot can be at most 3 hours`;
    for (const [x, y] of seen[s.day] ?? []) if (a < y && x < b) return `${s.day} slots ${s.start}–${s.end} overlap another slot`;
    (seen[s.day] ??= []).push([a, b]);
  }
  return null;
}

/** Concrete bookable slots for the next BOOKING_WINDOW_DAYS days, in chronological order. */
export function upcomingSlots(availability: Availability[], now = new Date()): UpcomingSlot[] {
  const out: UpcomingSlot[] = [];
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  for (let i = 0; i <= BOOKING_WINDOW_DAYS; i++) {
    const day = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate() + i));
    const dayName = DAY_NAMES[day.getUTCDay()];
    for (const a of availability.filter((x) => x.day === dayName).sort((x, y) => toMinutes(x.start) - toMinutes(y.start))) {
      const start = new Date(day.getTime() + toMinutes(a.start) * 60000 - IST_OFFSET_MS);
      const end = new Date(day.getTime() + toMinutes(a.end) * 60000 - IST_OFFSET_MS);
      if (start.getTime() - now.getTime() < BOOKING_LEAD_MS) continue;
      const date = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).format(start);
      out.push({
        startAt: start.toISOString(), endAt: end.toISOString(), day: dayName, date,
        label: `${date} · ${fmtTime(a.start)} – ${fmtTime(a.end)} IST`,
        slotMinutes: toMinutes(a.end) - toMinutes(a.start),
      });
    }
  }
  return out;
}
