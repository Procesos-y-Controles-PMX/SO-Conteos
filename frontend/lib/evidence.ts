import type { SupabaseClient } from "@supabase/supabase-js";
import type { EvidenceKind } from "@/lib/types";

export const EVIDENCE_BUCKET = "cnt-evidencia";
export const DEFAULT_EVIDENCE_RETENTION_DAYS = 14;
export const EVIDENCE_MAX_BYTES = 25 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  gif: "image/gif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

export function mimeFromFileName(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return EXT_MIME[ext] || "";
}

export function isAllowedEvidenceMime(mime: string, fileName?: string) {
  const type = mime.trim().toLowerCase() || mimeFromFileName(fileName || "");
  return ALLOWED_MIME.has(type) || type.startsWith("image/") || type.startsWith("video/");
}

export function isImageMime(mime?: string) {
  return (mime ?? "").toLowerCase().startsWith("image/");
}

export function safeEvidenceSku(sku: string) {
  return sku.trim().replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "sku";
}

export function evidenceObjectPath(
  conteoId: string,
  sku: string,
  fileName: string,
  kind: EvidenceKind = "general",
) {
  const ext = (fileName.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 8) || "bin";
  const slot = kind === "general" ? "ev" : kind;
  return `${conteoId}/${safeEvidenceSku(sku)}/${slot}-${crypto.randomUUID()}.${ext}`;
}

export function evidencePrefix(conteoId: string) {
  return `${conteoId}/`;
}

export async function evidenceRetentionDays(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase.from("cnt_ajustes").select("valor").eq("clave", "evidencia_retention_days").maybeSingle();
  const raw = data?.valor;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_EVIDENCE_RETENTION_DAYS;
  return Math.min(365, Math.round(n));
}

export function evidenceCutoffIso(days: number, now = new Date()) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function ensureEvidenceBucket(supabase: SupabaseClient) {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;
  if (buckets?.some((b) => b.id === EVIDENCE_BUCKET || b.name === EVIDENCE_BUCKET)) return;
  const { error: createError } = await supabase.storage.createBucket(EVIDENCE_BUCKET, {
    public: false,
    fileSizeLimit: EVIDENCE_MAX_BYTES,
  });
  if (createError && !/already exists/i.test(createError.message)) throw createError;
}

type EvidenceRow = {
  id_conteo: string;
  sku: string;
  evidencia_path: string | null;
};

async function clearEvidenceRows(
  supabase: SupabaseClient,
  rows: Array<{ id_conteo: string; sku: string }>,
) {
  for (const row of rows) {
    await supabase
      .from("cnt_conteo_lineas")
      .update({ evidencia_path: null, evidencia_nombre: null, evidencia_at: null, evidencia_mime: null })
      .eq("id_conteo", row.id_conteo)
      .eq("sku", row.sku);
  }
}

export async function removeEvidenceFiles(supabase: SupabaseClient, paths: string[]) {
  const clean = paths.filter(Boolean);
  if (!clean.length) return;
  for (let i = 0; i < clean.length; i += 50) {
    const { error } = await supabase.storage.from(EVIDENCE_BUCKET).remove(clean.slice(i, i + 50));
    if (error) console.error("evidence remove", error.message);
  }
}

export async function purgeExpiredEvidence(supabase: SupabaseClient, conteoId?: string) {
  const days = await evidenceRetentionDays(supabase);
  const cutoff = evidenceCutoffIso(days);
  let q = supabase
    .from("cnt_conteo_lineas")
    .select("id_conteo, sku, evidencia_path")
    .not("evidencia_path", "is", null)
    .lt("evidencia_at", cutoff);
  if (conteoId) q = q.eq("id_conteo", conteoId);
  const { data, error } = await q;
  if (error) {
    if (/evidencia_path|evidencia_at/.test(error.message)) {
      return { days, cutoff, scanned: 0, purged: 0 };
    }
    throw error;
  }
  const rows = (data ?? []) as EvidenceRow[];
  const paths = rows.map((row) => row.evidencia_path).filter((p): p is string => Boolean(p));
  await removeEvidenceFiles(supabase, paths);
  await clearEvidenceRows(
    supabase,
    rows.map((row) => ({ id_conteo: row.id_conteo, sku: row.sku })),
  );

  // Same retention for físico photos stored in cnt_evidencias.
  let extraQ = supabase.from("cnt_evidencias").select("id, path").eq("kind", "general").lt("created_at", cutoff);
  if (conteoId) extraQ = extraQ.eq("id_conteo", conteoId);
  const { data: extra, error: extraError } = await extraQ;
  if (extraError && !/cnt_evidencias/.test(extraError.message)) throw extraError;
  const extraRows = (extra ?? []) as Array<{ id: string; path: string }>;
  if (extraRows.length) {
    await removeEvidenceFiles(supabase, extraRows.map((row) => row.path));
    await supabase.from("cnt_evidencias").delete().in("id", extraRows.map((row) => row.id));
  }
  return { days, cutoff, scanned: rows.length + extraRows.length, purged: paths.length + extraRows.length };
}

export async function removeConteoEvidence(supabase: SupabaseClient, conteoId: string) {
  const [{ data, error }, { data: extra, error: extraError }] = await Promise.all([
    supabase
      .from("cnt_conteo_lineas")
      .select("evidencia_path, evidencia_entregar_path, evidencia_facturar_path")
      .eq("id_conteo", conteoId),
    supabase.from("cnt_evidencias").select("path").eq("id_conteo", conteoId),
  ]);
  if (error && !/evidencia_/.test(error.message)) throw error;
  if (extraError && !/cnt_evidencias/.test(extraError.message)) throw extraError;
  const legacy = (data ?? []) as Array<Record<string, string | null>>;
  const paths = [
    ...legacy.flatMap((row) => [row.evidencia_path, row.evidencia_entregar_path, row.evidencia_facturar_path]),
    ...((extra ?? []) as Array<{ path: string }>).map((row) => row.path),
  ].filter((p): p is string => Boolean(p));
  await removeEvidenceFiles(supabase, paths);
}
