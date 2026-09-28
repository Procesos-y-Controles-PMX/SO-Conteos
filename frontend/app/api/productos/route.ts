import { dbOrError, fail, ok } from "@/lib/api/http";
import { fetchProductos } from "@/lib/db/queries";

export async function GET(request: Request) {
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  try {
    const params = new URL(request.url).searchParams;
    const sucursalId = params.get("sucursalId")?.trim() || undefined;
    const alcance = params.get("alcance") === "todos" ? "todos" : "semanal";
    const productos = await fetchProductos(resolved.supabase, sucursalId, alcance);
    return ok({ productos });
  } catch (err) {
    console.error(err);
    return fail("No se pudieron cargar los SKUs.", 500);
  }
}
