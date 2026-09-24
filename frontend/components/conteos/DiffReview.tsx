"use client";

import { useMemo, useState } from "react";
import { LineEvidence } from "@/components/conteos/EvidencePreview";
import DiffSortControls from "@/components/conteos/DiffSortControls";
import type { CountSession } from "@/lib/types";
import { lineDiff, lineMonto, sessionDiffStats } from "@/lib/types";
import { lineMatchesQuery, sortLines, type DiffSort } from "@/lib/conteos/diffSort";
import { formatQtyInput } from "@/lib/conteos/qtyMode";
import { cn, formatMoney } from "@/lib/utils";

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
  const [skuQuery, setSkuQuery] = useState("");
  const [sort, setSort] = useState<DiffSort>("monto");
  const stats = sessionDiffStats(session);
  const diffs = useMemo(() => {
    const withDiff = session.lines.filter((line) => {
      const diff = lineDiff(line);
      return diff != null && diff !== 0 && lineMatchesQuery(line, skuQuery);
    });
    return sortLines(withDiff, sort).map((line) => ({ line, diff: lineDiff(line), monto: lineMonto(line) }));
  }, [session.lines, skuQuery, sort]);

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
            {session.status === "enviado"
              ? "Cantidades enviadas."
              : session.capturaCerradaAt
                ? "La captura está cerrada. Estas son las cantidades que se enviarán."
                : "Cantidades capturadas hasta ahora."}
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
                        <LineEvidence session={session} line={line} className="mt-1.5" />
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
            : stats.skuCount === 0
              ? "Sin diferencias"
              : `${stats.skuCount} SKU con diferencia`}
        </h2>
        {captured && stats.skuCount > 0 ? (
          <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-fg">{formatMoney(stats.monto)}</p>
        ) : null}
        {captured && session.lines.every((line) => line.teorico === 0) ? (
          <p className="mt-2 text-sm text-fg-subtle">
            Aún no hay stock SAP (teórico 0). La diferencia de cada SKU es el físico ajustado.
          </p>
        ) : null}
        {!readOnly && stats.skuCount > 0 ? (
          <p className="mt-2 text-sm text-fg-subtle">Explica cada diferencia (positiva o negativa).</p>
        ) : null}
        {captured && stats.skuCount > 0 ? (
          <DiffSortControls className="mt-3" query={skuQuery} onQuery={setSkuQuery} sort={sort} onSort={setSort} />
        ) : null}
        {!captured ? (
          <p className="mt-2 text-sm text-fg-subtle">Todavía no hay cantidades capturadas.</p>
        ) : stats.skuCount === 0 ? (
          <p className="mt-2 text-sm text-fg-subtle">El físico ajustado coincide con el teórico SAP.</p>
        ) : diffs.length === 0 ? (
          <p className="mt-4 text-sm text-fg-subtle">Ningún SKU coincide con el filtro.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {diffs.map(({ line, diff, monto }) => {
              const missingComment = !readOnly && !(line.comentario ?? "").trim();
              return (
                <li key={line.sku} className="border-t border-line-subtle pt-4 first:border-t-0 first:pt-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] text-fg-faint">{line.sku}</p>
                      <p className="truncate text-sm text-fg">{line.nombre}</p>
                    </div>
                    <div
                      className={cn(
                        "shrink-0 text-right font-mono tabular-nums",
                        (diff ?? 0) < 0 ? "text-brand" : "text-emerald-600",
                      )}
                    >
                      <p className="text-sm font-semibold">
                        {(diff ?? 0) > 0 ? "+" : ""}
                        {formatQtyInput(diff ?? 0)} {line.um}
                      </p>
                      <p className="text-[11px]">{formatMoney(monto ?? 0)}</p>
                    </div>
                  </div>
                  <LineEvidence session={session} line={line} className="mt-2" />
                  {readOnly ? (
                    line.comentario ? (
                      <p className="mt-2 text-sm text-fg-subtle">{line.comentario}</p>
                    ) : (
                      <p className="mt-2 text-sm text-fg-faint">Sin comentario</p>
                    )
                  ) : (
                    <label className="mt-2 block">
                      <span className="field-label mb-1.5 block">Comentario</span>
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
