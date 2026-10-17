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
import type { SupabaseClient } from "@supabase/supabase-js";
import { conteoParaEditar, conteoVisible } from "@/lib/api/conteoGuard";
import { requireSession } from "@/lib/api/session";
import { mapEvidencia } from "@/lib/db/map";
import { fetchEvidencias } from "@/lib/db/queries";
import type { EvidenceKind } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function pathForConteo(conteoId: string, path: string) {
  return path.startsWith(evidencePrefix(conteoId)) && !path.includes("..");
}

function normalizeKind(raw: unknown): EvidenceKind {
  if (raw === "entregar" || raw === "facturar" || raw === "danado" || raw === "general") return raw;
  return "general";
}

/** Pre-patch single-file columns, one set per slot. */
const LEGACY_SLOTS = [
  ["evidencia_path", "evidencia_nombre", "evidencia_at", "evidencia_mime"],
  ["evidencia_entregar_path", "evidencia_entregar_nombre", "evidencia_entregar_at", "evidencia_entregar_mime"],
  ["evidencia_facturar_path", "evidencia_facturar_nombre", "evidencia_facturar_at", "evidencia_facturar_mime"],
] as const;

async function evidenciasFor(supabase: SupabaseClient, id: string, sku: string) {
  return (await fetchEvidencias(supabase, id, sku)).map(mapEvidencia);
}

export async function GET(request: Request, { params }: Params) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  const { id } = await params;
  const path = new URL(request.url).searchParams.get("path")?.trim() || "";
  if (!path || !pathForConteo(id, path)) return fail("Ruta inválida.");
  try {
    const visible = await conteoVisible(resolved.supabase, id, auth.user);
    if ("response" in visible) return visible.response;
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
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  const { id } = await params;
  try {
    const guard = await conteoParaEditar(resolved.supabase, id, auth.user, { capturaAbierta: true });
    if ("response" in guard) return guard.response;

    const body = (await request.json()) as {
      sku?: string;
      fileName?: string;
      contentType?: string;
      bytes?: number;
      kind?: EvidenceKind;
    };
    const sku = body.sku?.trim() || "";
    const kind = normalizeKind(body.kind);
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
    const path = evidenceObjectPath(id, sku, fileName, kind);
    const { data, error } = await resolved.supabase.storage
      .from(EVIDENCE_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) throw error ?? new Error("No se pudo firmar la carga.");
    return ok({ path: data.path, token: data.token, signedUrl: data.signedUrl, bucket: EVIDENCE_BUCKET, kind });
  } catch (err) {
    console.error(err);
    return fail("No se pudo preparar la evidencia.", 500);
  }
}

export async function PUT(request: Request, { params }: Params) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  const { id } = await params;
  try {
    const guard = await conteoParaEditar(resolved.supabase, id, auth.user, { capturaAbierta: true });
    if ("response" in guard) return guard.response;

    const body = (await request.json()) as {
      sku?: string;
      path?: string;
      fileName?: string;
      contentType?: string;
      kind?: EvidenceKind;
    };
    const sku = body.sku?.trim() || "";
    const path = body.path?.trim() || "";
    const kind = normalizeKind(body.kind);
    if (!sku || !path) return fail("SKU y archivo requeridos.");
    if (!pathForConteo(id, path)) return fail("Ruta inválida.");

    const { data: line, error: lineError } = await resolved.supabase
      .from("cnt_conteo_lineas")
      .select("sku")
      .eq("id_conteo", id)
      .eq("sku", sku)
      .maybeSingle();
    if (lineError) throw lineError;
    if (!line) return fail("Esa línea no existe.", 404);

    const fileName = body.fileName?.trim() || path.split("/").pop() || "evidencia";
    const { error } = await resolved.supabase.from("cnt_evidencias").upsert(
      {
        id_conteo: id,
        sku,
        kind,
        path,
        nombre: fileName,
        mime: body.contentType?.trim() || mimeFromFileName(fileName) || null,
      },
      { onConflict: "path", ignoreDuplicates: true },
    );
    if (error) {
      console.error("evidencia put insert", error);
      if (/cnt_evidencias/.test(error.message)) {
        return fail("Falta la tabla de evidencias en la base. Corre db/patch-danado-y-evidencias.sql.", 500);
      }
      throw error;
    }

    await resolved.supabase.from("cnt_conteos").update({ status: "en_progreso" }).eq("id", id).eq("status", "pendiente");
    return ok({ saved: true, evidencias: await evidenciasFor(resolved.supabase, id, sku) });
  } catch (err) {
    console.error(err);
    return fail("No se pudo guardar la evidencia.", 500);
  }
}

/** Removes one file: a cnt_evidencias row, or a pre-patch single-file slot. */
export async function DELETE(request: Request, { params }: Params) {
  const auth = await requireSession();
  if ("response" in auth) return auth.response;
  const resolved = dbOrError();
  if ("response" in resolved) return resolved.response;
  const { id } = await params;
  try {
    const guard = await conteoParaEditar(resolved.supabase, id, auth.user, { capturaAbierta: true });
    if ("response" in guard) return guard.response;

    const body = (await request.json()) as { sku?: string; path?: string };
    const sku = body.sku?.trim() || "";
    const path = body.path?.trim() || "";
    if (!sku || !path || !pathForConteo(id, path)) return fail("SKU y archivo requeridos.");

    const { data: removed, error } = await resolved.supabase
      .from("cnt_evidencias")
      .delete()
      .eq("id_conteo", id)
      .eq("sku", sku)
      .eq("path", path)
      .select("path");
    if (error && !/cnt_evidencias/.test(error.message)) throw error;
    if (!removed?.length) {
      for (const [pathCol, ...rest] of LEGACY_SLOTS) {
        const cleared = Object.fromEntries([pathCol, ...rest].map((col) => [col, null]));
        const { error: legacyError } = await resolved.supabase
          .from("cnt_conteo_lineas")
          .update(cleared)
          .eq("id_conteo", id)
          .eq("sku", sku)
          .eq(pathCol, path);
        if (legacyError) throw legacyError;
      }
    }
    await removeEvidenceFiles(resolved.supabase, [path]);
    return ok({ removed: true, evidencias: await evidenciasFor(resolved.supabase, id, sku) });
  } catch (err) {
    console.error(err);
    return fail("No se pudo quitar la evidencia.", 500);
  }
}
