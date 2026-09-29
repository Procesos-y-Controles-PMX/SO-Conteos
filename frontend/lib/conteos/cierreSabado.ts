import type { SupabaseClient } from "@supabase/supabase-js";
import type { CntConteoRow } from "@/lib/db/map";
import { fetchSession } from "@/lib/db/queries";
import { COMENTARIO_NO_CONCLUIDO, sessionDiffStats, sessionWasStarted, unlockActivo } from "@/lib/types";
import { weekDeadlinePassed } from "@/lib/week";

/**
 * Closes started-but-unsent counts whose Saturday midnight CDMX deadline passed.
 * Does not touch counts that were never started or that have an open unlock window.
 */
export async function cerrarConteosNoConcluidos(supabase: SupabaseClient, now = new Date()) {
  const { data, error } = await supabase
    .from("cnt_conteos")
    .select("id, kind, week_key, status, desbloqueado_at, desbloqueado_hasta")
    .in("status", ["pendiente", "en_progreso"]);
  if (error) throw error;

  let examined = 0;
  let closed = 0;
  let skipped = 0;

  type Row = Pick<CntConteoRow, "id" | "kind" | "week_key" | "status" | "desbloqueado_at" | "desbloqueado_hasta">;
  for (const row of (data ?? []) as Row[]) {
    examined += 1;
    const unlockOpen = unlockActivo(
      { desbloqueadoAt: row.desbloqueado_at ?? undefined, desbloqueadoHasta: row.desbloqueado_hasta ?? undefined },
      now,
    );
    if (!weekDeadlinePassed(row.week_key, now) || unlockOpen) {
      skipped += 1;
      continue;
    }
    const session = await fetchSession(supabase, row.id);
    if (!session || !sessionWasStarted(session)) {
      skipped += 1;
      continue;
    }
    const stats = sessionDiffStats(session);
    const closedAt = now.toISOString();
    const { error: updateError } = await supabase
      .from("cnt_conteos")
      .update({
        status: "no_concluido",
        comentario: COMENTARIO_NO_CONCLUIDO,
        submitted_at: closedAt,
        dif_skus: stats.skuCount,
        dif_monto: stats.monto,
        desbloqueado_at: null,
        desbloqueado_por: null,
        desbloqueado_hasta: null,
      })
      .eq("id", session.id)
      .in("status", ["pendiente", "en_progreso"]);
    if (updateError) throw updateError;
    closed += 1;
  }

  return { examined, closed, skipped, at: now.toISOString() };
}
