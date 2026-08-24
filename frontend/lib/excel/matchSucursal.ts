/** Map SAP "Nombre 1" (MX-PROMEXMA PENJAMO) onto ctz_sucursales.nombre. */

export type NamedStore = { id: string; nombre: string };

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bcd\.?\b/g, "ciudad")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value: string): string {
  return fold(value).replace(/ /g, "");
}

const SAP_PREFIX = /^(mx[-\s]*pmx|mx[-\s]*promexma|promexma)[-\s]+/i;

/** SAP plant nicknames that don't match ctz_sucursales.nombre on their own. */
const ALIASES: Record<string, string> = {
  villahermosa: "villa hermosa",
  valles: "ciudad valles",
  "cancun operador lo": "cancun",
};

export function sapPlantName(raw: string): string {
  return raw.replace(SAP_PREFIX, "").replace(/\s+/g, " ").trim();
}

export function matchSucursalId(rawName: string, sucursales: NamedStore[]): string | null {
  const key = fold(ALIASES[fold(sapPlantName(rawName))] ?? sapPlantName(rawName));
  if (!key) return null;
  const keyCompact = compact(key);

  const scored = sucursales
    .map((s) => {
      const name = fold(s.nombre);
      const nameCompact = compact(name);
      let score = 0;
      if (name === key || nameCompact === keyCompact) score = 100;
      else if (name.startsWith(`${key} `) || key.startsWith(`${name} `)) score = 80;
      else if (key.length >= 5 && name.length >= 5 && (name.includes(key) || key.includes(name))) score = 50;
      return { s, name, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.name.length - b.name.length);

  if (!scored.length) return null;
  if (scored[0].score >= 80) return scored[0].s.id;
  if (scored.length === 1) return scored[0].s.id;
  if (scored[0].score > scored[1].score) return scored[0].s.id;
  return null;
}
