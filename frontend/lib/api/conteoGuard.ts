import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";
import { fail } from "@/lib/api/http";
import type { CntConteoRow } from "@/lib/db/map";
import { conteoBloqueado } from "@/lib/types";

export const MSG_ENVIADO = "Este conteo ya fue enviado y no se puede editar.";
export const MSG_BLOQUEADO = "Esta semana está bloqueada. Pide a un administrador que la desbloquee.";
export const MSG_CAPTURA_CERRADA = "La captura ya se cerró. Solo puedes escribir comentarios y enviar.";

/**
 * Loads a count for a store-side write. `capturaAbierta` also rejects counts
 * whose capture was closed (quantities and evidence are frozen).
 */
export async function conteoParaEditar(
  supabase: SupabaseClient,
  id: string,
  options: { capturaAbierta?: boolean } = {},
): Promise<{ row: CntConteoRow } | { response: NextResponse }> {
  const { data, error } = await supabase.from("cnt_conteos").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return { response: fail("Conteo no encontrado.", 404) };
  const row = data as CntConteoRow;
  if (row.status === "enviado") return { response: fail(MSG_ENVIADO, 409) };
  if (
    conteoBloqueado({
      kind: row.kind,
      status: row.status,
      weekKey: row.week_key,
      desbloqueadoAt: row.desbloqueado_at ?? undefined,
    })
  ) {
    return { response: fail(MSG_BLOQUEADO, 409) };
  }
  if (options.capturaAbierta && row.captura_cerrada_at) {
    return { response: fail(MSG_CAPTURA_CERRADA, 409) };
  }
  return { row };
}
