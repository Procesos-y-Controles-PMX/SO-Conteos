"use client";

import type { CountSession } from "@/lib/types";
import { lineDiff } from "@/lib/types";
import { formatQtyInput } from "@/lib/conteos/qtyMode";
import { cn } from "@/lib/utils";

function qtyLabel(value: number | null | undefined) {
  if (value == null) return "—";
  return formatQtyInput(value);
}

export default function DiffReview({
  session,
  mode = "captura",
  onLineComment,
  readOnly,
}: {
  session: CountSession;
  /** captura = físico + pendientes; diferencias = solo diffs con comentarios */
  mode?: "captura" | "diferencias";
  onLineComment?: (sku: string, comentario: string) => void;
  readOnly?: boolean;
}) {
  const captured = session.lines.some((line) => line.fisico != null);
  const diffs = session.lines
    .map((line) => ({ line, diff: lineDiff(line) }))
    .filter((row) => row.diff != null && row.diff !== 0);

  if (mode === "captura") {
    return (
      <div className="mx-auto w-full max-w-lg space-y-4">
        <div className="neu-raised rounded-lg p-5">
          <p className="field-label">Tu captura</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-fg">
            {!captured
              ? "Sin captura"
              : `${session.lines.filter((l) => l.fisico != null).length} SKUs capturados`}
          </h2>
          <p className="mt-2 text-sm text-fg-subtle">
            Revisa físico y pendientes. Si algo está mal, vuelve a corregir antes de continuar.
          </p>
          {!captured ? (
            <p className="mt-4 text-sm text-fg-subtle">Todavía no hay cantidades capturadas.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-fg-faint">
                    <th className="pb-2 pr-3">Producto</th>
                    <th className="pb-2 pr-3 text-right">Físico</th>
                    <th className="pb-2 pr-3 text-right">Pend. ent.</th>
                    <th className="pb-2 text-right">Pend. fact.</th>
                  </tr>
                </thead>
                <tbody>
                  {session.lines.map((line) => (
                    <tr key={line.sku} className="border-t border-line-subtle">
                      <td className="py-2.5 pr-3">
                        <p className="font-mono text-[11px] text-fg-faint">{line.sku}</p>
                        <p className="truncate text-sm text-fg">{line.nombre}</p>
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono text-sm tabular-nums text-fg">
                        {qtyLabel(line.fisico)}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono text-sm tabular-nums text-fg">
                        {qtyLabel(line.pendienteEntregar)}
                      </td>
                      <td className="py-2.5 text-right font-mono text-sm tabular-nums text-fg">
                        {qtyLabel(line.pendienteFacturar)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

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
            Aún no hay stock SAP (teórico 0). La diferencia de cada SKU es el físico ajustado.
          </p>
        ) : null}
        {!readOnly && diffs.length > 0 ? (
          <p className="mt-2 text-sm text-fg-subtle">
            Explica cada diferencia (positiva o negativa). Sin comentario no se puede enviar.
          </p>
        ) : null}
        {!captured ? (
          <p className="mt-2 text-sm text-fg-subtle">Todavía no hay cantidades capturadas.</p>
        ) : diffs.length === 0 ? (
          <p className="mt-2 text-sm text-fg-subtle">El físico ajustado coincide con el teórico SAP.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {diffs.map(({ line, diff }) => {
              const missingComment = !readOnly && !(line.comentario ?? "").trim();
              return (
                <li key={line.sku} className="border-t border-line-subtle pt-4 first:border-t-0 first:pt-0">
                  <div className="flex items-baseline justify-between gap-3">
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
                  </div>
                  {readOnly ? (
                    line.comentario ? (
                      <p className="mt-2 text-sm text-fg-subtle">{line.comentario}</p>
                    ) : (
                      <p className="mt-2 text-sm text-fg-faint">Sin comentario</p>
                    )
                  ) : (
                    <label className="mt-2 block">
                      <span className="field-label mb-1.5 block">
                        Comentario {missingComment ? "(requerido)" : ""}
                      </span>
                      <textarea
                        className={cn("input-field min-h-20", missingComment && "ring-1 ring-brand/40")}
                        placeholder="¿Por qué hay esta diferencia?"
                        value={line.comentario ?? ""}
                        onChange={(e) => onLineComment?.(line.sku, e.target.value)}
                        required
                      />
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
