import { NextResponse } from "next/server";
import { dbOrError, fail, ok } from "@/lib/api/http";
import {
  EVIDENCE_BUCKET,
  EVIDENCE_MAX_BYTES,
  ensureEvidenceBucket,
  evidenceObjectPath,
  evidencePrefix,
  isAllowedEvidenceMime,
  mimeFromFileName,
  removeEvidenceFiles,
} from "@/lib/evidence";

type Params = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function pathForConteo(conteoId: string, path: string) {
  return path.startsWith(evidencePrefix(conteoId)) && !path.includes("..");
}

export async function GET(request: Request, { params }: Params) {
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  const { id } = await params;
  const sku = new URL(request.url).searchParams.get("sku")?.trim() || "";
  if (!sku) return fail("SKU requerido.");
  try {
    const { data, error } = await resolved.supabase
      .from("cnt_conteo_lineas")
      .select("evidencia_path")
      .eq("id_conteo", id)
      .eq("sku", sku)
      .maybeSingle();
    if (error) throw error;
    const path = (data as { evidencia_path?: string | null } | null)?.evidencia_path;
    if (!path) return fail("Sin evidencia.", 404);
    const { data: signed, error: signError } = await resolved.supabase.storage
      .from(EVIDENCE_BUCKET)
      .createSignedUrl(path, 60 * 60);
    if (signError || !signed?.signedUrl) return fail("No se pudo abrir la evidencia.", 404);
    return NextResponse.redirect(signed.signedUrl);
  } catch (err) {
    console.error(err);
    return fail("No se pudo abrir la evidencia.", 500);
  }
}

export async function POST(request: Request, { params }: Params) {
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  const { id } = await params;
  try {
    const { data: conteo, error: conteoError } = await resolved.supabase
      .from("cnt_conteos")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    if (conteoError) throw conteoError;
    if (!conteo) return fail("Conteo no encontrado.", 404);
    if ((conteo as { status?: string }).status === "enviado") {
      return fail("Este conteo ya fue enviado y no se puede editar.", 409);
    }

    const body = (await request.json()) as {
      sku?: string;
      fileName?: string;
      contentType?: string;
      bytes?: number;
    };
    const sku = body.sku?.trim() || "";
    const fileName = body.fileName?.trim() || "evidencia";
    const contentType = (body.contentType || mimeFromFileName(fileName)).trim().toLowerCase();
    const bytes = Number(body.bytes) || 0;
    if (!sku) return fail("SKU requerido.");
    if (!isAllowedEvidenceMime(contentType, fileName)) return fail("Usa una foto o un video.");
    if (bytes <= 0 || bytes > EVIDENCE_MAX_BYTES) {
      return fail("El archivo no puede pesar más de 25 MB.");
    }

    const { data: line, error: lineError } = await resolved.supabase
      .from("cnt_conteo_lineas")
      .select("sku")
      .eq("id_conteo", id)
      .eq("sku", sku)
      .maybeSingle();
    if (lineError) throw lineError;
    if (!line) return fail("Esa línea no existe.", 404);

    await ensureEvidenceBucket(resolved.supabase);
    const path = evidenceObjectPath(id, sku, fileName);
    const { data, error } = await resolved.supabase.storage
      .from(EVIDENCE_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) throw error ?? new Error("No se pudo firmar la carga.");
    return ok({ path: data.path, token: data.token, signedUrl: data.signedUrl, bucket: EVIDENCE_BUCKET });
  } catch (err) {
    console.error(err);
    return fail("No se pudo preparar la evidencia.", 500);
  }
}

export async function PUT(request: Request, { params }: Params) {
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  const { id } = await params;
  try {
    const { data: conteo, error: conteoError } = await resolved.supabase
      .from("cnt_conteos")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    if (conteoError) throw conteoError;
    if (!conteo) return fail("Conteo no encontrado.", 404);
    if ((conteo as { status?: string }).status === "enviado") {
      return fail("Este conteo ya fue enviado y no se puede editar.", 409);
    }

    const body = (await request.json()) as {
      sku?: string;
      path?: string;
      fileName?: string;
      contentType?: string;
    };
    const sku = body.sku?.trim() || "";
    const path = body.path?.trim() || "";
    if (!sku || !path) return fail("SKU y archivo requeridos.");
    if (!pathForConteo(id, path)) return fail("Ruta inválida.");

    const { data: existing } = await resolved.supabase
      .from("cnt_conteo_lineas")
      .select("evidencia_path")
      .eq("id_conteo", id)
      .eq("sku", sku)
      .maybeSingle();
    if (!existing) return fail("Esa línea no existe.", 404);

    const { error } = await resolved.supabase
      .from("cnt_conteo_lineas")
      .update({
        evidencia_path: path,
        evidencia_nombre: body.fileName?.trim() || path.split("/").pop() || "evidencia",
        evidencia_at: new Date().toISOString(),
        evidencia_mime: body.contentType || null,
      })
      .eq("id_conteo", id)
      .eq("sku", sku);
    if (error) throw error;

    await resolved.supabase.from("cnt_conteos").update({ status: "en_progreso" }).eq("id", id).eq("status", "pendiente");

    const previous = (existing as { evidencia_path?: string | null }).evidencia_path;
    if (previous && previous !== path) await removeEvidenceFiles(resolved.supabase, [previous]);

    return ok({
      saved: true,
      evidencia: body.fileName?.trim() || "evidencia",
      evidenciaPath: path,
      evidenciaAt: new Date().toISOString(),
      evidenciaMime: body.contentType || null,
    });
  } catch (err) {
    console.error(err);
    return fail("No se pudo guardar la evidencia.", 500);
  }
}
