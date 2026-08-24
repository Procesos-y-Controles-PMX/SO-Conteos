import { dbOrError, fail, ok } from "@/lib/api/http";
import { fetchSessions, fetchSucursales } from "@/lib/db/queries";
import { sessionSemaforo, type CountSession, type SemaforoResumen, type Sucursal } from "@/lib/types";
import { weekKeyFromDate } from "@/lib/week";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

function resumenFor(sucursales: Sucursal[], sessions: CountSession[]): SemaforoResumen {
  const weekly = new Map(
    sessions.filter((s) => s.kind === "semanal").map((s) => [s.sucursalId, s] as const),
  );
  let contado = 0;
  let curso = 0;
  let pendiente = 0;
  for (const sucursal of sucursales) {
    const color = sessionSemaforo(weekly.get(sucursal.id));
    if (color === "verde") contado += 1;
    else if (color === "ambar") curso += 1;
    else pendiente += 1;
  }
  return {
    sucursales: sucursales.length,
    contado,
    curso,
    pendiente,
    urgentesAbiertos: sessions.filter((s) => s.kind === "urgente" && s.status !== "enviado").length,
  };
}

export async function GET(request: Request) {
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  const url = new URL(request.url);
  const weekKey = url.searchParams.get("weekKey") ?? weekKeyFromDate();
  const zona = url.searchParams.get("zona") || "todas";
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  try {
    const sucursales = await fetchSucursales(resolved.supabase, true);
    const zonas = Array.from(new Set(sucursales.map((s) => s.zona))).sort((a, b) => a.localeCompare(b, "es"));
    const filtered = zona === "todas" ? sucursales : sucursales.filter((s) => s.zona === zona);
    const total = filtered.length;
    const start = (page - 1) * PAGE_SIZE;
    const pageRows = filtered.slice(start, start + PAGE_SIZE);
    const weekSessions = await fetchSessions(resolved.supabase, { weekKey, includeLines: false });
    const scope = new Set(filtered.map((s) => s.id));
    const scoped = weekSessions.filter((s) => scope.has(s.sucursalId));
    const pageIds = new Set(pageRows.map((s) => s.id));
    return ok({
      weekKey,
      sucursales: pageRows,
      zonas,
      sessions: scoped.filter((s) => pageIds.has(s.sucursalId)),
      total,
      page,
      pageSize: PAGE_SIZE,
      resumen: resumenFor(filtered, scoped),
    });
  } catch (err) {
    console.error(err);
    return fail("No se pudo armar el semáforo.", 500);
  }
}
