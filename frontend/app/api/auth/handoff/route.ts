import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { dbOrError, fail, ok } from "@/lib/api/http";
import { mapCtzUser, type CtzUsuarioRow } from "@/lib/db/map";
import { fetchSucursalByGerenteEmail } from "@/lib/db/stores";

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

    const raw = (payload.session as { user?: CtzUsuarioRow } | undefined)?.user;
    if (!raw?.id || !raw.email) return fail("Token inválido.", 401);

    if (raw.rol === "admin") {
      return ok({ user: mapCtzUser(raw) });
    }

    const sucursal = await fetchSucursalByGerenteEmail(supabase, raw.email);
    if (!sucursal) {
      return fail("Esta cuenta no está ligada a una sucursal de conteos.", 401);
    }

    return ok({
      user: mapCtzUser(raw, {
        rol: "tienda",
        nombre: sucursal.nombre,
        sucursalId: sucursal.id,
        zona: sucursal.zona,
      }),
    });
  } catch {
    return fail("Token inválido o expirado. Inicia sesión de nuevo.", 401);
  }
}
