import type { Producto } from "@/lib/types";
import { matchSucursalId, sapPlantName, type NamedStore } from "@/lib/excel/matchSucursal";

const SKU_HEADERS = ["sku", "material", "codigo", "clave", "articulo", "item"];
const NOMBRE_HEADERS = [
  "nombre",
  "descripcion",
  "descripcion del material",
  "texto breve",
  "texto breve de material",
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
  "libre utilizacion",
  "existencia",
];
const COSTO_HEADERS = ["costo", "precio", "valor", "value unrestricted", "precio base", "costo prom unitario"];
const STORE_HEADERS = ["nombre 1", "sucursal", "tienda", "plant", "centro nombre"];
const LINEA_HEADERS = ["linea", "línea", "line", "tag"];

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
  return String(value).trim().replace(/^"+|"+$/g, "");
}

function findCol(headers: unknown[], candidates: string[], skip: Set<number> = new Set()): number {
  const normalized = headers.map(strip);
  const wanted = candidates.map(strip);
  for (let i = 0; i < normalized.length; i++) {
    if (skip.has(i)) continue;
    const header = normalized[i];
    if (!header) continue;
    if (wanted.some((c) => header === c)) return i;
  }
  for (let i = 0; i < normalized.length; i++) {
    if (skip.has(i)) continue;
    const header = normalized[i];
    if (!header) continue;
    if (wanted.some((c) => c.length >= 5 && (header.includes(c) || (c.length <= header.length + 4 && c.includes(header))))) {
      return i;
    }
  }
  return -1;
}

function parseNumber(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[$\s]/g, "").replace(/,/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** L1–L12 / L01–L12, or blank (untagged materials still count). */
export function isConteoLinea(raw: string): boolean {
  const tag = raw.trim().toUpperCase();
  if (!tag) return true;
  const match = /^L0?(\d+)$/.exec(tag);
  if (!match) return false;
  const n = Number(match[1]);
  return n >= 1 && n <= 12;
}

export type InventarioRow = Producto & {
  sucursalId: string;
  sucursalNombre: string;
  linea: string;
};

export type InventarioParseResult = {
  productos: InventarioRow[];
  skipped: number;
  unmatchedStores: string[];
  matchedStores: number;
};

export function resolveInventarioRows(rows: unknown[][], sucursales: NamedStore[]): InventarioParseResult {
  if (rows.length < 2) return { productos: [], skipped: 0, unmatchedStores: [], matchedStores: 0 };

  const header = rows[0] ?? [];
  const storeCol = findCol(header, STORE_HEADERS);
  const lineaCol = findCol(header, LINEA_HEADERS);
  const skip = new Set<number>([storeCol, lineaCol].filter((i) => i >= 0));
  const skuCol = findCol(header, SKU_HEADERS, skip);
  const nombreCol = findCol(header, NOMBRE_HEADERS, skip);
  const umCol = findCol(header, UM_HEADERS, skip);
  const teoricoCol = findCol(header, TEORICO_HEADERS, skip);
  const costoCol = findCol(header, COSTO_HEADERS, skip);

  if (skuCol < 0) {
    throw new Error("No se encontró la columna de SKU / material en la primera fila.");
  }
  if (storeCol < 0) {
    throw new Error('No se encontró la columna de sucursal ("Nombre 1").');
  }

  const byKey = new Map<string, InventarioRow>();
  const unmatched = new Set<string>();
  const matched = new Set<string>();
  let skipped = 0;

  for (const row of rows.slice(1)) {
    const sku = cell(row[skuCol]);
    const storeRaw = cell(row[storeCol]);
    const linea = lineaCol >= 0 ? cell(row[lineaCol]).toUpperCase() : "";
    const nombre = (nombreCol >= 0 ? cell(row[nombreCol]) : "") || sku;
    const um = umCol >= 0 ? cell(row[umCol]) : "";
    const teoricoRaw = teoricoCol >= 0 ? cell(row[teoricoCol]) : "";
    const costoRaw = costoCol >= 0 ? cell(row[costoCol]) : "";
    if (!sku && !storeRaw && !nombre && !um && !teoricoRaw && !costoRaw) continue;
    if (!isConteoLinea(linea)) {
      skipped += 1;
      continue;
    }
    if (!sku) {
      skipped += 1;
      continue;
    }
    const sucursalId = matchSucursalId(storeRaw, sucursales);
    if (!sucursalId) {
      if (storeRaw) unmatched.add(storeRaw);
      skipped += 1;
      continue;
    }
    matched.add(sucursalId);
    const sucursalNombre = sucursales.find((s) => s.id === sucursalId)?.nombre ?? sapPlantName(storeRaw);
    const key = `${sucursalId}::${sku.toUpperCase()}`;
    const next: InventarioRow = {
      sku,
      nombre,
      um: um || "PZA",
      teorico: teoricoCol >= 0 ? parseNumber(teoricoRaw) : 0,
      costo: costoCol >= 0 ? parseNumber(costoRaw) : 0,
      sucursalId,
      sucursalNombre,
      linea,
    };
    const prev = byKey.get(key);
    if (prev) {
      prev.teorico += next.teorico;
      if (!prev.nombre) prev.nombre = next.nombre;
      skipped += 1;
      continue;
    }
    byKey.set(key, next);
  }

  return {
    productos: Array.from(byKey.values()),
    skipped,
    unmatchedStores: [...unmatched].sort((a, b) => a.localeCompare(b, "es")),
    matchedStores: matched.size,
  };
}

export function parseDelimitedText(text: string): unknown[][] {
  const sample = text.slice(0, 2000);
  const delimiter = (sample.split("\t").length > sample.split(",").length ? "\t" : ",") as "," | "\t";
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => splitDelimitedLine(line, delimiter));
}

function splitDelimitedLine(line: string, delimiter: "," | "\t"): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      quoted = !quoted;
      continue;
    }
    if (ch === delimiter && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells;
}

export function decodeSpreadsheetBuffer(bytes: Uint8Array | Buffer): string | null {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(buf).replace(/^\uFEFF/, "");
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = new Uint8Array(buf.length - 2);
    for (let i = 2; i + 1 < buf.length; i += 2) {
      swapped[i - 2] = buf[i + 1];
      swapped[i - 1] = buf[i];
    }
    return new TextDecoder("utf-16le").decode(swapped);
  }
  return null;
}

/** Drop L13+ (hardware bulk, etc.) so the upload stays small. */
export function keepConteoSpreadsheet(rows: unknown[][]): unknown[][] {
  if (rows.length < 2) return rows;
  const lineaCol = findCol(rows[0] ?? [], LINEA_HEADERS);
  const kept: unknown[][] = [rows[0] ?? []];
  for (const row of rows.slice(1)) {
    const linea = lineaCol >= 0 ? cell(row[lineaCol]) : "";
    if (isConteoLinea(linea)) kept.push(row);
  }
  return kept;
}

export function parseCsvText(text: string): unknown[][] {
  return parseDelimitedText(text);
}
