import { dbOrError, fail, ok } from "@/lib/api/http";
import { ensureWeekly } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  try {
    const body = (await request.json()) as { sucursalId?: string; weekKey?: string; por?: string };
    const sucursalId = body.sucursalId?.trim();
    const weekKey = body.weekKey?.trim();
    if (!sucursalId || !weekKey || !/^\d{4}-W\d{2}$/.test(weekKey)) return fail("Sucursal y semana requeridas.");
    const session = await ensureWeekly(resolved.supabase, sucursalId, weekKey, { unlockBy: body.por?.trim() ?? "" });
    if (session.status !== "enviado" && !session.desbloqueadoAt) {
      return fail("No se pudo desbloquear. Falta aplicar la actualización de base de datos.", 500);
    }
    return ok({ session });
  } catch (err) {
    console.error(err);
    return fail("No se pudo desbloquear la semana.", 500);
  }
}
