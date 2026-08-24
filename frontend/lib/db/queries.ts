import type { SupabaseClient } from "@supabase/supabase-js";
import type { CountKind, CountLine, CountSession, Producto } from "@/lib/types";
import type { InventarioRow } from "@/lib/excel/parseInventario";
import { mapInventarioMeta, mapLine, mapProducto, mapSession, type CntConteoRow, type CntLineaRow } from "@/lib/db/map";
import { fetchSucursalById, fetchSucursales } from "@/lib/db/stores";

export { fetchSucursalById, fetchSucursales };

type StockRow = {
  sku: string;
  nombre: string;
  um: string;
  teorico: number | string;
  costo: number | string;
  id_sucursal: string;
  linea: string | null;
};

const INVENTARIO_KEY = "inventario_por_sucursal";

async function fetchInventarioAjustes(supabase: SupabaseClient): Promise<StockRow[] | null> {
  const { data, error } = await supabase.from("cnt_ajustes").select("valor").eq("clave", INVENTARIO_KEY).maybeSingle();
  if (error || data?.valor == null) return null;
  return Array.isArray(data.valor) ? (data.valor as StockRow[]) : null;
}

function mapStockRows(rows: StockRow[], nameById: Map<string, string>): Producto[] {
  return rows.map((row) =>
    mapProducto({
      ...row,
      sucursal_nombre: nameById.get(row.id_sucursal),
    }),
  );
}

export async function fetchSapStock(supabase: SupabaseClient, sucursalId?: string): Promise<Producto[]> {
  const fromAjustes = await fetchInventarioAjustes(supabase);
  const sucursales = sucursalId ? [] : await fetchSucursales(supabase);
  const nameById = new Map(sucursales.map((s) => [s.id, s.nombre]));

  if (fromAjustes?.length) {
    const rows = sucursalId ? fromAjustes.filter((r) => r.id_sucursal === sucursalId) : fromAjustes;
    return mapStockRows(rows, nameById);
  }

  const page = 1000;
  const rows: StockRow[] = [];
  for (let from = 0; ; from += page) {
    let q = supabase.from("cnt_inventario_sku").select("*").order("sku");
    if (sucursalId) q = q.eq("id_sucursal", sucursalId);
    const { data, error } = await q.range(from, from + page - 1);
    if (error) {
      if (error.message.includes("id_sucursal")) return [];
      throw error;
    }
    const batch = (data ?? []) as StockRow[];
    rows.push(...batch);
    if (batch.length < page) break;
  }
  return mapStockRows(rows, nameById);
}

/** Assortment for weekly/urgent counts: L1–L12 (+ blank) stock for this store. */
export async function fetchProductos(supabase: SupabaseClient, sucursalId?: string): Promise<Producto[]> {
  const rows = await fetchSapStock(supabase, sucursalId);
  if (sucursalId) return rows.sort((a, b) => a.sku.localeCompare(b.sku, "es"));
  const unique = new Map<string, Producto>();
  for (const row of rows) {
    const key = row.sku.toUpperCase();
    if (!unique.has(key)) unique.set(key, { ...row, sucursalId: undefined, sucursalNombre: undefined, teorico: 0 });
  }
  return Array.from(unique.values()).sort((a, b) => a.sku.localeCompare(b.sku, "es"));
}

async function insertSessionLines(supabase: SupabaseClient, conteoId: string, productos: Producto[]) {
  const chunk = 400;
  for (let i = 0; i < productos.length; i += chunk) {
    const slice = productos.slice(i, i + chunk);
    const { error } = await supabase.from("cnt_conteo_lineas").upsert(
      slice.map((p) => ({
        id_conteo: conteoId,
        sku: p.sku,
        nombre: p.nombre,
        um: p.um,
        teorico: p.teorico,
        pendiente_entregar: 0,
        pendiente_facturar: 0,
      })),
      { onConflict: "id_conteo,sku", ignoreDuplicates: true },
    );
    if (error) throw error;
  }
}

