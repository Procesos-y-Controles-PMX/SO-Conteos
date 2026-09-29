import { dbOrError, fail, ok } from "@/lib/api/http";
import { cerrarConteosNoConcluidos } from "@/lib/conteos/cierreSabado";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request: Request) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/** Daily 00:10 CDMX (Hobby plan allows one run per day): close started counts past Saturday midnight as "no concluido". */
export async function GET(request: Request) {
  if (!authorized(request)) return fail("No autorizado.", 401);
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  try {
    const result = await cerrarConteosNoConcluidos(resolved.supabase);
    return ok(result);
  } catch (err) {
    console.error(err);
    return fail("No se pudo cerrar los conteos no concluidos.", 500);
  }
}
