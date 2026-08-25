import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function WeekHistory({
  weeks,
  doneByWeek,
}: {
  weeks: string[];
  doneByWeek: Record<string, boolean>;
}) {
  if (weeks.length === 0) return null;

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
          {weeks.map((key) => {
            const done = Boolean(doneByWeek[key]);
            return (
              <td key={key} className="px-0.5 pt-0.5 text-center">
                <span
                  className={cn(
                    "inline-flex h-5 w-5 items-center justify-center rounded-sm",
                    done ? "text-emerald-500" : "text-brand",
                  )}
                  title={done ? `Semana ${Number(key.split("-W")[1])} enviada` : `Semana ${Number(key.split("-W")[1])} sin envío`}
                >
                  {done ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={2.8} aria-label="Enviado" />
                  ) : (
                    <X className="h-3.5 w-3.5" strokeWidth={2.8} aria-label="Sin envío" />
                  )}
                </span>
              </td>
            );
          })}
        </tr>
      </tbody>
    </table>
  );
}
