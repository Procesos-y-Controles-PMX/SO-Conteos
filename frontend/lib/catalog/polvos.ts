import type { CountSession } from "@/lib/types";

/** Weekly counts only cover bagged powders (cementos) until SAP assortment exists. */

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const EXCLUDE = [
  "cpvc",
  "revolvedora",
  "cementar",
  "plastico",
  "inteligente",
  "pegaduro",
  "tornillo",
  "tirnillo",
  "varilla",
];

/** Cemento, CPC/CPO, mortero — not hardware, adhesives, or fittings. */
export function isPolvoProducto(nombre: string): boolean {
  const text = normalize(nombre);
  if (EXCLUDE.some((token) => text.includes(token))) return false;
  if (text.includes("cemento") || text.includes("mortero")) return true;
  if (/\bcpc\b/.test(text) || text.includes("cpc30")) return true;
  if (/\bcpo\b/.test(text) || text.includes("cpo30")) return true;
  return false;
}

export const CONTEO_SCOPE_LABEL = "Polvos · cementos y morteros";

export function scopeWeeklySession(session: CountSession): CountSession {
  if (session.kind !== "semanal") return session;
  const lines = [...session.lines]
    .filter((line) => isPolvoProducto(line.nombre))
    .sort((a, b) => a.sku.localeCompare(b.sku, "es"));
  if (lines.length === session.lines.length) return session;
  return { ...session, lines };
}
