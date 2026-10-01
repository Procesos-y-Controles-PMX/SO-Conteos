const TZ = "America/Mexico_City";

function partsInMexico(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  return bag;
}

const MONTHS_ES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"] as const;

function mondayUtc(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (week - 1) * 7);
  return monday;
}

/** Monday-based week key, e.g. 2026-W34 */
export function weekKeyFromDate(date = new Date()): string {
  const bag = partsInMexico(date);
  const utc = new Date(`${bag.year}-${bag.month}-${bag.day}T12:00:00Z`);
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.floor((utc.getTime() - yearStart.getTime()) / 86400000 / 7) + 1;
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function mondayFromWeekKey(weekKey: string): Date | null {
  const [yearStr, weekStr] = weekKey.split("-W");
  const year = Number(yearStr);
  const week = Number(weekStr);
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1) return null;
  return mondayUtc(year, week);
}

/** First day of the week (Monday), e.g. SEP 21 2026 */
export function weekLabel(weekKey: string): string {
  const monday = mondayFromWeekKey(weekKey);
  if (!monday) {
    const [, week] = weekKey.split("-W");
    return week ? `Semana ${Number(week)}` : weekKey;
  }
  return `${MONTHS_ES[monday.getUTCMonth()]} ${monday.getUTCDate()} ${monday.getUTCFullYear()}`;
}

export function weekLabelParts(weekKey: string): { month: string; day: string; year: string } {
  const monday = mondayFromWeekKey(weekKey);
  if (!monday) return { month: "", day: weekLabel(weekKey), year: "" };
  return {
    month: MONTHS_ES[monday.getUTCMonth()],
    day: String(monday.getUTCDate()),
    year: String(monday.getUTCFullYear()),
  };
}

export function shiftWeekKey(weekKey: string, delta: number): string {
  const [yearStr, weekStr] = weekKey.split("-W");
  const year = Number(yearStr);
  const week = Number(weekStr) + delta;
  const monday = mondayUtc(year, week);
  monday.setUTCHours(12);
  return weekKeyFromDate(monday);
}

export function nearbyWeekKeys(around = weekKeyFromDate(), count = 6): string[] {
  return Array.from({ length: count }, (_, i) => shiftWeekKey(around, -i));
}

export function mexicoHourMinutes(date = new Date()): { hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  return { hour: Number(bag.hour), minute: Number(bag.minute) };
}

export function isWithinUploadWindow(startHHmm: string, endHHmm: string, date = new Date()): boolean {
  const { hour, minute } = mexicoHourMinutes(date);
  const now = hour * 60 + minute;
  const [sh, sm] = startHHmm.split(":").map(Number);
  const [eh, em] = endHHmm.split(":").map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  if (start <= end) return now >= start && now < end;
  return now >= start || now < end;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Instant when America/Mexico_City is at 00:00 on the given calendar day. */
export function mexicoMidnightUtc(year: number, month: number, day: number): Date {
  const ymd = `${year}-${pad2(month)}-${pad2(day)}`;
  for (const offset of ["-06:00", "-05:00"] as const) {
    const candidate = new Date(`${ymd}T00:00:00${offset}`);
    const bag = partsInMexico(candidate);
    const { hour } = mexicoHourMinutes(candidate);
    if (bag.year === String(year) && bag.month === pad2(month) && bag.day === pad2(day) && hour === 0) {
      return candidate;
    }
  }
  return new Date(`${ymd}T00:00:00-06:00`);
}

/**
 * Deadline for a week: end of Saturday = Sunday 00:00 CDMX
 * (Monday + 6 days at midnight).
 */
export function weekCloseAt(weekKey: string): Date | null {
  const monday = mondayFromWeekKey(weekKey);
  if (!monday) return null;
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return mexicoMidnightUtc(sunday.getUTCFullYear(), sunday.getUTCMonth() + 1, sunday.getUTCDate());
}

export function weekDeadlinePassed(weekKey: string, now = new Date()) {
  const closeAt = weekCloseAt(weekKey);
  return Boolean(closeAt && now.getTime() >= closeAt.getTime());
}

/** Exclusive end of an unlock window: start date (CDMX) + durationDays at midnight. */
export function unlockUntilFromStart(startYmd: string, durationDays: number): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startYmd.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 90) return null;
  let y = year;
  let mo = month;
  let d = day;
  for (let i = 0; i < durationDays; i += 1) {
    const probe = new Date(Date.UTC(y, mo - 1, d + 1, 12));
    y = probe.getUTCFullYear();
    mo = probe.getUTCMonth() + 1;
    d = probe.getUTCDate();
  }
  return mexicoMidnightUtc(y, mo, d);
}

export function todayYmdMexico(date = new Date()) {
  const bag = partsInMexico(date);
  return `${bag.year}-${bag.month}-${bag.day}`;
}
