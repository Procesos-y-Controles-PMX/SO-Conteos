import { isConteosAdmin } from "@/lib/access";
import { dbOrError, fail, ok } from "@/lib/api/http";
import { requireSession } from "@/lib/api/session";
import { fetchSessions } from "@/lib/db/queries";
import type { CountKind } from "@/lib/types";

export async function GET(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  const { searchParams } = new URL(request.url);
  const sucursalId = isConteosAdmin(auth.user.rol)
    ? searchParams.get("sucursalId") ?? undefined
    : auth.user.sucursalId;
  if (!sucursalId && !isConteosAdmin(auth.user.rol)) return fail("No autorizado.", 403);
  try {
    const sessions = await fetchSessions(resolved.supabase, {
      sucursalId,
      kind: (searchParams.get("kind") as CountKind | null) ?? undefined,
      weekKey: searchParams.get("weekKey") ?? undefined,
    });
    return ok({ sessions });
  } catch (err) {
    console.error(err);
    return fail("No se pudieron cargar los conteos.", 500);
  }
}
