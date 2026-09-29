import { isConteosAdmin } from "@/lib/access";
import { dbOrError, fail, ok } from "@/lib/api/http";
import { requireSession } from "@/lib/api/session";
import { fetchInventarioMeta, fetchSapStock, fetchSucursales, replaceInventario } from "@/lib/db/queries";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decodeSpreadsheetBuffer, isConteoLinea, parseDelimitedText, parseCsvText, resolveInventarioRows } from "@/lib/excel/parseInventario";

export const runtime = "nodejs";
export const maxDuration = 300;

type JsonUpload = {
  fileName?: string;
  rows?: unknown[][];
};

async function fileToRows(file: File): Promise<unknown[][]> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const utf16 = decodeSpreadsheetBuffer(buffer);
  if (utf16) return parseDelimitedText(utf16);

  const name = file.name.trim().toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".tsv") || name.endsWith(".txt")) {
    return parseCsvText(buffer.toString("utf8").replace(/^\uFEFF/, ""));
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const readXlsxFile = (await import("read-excel-file/node")).default;
    return (await readXlsxFile(buffer)) as unknown as unknown[][];
  }
  return parseDelimitedText(buffer.toString("utf8").replace(/^\uFEFF/, ""));
}

async function inventarioCounts(supabase: SupabaseClient, detalle: boolean) {
  const sap = await fetchSapStock(supabase);
  const skus = new Set(sap.map((p) => p.sku.toUpperCase()));
  const semanal = new Set(sap.filter((p) => isConteoLinea(p.linea ?? "")).map((p) => p.sku.toUpperCase()));
  return {
    productos: detalle ? sap : undefined,
    skuCount: skus.size,
    catalogCount: skus.size,
    semanalCount: semanal.size,
    sapCount: sap.length,
    storeCount: new Set(sap.map((p) => p.sucursalId).filter(Boolean)).size,
  };
}

async function ingest(resolved: { supabase: import("@supabase/supabase-js").SupabaseClient }, rows: unknown[][], fileName: string) {
  const sucursales = await fetchSucursales(resolved.supabase);
  const parsed = resolveInventarioRows(rows, sucursales);
  if (!parsed.productos.length) {
    return fail(
      parsed.unmatchedStores.length
        ? `Ninguna sucursal coincidió. Revisa nombres SAP: ${parsed.unmatchedStores.slice(0, 8).join(", ")}.`
        : "El archivo no tiene materiales con SKU.",
    );
  }

  const data = await replaceInventario(resolved.supabase, parsed.productos, fileName);
  return ok({
    ...data,
    ...(await inventarioCounts(resolved.supabase, true)),
    imported: parsed.productos.length,
    skipped: parsed.skipped,
    matchedStores: parsed.matchedStores,
    unmatchedStores: parsed.unmatchedStores,
  });
}

export async function GET(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  try {
    const detalle = new URL(request.url).searchParams.get("detalle") === "1";
    const meta = await fetchInventarioMeta(resolved.supabase);
    if (!detalle) return ok(meta);
    if (!isConteosAdmin(auth.user.rol)) return fail("No autorizado.", 403);
    return ok({ ...meta, ...(await inventarioCounts(resolved.supabase, true)) });
  } catch (err) {
    console.error(err);
    return fail("No se pudo leer el inventario.", 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireSession("admin");
  if ("response" in auth) return auth.response;
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as JsonUpload;
      const rows = Array.isArray(body.rows) ? body.rows : [];
      const fileName = body.fileName?.trim() || "inventario nacional.xls";
      if (rows.length < 2) return fail("Archivo requerido.");
      return await ingest(resolved, rows, fileName);
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return fail("Archivo requerido.");
    return await ingest(resolved, await fileToRows(file), file.name.trim());
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "No se pudo registrar la carga.";
    return fail(message, 500);
  }
}

export async function PATCH(request: Request) {
  const auth = await requireSession("admin");
  if ("response" in auth) return auth.response;
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  try {
    const body = (await request.json()) as { ignoreUploadWindow?: boolean };
    const { error } = await resolved.supabase
      .from("cnt_ajustes")
      .upsert({ clave: "ignore_upload_window", valor: Boolean(body.ignoreUploadWindow) });
    if (error) throw error;
    const data = await fetchInventarioMeta(resolved.supabase);
    return ok(data);
  } catch (err) {
    console.error(err);
    return fail("No se pudo actualizar el horario.", 500);
  }
}
