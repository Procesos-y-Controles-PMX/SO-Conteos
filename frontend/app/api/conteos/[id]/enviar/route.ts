import { dbOrError, fail, ok } from "@/lib/api/http";
import { conteoParaEditar } from "@/lib/api/conteoGuard";
import { fetchSession } from "@/lib/db/queries";
import { sessionDiffStats } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  const { id } = await params;
  try {
    const guard = await conteoParaEditar(resolved.supabase, id);
    if ("response" in guard) return guard.response;

    const body = (await request.json()) as {
      counterName?: string;
      counterPuesto?: string;
      comentario?: string;
    };
    const before = await fetchSession(resolved.supabase, id);
    if (!before) return fail("Conteo no encontrado.", 404);
    const stats = sessionDiffStats(before);
    const now = new Date().toISOString();
    const { error } = await resolved.supabase
      .from("cnt_conteos")
      .update({
        counter_name: body.counterName,
        counter_puesto: body.counterPuesto,
        comentario: body.comentario,
        status: "enviado",
        submitted_at: now,
        captura_cerrada_at: guard.row.captura_cerrada_at ?? now,
        dif_skus: stats.skuCount,
        dif_monto: stats.monto,
      })
      .eq("id", id);
    if (error) throw error;
    const session = await fetchSession(resolved.supabase, id);
    return ok({ session });
  } catch (err) {
    console.error(err);
    return fail("No se pudo enviar el conteo.", 500);
  }
}
