"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PageHeader from "@/components/ui/PageHeader";
import SelectDropdown from "@/components/ui/SelectDropdown";
import { listSucursales, sessionsForWeek, deleteConteo } from "@/lib/store";
import { lineDiff, lineMonto, sessionDiffStats, type CountLine, type CountSession, type Sucursal } from "@/lib/types";
import { cn, downloadTextFile, formatMoney, formatNumber } from "@/lib/utils";
import { nearbyWeekKeys, weekLabel } from "@/lib/week";
import { LineEvidence } from "@/components/conteos/EvidencePreview";
import DiffSortControls from "@/components/conteos/DiffSortControls";
import EvidenceZipButton from "@/components/conteos/EvidenceZipButton";
import { lineMatchesQuery, sortLines, type DiffSort } from "@/lib/conteos/diffSort";

function qtyCell(value: number | null | undefined) {
  if (value == null) return "—";
  return formatNumber(Number(value), 2);
}

function montoCell(line: CountLine) {
  const monto = lineMonto(line);
  if (monto == null) return "—";
  return formatMoney(monto);
}

function linesForTable(lines: CountLine[], skuQuery: string, sort: DiffSort) {
  return sortLines(
    lines.filter((line) => lineMatchesQuery(line, skuQuery)),
    sort,
  );
}

function hasEvidence(session: CountSession) {
  return session.lines.some((line) => line.evidenciaPath || line.evidenciaEntregarPath || line.evidenciaFacturarPath);
}

