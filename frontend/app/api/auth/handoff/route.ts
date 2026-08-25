import { jwtVerify } from "jose";
import { dbOrError, fail, ok } from "@/lib/api/http";
import { mapCtzUser, type CtzUsuarioRow } from "@/lib/db/map";
import { fetchSucursalByGerenteEmail } from "@/lib/db/stores";
import { clientMetaFromRequest, logSoAccess } from "@/lib/so-access-log";

/**
 * Verifies a short-lived handoff token issued by SO-Portal and returns the
 * Conteos session the normal login creates.
 */
export async function POST(request: Request) {
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  const { supabase } = resolved;

  try {
    const { token } = (await request.json()) as { token?: string };
    if (!token) return fail("Token requerido.");

    const secret = (process.env.PORTAL_HANDOFF_SECRET ?? "").trim();
    if (!secret) {
      return fail("Handoff no configurado en el servidor.", 500);
    }

    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: "so-portal",
    });

    if (payload.app !== "conteos") {
      return fail("Token de otra aplicación.", 401);
    }

    const session = payload.session as {
      user?: CtzUsuarioRow;
      sucursal?: { id?: string; nombre?: string; zona?: string };
    } | undefined;
    const raw = session?.user;
    if (!raw?.id || !raw.email) return fail("Token inválido.", 401);
    const correo = raw.email;

    const meta = clientMetaFromRequest(request);
    function logHandoff(user: { id: string; nombre: string }) {
      void logSoAccess({
        app: "conteos",
        userId: user.id,
        correo,
        nombre: user.nombre,
        method: "portal-handoff",
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    }

    if (raw.rol === "admin") {
      const user = mapCtzUser(raw);
      logHandoff(user);
      return ok({ user });
    }

    const picked = session?.sucursal?.id
      ? { id: session.sucursal.id, nombre: session.sucursal.nombre ?? "", zona: session.sucursal.zona ?? "" }
      : await fetchSucursalByGerenteEmail(supabase, raw.email);
    if (!picked?.id) {
      return fail("Esta cuenta no está ligada a una sucursal de conteos.", 401);
    }

    const tienda = mapCtzUser(raw, {
      rol: "tienda",
      nombre: picked.nombre || raw.nombre_completo || raw.email,
      sucursalId: picked.id,
      zona: picked.zona,
    });
    logHandoff(tienda);
    return ok({ user: tienda });
  } catch {
    return fail("Token inválido o expirado. Inicia sesión de nuevo.", 401);
  }
}
