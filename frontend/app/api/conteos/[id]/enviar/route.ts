import { dbOrError, fail, ok } from "@/lib/api/http";
import { fetchSession } from "@/lib/db/queries";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  const { id } = await params;
  try {
    const body = (await request.json()) as {
      counterName?: string;
      counterPuesto?: string;
      comentario?: string;
    };
    const { error } = await resolved.supabase
      .from("cnt_conteos")
      .update({
        counter_name: body.counterName,
        counter_puesto: body.counterPuesto,
        comentario: body.comentario,
        status: "enviado",
        submitted_at: new Date().toISOString(),
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
