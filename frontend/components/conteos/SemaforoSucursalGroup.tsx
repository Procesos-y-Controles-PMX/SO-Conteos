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
    <div className={cn("flex min-w-0 items-center gap-2", compact && "w-full justify-end")}>
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
  const cell = "px-3 py-2.5 align-middle";

  return (
    <>
      <tr className="border-t border-line-subtle transition-colors hover:bg-[color-mix(in_srgb,var(--fg)_4%,transparent)]">
        <td className={cn(cell, "relative min-w-0 pl-4")}>
          <span className={cn("absolute inset-y-0 left-0 w-1", statusBarClass(status))} aria-hidden />
          <p className="truncate font-semibold text-fg">{sucursal.nombre}</p>
          <p className="truncate text-[11px] text-fg-faint">{sucursal.gerenteNombre || "Gerente de tienda"}</p>
        </td>
        <td className={cell}>
          <SemaforoDot value={status} size="sm" />
        </td>
        <td className={cell}>
          <WeekHistory weeks={historyWeeks} doneByWeek={doneByWeek} compact />
        </td>
        <td className={cn(cell, "max-w-0 overflow-hidden text-xs text-fg-subtle")}>
          <span className="block truncate">{weekly?.counterName ?? "—"}</span>
        </td>
        <td className={cn(cell, "max-w-0 overflow-hidden text-xs text-fg-subtle")}>
          <span className="block truncate">{urgentesCopy(urgentes)}</span>
        </td>
        <td className={cn(cell, "text-right")}>
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
        </td>
      </tr>
      {urgentes.length > 0 ? (
        <tr className="border-t border-line-subtle">
          <td colSpan={6} className="px-3 py-2 pl-4">
            <div className="flex flex-wrap justify-end gap-2">
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
          </td>
        </tr>
      ) : null}
    </>
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
        <table className="w-full table-fixed text-left">
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[16%]" />
            <col className="w-[12%]" />
            <col className="w-[24%]" />
          </colgroup>
          <thead>
            <tr>
              <th className="px-3 py-2.5 pl-4 align-bottom">
                <span className="field-label">Sucursal</span>
              </th>
              <th className="px-3 py-2.5 align-bottom">
                <span className="field-label">Estado</span>
              </th>
              <th className="px-3 py-2.5 align-bottom">
                <p className="field-label">4 sem</p>
                {historyWeeks.length > 0 ? (
                  <div className="mt-0.5 grid w-[5.75rem] grid-cols-4 justify-items-center">
                    {historyWeeks.map((key) => (
                      <span key={key} className="font-mono text-[10px] font-semibold tabular-nums text-fg-faint">
                        {Number(key.split("-W")[1])}
                      </span>
                    ))}
                  </div>
                ) : null}
              </th>
              <th className="px-3 py-2.5 align-bottom">
                <span className="field-label">Semanal</span>
              </th>
              <th className="px-3 py-2.5 align-bottom">
                <span className="field-label">Urgentes</span>
              </th>
              <th className="px-3 py-2.5 pr-3 text-right align-bottom">
                <span className="field-label">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <SucursalRow
                key={row.sucursal.id}
                {...row}
                historyWeeks={historyWeeks}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
