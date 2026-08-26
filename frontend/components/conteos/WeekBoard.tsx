import type { SemaforoResumen } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function WeekBoard({ resumen }: { resumen: SemaforoResumen }) {
  const total = Math.max(resumen.sucursales, 1);
  const pct = Math.round((resumen.contado / total) * 100);

  return (
    <div className="neu-raised mb-6 rounded-lg p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="field-label">Semana</p>
        <p className="font-mono text-sm font-semibold tabular-nums text-fg">{pct}%</p>
      </div>
      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-muted-strong">
        {resumen.contado ? (
          <div className="h-full bg-emerald-500" style={{ width: `${(resumen.contado / total) * 100}%` }} />
        ) : null}
        {resumen.curso ? (
          <div className="h-full bg-amber-400" style={{ width: `${(resumen.curso / total) * 100}%` }} />
        ) : null}
        {resumen.pendiente ? (
          <div className="h-full bg-brand" style={{ width: `${(resumen.pendiente / total) * 100}%` }} />
        ) : null}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Contado" value={resumen.contado} tone="verde" />
        <Stat label="En curso" value={resumen.curso} tone="ambar" />
        <Stat label="Pendiente" value={resumen.pendiente} tone="rojo" />
        <Stat label="Urgentes" value={resumen.urgentesAbiertos} />
      </dl>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "verde" | "ambar" | "rojo";
}) {
  return (
    <div>
      <dt className="field-label">{label}</dt>
      <dd
        className={cn(
          "mt-1 font-display text-2xl font-semibold tabular-nums",
          tone === "verde" && "text-emerald-500",
          tone === "ambar" && "text-amber-400",
          tone === "rojo" && "text-brand",
          !tone && "text-fg",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function WeekBoardSkeleton() {
  return (
    <div className="neu-raised mb-6 rounded-lg p-5" aria-hidden>
      <div className="flex items-baseline justify-between gap-3">
        <p className="field-label">Semana</p>
        <div className="h-4 w-10 rounded-sm bg-muted-strong" />
      </div>
      <div className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-muted-strong">
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden"
        >
          <div
            className="h-full w-[45%] bg-[linear-gradient(90deg,transparent_0%,var(--steel-tint)_50%,transparent_100%)]"
            style={{ animation: "so-skeleton-sweep 1600ms linear infinite" }}
          />
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {["Contado", "En curso", "Pendiente", "Urgentes"].map((label) => (
          <div key={label}>
            <dt className="field-label">{label}</dt>
            <dd className="mt-1 h-8 w-10 rounded-sm bg-muted-strong" />
          </div>
        ))}
      </dl>
    </div>
  );
}
