import type { Role, SessionUser } from "./types";

/** Allowlist-only. Not a value in ctz_usuarios.rol (shared with Cotizador). */
export const MAJOR_ADMIN_EMAILS = ["fernando.corella@ext.cemex.com"] as const;

const MAJOR_ADMIN_EMAIL_SET = new Set(MAJOR_ADMIN_EMAILS.map((email) => email.trim().toLowerCase()));

export function normalizeEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

export function isMajorAdminEmail(email: string | null | undefined) {
  return MAJOR_ADMIN_EMAIL_SET.has(normalizeEmail(email));
}

export function resolveSessionRole(email: string | undefined, dbRol: Role): Role {
  if (dbRol === "tienda") return "tienda";
  if (isMajorAdminEmail(email)) return "administrador_general";
  return dbRol === "administrador_general" ? "admin" : dbRol;
}

export function isConteosAdmin(rol?: Role | null) {
  return rol === "admin" || rol === "administrador_general";
}

export function isMajorAdmin(user: Pick<SessionUser, "email" | "rol"> | null | undefined) {
  if (!user) return false;
  return user.rol === "administrador_general" || isMajorAdminEmail(user.email);
}

export function staffHomePath(rol?: Role | null) {
  return isConteosAdmin(rol) ? "/admin" : "/conteos";
}

export function sessionRoleLabel(user: SessionUser) {
  if (user.rol === "administrador_general" || isMajorAdminEmail(user.email)) return "Administrador general";
  if (user.rol === "admin") return "Administrador";
  return user.zona || "Tienda";
}
