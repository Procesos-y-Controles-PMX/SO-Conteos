import { dbOrError, fail, ok } from "@/lib/api/http";
import { mapCtzUser, type CtzUsuarioRow } from "@/lib/db/map";
import { fetchSucursalById } from "@/lib/db/stores";
import { clientMetaFromRequest, logSoAccess, logSoFailedAccess } from "@/lib/so-access-log";
import { scorePasswordCloseness } from "@/lib/password-closeness";
import type { SessionUser } from "@/lib/types";

function logLogin(request: Request, user: SessionUser, fallbackEmail?: string) {
  const meta = clientMetaFromRequest(request);
  void logSoAccess({
    app: "conteos",
    userId: user.id,
    correo: user.email || fallbackEmail || "",
    nombre: user.nombre,
    method: "credentials",
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
}

export async function POST(request: Request) {
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  const { supabase } = resolved;

  try {
    const body = (await request.json()) as {
      mode?: "tienda" | "admin";
      sucursalId?: string;
      email?: string;
      password?: string;
    };
    const password = (body.password ?? "").trim();
    if (!password) return fail("Contraseña requerida.");

    if (body.mode === "admin") {
      const email = (body.email ?? "").trim().toLowerCase();
      if (!email) return fail("Correo requerido.");
      const { data, error } = await supabase
        .from("ctz_usuarios")
        .select("id, email, nombre_completo, rol, activo, password")
        .ilike("email", email);
      if (error) throw error;
      // Eligibility is applied here rather than in the query so a rejected attempt can
      // distinguish an unknown email from an existing but inactive / non-admin account.
      // The accept condition is unchanged: admin + activo + matching password.
      const candidates = (data ?? []) as CtzUsuarioRow[];
      const eligible = candidates.filter((r) => r.rol === "admin" && r.activo === true);
      const row = eligible.find((r) => String(r.password ?? "").trim() === password);
      if (!row) {
        const first = eligible[0] ?? candidates[0];
        const meta = clientMetaFromRequest(request);
        const close = first
          ? scorePasswordCloseness(password, String(first.password ?? ""), email)
          : { closeness: "n_a" as const, distance: null, attemptLen: password.length, hint: null };
        void logSoFailedAccess({
          app: "conteos",
          correo: email,
          nombre: first?.nombre_completo,
          reason: !first ? "unknown_email" : eligible.length === 0 ? "inactive" : "wrong_password",
          closeness: close.closeness,
          distance: close.distance,
          attemptLen: close.attemptLen,
          hint: close.hint,
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
        return fail("Credenciales inválidas.", 401);
      }
      const user = mapCtzUser(row);
      logLogin(request, user);
      return ok({ user });
    }

    const sucursalId = body.sucursalId ?? "";
    if (!sucursalId) return fail("Selecciona una sucursal.");
    const sucursal = await fetchSucursalById(supabase, sucursalId);
    if (!sucursal) return fail("Sucursal no encontrada.", 401);
    if (!sucursal.gerenteEmail) {
      return fail("Esta sucursal no tiene cuenta de gerente.", 401);
    }

    const { data, error } = await supabase
      .from("ctz_usuarios")
      .select("id, email, nombre_completo, rol, activo, password")
      .ilike("email", sucursal.gerenteEmail);
    if (error) throw error;
    // Same as above: filter in memory so the failure reason stays accurate.
    // The accept condition is unchanged: activo + matching password.
    const candidates = (data ?? []) as CtzUsuarioRow[];
    const eligible = candidates.filter((r) => r.activo === true);
    const row = eligible.find((r) => String(r.password ?? "").trim() === password);
    if (!row) {
      const first = eligible[0] ?? candidates[0];
      const meta = clientMetaFromRequest(request);
      const close = first
        ? scorePasswordCloseness(password, String(first.password ?? ""), sucursal.gerenteEmail)
        : { closeness: "n_a" as const, distance: null, attemptLen: password.length, hint: null };
      void logSoFailedAccess({
        app: "conteos",
        correo: sucursal.gerenteEmail,
        nombre: sucursal.nombre,
        reason: !first ? "unknown_email" : eligible.length === 0 ? "inactive" : "wrong_password",
        closeness: close.closeness,
        distance: close.distance,
        attemptLen: close.attemptLen,
        hint: close.hint,
        sucursal: sucursal.nombre,
        region: sucursal.zona,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      return fail("Contraseña incorrecta para esta sucursal.", 401);
    }

    const user = mapCtzUser(row, {
      rol: "tienda",
      nombre: sucursal.nombre,
      sucursalId: sucursal.id,
      zona: sucursal.zona,
    });
    logLogin(request, user, sucursal.gerenteEmail);
    return ok({ user });
  } catch (err) {
    console.error(err);
    return fail("Error al iniciar sesión.", 500);
  }
}
