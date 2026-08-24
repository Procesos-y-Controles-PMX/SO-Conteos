import { dbOrError, fail, ok } from "@/lib/api/http";
import { fetchSession } from "@/lib/db/queries";
import type { CountLine } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  const { id } = await params;
  try {
    const body = (await request.json()) as { sku?: string; patch?: Partial<CountLine> };
    if (!body.sku || !body.patch) return fail("SKU y datos requeridos.");
    const dbPatch: Record<string, unknown> = {};
    if (body.patch.fisico !== undefined) dbPatch.fisico = body.patch.fisico;
    if (body.patch.pendienteEntregar !== undefined) dbPatch.pendiente_entregar = body.patch.pendienteEntregar;
    if (body.patch.pendienteFacturar !== undefined) dbPatch.pendiente_facturar = body.patch.pendienteFacturar;
    if (body.patch.evidencia !== undefined) dbPatch.evidencia_nombre = body.patch.evidencia;
    const { error } = await resolved.supabase
      .from("cnt_conteo_lineas")
      .update(dbPatch)
      .eq("id_conteo", id)
      .eq("sku", body.sku);
    if (error) throw error;
    await resolved.supabase.from("cnt_conteos").update({ status: "en_progreso" }).eq("id", id).eq("status", "pendiente");
    const session = await fetchSession(resolved.supabase, id);
    return ok({ session });
  } catch (err) {
    console.error(err);
    return fail("No se pudo guardar la línea.", 500);
  }
}
