import { isConteosAdmin } from "@/lib/access";
import { dbOrError, fail, ok } from "@/lib/api/http";
import { requireSession } from "@/lib/api/session";
import { fetchProductos } from "@/lib/db/queries";

export async function GET(request: Request) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  try {
    const params = new URL(request.url).searchParams;
    const admin = isConteosAdmin(auth.user.rol);
    const sucursalId = admin ? params.get("sucursalId")?.trim() || undefined : auth.user.sucursalId;
    if (!sucursalId && !admin) return fail("No autorizado.", 403);
    const alcance = admin && params.get("alcance") === "todos" ? "todos" : "semanal";
    const productos = await fetchProductos(resolved.supabase, sucursalId, alcance);
    return ok({ productos });
  } catch (err) {
    console.error(err);
    return fail("No se pudieron cargar los SKUs.", 500);
  }
}
