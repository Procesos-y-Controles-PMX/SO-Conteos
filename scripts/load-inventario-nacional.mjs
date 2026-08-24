#!/usr/bin/env node
/**
 * Applies per-sucursal inventory schema (if the DB URL is available) and
 * loads L1–L12 (+ blank) rows from the national SAP TSV.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = process.argv[2] || "/Users/inakicorella/Downloads/inventario nacional.xls";

function loadEnv(path) {
  try {
    const env = {};
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
    return env;
  } catch {
    return {};
  }
}

const env = {
  ...loadEnv(resolve(root, "../SO-Cotizador/frontend/.env")),
  ...loadEnv(resolve(root, "frontend/.env")),
  ...loadEnv(resolve(root, "frontend/.env.local")),
};

const url = (env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "").replace(/\/$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY || "";
if (!url || !key) {
  console.error("Missing Cotizador Supabase URL/key.");
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

async function rest(method, path, body, extra = {}) {
  const res = await fetch(`${url}${path}`, {
    method,
    headers: { ...headers, ...extra },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { ok: res.ok, status: res.status, json, text, res };
}

function fold(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bcd\.?\b/g, "ciudad")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function compact(value) {
  return fold(value).replace(/ /g, "");
}
const SAP_PREFIX = /^(mx[-\s]*pmx|mx[-\s]*promexma|promexma)[-\s]+/i;
const ALIASES = {
  villahermosa: "villa hermosa",
  valles: "ciudad valles",
  "cancun operador lo": "cancun",
};
function sapPlantName(raw) {
  return raw.replace(SAP_PREFIX, "").replace(/\s+/g, " ").trim();
}
function matchSucursalId(rawName, sucursales) {
  const key = fold(ALIASES[fold(sapPlantName(rawName))] ?? sapPlantName(rawName));
  if (!key) return null;
  const keyCompact = compact(key);
  const scored = sucursales
    .map((s) => {
      const name = fold(s.nombre);
      let score = 0;
      if (name === key || compact(name) === keyCompact) score = 100;
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
function isConteoLinea(raw) {
  const tag = raw.trim().toUpperCase();
  if (!tag) return true;
  const match = /^L0?(\d+)$/.exec(tag);
  if (!match) return false;
  const n = Number(match[1]);
  return n >= 1 && n <= 12;
}
function parseNumber(raw) {
  if (!raw) return 0;
  const n = Number.parseFloat(raw.replace(/[$\s]/g, "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function parseFile(path) {
  const buf = readFileSync(path);
  let text;
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    text = buf.toString("utf16le").replace(/^\uFEFF/, "");
  } else {
    text = buf.toString("utf8");
  }
  const rows = text
    .split(/\r?\n/)
    .filter((line) => line.trim().length)
    .map((line) => line.split("\t").map((c) => c.trim().replace(/^"+|"+$/g, "")));
  return rows;
}

async function ensureSchema() {
  const probe = await rest("GET", "/rest/v1/cnt_inventario_sku?select=id_sucursal,linea,sku&limit=1");
  if (probe.ok) {
    console.log("Schema already has id_sucursal.");
    return true;
  }
  const msg = typeof probe.json === "object" ? JSON.stringify(probe.json) : probe.text;
  console.log("Current table is missing per-sucursal columns:", probe.status, msg.slice(0, 300));

  const dbUrl = env.SUPABASE_DB_URL || env.DATABASE_URL || "";
  if (!dbUrl) {
    console.log("No SUPABASE_DB_URL; trying REST-only (will fail if columns are missing).");
    return false;
  }
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query(readFileSync(resolve(root, "db/patch-inventario-por-sucursal.sql"), "utf8"));
  await client.end();
  console.log("Applied patch-inventario-por-sucursal.sql");
  return true;
}

const rows = parseFile(FILE);
const header = rows[0] ?? [];
const col = (name) => header.findIndex((h) => h.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === name);
const storeCol = col("nombre 1");
const lineaCol = col("linea");
const skuCol = col("material");
const nombreCol = col("texto breve de material");
const umCol = col("umb");
const teoricoCol = col("libre utilizacion");
const costoCol = col("costo prom unitario");
if (storeCol < 0 || skuCol < 0) {
  console.error("Unexpected headers", header);
  process.exit(1);
}

const suc = await rest("GET", "/rest/v1/ctz_sucursales?select=id,nombre,activo&activo=eq.true&order=nombre");
if (!suc.ok || !Array.isArray(suc.json)) {
  console.error("Could not read ctz_sucursales", suc.status, suc.text.slice(0, 400));
  process.exit(1);
}
const sucursales = suc.json;

const byKey = new Map();
const unmatched = new Set();
let skipped = 0;
for (const row of rows.slice(1)) {
  const sku = row[skuCol] ?? "";
  const storeRaw = row[storeCol] ?? "";
  const linea = (lineaCol >= 0 ? row[lineaCol] ?? "" : "").toUpperCase();
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
  const key = `${sucursalId}::${sku.toUpperCase()}`;
  const next = {
    id_sucursal: sucursalId,
    sku,
    nombre: (nombreCol >= 0 ? row[nombreCol] : "") || sku,
    um: (umCol >= 0 ? row[umCol] : "") || "PZA",
    teorico: teoricoCol >= 0 ? parseNumber(row[teoricoCol] ?? "") : 0,
    costo: costoCol >= 0 ? parseNumber(row[costoCol] ?? "") : 0,
    linea: linea || null,
  };
  const prev = byKey.get(key);
  if (prev) {
    prev.teorico += next.teorico;
    skipped += 1;
    continue;
  }
  byKey.set(key, next);
}

const productos = [...byKey.values()];
console.log(`Parsed ${productos.length} store-SKU rows, skipped ${skipped}, unmatched ${unmatched.size}`);
if (unmatched.size) console.log("Unmatched:", [...unmatched].sort().join(" | "));

await ensureSchema();

const ajuste = await rest(
  "POST",
  "/rest/v1/cnt_ajustes",
  { clave: "inventario_por_sucursal", valor: productos },
  { Prefer: "resolution=merge-duplicates,return=minimal" },
);
if (!ajuste.ok) {
  console.error("Ajustes upsert failed", ajuste.status, ajuste.text.slice(0, 800));
  process.exit(1);
}
console.log("Saved inventario_por_sucursal in cnt_ajustes");

const wipe2 = await rest("DELETE", "/rest/v1/cnt_inventario_sku?sku=neq.__none__");
console.log("Wipe", wipe2.status, wipe2.ok ? "ok" : wipe2.text.slice(0, 400));

const now = new Date().toISOString();
const chunk = 200;
for (let i = 0; i < productos.length; i += chunk) {
  const slice = productos.slice(i, i + chunk).map((p) => ({ ...p, updated_at: now }));
  const ins = await rest("POST", "/rest/v1/cnt_inventario_sku", slice);
  if (!ins.ok) {
    if (ins.text.includes("id_sucursal") || ins.text.includes("PGRST204")) {
      console.log("cnt_inventario_sku still on the old schema; app will read cnt_ajustes.");
      break;
    }
    console.error("Insert failed", ins.status, ins.text.slice(0, 800));
    process.exit(1);
  }
  console.log(`Inserted ${Math.min(i + chunk, productos.length)}/${productos.length}`);
}

const carga = await rest("POST", "/rest/v1/cnt_inventario_carga", { file_name: "inventario nacional.xls" });
console.log("Carga log", carga.status, carga.ok ? "ok" : carga.text.slice(0, 400));

const check = await rest("GET", "/rest/v1/cnt_ajustes?clave=eq.inventario_por_sucursal&select=clave");
console.log("Ajustes row:", check.status, check.ok ? `${productos.length} SKU-sucursal rows stored` : check.text.slice(0, 400));
