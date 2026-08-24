import { dbOrError, fail, ok } from "@/lib/api/http";
import { fetchProductos } from "@/lib/db/queries";

export async function GET() {
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  try {
    const productos = (await fetchProductos(resolved.supabase)).map((p) => ({
      ...p,
      teorico: 0,
    }));
    return ok({ productos });
  } catch (err) {
    console.error(err);
    return fail("No se pudieron cargar los SKUs.", 500);
  }
}
