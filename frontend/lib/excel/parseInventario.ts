import type { Producto } from "@/lib/types";

const SKU_HEADERS = ["sku", "material", "codigo", "clave", "articulo", "item"];
const NOMBRE_HEADERS = [
  "nombre",
  "descripcion",
  "descripcion del material",
  "texto breve",
  "producto",
  "material description",
];
const UM_HEADERS = ["um", "u.m.", "u.m", "umb", "unidad", "unidad de medida", "base unit of measure", "uom"];
const TEORICO_HEADERS = [
  "teorico",
  "stock",
  "inventario",
  "cantidad",
  "unrestricted",
  "libre utilizacion",
  "libre utilización",
  "existencia",
];
const COSTO_HEADERS = ["costo", "precio", "valor", "value unrestricted", "precio base"];

function strip(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return String(value).trim();
}

function findCol(headers: unknown[], candidates: string[]): number {
  const normalized = headers.map(strip);
  const wanted = candidates.map(strip);
  for (let i = 0; i < normalized.length; i++) {
    const header = normalized[i];
    if (!header) continue;
    if (wanted.some((c) => header === c)) return i;
  }
  for (let i = 0; i < normalized.length; i++) {
    const header = normalized[i];
    if (!header) continue;
    if (wanted.some((c) => header.includes(c) || c.includes(header))) return i;
  }
  return -1;
}

function parseNumber(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[$\s]/g, "").replace(/,/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export type InventarioParseResult = {
  productos: Producto[];
  skipped: number;
};

export function resolveInventarioRows(rows: unknown[][]): InventarioParseResult {
  if (rows.length < 2) return { productos: [], skipped: 0 };

  const header = rows[0] ?? [];
  const skuCol = findCol(header, SKU_HEADERS);
  const nombreCol = findCol(header, NOMBRE_HEADERS);
  const umCol = findCol(header, UM_HEADERS);
  const teoricoCol = findCol(header, TEORICO_HEADERS);
  const costoCol = findCol(header, COSTO_HEADERS);

  if (skuCol < 0) {
    throw new Error('No se encontró la columna de SKU / material en la primera fila.');
  }

  const seen = new Set<string>();
  const productos: Producto[] = [];
  let skipped = 0;

  for (const row of rows.slice(1)) {
    const sku = cell(row[skuCol]);
    const nombre = (nombreCol >= 0 ? cell(row[nombreCol]) : "") || sku;
    const um = umCol >= 0 ? cell(row[umCol]) : "";
    const teoricoRaw = teoricoCol >= 0 ? cell(row[teoricoCol]) : "";
    const costoRaw = costoCol >= 0 ? cell(row[costoCol]) : "";
    if (!sku && !nombre && !um && !teoricoRaw && !costoRaw) continue;
    if (!sku) {
      skipped += 1;
      continue;
    }
    const key = sku.toUpperCase();
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    productos.push({
      sku,
      nombre,
      um: umCol >= 0 ? cell(row[umCol]) || "PZA" : "PZA",
      teorico: teoricoCol >= 0 ? parseNumber(cell(row[teoricoCol])) : 0,
      costo: costoCol >= 0 ? parseNumber(cell(row[costoCol])) : 0,
    });
  }

  return { productos, skipped };
}

export function parseCsvText(text: string): unknown[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const cells: string[] = [];
      let current = "";
      let quoted = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          quoted = !quoted;
          continue;
        }
        if (ch === "," && !quoted) {
          cells.push(current);
          current = "";
          continue;
        }
        current += ch;
      }
      cells.push(current);
      return cells;
    });
}
