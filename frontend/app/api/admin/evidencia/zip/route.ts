import { dbOrError, fail, ok } from "@/lib/api/http";
import type { CntConteoRow } from "@/lib/db/map";
import { fetchSucursales } from "@/lib/db/stores";
import { EVIDENCE_BUCKET, safeEvidenceSku } from "@/lib/evidence";
import { weekLabel } from "@/lib/week";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LineaEvidencia = {
  id_conteo: string;
  sku: string;
  evidencia_path: string | null;
  evidencia_entregar_path: string | null;
  evidencia_facturar_path: string | null;
};

const SLOTS = [
  { col: "evidencia_path", suffix: "foto" },
  { col: "evidencia_entregar_path", suffix: "entregar" },
  { col: "evidencia_facturar_path", suffix: "facturar" },
] as const;

function folderName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || "sin-nombre";
}

function extOf(path: string) {
  return path.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]+/g, "") || "bin";
}

/**
 * Lists signed URLs for every evidence file of the given counts. The browser
 * downloads and zips them, so large archives never pass through the function.
 */
export async function POST(request: Request) {
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  try {
    const body = (await request.json()) as { ids?: string[] };
    const ids = Array.from(new Set((body.ids ?? []).filter((id) => typeof id === "string" && id)));
    if (!ids.length) return fail("Selecciona al menos un conteo.");
    if (ids.length > 500) return fail("Demasiados conteos para un solo ZIP.");

    const [{ data: conteos, error: conteoError }, sucursales] = await Promise.all([
      resolved.supabase.from("cnt_conteos").select("*").in("id", ids),
      fetchSucursales(resolved.supabase),
    ]);
    if (conteoError) throw conteoError;
    const sucursalName = new Map(sucursales.map((s) => [s.id, s.nombre]));
    const byId = new Map(((conteos ?? []) as CntConteoRow[]).map((row) => [row.id, row]));

    const { data: lineas, error: lineError } = await resolved.supabase
      .from("cnt_conteo_lineas")
      .select("id_conteo, sku, evidencia_path, evidencia_entregar_path, evidencia_facturar_path")
      .in("id_conteo", ids)
      .or("evidencia_path.not.is.null,evidencia_entregar_path.not.is.null,evidencia_facturar_path.not.is.null");
    if (lineError) throw lineError;

    const entries: Array<{ path: string; name: string }> = [];
    for (const linea of (lineas ?? []) as LineaEvidencia[]) {
      const conteo = byId.get(linea.id_conteo);
      if (!conteo) continue;
      const tienda = folderName(sucursalName.get(conteo.id_sucursal) ?? conteo.id_sucursal);
      const conteoFolder = folderName(
        conteo.kind === "semanal" ? `Semanal ${weekLabel(conteo.week_key)}` : conteo.titulo,
      );
      for (const slot of SLOTS) {
        const path = linea[slot.col];
        if (!path) continue;
        entries.push({
          path,
          name: `${tienda}/${conteoFolder}/${safeEvidenceSku(linea.sku)}_${slot.suffix}.${extOf(path)}`,
        });
      }
    }
    if (!entries.length) return ok({ files: [] });

    const files: Array<{ name: string; url: string }> = [];
    for (let i = 0; i < entries.length; i += 100) {
      const chunk = entries.slice(i, i + 100);
      const { data: signed, error } = await resolved.supabase.storage
        .from(EVIDENCE_BUCKET)
        .createSignedUrls(
          chunk.map((entry) => entry.path),
          60 * 30,
        );
      if (error) throw error;
      (signed ?? []).forEach((item, j) => {
        if (item.signedUrl) files.push({ name: chunk[j].name, url: item.signedUrl });
      });
    }
    return ok({ files });
  } catch (err) {
    console.error(err);
    return fail("No se pudo preparar el ZIP de evidencias.", 500);
  }
}
