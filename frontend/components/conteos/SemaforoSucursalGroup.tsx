"use client";

import Link from "next/link";
import { SkeletonRow } from "@promexma/ui";
import SemaforoDot from "@/components/conteos/SemaforoDot";
import WeekHistory from "@/components/conteos/WeekHistory";
import {
  sessionSemaforo,
  type CountSession,
  type Semaforo,
  type Sucursal,
  type WeekState,
} from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";
import { weekLabelParts } from "@/lib/week";

export type SemaforoSucursalRow = {
  sucursal: Sucursal;
  weekly?: CountSession;
  urgentes: CountSession[];
  stateByWeek: Record<string, WeekState>;
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
          "btn-danger shrink-0 rounded-sm text-[10px] font-semibold uppercase tracking-wide",
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

function difCopy(weekly?: CountSession) {
  if (weekly?.status !== "enviado" || weekly.difSkus == null) return null;
  return `${weekly.difSkus} dif · ${formatMoney(weekly.difMonto ?? 0)}`;
}

function urgenteLabel(urgente: CountSession) {
  return urgente.titulo.replace("Urgente · ", "");
}

function urgentesCopy(urgentes: CountSession[]) {
  if (urgentes.length === 0) return "Ninguno";
  return `${urgentes.filter((u) => u.status === "enviado").length}/${urgentes.length} enviados`;
}

function SucursalName({ sucursal }: { sucursal: Sucursal }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-semibold text-fg">{sucursal.nombre}</p>
      <p className="truncate text-[11px] text-fg-faint">
        {sucursal.gerenteNombre || "Gerente de tienda"}
        {!sucursal.hasAccount ? <span className="font-semibold text-brand"> · Sin usuario</span> : null}
      </p>
    </div>
  );
}

const ROW_H = 54;

function Bone({ className }: { className?: string }) {
  return <div className={cn("rounded-sm bg-muted-strong", className)} />;
}

function RowPlaceholder() {
  return (
    <div className="grid h-full grid-cols-[24%_12%_12%_16%_12%_24%] items-center px-3 pl-4">
      <div className="min-w-0 pr-3">
        <Bone className="h-3.5 w-[70%]" />
        <Bone className="mt-1.5 h-2.5 w-[45%] opacity-60" />
      </div>
      <Bone className="h-3 w-16" />
      <div className="grid w-[5.75rem] grid-cols-4 justify-items-center">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bone key={i} className="h-3.5 w-3.5 rounded-sm" />
        ))}
      </div>
      <Bone className="h-3 w-14" />
      <Bone className="h-3 w-12" />
      <div className="flex justify-end gap-2 pr-1">
        <Bone className="h-7 w-20" />
        <Bone className="h-7 w-14" />
      </div>
    </div>
  );
}

function CardPlaceholder() {
  return (
    <div className="flex h-full flex-col justify-between p-4">
      <div>
        <Bone className="h-4 w-[55%]" />
        <Bone className="mt-2 h-2.5 w-[40%] opacity-60" />
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <Bone className="h-2.5 w-24" />
          <Bone className="h-2.5 w-16 opacity-60" />
        </div>
        <div className="flex gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <Bone key={i} className="h-5 w-5" />
          ))}
        </div>
      </div>
      <Bone className="h-8 w-full" />
    </div>
  );
}

function TableHead({ historyWeeks }: { historyWeeks: string[] }) {
  return (
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
            <div className="mt-0.5 grid w-[7.25rem] grid-cols-4 justify-items-center">
              {historyWeeks.map((key) => {
                const { month, day, year } = weekLabelParts(key);
                return (
                  <span key={key} className="flex flex-col items-center leading-none" title={`${month} ${day} ${year}`}>
                    <span className="text-[8px] font-bold tracking-wide text-fg-faint">{month}</span>
                    <span className="mt-0.5 font-mono text-[10px] font-semibold tabular-nums text-fg-muted">{day}</span>
                  </span>
                );
              })}
            </div>
          ) : (
            <div className="mt-0.5 grid w-[5.75rem] grid-cols-4 justify-items-center">
              {Array.from({ length: 4 }).map((_, i) => (
                <Bone key={i} className="h-2.5 w-4" />
              ))}
            </div>
          )}
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
  );
}

