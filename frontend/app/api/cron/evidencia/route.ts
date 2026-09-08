import { dbOrError, fail, ok } from "@/lib/api/http";
import { purgeExpiredEvidence } from "@/lib/evidence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request: Request) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) return fail("No autorizado.", 401);
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  try {
    const result = await purgeExpiredEvidence(resolved.supabase);
    return ok(result);
  } catch (err) {
    console.error(err);
    return fail("No se pudo borrar la evidencia vencida.", 500);
  }
}
