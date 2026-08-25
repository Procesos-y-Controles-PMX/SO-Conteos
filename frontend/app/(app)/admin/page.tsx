"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import SemaforoDot from "@/components/conteos/SemaforoDot";
import WeekBoard from "@/components/conteos/WeekBoard";
import WeekHistory from "@/components/conteos/WeekHistory";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PageHeader from "@/components/ui/PageHeader";
import { deleteConteo, fetchSemaforo } from "@/lib/store";
import {
  sessionSemaforo,
  type CountSession,
  type Semaforo,
  type SemaforoResumen,
  type Sucursal,
  type ZonaSemaforo,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { weekKeyFromDate, weekLabel } from "@/lib/week";

const ORDER: Semaforo[] = ["verde", "ambar", "rojo"];
const ZONA_STORAGE_KEY = "so-conteos-semaforo-zona";

function zonaStorageRead(): string[] {
  const raw = window.localStorage.getItem(ZONA_STORAGE_KEY);
  if (!raw || raw === "todas") return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
    }
  } catch {
    /* previously a single zona name */
  }
  return [raw];
}

function zonaStorageWrite(zonas: string[]) {
  if (!zonas.length) window.localStorage.removeItem(ZONA_STORAGE_KEY);
  else window.localStorage.setItem(ZONA_STORAGE_KEY, JSON.stringify(zonas));
}

function zonaListLabel(zonas: string[]) {
  if (zonas.length === 1) return zonas[0]!;
  if (zonas.length === 2) return `${zonas[0]} y ${zonas[1]}`;
  return `${zonas.length} zonas`;
}

function CountAction({
  href,
  label,
  onDelete,
}: {
  href: string;
  label: string;
  onDelete: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Link
        href={href}
        className="neu-tray min-w-0 flex-1 truncate rounded-sm px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-fg"
      >
        {label}
      </Link>
      <button
        type="button"
        className="neu-button shrink-0 rounded-sm px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-brand"
        onClick={onDelete}
      >
        Borrar
      </button>
    </div>
  );
}

