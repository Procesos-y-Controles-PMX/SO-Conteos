import { dbOrError, fail, ok } from "@/lib/api/http";
import { fetchInventarioMeta, fetchProductos, fetchSapStock, replaceInventario } from "@/lib/db/queries";
import { parseCsvText, resolveInventarioRows } from "@/lib/excel/parseInventario";

export const runtime = "nodejs";

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
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return fail("Archivo requerido.");

    const name = file.name.trim();
    const lower = name.toLowerCase();
    let rows: unknown[][];

    if (lower.endsWith(".csv")) {
      rows = parseCsvText(await file.text());
    } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      const readXlsxFile = (await import("read-excel-file/node")).default;
      const buffer = Buffer.from(await file.arrayBuffer());
      rows = (await readXlsxFile(buffer)) as unknown as unknown[][];
    } else {
      return fail("Usa un archivo .xlsx, .xls o .csv.");
    }

    const parsed = resolveInventarioRows(rows);
    if (!parsed.productos.length) return fail("El archivo no tiene SKUs válidos.");

    const data = await replaceInventario(resolved.supabase, parsed.productos, name);
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
    });
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
