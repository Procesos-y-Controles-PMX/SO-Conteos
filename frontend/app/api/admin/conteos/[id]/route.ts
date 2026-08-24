import { dbOrError, fail, ok } from "@/lib/api/http";
import { deleteConteo } from "@/lib/db/queries";

type Params = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: Params) {
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  const { id } = await params;
  try {
    await deleteConteo(resolved.supabase, id);
    return ok({ deleted: true });
  } catch (err) {
    console.error(err);
    return fail("No se pudo borrar el conteo.", 500);
  }
}
