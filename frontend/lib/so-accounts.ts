import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SoAccount, SoAccountApp, SoAccountsResult, SoAccountsSourceStatus } from "@/lib/so-account-types";

export type { SoAccount, SoAccountApp, SoAccountsResult, SoAccountsSourceStatus } from "@/lib/so-account-types";

const PAGE = 1000;
const APP_ORDER: SoAccountApp[] = ["equipo", "cotizador", "permisos", "carta-responsiva"];

function missingEquipoEnv() {
  const missing: string[] = [];
  if (!(process.env.SUPABASE_URL_EQUIPO || "").trim()) missing.push("SUPABASE_URL_EQUIPO");
  if (!(process.env.SUPABASE_SERVICE_ROLE_EQUIPO || "").trim()) {
    missing.push("SUPABASE_SERVICE_ROLE_EQUIPO");
  }
  return missing;
}

function equipoClient(): SupabaseClient | null {
  const url = (process.env.SUPABASE_URL_EQUIPO || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_EQUIPO || "").trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function cotizadorClient(): SupabaseClient | null {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function textOrNull(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function keepEarlier(map: Map<string, string>, email: string, iso: unknown) {
  const at = String(iso ?? "").trim();
  if (!email || !at) return;
  const prev = map.get(email);
  if (!prev || at < prev) map.set(email, at);
}

async function selectAll<T extends Record<string, unknown>>(
  client: SupabaseClient,
  table: string,
  columns: string,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await client.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) throw error;
    const page = (data ?? []) as unknown as T[];
    rows.push(...page);
    if (page.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

function equipoRolLabel(rol: unknown) {
  switch (String(rol ?? "").trim().toUpperCase()) {
    case "ADMIN":
      return "Administrador";
    case "APPROVER":
      return "Aprobador";
    case "REQUESTER":
      return "Solicitante";
    default:
      return String(rol ?? "").trim() || "—";
  }
}

function cotizadorRolLabel(rol: unknown) {
  switch (String(rol ?? "").trim()) {
    case "admin":
      return "Administrador";
    case "tienda":
      return "Tienda";
    default:
      return String(rol ?? "").trim() || "—";
  }
}

function cartaRolLabel(rol: unknown) {
  switch (String(rol ?? "").trim()) {
    case "administrador_general":
      return "Administrador general";
    case "administrador_zona":
      return "Administrador de zona";
    case "usuario":
      return "Usuario";
    default:
      return String(rol ?? "").trim() || "—";
  }
}

async function firstLoginByEmail(equipo: SupabaseClient): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const rows = await selectAll<{ CORREO?: string; CREATED_AT?: string }>(
      equipo,
      "APP_ACCESS_LOG",
      "CORREO, CREATED_AT",
    );
    for (const row of rows) keepEarlier(map, normalizeEmail(row.CORREO), row.CREATED_AT);
  } catch (err) {
    console.error("[so-accounts] APP_ACCESS_LOG:", err instanceof Error ? err.message : err);
  }
  return map;
}

async function loadEquipo(): Promise<{ cuentas: SoAccount[]; status: SoAccountsSourceStatus }> {
  const equipo = equipoClient();
  if (!equipo) {
    if (missingEquipoEnv().length) return { cuentas: [], status: "missing_env" };
    return { cuentas: [], status: "error" };
  }
  try {
    const usersPromise = selectAll<{
      ID?: string;
      CORREO?: string;
      NOMBRE?: string;
      ROL?: string;
      ACTIVO?: string;
      CREATED_AT?: string;
    }>(equipo, "APP_USERS", "ID, CORREO, NOMBRE, ROL, ACTIVO, CREATED_AT").catch(() =>
      selectAll<{ ID?: string; CORREO?: string; NOMBRE?: string; ROL?: string; ACTIVO?: string }>(
        equipo,
        "APP_USERS",
        "ID, CORREO, NOMBRE, ROL, ACTIVO",
      ),
    );
    const [users, firstLogin] = await Promise.all([usersPromise, firstLoginByEmail(equipo)]);
    const cuentas = users.map((row, index) => {
      const email = normalizeEmail(row.CORREO);
      const created = textOrNull("CREATED_AT" in row ? row.CREATED_AT : null);
      const firstSeen = firstLogin.get(email) ?? null;
      const alta = created ?? firstSeen;
      return {
        key: `equipo:${row.ID || email || index}`,
        app: "equipo" as const,
        email,
        nombre: textOrNull(row.NOMBRE),
        rol: equipoRolLabel(row.ROL),
        activo: String(row.ACTIVO ?? "").trim().toUpperCase() === "SI",
        alta,
        altaSource: created ? ("created_at" as const) : alta ? ("first_login" as const) : null,
      };
    });
    return { cuentas, status: "ok" };
  } catch (err) {
    console.error("[so-accounts] APP_USERS:", err instanceof Error ? err.message : err);
    return { cuentas: [], status: "error" };
  }
}

async function loadCotizador(client: SupabaseClient): Promise<{ cuentas: SoAccount[]; status: SoAccountsSourceStatus }> {
  try {
    const rows = await selectAll<{
      id?: string;
      email?: string;
      nombre_completo?: string | null;
      rol?: string;
      activo?: boolean;
      created_at?: string;
    }>(client, "ctz_usuarios", "id, email, nombre_completo, rol, activo, created_at");
    return {
      status: "ok",
      cuentas: rows.map((row, index) => {
        const email = normalizeEmail(row.email);
        const alta = textOrNull(row.created_at);
        return {
          key: `cotizador:${row.id || email || index}`,
          app: "cotizador" as const,
          email,
          nombre: textOrNull(row.nombre_completo),
          rol: cotizadorRolLabel(row.rol),
          activo: row.activo !== false,
          alta,
          altaSource: alta ? ("created_at" as const) : null,
        };
      }),
    };
  } catch (err) {
    console.error("[so-accounts] ctz_usuarios:", err instanceof Error ? err.message : err);
    return { cuentas: [], status: "error" };
  }
}

async function loadPermisos(client: SupabaseClient): Promise<{ cuentas: SoAccount[]; status: SoAccountsSourceStatus }> {
  try {
    let rows: Array<Record<string, unknown>>;
    try {
      rows = await selectAll(
        client,
        "perfiles",
        "id, email, nombre_completo, id_rol, created_at, roles:id_rol(nombre_rol)",
      );
    } catch {
      rows = await selectAll(client, "perfiles", "id, email, nombre_completo, id_rol, created_at");
    }
    return {
      status: "ok",
      cuentas: rows.map((row, index) => {
        const email = normalizeEmail(row.email);
        const alta = textOrNull(row.created_at);
        const joined = row.roles as { nombre_rol?: string } | { nombre_rol?: string }[] | null;
        const rolName = Array.isArray(joined) ? joined[0]?.nombre_rol : joined?.nombre_rol;
        const rolFromId =
          Number(row.id_rol) === 1 ? "Admin" : Number(row.id_rol) === 2 ? "Tienda" : Number(row.id_rol) === 3 ? "Regional" : "";
        return {
          key: `permisos:${row.id ?? email ?? index}`,
          app: "permisos" as const,
          email,
          nombre: textOrNull(row.nombre_completo),
          rol: String(rolName ?? "").trim() || rolFromId || "—",
          activo: null,
          alta,
          altaSource: alta ? ("created_at" as const) : null,
        };
      }),
    };
  } catch (err) {
    console.error("[so-accounts] perfiles:", err instanceof Error ? err.message : err);
    return { cuentas: [], status: "error" };
  }
}

async function loadCartas(client: SupabaseClient): Promise<{ cuentas: SoAccount[]; status: SoAccountsSourceStatus }> {
  try {
    const rows = await selectAll<{
      id?: string;
      email?: string;
      nombre_completo?: string | null;
      rol?: string;
      activo?: boolean;
      created_at?: string;
    }>(client, "cr_usuarios", "id, email, nombre_completo, rol, activo, created_at");
    return {
      status: "ok",
      cuentas: rows.map((row, index) => {
        const email = normalizeEmail(row.email);
        const alta = textOrNull(row.created_at);
        return {
          key: `carta-responsiva:${row.id || email || index}`,
          app: "carta-responsiva" as const,
          email,
          nombre: textOrNull(row.nombre_completo),
          rol: cartaRolLabel(row.rol),
          activo: row.activo !== false,
          alta,
          altaSource: alta ? ("created_at" as const) : null,
        };
      }),
    };
  } catch (err) {
    console.error("[so-accounts] cr_usuarios:", err instanceof Error ? err.message : err);
    return { cuentas: [], status: "error" };
  }
}

function sortAccounts(cuentas: SoAccount[]) {
  return [...cuentas].sort((a, b) => {
    const app = APP_ORDER.indexOf(a.app) - APP_ORDER.indexOf(b.app);
    if (app !== 0) return app;
    const altaA = a.alta ?? "";
    const altaB = b.alta ?? "";
    if (altaA !== altaB) return altaB.localeCompare(altaA);
    return a.email.localeCompare(b.email);
  });
}

export async function fetchSoAccounts(): Promise<SoAccountsResult> {
  const empty: SoAccountsResult = {
    cuentas: [],
    sources: {
      equipo: "missing_env",
      cotizador: "error",
      permisos: "error",
      "carta-responsiva": "error",
    },
  };

  const cotizador = cotizadorClient();
  const [equipo, rest] = await Promise.all([
    loadEquipo(),
    cotizador
      ? Promise.all([loadCotizador(cotizador), loadPermisos(cotizador), loadCartas(cotizador)])
      : Promise.resolve(null),
  ]);

  if (!rest) {
    return {
      cuentas: sortAccounts(equipo.cuentas),
      sources: {
        ...empty.sources,
        equipo: equipo.status,
        cotizador: "missing_env",
        permisos: "missing_env",
        "carta-responsiva": "missing_env",
      },
    };
  }

  const [cotizadorRows, permisos, cartas] = rest;
  return {
    cuentas: sortAccounts([...equipo.cuentas, ...cotizadorRows.cuentas, ...permisos.cuentas, ...cartas.cuentas]),
    sources: {
      equipo: equipo.status,
      cotizador: cotizadorRows.status,
      permisos: permisos.status,
      "carta-responsiva": cartas.status,
    },
  };
}
