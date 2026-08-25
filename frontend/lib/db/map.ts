import type { SessionUser, Sucursal } from "@/lib/types";
import { resolveSessionRole } from "@/lib/access";

export type CtzSucursalRow = {
  id: string;
  nombre: string;
  region: string | null;
  centro: string | null;
  activo: boolean;
};

export type CtzUsuarioRow = {
  id: string;
  email: string | null;
  nombre_completo: string | null;
  rol: "admin" | "tienda";
  activo: boolean;
  password?: string | null;
};

export type CntConteoRow = {
  id: string;
  kind: import("@/lib/types").CountSession["kind"];
  id_sucursal: string;
  week_key: string;
  titulo: string;
  status: import("@/lib/types").CountSession["status"];
  counter_name: string | null;
  counter_puesto: string | null;
  comentario: string | null;
  created_at: string;
  submitted_at: string | null;
};

export type CntLineaRow = {
  sku: string;
  nombre: string;
  um: string;
  teorico: number | string;
  fisico: number | string | null;
  pendiente_entregar: number | string | null;
  pendiente_facturar: number | string | null;
  evidencia_nombre: string | null;
};

function num(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function mapSucursal(
  row: CtzSucursalRow,
  extra: {
    gerenteEmail?: string;
    gerenteNombre?: string;
    hasAccount?: boolean;
  } = {},
): Sucursal {
  const gerenteNombre = extra.gerenteNombre?.trim() || "";
  const gerenteEmail = extra.gerenteEmail?.trim() || "";
  return {
    id: row.id,
    nombre: row.nombre,
    zona: row.region?.trim() || "Sin región",
    gerenteEmail,
    gerenteNombre,
    hasAccount: Boolean(extra.hasAccount),
    usuarios: gerenteNombre
      ? [{ nombre: gerenteNombre, puesto: "Gerente de tienda" }]
      : [],
  };
}

export function mapProducto(row: {
  sku: string;
  nombre: string;
  um: string;
  teorico: number | string;
  costo: number | string;
  id_sucursal?: string;
  sucursal_nombre?: string;
  linea?: string | null;
}): import("@/lib/types").Producto {
  return {
    sku: row.sku,
    nombre: row.nombre,
    um: row.um,
    teorico: Number(row.teorico) || 0,
    costo: Number(row.costo) || 0,
    sucursalId: row.id_sucursal,
    sucursalNombre: row.sucursal_nombre,
    linea: row.linea ?? undefined,
  };
}

export function mapLine(row: CntLineaRow): import("@/lib/types").CountLine {
  return {
    sku: row.sku,
    nombre: row.nombre,
    um: row.um,
    teorico: Number(row.teorico) || 0,
    fisico: num(row.fisico),
    pendienteEntregar: num(row.pendiente_entregar) ?? 0,
    pendienteFacturar: num(row.pendiente_facturar) ?? 0,
    evidencia: row.evidencia_nombre ?? undefined,
  };
}

export function mapSession(
  row: CntConteoRow,
  lines: import("@/lib/types").CountLine[] = [],
): import("@/lib/types").CountSession {
  return {
    id: row.id,
    kind: row.kind,
    sucursalId: row.id_sucursal,
    weekKey: row.week_key,
    titulo: row.titulo,
    status: row.status,
    createdAt: row.created_at,
    submittedAt: row.submitted_at ?? undefined,
    counterName: row.counter_name ?? undefined,
    counterPuesto: row.counter_puesto ?? undefined,
    comentario: row.comentario ?? undefined,
    lines,
  };
}

export function mapCtzUser(row: CtzUsuarioRow, extra?: Partial<SessionUser>): SessionUser {
  const email = extra?.email ?? row.email ?? undefined;
  const dbRol = extra?.rol ?? row.rol;
  return {
    id: row.id,
    rol: resolveSessionRole(email, dbRol),
    nombre: extra?.nombre ?? row.nombre_completo ?? row.email ?? "",
    email,
    sucursalId: extra?.sucursalId,
    zona: extra?.zona,
  };
}

export function mapInventarioMeta(
  carga: { file_name: string; uploaded_at: string } | null,
  windowVal: { start: string; end: string },
): import("@/lib/types").InventarioMeta {
  return {
    lastUpdatedAt: carga?.uploaded_at ?? null,
    lastFileName: carga?.file_name ?? null,
    uploadWindowStart: windowVal.start,
    uploadWindowEnd: windowVal.end,
  };
}
