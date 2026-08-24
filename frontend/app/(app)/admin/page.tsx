"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import SemaforoDot from "@/components/conteos/SemaforoDot";
import WeekBoard from "@/components/conteos/WeekBoard";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PageHeader from "@/components/ui/PageHeader";
import SelectDropdown from "@/components/ui/SelectDropdown";
import { deleteConteo, fetchSemaforo } from "@/lib/store";
import { sessionSemaforo, type CountSession, type Semaforo, type SemaforoResumen, type Sucursal } from "@/lib/types";
import { weekKeyFromDate, weekLabel } from "@/lib/week";

const ORDER: Semaforo[] = ["verde", "ambar", "rojo"];

export default function AdminSemaforoPage() {
  const weekKey = weekKeyFromDate();
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sessions, setSessions] = useState<CountSession[]>([]);
  const [zonas, setZonas] = useState<string[]>([]);
  const [zona, setZona] = useState("todas");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(12);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<{ session: CountSession; nombre: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resumen, setResumen] = useState<SemaforoResumen | null>(null);

  useEffect(() => {
    setLoading(true);
    void fetchSemaforo(weekKey, { zona, page })
      .then((data) => {
        setSucursales(data.sucursales);
        setSessions(data.sessions);
        setZonas(data.zonas ?? []);
        setTotal(data.total ?? data.sucursales.length);
        setPageSize(data.pageSize ?? 12);
        setResumen(data.resumen ?? null);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [weekKey, zona, page]);

  const rows = sucursales.map((sucursal) => ({
    sucursal,
    weekly: sessions.find((s) => s.sucursalId === sucursal.id && s.kind === "semanal"),
    urgentes: sessions.filter((s) => s.sucursalId === sucursal.id && s.kind === "urgente"),
  }));
  const grouped = Array.from(new Set(sucursales.map((s) => s.zona))).map((z) => ({
    zona: z,
    rows: rows.filter((r) => r.sucursal.zona === z),
  }));
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  async function confirmDelete() {
    if (!pending) return;
    setDeleting(true);
    try {
      await deleteConteo(pending.session.id);
      toast.success("Conteo borrado.");
      setPending(null);
      const data = await fetchSemaforo(weekKey, { zona, page });
      setSucursales(data.sucursales);
      setSessions(data.sessions);
      setTotal(data.total ?? data.sucursales.length);
      setResumen(data.resumen ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Administración"
        title="Semáforo nacional"
        subtitle={`${weekLabel(weekKey)} · quién ya contó, por zona y sucursal.`}
        actions={
          <SelectDropdown
            className="w-full sm:w-56"
            value={zona}
            onChange={(id) => {
              setZona(id);
              setPage(1);
            }}
            options={[{ id: "todas", label: "Todas las zonas" }, ...zonas.map((z) => ({ id: z, label: z }))]}
          />
        }
      />
      {error ? <p className="mb-4 text-sm text-brand">{error}</p> : null}
      {resumen ? <WeekBoard resumen={resumen} /> : null}
      <div className="mb-6 flex flex-wrap gap-4 text-xs">
        {ORDER.map((value) => (
          <SemaforoDot key={value} value={value} />
        ))}
      </div>
      {loading ? <p className="text-sm text-fg-subtle">Cargando sucursales…</p> : null}
      <div className="space-y-8">
        {grouped.map((group) => (
          <section key={group.zona}>
            <h2 className="mb-3 font-display text-lg font-semibold text-fg">{group.zona}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.rows.map(({ sucursal, weekly, urgentes }) => {
                const status = sessionSemaforo(weekly);
                return (
                <article key={sucursal.id} className="neu-raised relative overflow-hidden rounded-lg">
                  <div
                    className={
                      status === "verde"
                        ? "absolute inset-y-0 right-0 w-1.5 bg-emerald-500"
                        : status === "ambar"
                          ? "absolute inset-y-0 right-0 w-1.5 bg-amber-400"
                          : "absolute inset-y-0 right-0 w-1.5 bg-brand"
                    }
                    aria-hidden
                  />
                  <div className="p-4 pr-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-fg">{sucursal.nombre}</p>
                      <p className="text-[11px] text-fg-faint">{sucursal.gerenteNombre || "Gerente de tienda"}</p>
                    </div>
                    <SemaforoDot value={status} />
                  </div>
                  <dl className="mt-3 space-y-1 text-xs text-fg-subtle">
                    <div className="flex justify-between">
                      <dt>Semanal</dt>
                      <dd>{weekly?.counterName ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Urgentes</dt>
                      <dd>
                        {urgentes.length === 0
                          ? "ninguno"
                          : `${urgentes.filter((u) => u.status === "enviado").length}/${urgentes.length} enviados`}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {weekly ? (
                      <>
                        <Link
                          href={`/conteos/${weekly.id}`}
                          className="neu-tray rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                        >
                          {weekly.status === "enviado" ? "Ver enviado" : "Ver semanal"}
                        </Link>
                        <button
                          type="button"
                          className="text-[10px] font-semibold uppercase tracking-wide text-brand"
                          onClick={() => setPending({ session: weekly, nombre: sucursal.nombre })}
                        >
                          Borrar
                        </button>
                      </>
                    ) : null}
                    {urgentes.map((u) => (
                      <span key={u.id} className="flex items-center gap-1">
                        <Link
                          href={`/conteos/${u.id}`}
                          className="neu-tray rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                        >
                          {u.titulo.replace("Urgente · ", "")}
                        </Link>
                        <button
                          type="button"
                          className="text-[10px] font-semibold uppercase tracking-wide text-brand"
                          onClick={() => setPending({ session: u, nombre: sucursal.nombre })}
                        >
                          Borrar
                        </button>
                      </span>
                    ))}
                  </div>
                  </div>
                </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      {total > pageSize ? (
        <div className="mt-8 flex items-center justify-between gap-3">
          <p className="text-xs text-fg-subtle">
            {from}–{to} de {total}
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(pending)}
        title="Borrar conteo"
        body={`Se elimina el envío de ${pending?.nombre ?? "esta sucursal"}. La tienda podrá capturarlo de nuevo.`}
        pending={deleting}
        onCancel={() => setPending(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
