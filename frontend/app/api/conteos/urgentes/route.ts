import { dbOrError, fail, ok } from "@/lib/api/http";
import { fetchProductos, fetchSession, fetchSucursalById } from "@/lib/db/queries";
import { weekKeyFromDate } from "@/lib/week";

export async function POST(request: Request) {
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  const { supabase } = resolved;
  try {
    const body = (await request.json()) as { sucursalId?: string; titulo?: string; skus?: string[] };
    if (!body.sucursalId || !body.skus?.length) return fail("Sucursal y productos requeridos.");
    const productos = (await fetchProductos(supabase)).filter((p) => body.skus!.includes(p.sku));
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

    const { error: lineError } = await supabase.from("cnt_conteo_lineas").insert(
      productos.map((p) => ({
        id_conteo: created.id,
        sku: p.sku,
        nombre: p.nombre,
        um: p.um,
        teorico: p.teorico,
        pendiente_entregar: 0,
        pendiente_facturar: 0,
      })),
    );
    if (lineError) throw lineError;

    const session = await fetchSession(supabase, created.id);
    return ok({ session, gerenteEmail: sucursal?.gerenteEmail ?? null });
  } catch (err) {
    console.error(err);
    return fail("No se pudo crear el conteo urgente.", 500);
  }
}
