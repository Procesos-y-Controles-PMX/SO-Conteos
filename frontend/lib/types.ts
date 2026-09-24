import { weekKeyFromDate } from "./week";

export type Role = "admin" | "tienda" | "administrador_general";

export type CountKind = "semanal" | "urgente";

export type CountStatus = "pendiente" | "en_progreso" | "enviado";

export type Semaforo = "verde" | "rojo" | "ambar";

export type SemaforoResumen = {
  sucursales: number;
  contado: number;
  curso: number;
  pendiente: number;
  urgentesAbiertos: number;
};

export type ZonaSemaforo = {
  id: string;
  sucursales: number;
  contado: number;
  curso: number;
  pendiente: number;
};

export type SessionUser = {
  id: string;
  rol: Role;
  nombre: string;
  email?: string;
  sucursalId?: string;
  zona?: string;
};

export type CtzUsuario = {
  id: string;
  email: string;
  nombre_completo: string | null;
  rol: Role;
  activo: boolean;
  created_at?: string;
};

export type Sucursal = {
  id: string;
  nombre: string;
  zona: string;
  gerenteEmail: string;
  gerenteNombre: string;
  hasAccount: boolean;
  usuarios: Array<{ nombre: string; puesto: string }>;
};

export type Producto = {
  sku: string;
  nombre: string;
  um: string;
  teorico: number;
  costo: number;
  sucursalId?: string;
  sucursalNombre?: string;
  linea?: string;
};

export type CountLine = {
  sku: string;
  nombre: string;
  um: string;
  teorico: number;
  fisico: number | null;
  pendienteEntregar: number | null;
  pendienteFacturar: number | null;
  costo?: number;
  comentario?: string;
  evidencia?: string;
  evidenciaPath?: string;
  evidenciaAt?: string;
  evidenciaMime?: string;
  evidenciaEntregar?: string;
  evidenciaEntregarPath?: string;
  evidenciaEntregarAt?: string;
  evidenciaEntregarMime?: string;
  evidenciaFacturar?: string;
  evidenciaFacturarPath?: string;
  evidenciaFacturarAt?: string;
  evidenciaFacturarMime?: string;
};

export type EvidenceKind = "general" | "entregar" | "facturar";

export type CountSession = {
  id: string;
  kind: CountKind;
  sucursalId: string;
  weekKey: string;
  titulo: string;
  status: CountStatus;
  createdAt: string;
  submittedAt?: string;
  counterName?: string;
  counterPuesto?: string;
  comentario?: string;
  evidenceRetentionDays?: number;
  capturaCerradaAt?: string;
  desbloqueadoAt?: string;
  desbloqueadoPor?: string;
  difSkus?: number;
  difMonto?: number;
  /** Semana pasada sin empezar y sin desbloqueo del admin. */
  bloqueado?: boolean;
  lines: CountLine[];
};

export type InventarioMeta = {
  lastUpdatedAt: string | null;
  lastFileName: string | null;
  uploadWindowStart: string;
  uploadWindowEnd: string;
};

export function lineAjustado(line: CountLine): number | null {
  if (line.fisico == null) return null;
  return (line.fisico ?? 0) + (line.pendienteEntregar ?? 0) - (line.pendienteFacturar ?? 0);
}

export function lineDiff(line: CountLine): number | null {
  const ajustado = lineAjustado(line);
  if (ajustado == null) return null;
  return ajustado - line.teorico;
}

/** Signed amount for the difference: diff × unit cost. */
export function lineMonto(line: CountLine): number | null {
  const diff = lineDiff(line);
  if (diff == null) return null;
  return diff * (line.costo ?? 0);
}

export function sessionDiffStats(session: CountSession): { skuCount: number; monto: number } {
  let skuCount = 0;
  let monto = 0;
  for (const line of session.lines) {
    const diff = lineDiff(line);
    if (diff == null || diff === 0) continue;
    skuCount += 1;
    monto += lineMonto(line) ?? 0;
  }
  return { skuCount, monto };
}

export function countQtyLocked(session: Pick<CountSession, "status" | "capturaCerradaAt">) {
  return session.status === "enviado" || Boolean(session.capturaCerradaAt);
}

/** Photo is required for urgent lines only when something was physically counted. */
export function urgentNeedsEvidence(line: CountLine) {
  return (line.fisico ?? 0) > 0 && !line.evidenciaPath;
}

export function lineMissingEvidence(kind: CountKind, line: CountLine) {
  if (kind === "urgente") return urgentNeedsEvidence(line);
  const needEnt = (line.pendienteEntregar ?? 0) > 0 && !line.evidenciaEntregarPath;
  const needFac = (line.pendienteFacturar ?? 0) > 0 && !line.evidenciaFacturarPath;
  return needEnt || needFac;
}

/**
 * A weekly count locks once its week is over, unless it was already started
 * or an admin unlocked it for that store.
 */
export function conteoBloqueado(
  session: Pick<CountSession, "kind" | "status" | "weekKey" | "desbloqueadoAt">,
  currentWeekKey = weekKeyFromDate(),
) {
  if (session.kind !== "semanal") return false;
  if (session.status !== "pendiente") return false;
  if (session.desbloqueadoAt) return false;
  return session.weekKey < currentWeekKey;
}

export type WeekState = "enviado" | "abierta" | "bloqueada";

/** State of a store's weekly count in the history; a missing past session counts as locked. */
export function weekStateFor(
  session: CountSession | undefined,
  weekKey: string,
  currentWeekKey = weekKeyFromDate(),
): WeekState {
  if (session?.status === "enviado") return "enviado";
  if (session) return conteoBloqueado(session, currentWeekKey) ? "bloqueada" : "abierta";
  return weekKey < currentWeekKey ? "bloqueada" : "abierta";
}

export function countProgress(session: CountSession): { filled: number; total: number } {
  const filled = session.lines.filter((l) => l.fisico != null).length;
  return { filled, total: session.lines.length };
}

export function sessionSemaforo(session: CountSession | undefined): Semaforo {
  if (!session) return "rojo";
  if (session.status === "enviado") return "verde";
  if (session.status === "en_progreso") return "ambar";
  return "rojo";
}
