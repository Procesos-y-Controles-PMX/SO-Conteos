"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PageHeader from "@/components/ui/PageHeader";
import SelectDropdown from "@/components/ui/SelectDropdown";
import { listSucursales, sessionsForWeek, deleteConteo } from "@/lib/store";
import { lineDiff, type CountSession, type Sucursal } from "@/lib/types";
import { cn, downloadTextFile, formatNumber } from "@/lib/utils";
import { nearbyWeekKeys, weekLabel } from "@/lib/week";

export default function DescargasPage() {
  const weeks = useMemo(() => nearbyWeekKeys(), []);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sessions, setSessions] = useState<CountSession[]>([]);
  const [week, setWeek] = useState(weeks[0]);
  const [zona, setZona] = useState("todas");
  const [tienda, setTienda] = useState("todas");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void listSucursales().then(setSucursales);
  }, []);

  useEffect(() => {
    void sessionsForWeek(week).then(setSessions);
  }, [week]);

  const zonas = Array.from(new Set(sucursales.map((s) => s.zona)));
  const tiendasFiltradas = sucursales.filter((s) => zona === "todas" || s.zona === zona);
  const rows = sessions.filter((s) => {
    const suc = sucursales.find((x) => x.id === s.sucursalId);
    if (!suc) return false;
    if (zona !== "todas" && suc.zona !== zona) return false;
    if (tienda !== "todas" && suc.id !== tienda) return false;
    return true;
  });

  function download() {
    const header = [
      "semana",
      "tipo",
      "zona",
      "sucursal",
      "estatus",
      "contador",
      "puesto",
      "sku",
      "producto",
      "um",
      "teorico",
      "fisico",
      "pend_entregar",
      "pend_facturar",
      "diferencia",
      "comentario",
    ];
    const lines = [header.join(",")];
    for (const session of rows) {
      const suc = sucursales.find((s) => s.id === session.sucursalId);
      for (const line of session.lines) {
        lines.push(
          [
            session.weekKey,
            session.kind,
            suc?.zona ?? "",
            suc?.nombre ?? "",
            session.status,
            session.counterName ?? "",
            session.counterPuesto ?? "",
            line.sku,
            `"${line.nombre}"`,
            line.um,
            line.teorico,
            line.fisico ?? "",
            line.pendienteEntregar ?? "",
            line.pendienteFacturar ?? "",
            lineDiff(line) ?? "",
            `"${(session.comentario ?? "").replaceAll('"', '""')}"`,
          ].join(","),
        );
      }
    }
    downloadTextFile(`conteos-${week}.csv`, lines.join("\n"));
  }

  return (
    <div>
      <PageHeader
        eyebrow="Administración"
        title="Descargas"
        subtitle="Filtros por zona, tienda y pestaña de semana."
        actions={
          <button type="button" className="btn-primary" onClick={download} disabled={rows.length === 0}>
            Descargar CSV
          </button>
        }
      />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {weeks.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setWeek(key)}
            className={cn(
              "shrink-0 rounded-sm px-3 py-2 text-sm font-semibold",
              week === key ? "neu-nav-active text-white" : "neu-button text-fg-muted",
            )}
          >
            {weekLabel(key)}
          </button>
        ))}
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <label>
          <span className="field-label mb-1.5 block">Zona</span>
          <SelectDropdown
            value={zona}
            onChange={(id) => {
              setZona(id);
              setTienda("todas");
            }}
            options={[{ id: "todas", label: "Todas" }, ...zonas.map((z) => ({ id: z, label: z }))]}
          />
        </label>
        <label>
          <span className="field-label mb-1.5 block">Sucursal</span>
          <SelectDropdown
            value={tienda}
            onChange={setTienda}
            options={[{ id: "todas", label: "Todas" }, ...tiendasFiltradas.map((s) => ({ id: s.id, label: s.nombre }))]}
          />
        </label>
      </div>
      <div className="neu-raised overflow-x-auto rounded-lg">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-wider text-fg-faint">
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Sucursal</th>
              <th className="px-4 py-3">Estatus</th>
              <th className="px-4 py-3">Contador</th>
              <th className="px-4 py-3">SKUs</th>
              <th className="px-4 py-3">Diffs</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-fg-subtle">
                  Sin conteos con estos filtros.
                </td>
              </tr>
            ) : (
              rows.map((session) => {
                const suc = sucursales.find((s) => s.id === session.sucursalId);
                const diffs = session.lines.filter((l) => (lineDiff(l) ?? 0) !== 0).length;
                return (
                  <tr key={session.id} className="border-t border-line-subtle">
                    <td className="px-4 py-3 capitalize">{session.kind}</td>
                    <td className="px-4 py-3">{suc?.nombre}</td>
                    <td className="px-4 py-3">{session.status.replace("_", " ")}</td>
                    <td className="px-4 py-3">{session.counterName ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{session.lines.length}</td>
                    <td className="px-4 py-3 tabular-nums">{formatNumber(diffs, 0)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="text-xs font-semibold text-brand"
                        onClick={() => setPendingId(session.id)}
                      >
                        Borrar
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={Boolean(pendingId)}
        title="Borrar conteo"
        body="Se elimina este envío. La sucursal podrá capturarlo de nuevo."
        pending={deleting}
        onCancel={() => setPendingId(null)}
        onConfirm={() => {
          if (!pendingId) return;
          setDeleting(true);
          void deleteConteo(pendingId)
            .then(() => {
              toast.success("Conteo borrado.");
              setPendingId(null);
              return sessionsForWeek(week).then(setSessions);
            })
            .catch((err: Error) => toast.error(err.message))
            .finally(() => setDeleting(false));
        }}
      />
    </div>
  );
}
