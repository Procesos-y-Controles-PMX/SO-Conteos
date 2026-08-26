import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

function WeekMark({ weekKey, done }: { weekKey: string; done: boolean }) {
  const week = Number(weekKey.split("-W")[1]);
  return (
    <span
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded-sm",
        done ? "text-emerald-500" : "text-brand",
      )}
      title={done ? `Semana ${week} enviada` : `Semana ${week} sin envío`}
    >
      {done ? (
        <Check className="h-3.5 w-3.5" strokeWidth={2.8} aria-label={`Semana ${week} enviada`} />
      ) : (
        <X className="h-3.5 w-3.5" strokeWidth={2.8} aria-label={`Semana ${week} sin envío`} />
      )}
    </span>
  );
}

export default function WeekHistory({
  weeks,
  doneByWeek,
  compact = false,
}: {
  weeks: string[];
  doneByWeek: Record<string, boolean>;
  compact?: boolean;
}) {
  if (weeks.length === 0) return null;

  if (compact) {
    return (
      <div className="grid w-[5.75rem] grid-cols-4 justify-items-center" aria-label="Últimas 4 semanas">
        {weeks.map((key) => (
          <WeekMark key={key} weekKey={key} done={Boolean(doneByWeek[key])} />
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
            <th key={key} className="px-0.5 font-mono text-[10px] font-semibold tabular-nums text-fg-faint">
              {Number(key.split("-W")[1])}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {weeks.map((key) => (
            <td key={key} className="px-0.5 pt-0.5 text-center">
              <WeekMark weekKey={key} done={Boolean(doneByWeek[key])} />
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}
