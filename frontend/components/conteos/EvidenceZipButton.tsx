"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { downloadEvidenceZip } from "@/lib/evidenceZip";
import { cn } from "@/lib/utils";

export default function EvidenceZipButton({
  ids,
  fileName,
  label = "Descargar fotos (ZIP)",
  className,
}: {
  ids: string[];
  fileName: string;
  label?: string;
  className?: string;
}) {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const busy = progress !== null;

  async function run() {
    setProgress({ done: 0, total: 0 });
    try {
      const result = await downloadEvidenceZip(ids, fileName, (done, total) => setProgress({ done, total }));
      if (result.added === 0) toast.message("No hay fotos de evidencia para descargar.");
      else if (result.failed > 0) {
        toast.warning(`ZIP con ${result.added} archivo(s). ${result.failed} no se pudieron descargar.`);
      } else toast.success(`ZIP con ${result.added} archivo(s).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo armar el ZIP.");
    } finally {
      setProgress(null);
    }
  }

  return (
    <button
      type="button"
      className={cn("btn-secondary gap-2", className)}
      disabled={busy || ids.length === 0}
      onClick={() => void run()}
    >
      <Download className="h-4 w-4" />
      {busy ? (progress.total ? `Descargando ${progress.done}/${progress.total}…` : "Preparando…") : label}
    </button>
  );
}