export default function AdminSemaforoPage() {
  const weekKey = weekKeyFromDate();
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sessions, setSessions] = useState<CountSession[]>([]);
  const [zonaOpciones, setZonaOpciones] = useState<ZonaSemaforo[]>([]);
  const [draft, setDraft] = useState<string[]>([]);
  const [zonas, setZonas] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<{ session: CountSession; nombre: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resumen, setResumen] = useState<SemaforoResumen | null>(null);
  const [historyWeeks, setHistoryWeeks] = useState<string[]>([]);
  const [history, setHistory] = useState<CountSession[]>([]);

  useEffect(() => {
    const saved = zonaStorageRead();
    setDraft(saved);
    setZonas(saved);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    void fetchSemaforo(weekKey, zonas.length ? { zonas } : undefined)
      .then((data) => {
        setSucursales(data.sucursales);
        setSessions(data.sessions);
        setZonaOpciones(
          data.zonaOpciones ?? (data.zonas ?? []).map((id) => ({ id, sucursales: 0, contado: 0, curso: 0, pendiente: 0 })),
        );
        setResumen(data.resumen ?? null);
        setHistoryWeeks(data.historyWeeks ?? []);
        setHistory(data.history ?? []);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [weekKey, zonas, ready]);

  function toggleZona(id: string) {
    setDraft((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function applyZonas() {
    setZonas(draft);
    zonaStorageWrite(draft);
  }

  function clearZonas() {
    setZonas([]);
    setSucursales([]);
    setSessions([]);
    setHistory([]);
  }

  const rows = sucursales.map((sucursal) => {
    const doneByWeek: Record<string, boolean> = {};
    for (const session of history) {
      if (session.sucursalId !== sucursal.id || session.kind !== "semanal") continue;
      if (session.status === "enviado") doneByWeek[session.weekKey] = true;
    }
    return {
      sucursal,
      weekly: sessions.find((s) => s.sucursalId === sucursal.id && s.kind === "semanal"),
      urgentes: sessions.filter((s) => s.sucursalId === sucursal.id && s.kind === "urgente"),
      doneByWeek,
    };
  });

  const groups = zonas.map((id) => ({
    id,
    rows: rows.filter((row) => row.sucursal.zona === id),
  }));

  async function confirmDelete() {
    if (!pending || !zonas.length) return;
    setDeleting(true);
    try {
      await deleteConteo(pending.session.id);
      toast.success("Conteo borrado.");
      setPending(null);
      const data = await fetchSemaforo(weekKey, { zonas });
      setSucursales(data.sucursales);
      setSessions(data.sessions);
      setZonaOpciones(data.zonaOpciones ?? []);
      setResumen(data.resumen ?? null);
      setHistoryWeeks(data.historyWeeks ?? []);
      setHistory(data.history ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar.");
    } finally {
      setDeleting(false);
    }
  }

  const viewing = zonas.length > 0;

  return (
    <div>
      <PageHeader
        eyebrow="Administración"
        title="Semáforo nacional"
        subtitle={
          viewing
            ? `${weekLabel(weekKey)} · ${zonaListLabel(zonas)}`
            : `${weekLabel(weekKey)} · elige una o más zonas para ver sus sucursales.`
        }
        actions={
          viewing ? (
            <button type="button" className="btn-secondary" onClick={clearZonas}>
              <ChevronLeft className="h-4 w-4" />
              Cambiar zonas
            </button>
          ) : null
        }
      />
      {error ? <p className="mb-4 text-sm text-brand">{error}</p> : null}
      {resumen ? <WeekBoard resumen={resumen} /> : null}
      <div className="mb-6 flex flex-wrap gap-4 text-xs">
        {ORDER.map((value) => (
          <SemaforoDot key={value} value={value} />
        ))}
      </div>

      {!viewing ? (
        <section>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="field-label">Zonas</p>
              <h2 className="mt-1 font-display text-lg font-semibold text-fg">Elige una o más zonas</h2>
              <p className="mt-1 text-sm text-fg-subtle">
                {draft.length === 0
                  ? "Toca las zonas que quieres ver."
                  : `${draft.length} zona${draft.length === 1 ? "" : "s"} seleccionada${draft.length === 1 ? "" : "s"}.`}
              </p>
            </div>
            <button type="button" className="btn-primary shrink-0" disabled={draft.length === 0} onClick={applyZonas}>
              Ver sucursales
            </button>
          </div>
          {loading && zonaOpciones.length === 0 ? (
            <p className="mt-4 text-sm text-fg-subtle">Cargando zonas…</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {zonaOpciones.map((item) => {
                const selected = draft.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleZona(item.id)}
                    className={cn(
                      "rounded-lg p-4 text-left transition-shadow",
                      selected ? "neu-pressed" : "neu-raised hover:shadow-[var(--neu-raised-lg)]",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-display text-lg font-semibold text-fg">{item.id}</p>
                      {selected ? <span className="field-label">Seleccionada</span> : null}
                    </div>
                    <p className="mt-1 text-sm text-fg-subtle">
                      {item.sucursales} sucursal{item.sucursales === 1 ? "" : "es"}
                    </p>
                    <p className="mt-3 font-mono text-[11px] tabular-nums text-fg-muted">
                      <span className="text-emerald-500">{item.contado}</span> contado
                      {item.curso ? (
                        <>
                          {" · "}
                          <span className="text-amber-400">{item.curso}</span> en curso
                        </>
                      ) : null}
                      {" · "}
                      <span className="text-brand">{item.pendiente}</span> pendiente
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <div className="space-y-8">
          {loading ? <p className="text-sm text-fg-subtle">Cargando sucursales…</p> : null}
          {!loading && rows.length === 0 ? (
            <p className="text-sm text-fg-subtle">No hay sucursales en estas zonas.</p>
          ) : (
            groups.map((group) => (
              <section key={group.id}>
                <h2 className="mb-3 font-display text-lg font-semibold text-fg">{group.id}</h2>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {group.rows.map(({ sucursal, weekly, urgentes, doneByWeek }) => {
                    const status = sessionSemaforo(weekly);
                    return (
                      <article key={sucursal.id} className="neu-raised relative rounded-lg">
                        <div
                          className={
                            status === "verde"
                              ? "absolute inset-y-0 right-0 w-1.5 overflow-hidden rounded-r-lg bg-emerald-500"
                              : status === "ambar"
                                ? "absolute inset-y-0 right-0 w-1.5 overflow-hidden rounded-r-lg bg-amber-400"
                                : "absolute inset-y-0 right-0 w-1.5 overflow-hidden rounded-r-lg bg-brand"
                          }
                          aria-hidden
                        />
                        <div className="p-4 pr-5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-fg">{sucursal.nombre}</p>
                              <p className="text-[11px] text-fg-faint">{sucursal.gerenteNombre || "Gerente de tienda"}</p>
                            </div>
                            <SemaforoDot value={status} />
                          </div>
                          <div className="mt-3 flex items-end justify-between gap-3">
                            <dl className="min-w-0 flex-1 space-y-1 text-xs text-fg-subtle">
                              <div className="flex justify-between gap-3">
                                <dt>Semanal</dt>
                                <dd className="truncate text-right">{weekly?.counterName ?? "—"}</dd>
                              </div>
                              <div className="flex justify-between gap-3">
                                <dt>Urgentes</dt>
                                <dd>
                                  {urgentes.length === 0
                                    ? "ninguno"
                                    : `${urgentes.filter((u) => u.status === "enviado").length}/${urgentes.length} enviados`}
                                </dd>
                              </div>
                            </dl>
                            <WeekHistory weeks={historyWeeks} doneByWeek={doneByWeek} />
                          </div>
                          <div className="mt-3 space-y-2">
                            {weekly ? (
                              <CountAction
                                href={`/conteos/${weekly.id}`}
                                label={weekly.status === "enviado" ? "Ver enviado" : "Ver semanal"}
                                onDelete={() => setPending({ session: weekly, nombre: sucursal.nombre })}
                              />
                            ) : null}
                            {urgentes.map((u) => (
                              <CountAction
                                key={u.id}
                                href={`/conteos/${u.id}`}
                                label={u.titulo.replace("Urgente · ", "")}
                                onDelete={() => setPending({ session: u, nombre: sucursal.nombre })}
                              />
                            ))}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      )}

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
