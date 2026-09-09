import { dbOrError, fail, ok } from "@/lib/api/http";
import type { CountLine } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  const { id } = await params;
  try {
    const { data: existing, error: existingError } = await resolved.supabase
      .from("cnt_conteos")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) return fail("Conteo no encontrado.", 404);
    if ((existing as { status?: string }).status === "enviado") {
      return fail("Este conteo ya fue enviado y no se puede editar.", 409);
    }

    const body = (await request.json()) as { sku?: string; patch?: Partial<CountLine> };
    if (!body.sku || !body.patch) return fail("SKU y datos requeridos.");
    const dbPatch: Record<string, unknown> = {};
    if (body.patch.fisico !== undefined) dbPatch.fisico = body.patch.fisico;
    if (body.patch.pendienteEntregar !== undefined) dbPatch.pendiente_entregar = body.patch.pendienteEntregar;
    if (body.patch.pendienteFacturar !== undefined) dbPatch.pendiente_facturar = body.patch.pendienteFacturar;
    if (body.patch.comentario !== undefined) dbPatch.comentario = body.patch.comentario;
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
