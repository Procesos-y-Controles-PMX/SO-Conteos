import { dbOrError, fail, ok } from "@/lib/api/http";
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

    const body = (await request.json()) as {
      counterName?: string;
      counterPuesto?: string;
      comentario?: string;
      status?: string;
    };
    const patch: Record<string, unknown> = {};
    if (body.counterName !== undefined) patch.counter_name = body.counterName;
    if (body.counterPuesto !== undefined) patch.counter_puesto = body.counterPuesto;
    if (body.comentario !== undefined) patch.comentario = body.comentario;
    if (body.status !== undefined) patch.status = body.status;
    const { error } = await resolved.supabase.from("cnt_conteos").update(patch).eq("id", id);
    if (error) throw error;
    const session = await fetchSession(resolved.supabase, id);
    return ok({ session });
  } catch (err) {
    console.error(err);
    return fail("No se pudo guardar el conteo.", 500);
  }
}
