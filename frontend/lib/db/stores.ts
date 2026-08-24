import type { SupabaseClient } from "@supabase/supabase-js";
import { mapSucursal, type CtzSucursalRow, type CtzUsuarioRow } from "@/lib/db/map";
import type { Sucursal } from "@/lib/types";

function norm(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function maybeRows<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
): Promise<T[]> {
  const { data, error } = await supabase.from(table).select(columns);
  if (error) return [];
  return (data ?? []) as T[];
}

type TiendaRow = {
  sucursal: string | null;
  correo: string | null;
  gerente_tienda: string | null;
  centro: string | null;
};

type CrSucursalRow = {
  nombre: string | null;
  gerente_email: string | null;
  gerente_nombre: string | null;
  codigo_sap: string | null;
};

/**
 * Cotizador stores, with gerente email from Permisos `tiendas.correo`
 * (StoreName → GerenteMail) or Carta Responsiva as fallback.
 */
export async function fetchSucursales(supabase: SupabaseClient, withGerente = false): Promise<Sucursal[]> {
  const { data, error } = await supabase
    .from("ctz_sucursales")
    .select("id, nombre, region, centro, activo")
    .eq("activo", true)
    .order("region")
    .order("nombre");
  if (error) throw error;
  const rows = (data ?? []) as CtzSucursalRow[];

  const [tiendas, crStores, users] = await Promise.all([
    maybeRows<TiendaRow>(supabase, "tiendas", "sucursal, correo, gerente_tienda, centro"),
    maybeRows<CrSucursalRow>(supabase, "cr_sucursales", "nombre, gerente_email, gerente_nombre, codigo_sap"),
    withGerente
      ? maybeRows<Pick<CtzUsuarioRow, "email" | "nombre_completo" | "activo">>(
          supabase,
          "ctz_usuarios",
          "email, nombre_completo, activo",
        )
      : Promise.resolve([]),
  ]);

  const tiendaByCentro = new Map<string, TiendaRow>();
  const tiendaByNombre = new Map<string, TiendaRow>();
  for (const t of tiendas) {
    if (norm(t.centro)) tiendaByCentro.set(norm(t.centro), t);
    if (norm(t.sucursal)) tiendaByNombre.set(norm(t.sucursal), t);
  }

  const crByCodigo = new Map<string, CrSucursalRow>();
  const crByNombre = new Map<string, CrSucursalRow>();
  for (const c of crStores) {
    if (norm(c.codigo_sap)) crByCodigo.set(norm(c.codigo_sap), c);
    if (norm(c.nombre)) crByNombre.set(norm(c.nombre), c);
  }

  const userByEmail = new Map<string, Pick<CtzUsuarioRow, "email" | "nombre_completo" | "activo">>();
  for (const u of users) {
    const email = String(u.email ?? "").trim().toLowerCase();
    if (email) userByEmail.set(email, u);
  }

  return rows.map((row) => {
    const tienda = (row.centro ? tiendaByCentro.get(norm(row.centro)) : undefined) ?? tiendaByNombre.get(norm(row.nombre));
    const cr = (row.centro ? crByCodigo.get(norm(row.centro)) : undefined) ?? crByNombre.get(norm(row.nombre));
    const gerenteEmail = (tienda?.correo || cr?.gerente_email || "").trim().toLowerCase();
    const account = gerenteEmail ? userByEmail.get(gerenteEmail) : undefined;
    const gerenteNombre =
      tienda?.gerente_tienda?.trim() ||
      cr?.gerente_nombre?.trim() ||
      account?.nombre_completo?.trim() ||
      "";
    return mapSucursal(row, {
      gerenteEmail: withGerente ? gerenteEmail : "",
      gerenteNombre,
      hasAccount: Boolean(account?.activo),
    });
  });
}

export async function fetchSucursalById(supabase: SupabaseClient, id: string): Promise<Sucursal | null> {
  const all = await fetchSucursales(supabase, true);
  return all.find((s) => s.id === id) ?? null;
}

export async function fetchSucursalByGerenteEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<Sucursal | null> {
  const needle = email.trim().toLowerCase();
  if (!needle) return null;
  const all = await fetchSucursales(supabase, true);
  return all.find((s) => s.gerenteEmail.toLowerCase() === needle) ?? null;
}
