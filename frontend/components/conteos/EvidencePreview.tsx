"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ImageIcon, Video } from "lucide-react";
import { isImageMime } from "@/lib/evidence";
import { evidenceViewUrl } from "@/lib/store";
import type { CountLine, CountSession, EvidenceKind } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function EvidencePreview({
  sessionId,
  sku,
  kind = "general",
  mime,
  name,
  label,
}: {
  sessionId: string;
  sku: string;
  kind?: EvidenceKind;
  mime?: string;
  name?: string;
  label?: string;
}) {
  const href = evidenceViewUrl(sessionId, sku, kind);
  const image = isImageMime(mime);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const caption = label || name || "Ver evidencia";

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (image) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="neu-button inline-flex max-w-full items-center gap-1.5 rounded-sm px-2 py-1 text-[11px] font-semibold text-fg"
        >
          <ImageIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{caption}</span>
        </button>
        {mounted && open
          ? createPortal(
              <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                <button
                  type="button"
                  className="absolute inset-0 bg-black/75"
                  aria-label="Cerrar"
                  onClick={() => setOpen(false)}
                />
                <div className="relative z-10 max-h-[90vh] w-full max-w-3xl">
                  <img src={href} alt={caption} className="max-h-[85vh] w-full rounded-lg object-contain" />
                  <button type="button" className="btn-secondary mt-3 w-full" onClick={() => setOpen(false)}>
                    Cerrar
                  </button>
                </div>
              </div>,
              document.body,
            )
          : null}
      </>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="neu-button inline-flex max-w-full items-center gap-1.5 rounded-sm px-2 py-1 text-[11px] font-semibold text-fg"
    >
      <Video className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{caption}</span>
    </a>
  );
}

export function LineEvidence({
  session,
  line,
  className,
}: {
  session: CountSession;
  line: CountLine;
  className?: string;
}) {
  type Slot = { kind: EvidenceKind; path?: string; mime?: string; name?: string; label: string };
  const all: Slot[] = [
    { kind: "general", path: line.evidenciaPath, mime: line.evidenciaMime, name: line.evidencia, label: "Foto" },
    {
      kind: "entregar",
      path: line.evidenciaEntregarPath,
      mime: line.evidenciaEntregarMime,
      name: line.evidenciaEntregar,
      label: "Entregar",
    },
    {
      kind: "facturar",
      path: line.evidenciaFacturarPath,
      mime: line.evidenciaFacturarMime,
      name: line.evidenciaFacturar,
      label: "Facturar",
    },
  ];
  const slots = all.filter((slot) => Boolean(slot.path));

  if (slots.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {slots.map((slot) => (
        <EvidencePreview
          key={slot.kind}
          sessionId={session.id}
          sku={line.sku}
          kind={slot.kind}
          mime={slot.mime}
          name={slot.name}
          label={slot.label}
        />
      ))}
    </div>
  );
}
