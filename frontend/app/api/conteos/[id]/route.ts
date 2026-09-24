import { dbOrError, fail, ok } from "@/lib/api/http";
import { conteoParaEditar } from "@/lib/api/conteoGuard";
import { fetchSession } from "@/lib/db/queries";

type Params = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: Params) {
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  const { id } = await params;
  try {
    const session = await fetchSession(resolved.supabase, id, { syncCatalog: true });
    if (!session) return fail("Conteo no encontrado.", 404);
    return ok({ session });
  } catch (err) {
    console.error(err);
    return fail("No se pudo cargar el conteo.", 500);
  }
}

export async function PATCH(request: Request, { params }: Params) {
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
      status?: string;
      cerrarCaptura?: boolean;
    };
    const patch: Record<string, unknown> = {};
    if (body.counterName !== undefined) patch.counter_name = body.counterName;
    if (body.counterPuesto !== undefined) patch.counter_puesto = body.counterPuesto;
    if (body.comentario !== undefined) patch.comentario = body.comentario;
    if (body.status !== undefined && body.status !== "enviado") patch.status = body.status;
    if (body.cerrarCaptura && !guard.row.captura_cerrada_at) {
      patch.captura_cerrada_at = new Date().toISOString();
    }
    if (Object.keys(patch).length > 0) {
      const { error } = await resolved.supabase.from("cnt_conteos").update(patch).eq("id", id);
      if (error) throw error;
    }
    const session = await fetchSession(resolved.supabase, id);
    return ok({ session });
  } catch (err) {
    console.error(err);
    return fail("No se pudo guardar el conteo.", 500);
  }
}
