"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import PageHeader from "@/components/ui/PageHeader";
import SearchCombobox from "@/components/ui/SearchCombobox";
import { createUrgent, listProductos, listSucursales } from "@/lib/store";
import type { Producto, Sucursal } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function NuevoUrgentePage() {
  const router = useRouter();
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [sucursalId, setSucursalId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [skus, setSkus] = useState<string[]>([]);

  useEffect(() => {
    void Promise.all([listSucursales(), listProductos()]).then(([sucs, prods]) => {
      setSucursales(sucs);
      setProductos(prods);
      setSucursalId(sucs[0]?.id ?? "");
    });
  }, []);

  function toggle(sku: string) {
    setSkus((prev) => (prev.includes(sku) ? prev.filter((s) => s !== sku) : [...prev, sku]));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!sucursalId || skus.length === 0) {
      toast.error("Elige sucursal y al menos un producto.");
      return;
    }
    try {
      const { session, gerenteEmail } = await createUrgent({ sucursalId, titulo, skus });
      toast.success(`Urgente creado. Alerta a ${gerenteEmail ?? "gerente"} (correo pendiente).`);
      router.push(`/conteos/${session.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear.");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Administración"
        title="Nuevo conteo urgente"
        subtitle="Elige sucursal y productos. La tienda verá semáforo en rojo hasta enviarlo."
      />
      <form onSubmit={(e) => void onSubmit(e)} className="mx-auto max-w-2xl space-y-5">
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
        <div>
          <p className="field-label mb-2">Productos</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {productos.map((p) => {
              const on = skus.includes(p.sku);
              return (
                <li key={p.sku}>
                  <button
                    type="button"
                    onClick={() => toggle(p.sku)}
                    className={cn("w-full rounded-sm px-3 py-3 text-left", on ? "neu-nav-active text-white" : "neu-button text-fg")}
                  >
                    <span className="block font-mono text-[11px] opacity-80">{p.sku}</span>
                    <span className="text-sm font-semibold">{p.nombre}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <button type="submit" className="btn-primary w-full">
          Crear y avisar por correo
        </button>
      </form>
    </div>
  );
}
