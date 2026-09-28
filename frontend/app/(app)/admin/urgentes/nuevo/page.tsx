"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import PageHeader from "@/components/ui/PageHeader";
import SearchCombobox from "@/components/ui/SearchCombobox";
import { createUrgent, listProductos, listSucursales } from "@/lib/store";
import { URGENTE_MAX_SKUS, type Producto, type Sucursal } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function NuevoUrgentePage() {
  const router = useRouter();
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loadingProductos, setLoadingProductos] = useState(false);
  const [sucursalId, setSucursalId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [skus, setSkus] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState("");
  const [linea, setLinea] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void listSucursales().then((sucs) => {
      setSucursales(sucs);
      setSucursalId((prev) => prev || sucs[0]?.id || "");
    });
  }, []);

  useEffect(() => {
    if (!sucursalId) {
      setProductos([]);
      return;
    }
    setLoadingProductos(true);
    void listProductos(sucursalId, "todos")
      .then((prods) => {
        setProductos(prods);
        const valid = new Set(prods.map((p) => p.sku));
        setSkus((prev) => new Set([...prev].filter((sku) => valid.has(sku))));
      })
      .catch((err: Error) => toast.error(err.message))
      .finally(() => setLoadingProductos(false));
  }, [sucursalId]);

  const lineas = useMemo(
    () => [...new Set(productos.map((p) => p.linea || ""))].sort((a, b) => a.localeCompare(b, "es", { numeric: true })),
    [productos],
  );

  const visible = useMemo(() => {
    const q = fold(filter);
    return productos.filter((p) => {
      if (linea && (p.linea || "") !== linea) return false;
      return !q || fold(`${p.sku} ${p.nombre}`).includes(q);
    });
  }, [productos, filter, linea]);

  const allVisibleOn = visible.length > 0 && visible.every((p) => skus.has(p.sku));
  const afterSelectVisible = useMemo(
    () => new Set([...skus, ...visible.map((p) => p.sku)]).size,
    [skus, visible],
  );
  const selectVisibleFits = afterSelectVisible <= URGENTE_MAX_SKUS;
  const atCap = skus.size >= URGENTE_MAX_SKUS;

  function toggle(sku: string) {
    if (!skus.has(sku) && atCap) {
      toast.error(`Máximo ${URGENTE_MAX_SKUS} SKUs por urgente.`);
      return;
    }
    setSkus((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  }

  function selectVisible() {
    if (!selectVisibleFits) {
      toast.error(`Serían ${formatNumber(afterSelectVisible, 0)} SKUs; el máximo es ${URGENTE_MAX_SKUS}. Filtra más.`);
      return;
    }
    setSkus((prev) => new Set([...prev, ...visible.map((p) => p.sku)]));
  }

  function clearVisible() {
    const off = new Set(visible.map((p) => p.sku));
    setSkus((prev) => new Set([...prev].filter((sku) => !off.has(sku))));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!sucursalId || skus.size === 0) {
      toast.error("Elige sucursal y al menos un producto.");
      return;
    }
    setCreating(true);
    try {
      const { session, gerenteEmail } = await createUrgent({ sucursalId, titulo, skus: [...skus] });
      toast.success(`Urgente creado. Alerta a ${gerenteEmail ?? "gerente"} (correo pendiente).`);
      router.push(`/conteos/${session.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear.");
      setCreating(false);
    }
  }

  const filtered = Boolean(filter.trim() || linea);

  return (
    <div>
      <PageHeader
        eyebrow="Administración"
        title="Nuevo conteo urgente"
        subtitle="Elige sucursal y productos. Aquí aparecen todos los SKUs de la tienda, no solo los del semanal."
      />
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2 xl:max-w-3xl">
          <label className="block">
            <span className="field-label mb-1.5 block">Sucursal</span>
            <SearchCombobox
              minChars={0}
              clearOnType={false}
              placeholder="Buscar sucursal…"
              value={
                sucursales.find((s) => s.id === sucursalId)
                  ? {
                      id: sucursalId,
                      label: sucursales.find((s) => s.id === sucursalId)!.nombre,
                      sublabel: sucursales.find((s) => s.id === sucursalId)!.zona,
                    }
                  : null
              }
              onChange={(opt) => setSucursalId(opt?.id ?? "")}
              onSearch={(query) => {
                const q = query.trim().toLowerCase();
                return sucursales
                  .filter((s) => !q || `${s.nombre} ${s.zona}`.toLowerCase().includes(q))
                  .slice(0, 40)
                  .map((s) => ({ id: s.id, label: s.nombre, sublabel: s.zona }));
              }}
            />
          </label>
          <label className="block">
            <span className="field-label mb-1.5 block">Título</span>
            <input
              className="input-field"
              placeholder="Urgente · varilla"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </label>
        </div>
        <div>
          <p className="field-label mb-2">
            Productos · {formatNumber(skus.size, 0)} seleccionados (máximo {URGENTE_MAX_SKUS}) ·{" "}
            {formatNumber(productos.length, 0)} en la tienda
          </p>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              className="input-field max-w-sm flex-1"
              placeholder="Buscar SKU o producto…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <select className="input-field w-auto" value={linea} onChange={(e) => setLinea(e.target.value)}>
              <option value="">Todas las líneas</option>
              {lineas.map((l) => (
                <option key={l || "_"} value={l}>
                  {l || "Sin línea"}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="neu-button rounded-sm px-3 py-2 text-sm font-semibold text-fg"
              disabled={visible.length === 0 || allVisibleOn || !selectVisibleFits}
              title={selectVisibleFits ? undefined : `Filtra hasta que queden ${URGENTE_MAX_SKUS} o menos`}
              onClick={selectVisible}
            >
              {filtered ? `Seleccionar estos (${formatNumber(visible.length, 0)})` : "Seleccionar todos"}
            </button>
            <button
              type="button"
              className="neu-button rounded-sm px-3 py-2 text-sm font-semibold text-fg"
              disabled={skus.size === 0}
              onClick={filtered ? clearVisible : () => setSkus(new Set())}
            >
              {filtered ? "Quitar estos" : "Quitar todos"}
            </button>
          </div>
          {!selectVisibleFits && !allVisibleOn ? (
            <p className="mb-3 text-sm text-fg-subtle">
              Para seleccionar en bloque, filtra por línea o búsqueda hasta que queden {URGENTE_MAX_SKUS} SKUs o menos.
            </p>
          ) : null}
          {loadingProductos ? (
            <p className="text-sm text-fg-subtle">Cargando productos…</p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-fg-subtle">
              {productos.length ? "Ningún producto coincide." : "Esta sucursal no tiene inventario cargado."}
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
              {visible.map((p) => {
                const on = skus.has(p.sku);
                return (
                  <li key={p.sku}>
                    <button
                      type="button"
                      onClick={() => toggle(p.sku)}
                      className={cn(
                        "flex h-full w-full flex-col rounded-sm px-3 py-2.5 text-left",
                        on ? "neu-nav-active text-white" : "neu-button text-fg",
                      )}
                    >
                      <span className="block font-mono text-[11px] opacity-80">
                        {p.sku}
                        {p.linea ? ` · ${p.linea}` : ""}
                      </span>
                      <span className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug">{p.nombre}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <button type="submit" className="btn-primary w-full sm:w-auto sm:min-w-64" disabled={creating}>
          {creating ? "Creando…" : "Crear y avisar por correo"}
        </button>
      </form>
    </div>
  );
}
