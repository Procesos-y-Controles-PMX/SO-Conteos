"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import PageHeader from "@/components/ui/PageHeader";
import { getInventario, uploadInventario } from "@/lib/store";
import type { InventarioMeta, Producto } from "@/lib/types";
import { formatDateTime, formatNumber } from "@/lib/utils";

export default function InventarioAdminPage() {
  const [meta, setMeta] = useState<InventarioMeta | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [catalogCount, setCatalogCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    void getInventario().then((data) => {
      setMeta(data.meta);
      setProductos(data.productos ?? []);
      setCatalogCount(data.catalogCount ?? data.skuCount ?? 0);
    });
  }, []);

  const visible = useMemo(() => {
    const q = filter
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
    if (!q) return productos;
    return productos.filter((p) =>
      `${p.sucursalNombre ?? ""} ${p.sku} ${p.nombre} ${p.linea ?? ""}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .includes(q),
    );
  }, [filter, productos]);

  const storeCount = useMemo(() => new Set(productos.map((p) => p.sucursalId).filter(Boolean)).size, [productos]);

  if (!meta) return <p className="text-sm text-fg-subtle">Cargando…</p>;

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const data = await uploadInventario(file);
      setMeta(data.meta);
      setProductos(data.productos ?? []);
      setCatalogCount(data.catalogCount ?? data.skuCount ?? 0);
      const unmatched = data.unmatchedStores ?? [];
      toast.success(
        `${data.imported ?? 0} filas · ${data.matchedStores ?? 0} sucursales${
          data.skipped ? ` · ${data.skipped} omitidas` : ""
        }.`,
      );
      if (unmatched.length) {
        toast.warning(`Sin coincidencia: ${unmatched.slice(0, 8).join(", ")}${unmatched.length > 8 ? "…" : ""}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Administración"
        title="Inventario y costos"
        subtitle="Sube el inventario nacional SAP. El semanal usa L1–L12 (y líneas en blanco) de cada sucursal."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="neu-raised rounded-lg p-5">
          <p className="field-label">Última carga</p>
          <p className="mt-2 font-display text-xl font-semibold text-fg">
            {meta.lastUpdatedAt ? formatDateTime(meta.lastUpdatedAt) : "Sin carga"}
          </p>
          <p className="mt-1 truncate font-mono text-xs text-fg-subtle">
            {meta.lastFileName ?? "Sube inventario nacional.xls"}
          </p>
        </article>
        <article className="neu-raised rounded-lg p-5">
          <p className="field-label">SKUs / filas / sucursales</p>
          <p className="mt-2 font-display text-xl font-semibold tabular-nums text-fg">
            {catalogCount} / {productos.length} / {storeCount || "—"}
          </p>
          <p className="mt-1 text-sm text-fg-subtle">L1–L12 + sin tag · teórico por tienda.</p>
        </article>
      </div>

      <label className="neu-raised mt-6 flex max-w-xl cursor-pointer flex-col items-center gap-2 rounded-lg px-6 py-8">
        <span className="font-display text-lg font-semibold text-fg">
          {uploading ? "Leyendo archivo…" : "Subir inventario nacional"}
        </span>
        <span className="text-center text-sm text-fg-subtle">
          Excel SAP (todas las sucursales). Columna C = sucursal; Línea L01–L12 o vacía.
        </span>
        <input
          type="file"
          accept=".xlsx,.xls,.csv,.tsv,.txt"
          className="hidden"
          disabled={uploading}
          onChange={(e) => void onFile(e)}
        />
      </label>

      {productos.length > 0 ? (
        <input
          className="input-field mt-8 max-w-xl"
          placeholder="Filtrar por sucursal, SKU, producto o línea…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      ) : null}

      <div className="neu-raised mt-4 overflow-x-auto rounded-lg">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-wider text-fg-faint">
              <th className="px-4 py-3">Sucursal</th>
              <th className="px-4 py-3">Línea</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">UM</th>
              <th className="px-4 py-3 text-right">Teórico</th>
              <th className="px-4 py-3 text-right">Costo</th>
            </tr>
          </thead>
          <tbody>
            {productos.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-fg-subtle">
                  Sin carga SAP. Sube el inventario nacional para armar el surtido por sucursal.
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-fg-subtle">
                  Ninguna fila coincide con el filtro.
                </td>
              </tr>
            ) : (
              visible.map((p) => (
                <tr key={`${p.sucursalId ?? ""}-${p.sku}`} className="border-t border-line-subtle">
                  <td className="px-4 py-2.5">{p.sucursalNombre ?? "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-fg-subtle">{p.linea || "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{p.sku}</td>
                  <td className="px-4 py-2.5">{p.nombre}</td>
                  <td className="px-4 py-2.5 text-fg-subtle">{p.um}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatNumber(p.teorico, 0)}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatNumber(p.costo, 2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
