import { dbOrError, fail, ok } from "@/lib/api/http";
import { ensureWeekly } from "@/lib/db/queries";
import { weekKeyFromDate } from "@/lib/week";

export async function POST(request: Request) {
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  try {
    const body = (await request.json()) as { sucursalId?: string; weekKey?: string };
    if (!body.sucursalId) return fail("Sucursal requerida.");
    const session = await ensureWeekly(
      resolved.supabase,
      body.sucursalId,
      body.weekKey ?? weekKeyFromDate(),
    );
    return ok({ session });
  } catch (err) {
    console.error(err);
    return fail("No se pudo abrir el conteo semanal.", 500);
  }
}
