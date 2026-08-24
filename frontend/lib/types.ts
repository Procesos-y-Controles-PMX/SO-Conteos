export type Role = "admin" | "tienda";

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

export type SessionUser = {
  id: string;
  rol: Role;
  nombre: string;
  email?: string;
  sucursalId?: string;
  zona?: string;
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
  evidencia?: string;
};

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
