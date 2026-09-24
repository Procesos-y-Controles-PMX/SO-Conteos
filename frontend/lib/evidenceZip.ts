"use client";

import { zip, type Zippable } from "fflate";

type ZipFile = { name: string; url: string };

async function listFiles(ids: string[]): Promise<ZipFile[]> {
  const res = await fetch("/api/admin/evidencia/zip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  let body: { ok?: boolean; message?: string; files?: ZipFile[] };
  try {
    body = await res.json();
  } catch {
    throw new Error(`Error de servidor (${res.status}).`);
  }
  if (!res.ok || body.ok === false) throw new Error(body.message ?? `Error de servidor (${res.status}).`);
  return body.files ?? [];
}

function uniqueName(name: string, taken: Set<string>) {
  if (!taken.has(name)) return name;
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let n = 2;
  while (taken.has(`${base}-${n}${ext}`)) n += 1;
  return `${base}-${n}${ext}`;
}

/**
 * Downloads every evidence file of the given counts and saves them as one ZIP.
 * Returns how many files went in; 0 means there was nothing to download.
 */
export async function downloadEvidenceZip(
  ids: string[],
  fileName: string,
  onProgress?: (done: number, total: number) => void,
): Promise<{ added: number; failed: number }> {
  const files = await listFiles(ids);
  if (!files.length) return { added: 0, failed: 0 };

  const entries: Zippable = {};
  const taken = new Set<string>();
  let done = 0;
  let failed = 0;
  let cursor = 0;
  onProgress?.(0, files.length);

  async function worker() {
    while (cursor < files.length) {
      const file = files[cursor++];
      try {
        const res = await fetch(file.url);
        if (!res.ok) throw new Error(String(res.status));
        const data = new Uint8Array(await res.arrayBuffer());
        const name = uniqueName(file.name, taken);
        taken.add(name);
        // Photos and videos are already compressed.
        entries[name] = [data, { level: 0 }];
      } catch {
        failed += 1;
      }
      done += 1;
      onProgress?.(done, files.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, files.length) }, worker));

  const added = files.length - failed;
  if (!added) throw new Error("No se pudo descargar ninguna evidencia.");

  const archive = await new Promise<Uint8Array>((resolve, reject) => {
    zip(entries, (err, data) => (err ? reject(err) : resolve(data)));
  });
  const blob = new Blob([archive as BlobPart], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".zip") ? fileName : `${fileName}.zip`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { added, failed };
}
