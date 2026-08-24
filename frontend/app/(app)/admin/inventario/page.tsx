"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import PageHeader from "@/components/ui/PageHeader";
import { getInventario, setIgnoreUploadWindow, uploadInventario } from "@/lib/store";
import type { InventarioMeta, Producto } from "@/lib/types";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { isWithinUploadWindow } from "@/lib/week";

export default function InventarioAdminPage() {
  const [meta, setMeta] = useState<InventarioMeta | null>(null);
  const [ignore, setIgnore] = useState(false);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [catalogCount, setCatalogCount] = useState(0);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    void getInventario().then((data) => {
      setMeta(data.meta);
      setIgnore(data.ignoreUploadWindow);
      setProductos(data.productos ?? []);
      setCatalogCount(data.catalogCount ?? data.skuCount ?? 0);
    });
  }, []);

  if (!meta) return <p className="text-sm text-fg-subtle">Cargando…</p>;

  const open = ignore || isWithinUploadWindow(meta.uploadWindowStart, meta.uploadWindowEnd);

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!open) {
      toast.error("Carga bloqueada fuera de horario.");
      return;
    }
    setUploading(true);
    try {
      const data = await uploadInventario(file);
      setMeta(data.meta);
      setProductos(data.productos ?? []);
      setCatalogCount(data.catalogCount ?? data.skuCount ?? 0);
      toast.success(`${data.imported ?? 0} SKUs SAP cargados${data.skipped ? ` · ${data.skipped} omitidos` : ""}.`);
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
        subtitle="El semanal cuenta polvos (cementos y morteros). Este archivo es el stock SAP para el diff."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <article className="neu-raised rounded-lg p-5">
          <p className="field-label">Última carga</p>
          <p className="mt-2 font-display text-xl font-semibold text-fg">
            {meta.lastUpdatedAt ? formatDateTime(meta.lastUpdatedAt) : "Sin carga"}
          </p>
          <p className="mt-1 truncate font-mono text-xs text-fg-subtle">
            {meta.lastFileName ?? "Sube el Excel SAP del día."}
          </p>
        </article>
        <article className="neu-raised rounded-lg p-5">
          <p className="field-label">Horario</p>
          <p className="mt-2 font-display text-xl font-semibold text-fg">
            {meta.uploadWindowStart} – {meta.uploadWindowEnd}
          </p>
          <p className="mt-1 text-sm text-fg-subtle">México · {open ? "ventana abierta" : "ventana cerrada"}</p>
        </article>
        <article className="neu-raised rounded-lg p-5">
          <p className="field-label">Catálogo / SAP</p>
          <p className="mt-2 font-display text-xl font-semibold tabular-nums text-fg">
            {catalogCount} / {productos.length}
          </p>
          <p className="mt-1 text-sm text-fg-subtle">Cementos/morteros a contar · Excel solo para el diff.</p>
        </article>
      </div>

      <label
        className={`mt-6 flex max-w-xl cursor-pointer flex-col items-center gap-2 rounded-lg px-6 py-8 ${open ? "neu-raised" : "neu-pressed opacity-70"}`}
      >
        <span className="font-display text-lg font-semibold text-fg">
          {uploading ? "Leyendo archivo…" : open ? "Subir Excel o CSV" : "Carga bloqueada"}
        </span>
        <span className="text-center text-sm text-fg-subtle">
          Encabezados: SKU / Material, Descripción, U.M., teórico o stock, costo.
        </span>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          disabled={!open || uploading}
          onChange={(e) => void onFile(e)}
        />
      </label>

      <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm text-fg-muted">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0"
          checked={ignore}
          onChange={(e) => {
            const value = e.target.checked;
            setIgnore(value);
            void setIgnoreUploadWindow(value);
          }}
        />
        <span>
          Ignorar horario (pruebas)
          {!open ? (
            <span className="mt-0.5 block text-xs text-fg-faint">
              Márcalo para poder subir el archivo fuera de las 05:00–08:00.
            </span>
          ) : null}
        </span>
      </label>

      <div className="neu-raised mt-8 overflow-x-auto rounded-lg">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-wider text-fg-faint">
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
                <td colSpan={5} className="px-4 py-10 text-center text-fg-subtle">
                  Sin carga SAP. El conteo usa el catálogo de Cotizador; el teórico queda en 0.
                </td>
              </tr>
            ) : (
              productos.map((p) => (
                <tr key={p.sku} className="border-t border-line-subtle">
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
