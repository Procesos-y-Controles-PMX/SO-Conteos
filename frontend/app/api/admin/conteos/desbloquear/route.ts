import { isConteosAdmin, isUnlockAdmin } from "@/lib/access";
import { dbOrError, fail, ok } from "@/lib/api/http";
import { requireSession } from "@/lib/api/session";
import { ensureWeekly } from "@/lib/db/queries";
import { unlockActivo } from "@/lib/types";
import { unlockUntilFromStart } from "@/lib/week";

export const dynamic = "force-dynamic";

/**
 * Lilian-only: unlock a past week for a store for N days from a start date,
 * or clear the unlock (re-lock).
 */
export async function POST(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  if (!isConteosAdmin(auth.user.rol) || !isUnlockAdmin(auth.user)) {
    return fail("Solo la cuenta de Lilian puede desbloquear o volver a bloquear semanas.", 403);
  }
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  try {
    const body = (await request.json()) as {
      sucursalId?: string;
      weekKey?: string;
      startDate?: string;
      days?: number;
      lock?: boolean;
    };
    const sucursalId = body.sucursalId?.trim();
    const weekKey = body.weekKey?.trim();
    const email = (auth.user.email ?? "").trim().toLowerCase();
    if (!sucursalId || !weekKey || !/^\d{4}-W\d{2}$/.test(weekKey)) {
      return fail("Sucursal y semana requeridas.");
    }

    if (body.lock) {
      const session = await ensureWeekly(resolved.supabase, sucursalId, weekKey, { lock: true });
      return ok({ session });
    }

    const days = Number(body.days);
    const until = unlockUntilFromStart(body.startDate ?? "", days);
    if (!until) return fail("Indica la fecha inicial y cuántos días dura el desbloqueo (1–90).");
    if (until.getTime() <= Date.now()) {
      return fail("Ese plazo ya terminó. Elige una fecha inicial más reciente o más días.");
    }

    const session = await ensureWeekly(resolved.supabase, sucursalId, weekKey, {
      unlockBy: auth.user.nombre?.trim() || email,
      unlockUntil: until.toISOString(),
    });
    if (session.status !== "enviado" && !unlockActivo(session)) {
      return fail("No se pudo desbloquear. Falta aplicar la actualización de base de datos.", 500);
    }
    return ok({ session });
  } catch (err) {
    console.error(err);
    return fail("No se pudo desbloquear la semana.", 500);
  }
}
