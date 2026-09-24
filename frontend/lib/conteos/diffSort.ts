import { lineDiff, lineMonto, type CountLine } from "@/lib/types";

export type DiffSort = "monto" | "sku";

export const DIFF_SORT_LABEL: Record<DiffSort, string> = {
  monto: "Monto",
  sku: "SKU",
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function lineMatchesQuery(line: CountLine, query: string) {
  const q = normalize(query);
  return !q || normalize(`${line.sku} ${line.nombre}`).includes(q);
}

/** monto: largest absolute amount first (then quantity); sku: ascending code. */
export function sortLines(lines: CountLine[], sort: DiffSort): CountLine[] {
  return lines.slice().sort((a, b) => {
    if (sort === "sku") return a.sku.localeCompare(b.sku, "es", { numeric: true });
    const byMonto = Math.abs(lineMonto(b) ?? 0) - Math.abs(lineMonto(a) ?? 0);
    if (byMonto !== 0) return byMonto;
    return Math.abs(lineDiff(b) ?? 0) - Math.abs(lineDiff(a) ?? 0);
  });
}
