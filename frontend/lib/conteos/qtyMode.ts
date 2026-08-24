export type QtyMode = "sacos" | "peso";

export const QTY_MODE_STORAGE_KEY = "so-conteos-count-unit";

const KG_PER_TON = 1000;
const GRANEL_RE = /\bGRANEL\b/;
const BAG_KG_RE = /(\d+(?:[.,]\d+)?)\s*K\s*G/;

export function roundQty(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function normalizeName(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function normalizeUm(um: string): string {
  return um.trim().toUpperCase();
}

export function umIsKg(um: string): boolean {
  const u = normalizeUm(um);
  return u === "KG" || u === "KGM" || u === "KILO" || u === "KILOS";
}

export function umIsTon(um: string): boolean {
  const u = normalizeUm(um);
  return u === "TN" || u === "TO" || u === "TON" || u === "T" || u === "TONELADA" || u === "TONELADAS";
}

export function umIsWeight(um: string): boolean {
  return umIsKg(um) || umIsTon(um);
}

/** Kg per bag from names like "Mortero Tolteca 50.0 Kg." Bulk (granel) has no bags. */
export function bagKgFromName(nombre: string): number | null {
  const n = normalizeName(nombre);
  if (GRANEL_RE.test(n)) return null;
  const match = n.match(BAG_KG_RE);
  if (!match) return null;
  const kg = Number(match[1].replace(",", "."));
  if (!Number.isFinite(kg) || kg < 1 || kg > 100) return null;
  return kg;
}

export function canCountBags(nombre: string, um: string): boolean {
  return umIsWeight(um) && bagKgFromName(nombre) != null;
}

export function readPreferredQtyMode(): QtyMode {
  if (typeof window === "undefined") return "sacos";
  const raw = window.localStorage.getItem(QTY_MODE_STORAGE_KEY);
  return raw === "peso" || raw === "sacos" ? raw : "sacos";
}

export function writePreferredQtyMode(mode: QtyMode) {
  window.localStorage.setItem(QTY_MODE_STORAGE_KEY, mode);
}

function toKg(value: number, um: string): number {
  return umIsKg(um) ? value : value * KG_PER_TON;
}

function fromKg(kg: number, um: string): number {
  return umIsKg(um) ? roundQty(kg) : roundQty(kg / KG_PER_TON);
}

export function toDisplay(
  stored: number | null,
  um: string,
  mode: QtyMode,
  bagKg: number,
): number | null {
  if (stored == null) return null;
  if (mode === "peso") return roundQty(stored);
  return roundQty(toKg(stored, um) / bagKg);
}

export function fromDisplay(
  display: number | null,
  um: string,
  mode: QtyMode,
  bagKg: number,
): number | null {
  if (display == null) return null;
  if (mode === "peso") return roundQty(display);
  return fromKg(display * bagKg, um);
}

export function pesoStep(um: string, bagKg: number): number {
  return umIsKg(um) ? bagKg : roundQty(bagKg / KG_PER_TON);
}

export function formatQtyInput(value: number | null): string {
  if (value == null) return "";
  const n = roundQty(value);
  if (Number.isInteger(n)) return String(n);
  return String(n);
}

/** Accepts comma or period. Returns null if the keystroke is invalid. */
export function sanitizeQtyDraft(raw: string): string | null {
  const normalized = raw.replace(/,/g, ".");
  if (normalized === "") return "";
  if (!/^\d*\.?\d*$/.test(normalized)) return null;
  return normalized;
}

export function parseQtyDraft(draft: string): number | null {
  const sanitized = sanitizeQtyDraft(draft);
  if (sanitized == null || sanitized === "" || sanitized === ".") return null;
  const n = Number(sanitized.endsWith(".") ? sanitized.slice(0, -1) : sanitized);
  if (!Number.isFinite(n) || n < 0) return null;
  return roundQty(n);
}

export function insertDecimal(draft: string): string {
  const sanitized = sanitizeQtyDraft(draft) ?? "";
  if (sanitized.includes(".")) return sanitized;
  return sanitized === "" ? "0." : `${sanitized}.`;
}

export function conversionCaption(
  stored: number | null,
  um: string,
  mode: QtyMode,
  bagKg: number,
): string | undefined {
  if (stored == null) return undefined;
  const umLabel = um.trim() || "UM";
  if (mode === "sacos") {
    const peso = toDisplay(stored, um, "peso", bagKg);
    if (peso == null) return undefined;
    return `= ${formatQtyInput(peso)} ${umLabel}`;
  }
  const sacos = toDisplay(stored, um, "sacos", bagKg);
  if (sacos == null) return undefined;
  return `= ${formatQtyInput(sacos)} sacos`;
}

export function unitHint(um: string, bagKg: number, mode: QtyMode): string {
  const umLabel = um.trim() || "UM";
  const kgLabel = formatQtyInput(bagKg);
  if (mode === "sacos") {
    if (umIsKg(um)) return `${kgLabel} kg por saco`;
    const perTon = roundQty(KG_PER_TON / bagKg);
    return `${kgLabel} kg por saco · ${formatQtyInput(perTon)} sacos = 1 ${umLabel}`;
  }
  const oneBag = fromDisplay(1, um, "sacos", bagKg);
  return `1 saco = ${formatQtyInput(oneBag)} ${umLabel}`;
}
