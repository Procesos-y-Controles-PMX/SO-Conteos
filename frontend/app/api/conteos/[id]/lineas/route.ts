import { dbOrError, fail, ok } from "@/lib/api/http";
import { conteoParaEditar, MSG_CAPTURA_CERRADA } from "@/lib/api/conteoGuard";
import type { CountLine } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  const { id } = await params;
  try {
    const guard = await conteoParaEditar(resolved.supabase, id);
    if ("response" in guard) return guard.response;

    const body = (await request.json()) as { sku?: string; patch?: Partial<CountLine> };
    if (!body.sku || !body.patch) return fail("SKU y datos requeridos.");
    const touchesQty =
      body.patch.fisico !== undefined ||
      body.patch.pendienteEntregar !== undefined ||
      body.patch.pendienteFacturar !== undefined;
    if (touchesQty && guard.row.captura_cerrada_at) return fail(MSG_CAPTURA_CERRADA, 409);

    const dbPatch: Record<string, unknown> = {};
    if (body.patch.fisico !== undefined) dbPatch.fisico = body.patch.fisico;
    if (body.patch.pendienteEntregar !== undefined) dbPatch.pendiente_entregar = body.patch.pendienteEntregar;
    if (body.patch.pendienteFacturar !== undefined) dbPatch.pendiente_facturar = body.patch.pendienteFacturar;
    if (body.patch.comentario !== undefined) dbPatch.comentario = body.patch.comentario;
    if (Object.keys(dbPatch).length === 0) return ok({ saved: true });
    const { error } = await resolved.supabase
      .from("cnt_conteo_lineas")
      .update(dbPatch)
      .eq("id_conteo", id)
      .eq("sku", body.sku);
    if (error) throw error;
    await resolved.supabase.from("cnt_conteos").update({ status: "en_progreso" }).eq("id", id).eq("status", "pendiente");
    return ok({ saved: true });
  } catch (err) {
    console.error(err);
    return fail("No se pudo guardar la línea.", 500);
  }
}
