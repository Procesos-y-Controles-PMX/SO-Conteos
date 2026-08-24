import { dbOrError, fail, ok } from "@/lib/api/http";
import { fetchSessions } from "@/lib/db/queries";
import type { CountKind } from "@/lib/types";

export async function GET(request: Request) {
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  const { searchParams } = new URL(request.url);
  try {
    const sessions = await fetchSessions(resolved.supabase, {
      sucursalId: searchParams.get("sucursalId") ?? undefined,
      kind: (searchParams.get("kind") as CountKind | null) ?? undefined,
      weekKey: searchParams.get("weekKey") ?? undefined,
    });
    return ok({ sessions });
  } catch (err) {
    console.error(err);
    return fail("No se pudieron cargar los conteos.", 500);
  }
}