function SucursalCard({
  sucursal,
  weekly,
  urgentes,
  stateByWeek,
  historyWeeks,
  onDelete,
  onUnlock,
}: {
  sucursal: Sucursal;
  weekly?: CountSession;
  urgentes: CountSession[];
  stateByWeek: Record<string, WeekState>;
  historyWeeks: string[];
  onDelete: (session: CountSession, nombre: string) => void;
  onUnlock?: (sucursal: Sucursal, weekKey: string) => void;
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
          <SucursalName sucursal={sucursal} />
          <SemaforoDot value={status} />
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <dl className="min-w-0 flex-1 space-y-1 text-xs text-fg-subtle">
            <div className="flex justify-between gap-3">
              <dt>Semanal</dt>
              <dd className="truncate text-right">{weekly?.counterName ?? "—"}</dd>
            </div>
            {difCopy(weekly) ? (
              <div className="flex justify-between gap-3">
                <dt>Diferencias</dt>
                <dd className="font-mono tabular-nums">{difCopy(weekly)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3">
              <dt>Urgentes</dt>
              <dd>{urgentesCopy(urgentes)}</dd>
            </div>
          </dl>
          <WeekHistory
            weeks={historyWeeks}
            stateByWeek={stateByWeek}
            onUnlock={onUnlock ? (weekKey) => onUnlock(sucursal, weekKey) : undefined}
          />
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
  stateByWeek,
  historyWeeks,
  onDelete,
  onUnlock,
  enterDelay = 0,
}: {
  sucursal: Sucursal;
  weekly?: CountSession;
  urgentes: CountSession[];
  stateByWeek: Record<string, WeekState>;
  historyWeeks: string[];
  onDelete: (session: CountSession, nombre: string) => void;
  onUnlock?: (sucursal: Sucursal, weekKey: string) => void;
  enterDelay?: number;
}) {
  const status = sessionSemaforo(weekly);
  const cell = "px-3 py-2.5 align-middle";

  return (
    <>
      <tr
        className="animate-fade-up border-t border-line-subtle transition-colors hover:bg-[color-mix(in_srgb,var(--fg)_4%,transparent)]"
        style={{ animationDelay: `${enterDelay}ms` }}
      >
        <td className={cn(cell, "relative min-w-0 pl-4")}>
          <span className={cn("absolute inset-y-0 left-0 w-1", statusBarClass(status))} aria-hidden />
          <SucursalName sucursal={sucursal} />
        </td>
        <td className={cell}>
          <SemaforoDot value={status} size="sm" />
        </td>
        <td className={cell}>
          <WeekHistory
            weeks={historyWeeks}
            stateByWeek={stateByWeek}
            onUnlock={onUnlock ? (weekKey) => onUnlock(sucursal, weekKey) : undefined}
            compact
          />
        </td>
        <td className={cn(cell, "max-w-0 overflow-hidden text-xs text-fg-subtle")}>
          <span className="block truncate">{weekly?.counterName ?? "—"}</span>
          {difCopy(weekly) ? (
            <span className="block truncate font-mono text-[11px] tabular-nums text-fg-muted">{difCopy(weekly)}</span>
          ) : null}
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
  onUnlock,
  loading = false,
  placeholderCount = 8,
}: {
  zona: string;
  rows: SemaforoSucursalRow[];
  historyWeeks: string[];
  onDelete: (session: CountSession, nombre: string) => void;
  onUnlock?: (sucursal: Sucursal, weekKey: string) => void;
  loading?: boolean;
  placeholderCount?: number;
}) {
  const skeletons = Math.min(Math.max(placeholderCount, 4), 12);

  return (
    <section aria-busy={loading || undefined}>
      <h2 className="mb-3 font-display text-lg font-semibold text-fg">{zona}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
        {loading
          ? Array.from({ length: Math.min(skeletons, 6) }).map((_, i) => (
              <SkeletonRow
                key={i}
                loading
                index={i}
                height={176}
                className="neu-raised rounded-lg"
                placeholder={<CardPlaceholder />}
              >
                {null}
              </SkeletonRow>
            ))
          : rows.map((row) => (
              <SucursalCard
                key={row.sucursal.id}
                {...row}
                historyWeeks={historyWeeks}
                onDelete={onDelete}
                onUnlock={onUnlock}
              />
            ))}
      </div>
      <div className="neu-raised hidden overflow-hidden rounded-lg lg:block">
        <table className="w-full table-fixed text-left">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[12%]" />
            <col className="w-[16%]" />
            <col className="w-[14%]" />
            <col className="w-[12%]" />
            <col className="w-[24%]" />
          </colgroup>
          <TableHead historyWeeks={historyWeeks} />
          <tbody>
            {loading
              ? Array.from({ length: skeletons }).map((_, i) => (
                  <tr key={i} className="border-t border-line-subtle">
                    <td colSpan={6} className="p-0">
                      <SkeletonRow loading index={i} height={ROW_H} placeholder={<RowPlaceholder />}>
                        {null}
                      </SkeletonRow>
                    </td>
                  </tr>
                ))
              : rows.map((row, i) => (
                  <SucursalRow
                    key={row.sucursal.id}
                    {...row}
                    historyWeeks={historyWeeks}
                    onDelete={onDelete}
                    onUnlock={onUnlock}
                    enterDelay={Math.min(i, 12) * 22}
                  />
                ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
