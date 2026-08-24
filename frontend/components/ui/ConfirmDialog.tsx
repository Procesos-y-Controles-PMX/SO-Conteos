"use client";

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
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Cerrar" onClick={onCancel} />
      <div className="neu-raised relative z-10 w-full max-w-md rounded-lg p-5">
        <h2 className="font-display text-lg font-semibold text-fg">{title}</h2>
        <p className="mt-2 text-sm text-fg-subtle">{body}</p>
        <div className="mt-5 flex gap-3">
          <button type="button" className="btn-secondary flex-1" disabled={pending} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="btn-primary flex-1" disabled={pending} onClick={onConfirm}>
            {pending ? "Borrando…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
