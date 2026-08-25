"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Borrar",
  cancelLabel = "Cancelar",
  pending = false,
  onConfirm,
  onCancel,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pb-[max(1.25rem,calc(6rem+env(safe-area-inset-bottom)))] lg:pb-4">
      <button type="button" className="absolute inset-0 bg-black/65" aria-label="Cerrar" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="neu-raised relative z-10 w-full max-w-md rounded-lg p-5"
      >
        <h2 id="confirm-dialog-title" className="font-display text-lg font-semibold text-fg">
          {title}
        </h2>
        <p className="mt-2 text-sm text-fg-subtle">{body}</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:gap-3">
          <button
            type="button"
            className="neu-button min-h-11 flex-1 rounded-sm px-4 text-sm font-semibold text-fg"
            disabled={pending}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button type="button" className="btn-primary flex-1" disabled={pending} onClick={onConfirm}>
            {pending ? "Borrando…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