export default function DescargasPage() {
  const weeks = useMemo(() => nearbyWeekKeys(), []);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sessions, setSessions] = useState<CountSession[]>([]);
  const [week, setWeek] = useState(weeks[0]);
  const [zona, setZona] = useState("todas");
  const [tienda, setTienda] = useState("todas");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [skuQuery, setSkuQuery] = useState("");
  const [sort, setSort] = useState<DiffSort>("monto");
  const [commentLine, setCommentLine] = useState<{
    sku: string;
    nombre: string;
    texto: string;
  } | null>(null);

  useEffect(() => {
    void listSucursales().then(setSucursales);
  }, []);

  useEffect(() => {
    void sessionsForWeek(week).then(setSessions);
    setExpandedId(null);
    setSkuQuery("");
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
      "material",
      "um",
      "inv_fisico",
      "inv_teorico",
      "por_entrega",
      "por_facturar",
      "dif",
      "monto",
      "comentarios",
    ];
    const lines = [header.join(",")];
    for (const session of rows) {
      const suc = sucursales.find((s) => s.id === session.sucursalId);
      for (const line of session.lines) {
        const diff = lineDiff(line);
        const monto = lineMonto(line);
        lines.push(
          [
            weekLabel(session.weekKey),
            session.kind,
            suc?.zona ?? "",
            suc?.nombre ?? "",
            session.status,
            session.counterName ?? "",
            session.counterPuesto ?? "",
            line.sku,
            `"${line.nombre.replaceAll('"', '""')}"`,
            line.um,
            line.fisico ?? "",
            line.teorico,
            line.pendienteEntregar ?? "",
            line.pendienteFacturar ?? "",
            diff ?? "",
            monto ?? "",
            `"${(line.comentario ?? "").replaceAll('"', '""')}"`,
          ].join(","),
        );
      }
    }
    downloadTextFile(`conteos-${weekLabel(week).replaceAll(" ", "-")}.csv`, lines.join("\n"));
  }

  return (
    <div>
      <PageHeader
        eyebrow="Administración"
        title="Descargas"
        subtitle="Filtros por zona, tienda y pestaña de semana. CSV o vista en página."
        actions={
          <div className="flex flex-wrap gap-2">
            <EvidenceZipButton
              ids={rows.filter(hasEvidence).map((s) => s.id)}
              fileName={`evidencias-${weekLabel(week).replaceAll(" ", "-")}`}
            />
            <button type="button" className="btn-primary" onClick={download} disabled={rows.length === 0}>
              Descargar CSV
            </button>
          </div>
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
              <th className="px-4 py-3" />
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Sucursal</th>
              <th className="px-4 py-3">Estatus</th>
              <th className="px-4 py-3">Contador</th>
              <th className="px-4 py-3">SKUs</th>
              <th className="px-4 py-3">Diffs</th>
              <th className="px-4 py-3">Monto dif</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-fg-subtle">
                  Sin conteos con estos filtros.
                </td>
              </tr>
            ) : (
              rows.map((session) => {
                const suc = sucursales.find((s) => s.id === session.sucursalId);
                const diffs = sessionDiffStats(session);
                const open = expandedId === session.id;
                return (
                  <Fragment key={session.id}>
                    <tr className="border-t border-line-subtle">
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          className="neu-button rounded-full p-2 text-fg-muted"
                          aria-expanded={open}
                          aria-label={open ? "Ocultar detalle" : "Ver detalle"}
                          onClick={() => {
                            setExpandedId(open ? null : session.id);
                            setSkuQuery("");
                          }}
                        >
                          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-3 capitalize">{session.kind}</td>
                      <td className="px-4 py-3">{suc?.nombre}</td>
                      <td className="px-4 py-3">{session.status.replace("_", " ")}</td>
                      <td className="px-4 py-3">{session.counterName ?? "—"}</td>
                      <td className="px-4 py-3 tabular-nums">{session.lines.length}</td>
                      <td className="px-4 py-3 tabular-nums">{formatNumber(diffs.skuCount, 0)}</td>
                      <td className="px-4 py-3 tabular-nums">{formatMoney(diffs.monto)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="btn-danger min-h-8 px-2 py-1 text-xs"
                          onClick={() => setPendingId(session.id)}
                        >
                          Borrar
                        </button>
                      </td>
                    </tr>
                    {open ? (
                      <tr className="border-t border-line-subtle bg-muted/40">
                        <td colSpan={9} className="px-4 py-4">
                          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wider text-fg-faint">
                              Detalle de líneas · {sort === "monto" ? "monto de mayor a menor" : "por SKU"}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                              <DiffSortControls
                                className="sm:w-[26rem]"
                                query={skuQuery}
                                onQuery={setSkuQuery}
                                sort={sort}
                                onSort={setSort}
                              />
                              {hasEvidence(session) ? (
                                <EvidenceZipButton
                                  ids={[session.id]}
                                  fileName={`evidencias-${suc?.nombre ?? "sucursal"}-${weekLabel(session.weekKey)}`.replaceAll(" ", "-")}
                                  label="Fotos (ZIP)"
                                  className="min-h-9 px-3 text-xs"
                                />
                              ) : null}
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-xs">
                              <thead>
                                <tr className="text-[10px] font-bold uppercase tracking-wider text-fg-faint">
                                  <th className="px-2 py-2">SKU</th>
                                  <th className="px-2 py-2">Material</th>
                                  <th className="px-2 py-2">UM</th>
                                  <th className="px-2 py-2 text-right">Inv. físico</th>
                                  <th className="px-2 py-2 text-right">Inv. teórico</th>
                                  <th className="px-2 py-2 text-right">Por entrega</th>
                                  <th className="px-2 py-2 text-right">Por facturar</th>
                                  <th className="px-2 py-2 text-right">Dif.</th>
                                  <th className="px-2 py-2 text-right">Monto</th>
                                  <th className="px-2 py-2 text-center">Evidencia</th>
                                  <th className="px-2 py-2 text-center">Comentarios</th>
                                </tr>
                              </thead>
                              <tbody>
                                {linesForTable(session.lines, skuQuery, sort).map((line) => {
                                  const diff = lineDiff(line);
                                  const monto = lineMonto(line);
                                  return (
                                    <tr key={line.sku} className="border-t border-line-subtle">
                                      <td className="px-2 py-2 font-mono tabular-nums">{line.sku}</td>
                                      <td className="max-w-[12rem] truncate px-2 py-2">{line.nombre}</td>
                                      <td className="px-2 py-2">{line.um}</td>
                                      <td className="px-2 py-2 text-right tabular-nums">{qtyCell(line.fisico)}</td>
                                      <td className="px-2 py-2 text-right tabular-nums">{qtyCell(line.teorico)}</td>
                                      <td className="px-2 py-2 text-right tabular-nums">
                                        {qtyCell(line.pendienteEntregar)}
                                      </td>
                                      <td className="px-2 py-2 text-right tabular-nums">
                                        {qtyCell(line.pendienteFacturar)}
                                      </td>
                                      <td
                                        className={cn(
                                          "px-2 py-2 text-right font-semibold tabular-nums",
                                          (diff ?? 0) < 0
                                            ? "text-brand"
                                            : (diff ?? 0) > 0
                                              ? "text-emerald-600"
                                              : "text-fg",
                                        )}
                                      >
                                        {diff == null ? "—" : `${diff > 0 ? "+" : ""}${formatNumber(diff, 2)}`}
                                      </td>
                                      <td
                                        className={cn(
                                          "px-2 py-2 text-right font-semibold tabular-nums",
                                          (monto ?? 0) < 0
                                            ? "text-brand"
                                            : (monto ?? 0) > 0
                                              ? "text-emerald-600"
                                              : "text-fg",
                                        )}
                                      >
                                        {montoCell(line)}
                                      </td>
                                      <td className="px-2 py-2">
                                        <LineEvidence session={session} line={line} />
                                      </td>
                                      <td className="px-2 py-2 text-center">
                                        {line.comentario?.trim() ? (
                                          <button
                                            type="button"
                                            className="neu-button inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[11px] font-semibold text-fg"
                                            onClick={() =>
                                              setCommentLine({
                                                sku: line.sku,
                                                nombre: line.nombre,
                                                texto: line.comentario!.trim(),
                                              })
                                            }
                                          >
                                            <MessageSquare className="h-3.5 w-3.5" />
                                            Ver
                                          </button>
                                        ) : (
                                          <span className="text-fg-faint">—</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
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
      <ConfirmDialog
        open={Boolean(commentLine)}
        title={commentLine ? `${commentLine.sku} · ${commentLine.nombre}` : "Comentario"}
        body={commentLine?.texto ?? ""}
        confirmLabel="Cerrar"
        cancelLabel="Cerrar"
        onCancel={() => setCommentLine(null)}
        onConfirm={() => setCommentLine(null)}
      />
    </div>
  );
}
