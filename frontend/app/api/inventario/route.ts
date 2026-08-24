import { dbOrError, fail, ok } from "@/lib/api/http";
import { fetchInventarioMeta, fetchProductos, fetchSapStock, fetchSucursales, replaceInventario } from "@/lib/db/queries";
import { decodeSpreadsheetBuffer, parseDelimitedText, parseCsvText, keepConteoSpreadsheet, resolveInventarioRows } from "@/lib/excel/parseInventario";

export const runtime = "nodejs";

type JsonUpload = {
  fileName?: string;
  rows?: unknown[][];
};

async function fileToRows(file: File): Promise<unknown[][]> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const utf16 = decodeSpreadsheetBuffer(buffer);
  if (utf16) return keepConteoSpreadsheet(parseDelimitedText(utf16));

  const name = file.name.trim().toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".tsv") || name.endsWith(".txt")) {
    return keepConteoSpreadsheet(parseCsvText(buffer.toString("utf8")));
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const readXlsxFile = (await import("read-excel-file/node")).default;
    return keepConteoSpreadsheet((await readXlsxFile(buffer)) as unknown as unknown[][]);
  }
  return keepConteoSpreadsheet(parseDelimitedText(buffer.toString("utf8")));
}

async function ingest(resolved: { supabase: import("@supabase/supabase-js").SupabaseClient }, rows: unknown[][], fileName: string) {
  const sucursales = await fetchSucursales(resolved.supabase);
  const parsed = resolveInventarioRows(rows, sucursales);
  if (!parsed.productos.length) {
    return fail(
      parsed.unmatchedStores.length
        ? `Ninguna sucursal coincidió. Revisa nombres SAP: ${parsed.unmatchedStores.slice(0, 8).join(", ")}.`
        : "El archivo no tiene materiales L1–L12 (ni líneas en blanco) con SKU.",
    );
  }

  const data = await replaceInventario(resolved.supabase, parsed.productos, fileName);
  const [catalog, sap] = await Promise.all([
    fetchProductos(resolved.supabase),
    fetchSapStock(resolved.supabase),
  ]);
  return ok({
    ...data,
    productos: sap,
    skuCount: catalog.length,
    catalogCount: catalog.length,
    sapCount: sap.length,
    imported: parsed.productos.length,
    skipped: parsed.skipped,
    matchedStores: parsed.matchedStores,
    unmatchedStores: parsed.unmatchedStores,
  });
}

export async function GET() {
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  try {
    const [meta, catalog, sap] = await Promise.all([
      fetchInventarioMeta(resolved.supabase),
      fetchProductos(resolved.supabase),
      fetchSapStock(resolved.supabase),
    ]);
    return ok({
      ...meta,
      productos: sap,
      skuCount: catalog.length,
      catalogCount: catalog.length,
      sapCount: sap.length,
    });
  } catch (err) {
    console.error(err);
    return fail("No se pudo leer el inventario.", 500);
  }
}

export async function POST(request: Request) {
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
