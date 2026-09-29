import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { isConteosAdmin, isMajorAdmin, isUnlockAdmin } from "@/lib/access";
import { fail } from "@/lib/api/http";
import type { SessionUser } from "@/lib/types";

export const SESSION_COOKIE = "cnt_auth";
const ISSUER = "so-conteos";
const TTL_SECONDS = 12 * 60 * 60;

export const MSG_SESION = "Tu sesión expiró. Inicia sesión de nuevo.";

function secretKey() {
  const secret = (process.env.SESSION_SECRET ?? "").trim();
  return secret ? new TextEncoder().encode(secret) : null;
}

export async function setSessionCookie(response: NextResponse, user: SessionUser) {
  const key = secretKey();
  if (!key) throw new Error("SESSION_SECRET no configurado.");
  const claims: SessionUser = {
    id: user.id,
    rol: user.rol,
    nombre: user.nombre,
    email: user.email,
    sucursalId: user.sucursalId,
    zona: user.zona,
  };
  const token = await new SignJWT({ user: claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(key);
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}

export async function sessionUser(): Promise<SessionUser | null> {
  const key = secretKey();
  if (!key) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key, { issuer: ISSUER, algorithms: ["HS256"] });
    const user = payload.user as SessionUser | undefined;
    return user?.id && user.rol ? user : null;
  } catch {
    return null;
  }
}

/**
 * `admin`: Conteos admins. `major`: administrador general. `unlock`: Lilian
 * (must also be an admin).
 */
export type Access = "any" | "admin" | "major" | "unlock";

function allows(user: SessionUser, access: Access) {
  if (access === "any") return true;
  if (access === "admin") return isConteosAdmin(user.rol);
  if (access === "major") return isMajorAdmin(user);
  return isConteosAdmin(user.rol) && isUnlockAdmin(user);
}

export async function requireSession(
  access: Access = "any",
): Promise<{ user: SessionUser } | { response: NextResponse }> {
  const user = await sessionUser();
  if (!user) return { response: fail(MSG_SESION, 401) };
  if (!allows(user, access)) return { response: fail("No autorizado.", 403) };
  return { user };
}

/** Admins see every store; a store account only its own. */
export function canAccessSucursal(user: SessionUser, sucursalId: string | null | undefined) {
  if (isConteosAdmin(user.rol)) return true;
  return Boolean(sucursalId) && user.sucursalId === sucursalId;
}
