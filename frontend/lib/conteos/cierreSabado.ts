import type { SupabaseClient } from "@supabase/supabase-js";
import type { CntConteoRow } from "@/lib/db/map";
import { fetchSession } from "@/lib/db/queries";
import { sessionDiffStats, sessionWasStarted } from "@/lib/types";
import { weekDeadlinePassed } from "@/lib/week";

export const COMENTARIO_NO_CONCLUIDO = "no concluido";

/**
 * Closes started-but-unsent counts whose Saturday midnight CDMX deadline passed.
 * Does not touch counts that were never started.
 */
export async function cerrarConteosNoConcluidos(supabase: SupabaseClient, now = new Date()) {
  const { data, error } = await supabase
    .from("cnt_conteos")
    .select("id, kind, week_key, status")
    .in("status", ["pendiente", "en_progreso"]);
  if (error) throw error;

  let examined = 0;
  let closed = 0;
  let skipped = 0;

  for (const row of (data ?? []) as Array<Pick<CntConteoRow, "id" | "kind" | "week_key" | "status">>) {
    examined += 1;
    if (!weekDeadlinePassed(row.week_key, now)) {
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
        captura_cerrada_at: session.capturaCerradaAt ?? closedAt,
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
