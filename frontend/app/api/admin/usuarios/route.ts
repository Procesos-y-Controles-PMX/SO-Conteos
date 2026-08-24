import { dbOrError, fail, ok } from "@/lib/api/http";
import { fetchSucursales } from "@/lib/db/queries";

export async function GET() {
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  try {
    const sucursales = await fetchSucursales(resolved.supabase, true);
    return ok({ sucursales });
  } catch (err) {
    console.error(err);
    return fail("No se pudieron cargar los usuarios.", 500);
  }
}
