import { dbOrError, fail, ok } from "@/lib/api/http";
import { fetchSucursales } from "@/lib/db/queries";
import type { CtzUsuario, Role } from "@/lib/types";

const USER_SELECT = "id, email, nombre_completo, rol, activo, created_at";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isRole(value: string): value is Role {
  return value === "admin" || value === "tienda";
}

async function listCtzUsuarios(supabase: Parameters<typeof fetchSucursales>[0]): Promise<CtzUsuario[]> {
  const { data, error } = await supabase
    .from("ctz_usuarios")
    .select(USER_SELECT)
    .order("activo", { ascending: false })
    .order("email");
  if (error) throw error;
  return ((data ?? []) as CtzUsuario[]).map((row) => ({
    ...row,
    email: String(row.email ?? "").trim(),
  }));
}

async function countActiveAdmins(
  supabase: Parameters<typeof fetchSucursales>[0],
  excludeId?: string,
): Promise<number> {
  let query = supabase
    .from("ctz_usuarios")
    .select("id", { count: "exact", head: true })
    .eq("rol", "admin")
    .eq("activo", true);
  if (excludeId) query = query.neq("id", excludeId);
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

export async function GET() {
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  try {
    const [sucursales, usuarios] = await Promise.all([
      fetchSucursales(resolved.supabase, true),
      listCtzUsuarios(resolved.supabase),
    ]);
    return ok({ sucursales, usuarios });
  } catch (err) {
    console.error(err);
    return fail("No se pudieron cargar los usuarios.", 500);
  }
}

export async function POST(request: Request) {
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;

  try {
    const body = (await request.json()) as {
      email?: string;
      nombre_completo?: string;
      rol?: string;
      password?: string;
      activo?: boolean;
    };
    const email = normalizeEmail(body.email ?? "");
    const password = (body.password ?? "").trim();
    const rol = body.rol ?? "tienda";
    if (!email) return fail("El correo es obligatorio.");
    if (password.length < 4) return fail("La contraseña debe tener al menos 4 caracteres.");
    if (!isRole(rol)) return fail("Rol inválido.");

    const { data, error } = await resolved.supabase
      .from("ctz_usuarios")
      .insert({
        email,
        nombre_completo: body.nombre_completo?.trim() || null,
        rol,
        activo: body.activo !== false,
        password,
      })
      .select(USER_SELECT)
      .single();
    if (error) {
      if (error.code === "23505") return fail("Ese correo ya está registrado.", 409);
      throw error;
    }
    return ok({ usuario: data as CtzUsuario }, 201);
  } catch (err) {
    console.error(err);
    return fail("No se pudo crear el usuario.", 500);
  }
}

export async function PUT(request: Request) {
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;

  try {
    const body = (await request.json()) as {
      id?: string;
      email?: string;
      nombre_completo?: string | null;
      rol?: string;
      password?: string;
      activo?: boolean;
    };
    if (!body.id) return fail("id es requerido.");
    if (body.rol && !isRole(body.rol)) return fail("Rol inválido.");
    if (body.password !== undefined && body.password.trim() && body.password.trim().length < 4) {
      return fail("La contraseña debe tener al menos 4 caracteres.");
    }

    const { data: current, error: currentError } = await resolved.supabase
      .from("ctz_usuarios")
      .select("id, rol, activo")
      .eq("id", body.id)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) return fail("Usuario no encontrado.", 404);

    const nextRol = body.rol ?? (current.rol as Role);
    const nextActivo = body.activo ?? (current.activo as boolean);
    const leavingAdmin = current.rol === "admin" && current.activo && (nextRol !== "admin" || nextActivo === false);
    if (leavingAdmin && (await countActiveAdmins(resolved.supabase, body.id)) === 0) {
      return fail("Debe quedar al menos un administrador activo.");
    }

    const patch: Record<string, unknown> = {};
    if (body.email !== undefined) patch.email = normalizeEmail(body.email);
    if (body.nombre_completo !== undefined) patch.nombre_completo = body.nombre_completo?.trim() || null;
    if (body.rol !== undefined) patch.rol = body.rol;
    if (body.activo !== undefined) patch.activo = body.activo;
    if (body.password !== undefined && body.password.trim()) patch.password = body.password.trim();

    const { data, error } = await resolved.supabase
      .from("ctz_usuarios")
      .update(patch)
      .eq("id", body.id)
      .select(USER_SELECT)
      .single();
    if (error) {
      if (error.code === "23505") return fail("Ese correo ya está registrado.", 409);
      throw error;
    }
    return ok({ usuario: data as CtzUsuario });
  } catch (err) {
    console.error(err);
    return fail("No se pudo actualizar el usuario.", 500);
  }
}

export async function DELETE(request: Request) {
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;

  try {
    const body = (await request.json()) as { id?: string };
    if (!body.id) return fail("id es requerido.");

    const { data: current } = await resolved.supabase
      .from("ctz_usuarios")
      .select("rol, activo")
      .eq("id", body.id)
      .maybeSingle();
    if (current?.rol === "admin" && current.activo && (await countActiveAdmins(resolved.supabase, body.id)) === 0) {
      return fail("Debe quedar al menos un administrador activo.");
    }

    const { error } = await resolved.supabase.from("ctz_usuarios").delete().eq("id", body.id);
    if (error) {
      if (error.code === "23503") {
        return fail("No se puede borrar: el usuario tiene cotizaciones. Desactívalo en su lugar.", 409);
      }
      throw error;
    }
    return ok({});
  } catch (err) {
    console.error(err);
    return fail("No se pudo eliminar el usuario.", 500);
  }
}
