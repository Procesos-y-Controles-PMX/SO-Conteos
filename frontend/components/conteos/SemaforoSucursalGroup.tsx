"use client";

import Link from "next/link";
import SemaforoDot from "@/components/conteos/SemaforoDot";
import WeekHistory from "@/components/conteos/WeekHistory";
import {
  sessionSemaforo,
  type CountSession,
  type Semaforo,
  type Sucursal,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export type SemaforoSucursalRow = {
  sucursal: Sucursal;
  weekly?: CountSession;
  urgentes: CountSession[];
  doneByWeek: Record<string, boolean>;
};

function statusBarClass(status: Semaforo) {
  if (status === "verde") return "bg-emerald-500";
  if (status === "ambar") return "bg-amber-400";
  return "bg-brand";
}

function CountAction({
  href,
  label,
  onDelete,
  compact = false,
}: {
  href: string;
  label: string;
  onDelete: () => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", compact && "justify-end")}>
      <Link
        href={href}
        className={cn(
          "neu-tray truncate rounded-sm text-[10px] font-semibold uppercase tracking-wide text-fg",
          compact ? "px-2.5 py-1.5" : "min-w-0 flex-1 px-3 py-2",
        )}
      >
        {label}
      </Link>
      <button
        type="button"
        className={cn(
          "neu-button shrink-0 rounded-sm text-[10px] font-semibold uppercase tracking-wide text-brand",
          compact ? "px-2.5 py-1.5" : "px-3 py-2",
        )}
        onClick={onDelete}
      >
        Borrar
      </button>
    </div>
  );
}

function weeklyLabel(weekly: CountSession) {
  return weekly.status === "enviado" ? "Ver enviado" : "Ver semanal";
}

function urgenteLabel(urgente: CountSession) {
  return urgente.titulo.replace("Urgente · ", "");
}

function urgentesCopy(urgentes: CountSession[]) {
  if (urgentes.length === 0) return "ninguno";
  return `${urgentes.filter((u) => u.status === "enviado").length}/${urgentes.length} enviados`;
}

const ROW_GRID =
  "grid grid-cols-[minmax(11rem,1.5fr)_6.75rem_7rem_minmax(4.5rem,0.85fr)_5.25rem_auto] items-center gap-x-3";

function SucursalCard({
  sucursal,
  weekly,
  urgentes,
  doneByWeek,
  historyWeeks,
  onDelete,
}: {
  sucursal: Sucursal;
  weekly?: CountSession;
  urgentes: CountSession[];
  doneByWeek: Record<string, boolean>;
  historyWeeks: string[];
  onDelete: (session: CountSession, nombre: string) => void;
}) {
  const status = sessionSemaforo(weekly);

  return (
    <article className="neu-raised relative rounded-lg">
      <div
        className={cn("absolute inset-y-0 right-0 w-1.5 overflow-hidden rounded-r-lg", statusBarClass(status))}
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
              <dd>{urgentesCopy(urgentes)}</dd>
            </div>
          </dl>
          <WeekHistory weeks={historyWeeks} doneByWeek={doneByWeek} />
        </div>
        <div className="mt-3 space-y-2">
          {weekly ? (
            <CountAction
              href={`/conteos/${weekly.id}`}
              label={weeklyLabel(weekly)}
              onDelete={() => onDelete(weekly, sucursal.nombre)}
            />
          ) : null}
          {urgentes.map((u) => (
            <CountAction
              key={u.id}
              href={`/conteos/${u.id}`}
              label={urgenteLabel(u)}
              onDelete={() => onDelete(u, sucursal.nombre)}
            />
          ))}
        </div>
      </div>
    </article>
  );
}

function SucursalRow({
  sucursal,
  weekly,
  urgentes,
  doneByWeek,
  historyWeeks,
  onDelete,
}: {
  sucursal: Sucursal;
  weekly?: CountSession;
  urgentes: CountSession[];
  doneByWeek: Record<string, boolean>;
  historyWeeks: string[];
  onDelete: (session: CountSession, nombre: string) => void;
}) {
  const status = sessionSemaforo(weekly);

  return (
    <article className="relative">
      <div className={cn("absolute inset-y-0 left-0 w-1", statusBarClass(status))} aria-hidden />
        <div className={cn(ROW_GRID, "py-2.5 pl-4 pr-3 transition-colors hover:bg-[color-mix(in_srgb,var(--fg)_4%,transparent)]")}>
        <div className="min-w-0">
          <p className="truncate font-semibold text-fg">{sucursal.nombre}</p>
          <p className="truncate text-[11px] text-fg-faint">{sucursal.gerenteNombre || "Gerente de tienda"}</p>
        </div>
        <SemaforoDot value={status} size="sm" />
        <WeekHistory weeks={historyWeeks} doneByWeek={doneByWeek} compact />
        <p className="truncate text-xs text-fg-subtle">{weekly?.counterName ?? "—"}</p>
        <p className="truncate text-xs text-fg-subtle">{urgentesCopy(urgentes)}</p>
        <div className="flex justify-end">
          {weekly ? (
            <CountAction
              compact
              href={`/conteos/${weekly.id}`}
              label={weeklyLabel(weekly)}
              onDelete={() => onDelete(weekly, sucursal.nombre)}
            />
          ) : (
            <span className="text-xs text-fg-faint">—</span>
          )}
        </div>
      </div>
      {urgentes.length > 0 ? (
        <div className="flex flex-wrap justify-end gap-2 border-t border-line-subtle py-2 pl-4 pr-3">
          {urgentes.map((u) => (
            <CountAction
              key={u.id}
              compact
              href={`/conteos/${u.id}`}
              label={urgenteLabel(u)}
              onDelete={() => onDelete(u, sucursal.nombre)}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

export default function SemaforoSucursalGroup({
  zona,
  rows,
  historyWeeks,
  onDelete,
}: {
  zona: string;
  rows: SemaforoSucursalRow[];
  historyWeeks: string[];
  onDelete: (session: CountSession, nombre: string) => void;
}) {
  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-semibold text-fg">{zona}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
        {rows.map((row) => (
          <SucursalCard
            key={row.sucursal.id}
            {...row}
            historyWeeks={historyWeeks}
            onDelete={onDelete}
          />
        ))}
      </div>
      <div className="neu-raised hidden overflow-hidden rounded-lg lg:block">
        <div className={cn(ROW_GRID, "items-end border-b border-line-subtle py-2 pl-4 pr-3")}>
          <p className="field-label">Sucursal</p>
          <p className="field-label">Estado</p>
          <div>
            <p className="field-label">4 sem</p>
            {historyWeeks.length > 0 ? (
              <p className="mt-0.5 font-mono text-[10px] font-semibold tabular-nums tracking-wide text-fg-faint">
                {historyWeeks.map((key) => Number(key.split("-W")[1])).join("  ")}
              </p>
            ) : null}
          </div>
          <p className="field-label">Semanal</p>
          <p className="field-label">Urgentes</p>
          <p className="field-label text-right">Acciones</p>
        </div>
        <div className="divide-y divide-line-subtle">
          {rows.map((row) => (
            <SucursalRow
              key={row.sucursal.id}
              {...row}
              historyWeeks={historyWeeks}
              onDelete={onDelete}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
