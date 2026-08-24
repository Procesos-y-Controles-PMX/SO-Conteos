import type { CountSession } from "@/lib/types";

/** Weekly counts use SAP lines L1–L12, plus materials with no Línea tag. */

export const CONTEO_SCOPE_LABEL = "Líneas L1–L12";

export function scopeWeeklySession(session: CountSession): CountSession {
  return session;
}
