import { dbOrError, fail, ok } from "@/lib/api/http";
import { fetchProductos, fetchSession, fetchSucursalById, insertSessionLines } from "@/lib/db/queries";
import { URGENTE_MAX_SKUS } from "@/lib/types";
import { weekKeyFromDate } from "@/lib/week";

export async function POST(request: Request) {
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  const { supabase } = resolved;
  try {
    const body = (await request.json()) as { sucursalId?: string; titulo?: string; skus?: string[] };
    if (!body.sucursalId || !body.skus?.length) return fail("Sucursal y productos requeridos.");
    const wanted = new Set(body.skus);
    if (wanted.size > URGENTE_MAX_SKUS) return fail(`Un urgente puede tener máximo ${URGENTE_MAX_SKUS} SKUs.`);
    const productos = (await fetchProductos(supabase, body.sucursalId, "todos")).filter((p) => wanted.has(p.sku));
    if (!productos.length) return fail("Ningún SKU válido.");

    const sucursal = await fetchSucursalById(supabase, body.sucursalId);

    const { data: created, error } = await supabase
      .from("cnt_conteos")
      .insert({
        kind: "urgente",
        id_sucursal: body.sucursalId,
        week_key: weekKeyFromDate(),
        titulo: body.titulo?.trim() || `Urgente · ${sucursal?.nombre ?? "tienda"}`,
        status: "pendiente",
      })
      .select("id")
      .single();
    if (error) throw error;

    await insertSessionLines(supabase, created.id, productos);

    const session = await fetchSession(supabase, created.id);
    return ok({ session, gerenteEmail: sucursal?.gerenteEmail ?? null });
  } catch (err) {
    console.error(err);
    return fail("No se pudo crear el conteo urgente.", 500);
  }
}
