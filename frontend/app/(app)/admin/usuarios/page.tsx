"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { listSucursalesConUsuarios } from "@/lib/store";
import type { Sucursal } from "@/lib/types";

export default function UsuariosPage() {
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);

  useEffect(() => {
    void listSucursalesConUsuarios().then(setSucursales);
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="Administración"
        title="Cuentas de sucursal"
        subtitle="Una cuenta por tienda: el gerente. En el login se muestra el nombre de la sucursal, no el correo."
      />
      <div className="neu-raised overflow-x-auto rounded-lg">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-wider text-fg-faint">
              <th className="px-4 py-3">Sucursal</th>
              <th className="px-4 py-3">Zona</th>
              <th className="px-4 py-3">Gerente</th>
              <th className="px-4 py-3">Correo (cuenta)</th>
              <th className="px-4 py-3">Cotizador</th>
            </tr>
          </thead>
          <tbody>
            {sucursales.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-fg-subtle">
                  Sin sucursales en Cotizador.
                </td>
              </tr>
            ) : (
              sucursales.map((sucursal) => (
                <tr key={sucursal.id} className="border-t border-line-subtle">
                  <td className="px-4 py-2.5 font-semibold text-fg">{sucursal.nombre}</td>
                  <td className="px-4 py-2.5 text-fg-subtle">{sucursal.zona}</td>
                  <td className="px-4 py-2.5">{sucursal.gerenteNombre || "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-fg-faint">{sucursal.gerenteEmail || "—"}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {sucursal.hasAccount ? "Activa" : "Sin usuario"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
