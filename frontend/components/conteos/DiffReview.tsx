"use client";

import type { CountSession } from "@/lib/types";
import { lineDiff } from "@/lib/types";
import { formatQtyInput } from "@/lib/conteos/qtyMode";
import { cn } from "@/lib/utils";

export default function DiffReview({
  session,
  comentario,
  onComentario,
  readOnly,
}: {
  session: CountSession;
  comentario: string;
  onComentario: (value: string) => void;
  readOnly?: boolean;
}) {
  const captured = session.lines.some((line) => line.fisico != null);
  const diffs = session.lines
    .map((line) => ({ line, diff: lineDiff(line) }))
    .filter((row) => row.diff != null && row.diff !== 0);

  return (
    <div className="mx-auto w-full max-w-lg space-y-4">
      <div className="neu-raised rounded-lg p-5">
        <p className="field-label">Diferencias vs SAP</p>
        <h2 className="mt-1 font-display text-xl font-semibold text-fg">
          {!captured
            ? "Sin captura"
            : diffs.length === 0
              ? "Sin diferencias"
              : `${diffs.length} SKU con diferencia`}
        </h2>
        {captured && session.lines.every((line) => line.teorico === 0) ? (
          <p className="mt-2 text-sm text-fg-subtle">
            Aún no hay stock SAP (teórico 0). La diferencia de cada SKU es el físico ajustado: si contaste 12, verás +12.
          </p>
        ) : null}
        {!captured ? (
          <p className="mt-2 text-sm text-fg-subtle">Todavía no hay cantidades capturadas.</p>
        ) : diffs.length === 0 ? (
          <p className="mt-2 text-sm text-fg-subtle">El físico ajustado coincide con el teórico SAP.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line-subtle">
            {diffs.map(({ line, diff }) => (
              <li key={line.sku} className="flex items-baseline justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] text-fg-faint">{line.sku}</p>
                  <p className="truncate text-sm text-fg">{line.nombre}</p>
                </div>
                <p
                  className={cn(
                    "shrink-0 font-mono text-sm font-semibold tabular-nums",
                    (diff ?? 0) < 0 ? "text-brand" : "text-emerald-600",
                  )}
                >
                  {(diff ?? 0) > 0 ? "+" : ""}
                  {formatQtyInput(diff ?? 0)} {line.um}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {readOnly ? (
        comentario ? (
          <div className="neu-raised rounded-lg p-5">
            <p className="field-label">Comentario</p>
            <p className="mt-2 text-sm text-fg">{comentario}</p>
          </div>
        ) : null
      ) : (
        <label className="neu-raised block rounded-lg p-5">
          <span className="field-label mb-1.5 block">Comentario de sucursal</span>
          <textarea
            className="input-field min-h-24"
            placeholder="Aclarar faltantes, traslados, mercancía en piso…"
            value={comentario}
            onChange={(e) => onComentario(e.target.value)}
          />
        </label>
      )}
    </div>
  );
}
