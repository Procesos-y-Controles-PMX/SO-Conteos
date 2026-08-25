import { dbOrError, fail, ok } from "@/lib/api/http";
import { fetchSessions, fetchSucursales } from "@/lib/db/queries";
import { sessionSemaforo, type CountSession, type SemaforoResumen, type Sucursal, type ZonaSemaforo } from "@/lib/types";
import { weekKeyFromDate, nearbyWeekKeys } from "@/lib/week";

export const dynamic = "force-dynamic";

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

function zonasFor(sucursales: Sucursal[], sessions: CountSession[]): ZonaSemaforo[] {
  const names = Array.from(new Set(sucursales.map((s) => s.zona))).sort((a, b) => a.localeCompare(b, "es"));
  return names.map((id) => {
    const rows = sucursales.filter((s) => s.zona === id);
    const ids = new Set(rows.map((s) => s.id));
    const scoped = sessions.filter((s) => ids.has(s.sucursalId));
    const resumen = resumenFor(rows, scoped);
    return {
      id,
      sucursales: rows.length,
      contado: resumen.contado,
      curso: resumen.curso,
      pendiente: resumen.pendiente,
    };
  });
}

export async function GET(request: Request) {
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  const url = new URL(request.url);
  const weekKey = url.searchParams.get("weekKey") ?? weekKeyFromDate();
  const zona = url.searchParams.get("zona")?.trim() || "";
  try {
    const sucursales = await fetchSucursales(resolved.supabase, true);
    const weekSessions = await fetchSessions(resolved.supabase, { weekKey, includeLines: false });
    const zonaOpciones = zonasFor(sucursales, weekSessions);
    const zonas = zonaOpciones.map((z) => z.id);
    const historyWeeks = nearbyWeekKeys(weekKey, 4).slice().reverse();
    const nacional = resumenFor(sucursales, weekSessions);

    if (!zona) {
      return ok({
        weekKey,
        historyWeeks,
        sucursales: [],
        zonas,
        zonaOpciones,
        sessions: [],
        history: [],
        total: 0,
        page: 1,
        pageSize: 0,
        resumen: nacional,
      });
    }

    const filtered = sucursales.filter((s) => s.zona === zona);
    const scope = new Set(filtered.map((s) => s.id));
    const scoped = weekSessions.filter((s) => scope.has(s.sucursalId));
    const history = filtered.length
      ? await fetchSessions(resolved.supabase, {
          sucursalIds: filtered.map((s) => s.id),
          kind: "semanal",
          weekKeys: historyWeeks,
          includeLines: false,
        })
      : [];

    return ok({
      weekKey,
      historyWeeks,
      sucursales: filtered,
      zonas,
      zonaOpciones,
      sessions: scoped,
      history,
      total: filtered.length,
      page: 1,
      pageSize: filtered.length,
      resumen: nacional,
    });
  } catch (err) {
    console.error(err);
    return fail("No se pudo armar el semáforo.", 500);
  }
}
