import type { SupabaseClient } from "@supabase/supabase-js";
import type { CountKind, CountLine, CountSession, Producto } from "@/lib/types";
import { isPolvoProducto } from "@/lib/catalog/polvos";
import { mapInventarioMeta, mapLine, mapProducto, mapSession, type CntConteoRow, type CntLineaRow } from "@/lib/db/map";
import { fetchSucursalById, fetchSucursales } from "@/lib/db/stores";

export { fetchSucursalById, fetchSucursales };

export async function fetchSapStock(supabase: SupabaseClient): Promise<Producto[]> {
  const { data, error } = await supabase.from("cnt_inventario_sku").select("*").order("sku");
  if (error) throw error;
  return (data ?? []).map(mapProducto);
}

async function fetchCtzCatalog(supabase: SupabaseClient): Promise<Producto[]> {
  const page = 1000;
  const rows: Producto[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from("ctz_productos")
      .select("sku, descripcion, unidad_medida, precio_unitario_base, activo")
      .eq("activo", true)
      .not("sku", "is", null)
      .order("sku")
      .range(from, from + page - 1);
    if (error) throw error;
    const batch = (data ?? []) as Array<{
      sku: string | null;
      descripcion: string;
      unidad_medida: string | null;
      precio_unitario_base: number | string;
    }>;
    for (const row of batch) {
      const sku = String(row.sku ?? "").trim();
      if (!sku) continue;
      if (!isPolvoProducto(row.descripcion)) continue;
      rows.push(
        mapProducto({
          sku,
          nombre: row.descripcion,
          um: row.unidad_medida?.trim() || "PZA",
          teorico: 0,
          costo: row.precio_unitario_base,
        }),
      );
    }
    if (batch.length < page) break;
  }
  return rows;
}

/** Cotizador polvos (cementos/morteros) + SAP teórico overlay when the SKU is in that set. */
export async function fetchProductos(supabase: SupabaseClient): Promise<Producto[]> {
  const [catalog, sap] = await Promise.all([fetchCtzCatalog(supabase), fetchSapStock(supabase)]);
  const bySku = new Map<string, Producto>();
  for (const p of catalog) bySku.set(p.sku.toUpperCase(), p);
  for (const p of sap) {
    const key = p.sku.toUpperCase();
    const existing = bySku.get(key);
    if (!existing) continue;
    bySku.set(key, {
      ...existing,
      teorico: p.teorico,
      costo: p.costo || existing.costo,
      um: p.um || existing.um,
    });
  }
  return Array.from(bySku.values())
    .filter((p) => isPolvoProducto(p.nombre))
    .sort((a, b) => a.sku.localeCompare(b.sku, "es"));
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

async function syncWeeklyLines(supabase: SupabaseClient, conteoId: string, lines: CountLine[]): Promise<CountLine[]> {
  const productos = await fetchProductos(supabase);
  const allowed = new Set(productos.map((p) => p.sku.toUpperCase()));
  const extra = lines.filter((line) => !allowed.has(line.sku.toUpperCase())).map((line) => line.sku);
  if (extra.length) await deleteLinesBySku(supabase, conteoId, extra);
  const kept = new Set(
    lines.filter((line) => allowed.has(line.sku.toUpperCase())).map((line) => line.sku.toUpperCase()),
  );
  const missing = productos.filter((p) => !kept.has(p.sku.toUpperCase()));
  if (missing.length) await insertSessionLines(supabase, conteoId, missing);
  return (extra.length || missing.length ? await linesFor(supabase, conteoId) : lines).filter((line) =>
    allowed.has(line.sku.toUpperCase()),
  );
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
  if (row.kind === "semanal" && row.status !== "enviado") {
    if (options.syncCatalog) {
      lines = await syncWeeklyLines(supabase, id, lines);
    } else {
      lines = lines.filter((line) => isPolvoProducto(line.nombre));
    }
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
    if (row.kind === "semanal") {
      lines = lines.filter((line) => isPolvoProducto(line.nombre));
    }
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
  productos: Producto[],
  fileName: string,
) {
  if (productos.length) {
    const { error } = await supabase.from("cnt_inventario_sku").upsert(
      productos.map((p) => ({
        sku: p.sku,
        nombre: p.nombre,
        um: p.um,
        teorico: p.teorico,
        costo: p.costo,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "sku" },
    );
    if (error) throw error;
  }
  const { error: cargaError } = await supabase.from("cnt_inventario_carga").insert({ file_name: fileName });
  if (cargaError) throw cargaError;
  return fetchInventarioMeta(supabase);
}