export async function fetchInventarioMeta(supabase: SupabaseClient) {
  const [{ data: carga }, { data: windowRow }, { data: ignoreRow }] = await Promise.all([
    supabase.from("cnt_inventario_carga").select("file_name, uploaded_at").order("uploaded_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("cnt_ajustes").select("valor").eq("clave", "upload_window").maybeSingle(),
    supabase.from("cnt_ajustes").select("valor").eq("clave", "ignore_upload_window").maybeSingle(),
  ]);
  const windowVal = (windowRow?.valor as { start?: string; end?: string } | null) ?? {};
  return {
    meta: mapInventarioMeta(carga, {
      start: windowVal.start ?? "05:00",
      end: windowVal.end ?? "08:00",
    }),
    ignoreUploadWindow: Boolean(ignoreRow?.valor === true || ignoreRow?.valor === "true"),
  };
}

async function deleteLinesBySku(supabase: SupabaseClient, conteoId: string, skus: string[]) {
  const chunk = 200;
  for (let i = 0; i < skus.length; i += chunk) {
    const { error } = await supabase
      .from("cnt_conteo_lineas")
      .delete()
      .eq("id_conteo", conteoId)
      .in("sku", skus.slice(i, i + chunk));
    if (error) throw error;
  }
}

async function syncWeeklyLines(supabase: SupabaseClient, conteoId: string, sucursalId: string, lines: CountLine[]): Promise<CountLine[]> {
  const productos = await fetchProductos(supabase, sucursalId);
  const allowed = new Set(productos.map((p) => p.sku.toUpperCase()));
  const extra = lines.filter((line) => !allowed.has(line.sku.toUpperCase()) && line.fisico == null).map((line) => line.sku);
  if (extra.length) await deleteLinesBySku(supabase, conteoId, extra);
  const kept = new Set(
    lines.filter((line) => allowed.has(line.sku.toUpperCase())).map((line) => line.sku.toUpperCase()),
  );
  const missing = productos.filter((p) => !kept.has(p.sku.toUpperCase()));
  if (missing.length) await insertSessionLines(supabase, conteoId, missing);
  const teoricoBySku = new Map(productos.map((p) => [p.sku.toUpperCase(), p]));
  let teoricoChanged = false;
  for (const line of lines) {
    if (line.fisico != null) continue;
    const sap = teoricoBySku.get(line.sku.toUpperCase());
    if (!sap || Number(sap.teorico) === Number(line.teorico)) continue;
    const { error } = await supabase
      .from("cnt_conteo_lineas")
      .update({ teorico: sap.teorico, nombre: sap.nombre, um: sap.um })
      .eq("id_conteo", conteoId)
      .eq("sku", line.sku);
    if (error) throw error;
    teoricoChanged = true;
  }
  return extra.length || missing.length || teoricoChanged ? await linesFor(supabase, conteoId) : lines;
}

async function linesFor(supabase: SupabaseClient, conteoId: string): Promise<CountLine[]> {
  const { data, error } = await supabase
    .from("cnt_conteo_lineas")
    .select("*")
    .eq("id_conteo", conteoId)
    .order("sku");
  if (error) throw error;
  return ((data ?? []) as CntLineaRow[]).map(mapLine);
}

export async function fetchSession(
  supabase: SupabaseClient,
  id: string,
  options: { syncCatalog?: boolean } = {},
): Promise<CountSession | null> {
  const { data, error } = await supabase.from("cnt_conteos").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as CntConteoRow;
  let lines = await linesFor(supabase, id);
  if (row.kind === "semanal" && row.status !== "enviado" && options.syncCatalog) {
    lines = await syncWeeklyLines(supabase, id, row.id_sucursal, lines);
  }
  return mapSession(row, lines);
}

export async function fetchSessions(
  supabase: SupabaseClient,
  filters: {
    sucursalId?: string;
    sucursalIds?: string[];
    kind?: CountKind;
    weekKey?: string;
    includeLines?: boolean;
  },
): Promise<CountSession[]> {
  let q = supabase.from("cnt_conteos").select("*").order("created_at", { ascending: false });
  if (filters.sucursalId) q = q.eq("id_sucursal", filters.sucursalId);
  if (filters.sucursalIds?.length) q = q.in("id_sucursal", filters.sucursalIds);
  if (filters.kind) q = q.eq("kind", filters.kind);
  if (filters.weekKey) q = q.eq("week_key", filters.weekKey);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as CntConteoRow[];
  const includeLines = filters.includeLines !== false;
  const result: CountSession[] = [];
  for (const row of rows) {
    if (!includeLines) {
      result.push(mapSession(row, []));
      continue;
    }
    let lines = await linesFor(supabase, row.id);
    result.push(mapSession(row, lines));
  }
  return result;
}

export async function ensureWeekly(
  supabase: SupabaseClient,
  sucursalId: string,
  weekKey: string,
): Promise<CountSession> {
  const { data: existing } = await supabase
    .from("cnt_conteos")
    .select("*")
    .eq("id_sucursal", sucursalId)
    .eq("kind", "semanal")
    .eq("week_key", weekKey)
    .maybeSingle();
  if (existing) return (await fetchSession(supabase, (existing as CntConteoRow).id, { syncCatalog: true }))!;

  const { data: created, error } = await supabase
    .from("cnt_conteos")
    .insert({
      kind: "semanal",
      id_sucursal: sucursalId,
      week_key: weekKey,
      titulo: `Conteo semanal · ${weekKey}`,
      status: "pendiente",
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") {
      const { data: again } = await supabase
        .from("cnt_conteos")
        .select("*")
        .eq("id_sucursal", sucursalId)
        .eq("kind", "semanal")
        .eq("week_key", weekKey)
        .maybeSingle();
      if (again) return (await fetchSession(supabase, (again as CntConteoRow).id, { syncCatalog: true }))!;
    }
    throw error;
  }
  return (await fetchSession(supabase, (created as CntConteoRow).id, { syncCatalog: true }))!;
}

export async function deleteConteo(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("cnt_conteos").delete().eq("id", id);
  if (error) throw error;
}

export async function replaceInventario(
  supabase: SupabaseClient,
  productos: InventarioRow[],
  fileName: string,
) {
  const payload = productos.map((p) => ({
    id_sucursal: p.sucursalId,
    sku: p.sku,
    nombre: p.nombre,
    um: p.um,
    teorico: p.teorico,
    costo: p.costo,
    linea: p.linea || null,
  }));
  const { error: ajusteError } = await supabase.from("cnt_ajustes").upsert({
    clave: INVENTARIO_KEY,
    valor: payload,
  });
  if (ajusteError) throw ajusteError;

  const now = new Date().toISOString();
  await supabase.from("cnt_inventario_sku").delete().neq("sku", "");
  const chunk = 400;
  for (let i = 0; i < payload.length; i += chunk) {
    const { error } = await supabase.from("cnt_inventario_sku").insert(
      payload.slice(i, i + chunk).map((p) => ({ ...p, updated_at: now })),
    );
    if (error && (error.message.includes("id_sucursal") || error.code === "PGRST204")) break;
    if (error) throw error;
  }
  const { error: cargaError } = await supabase.from("cnt_inventario_carga").insert({ file_name: fileName });
  if (cargaError) throw cargaError;
  return fetchInventarioMeta(supabase);
}
