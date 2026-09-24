import { Check, Lock, X } from "lucide-react";
import type { WeekState } from "@/lib/types";
import { cn } from "@/lib/utils";
import { weekLabel, weekLabelParts } from "@/lib/week";

function WeekMark({
  weekKey,
  state,
  onUnlock,
}: {
  weekKey: string;
  state: WeekState;
  onUnlock?: (weekKey: string) => void;
}) {
  const label = weekLabel(weekKey);
  const base = "inline-flex h-5 w-5 items-center justify-center rounded-sm";
  if (state === "enviado") {
    return (
      <span className={cn(base, "text-emerald-500")} title={`${label} enviada`}>
        <Check className="h-3.5 w-3.5" strokeWidth={2.8} aria-label={`${label} enviada`} />
      </span>
    );
  }
  if (state === "bloqueada") {
    const title = `${label} bloqueada sin envío${onUnlock ? " · toca para desbloquear" : ""}`;
    if (!onUnlock) {
      return (
        <span className={cn(base, "text-brand")} title={title}>
          <Lock className="h-3 w-3" strokeWidth={2.6} aria-label={title} />
        </span>
      );
    }
    return (
      <button
        type="button"
        className={cn(base, "text-brand transition-colors hover:bg-[color-mix(in_srgb,var(--fg)_8%,transparent)]")}
        title={title}
        aria-label={title}
        onClick={() => onUnlock(weekKey)}
      >
        <Lock className="h-3 w-3" strokeWidth={2.6} />
      </button>
    );
  }
  return (
    <span className={cn(base, "text-brand")} title={`${label} sin envío`}>
      <X className="h-3.5 w-3.5" strokeWidth={2.8} aria-label={`${label} sin envío`} />
    </span>
  );
}

function WeekHead({ weekKey }: { weekKey: string }) {
  const { month, day } = weekLabelParts(weekKey);
  return (
    <span className="flex flex-col items-center leading-none" title={weekLabel(weekKey)}>
      <span className="text-[9px] font-bold tracking-wide text-fg-faint">{month}</span>
      <span className="mt-0.5 font-mono text-[10px] font-semibold tabular-nums text-fg-muted">{day}</span>
    </span>
  );
}

export default function WeekHistory({
  weeks,
  stateByWeek,
  onUnlock,
  compact = false,
}: {
  weeks: string[];
  stateByWeek: Record<string, WeekState>;
  onUnlock?: (weekKey: string) => void;
  compact?: boolean;
}) {
  if (weeks.length === 0) return null;

  if (compact) {
    return (
      <div className="grid w-[7.25rem] grid-cols-4 justify-items-center" aria-label="Últimas 4 semanas">
        {weeks.map((key) => (
          <WeekMark key={key} weekKey={key} state={stateByWeek[key] ?? "abierta"} onUnlock={onUnlock} />
        ))}
      </div>
    );
  }

  return (
    <table className="shrink-0 border-separate border-spacing-x-1.5 border-spacing-y-0.5">
      <caption className="field-label mb-1 text-left">4 sem</caption>
      <thead>
        <tr>
          {weeks.map((key) => (
            <th key={key} className="px-0.5">
              <WeekHead weekKey={key} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {weeks.map((key) => (
            <td key={key} className="px-0.5 pt-0.5 text-center">
              <WeekMark weekKey={key} state={stateByWeek[key] ?? "abierta"} onUnlock={onUnlock} />
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}
