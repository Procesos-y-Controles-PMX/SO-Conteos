"use client";

import { DIFF_SORT_LABEL, type DiffSort } from "@/lib/conteos/diffSort";
import { cn } from "@/lib/utils";

export default function DiffSortControls({
  query,
  onQuery,
  sort,
  onSort,
  className,
}: {
  query: string;
  onQuery: (value: string) => void;
  sort: DiffSort;
  onSort: (value: DiffSort) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <label className="min-w-40 flex-1">
        <span className="sr-only">Buscar SKU</span>
        <input
          className="input-field"
          placeholder="Buscar SKU o producto…"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
      </label>
      <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Ordenar">
        <span className="field-label mr-1">Ordenar</span>
        {(Object.keys(DIFF_SORT_LABEL) as DiffSort[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={sort === key}
            className={cn(
              "rounded-sm px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide",
              sort === key ? "neu-pressed text-fg" : "neu-button text-fg-subtle",
            )}
            onClick={() => onSort(key)}
          >
            {DIFF_SORT_LABEL[key]}
          </button>
        ))}
      </div>
    </div>
  );
}
