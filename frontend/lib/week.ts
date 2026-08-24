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

/** Monday-based week key, e.g. 2026-W34 */
export function weekKeyFromDate(date = new Date()): string {
  const bag = partsInMexico(date);
  const utc = new Date(`${bag.year}-${bag.month}-${bag.day}T12:00:00Z`);
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function weekLabel(weekKey: string): string {
  const [, week] = weekKey.split("-W");
  return `Semana ${Number(week)}`;
}

export function shiftWeekKey(weekKey: string, delta: number): string {
  const [yearStr, weekStr] = weekKey.split("-W");
  const year = Number(yearStr);
  const week = Number(weekStr) + delta;
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (week - 1) * 7);
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
