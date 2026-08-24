import { cn } from "@/lib/utils";
import type { Semaforo } from "@/lib/types";

const COPY: Record<Semaforo, string> = {
  verde: "Contado",
  ambar: "En curso",
  rojo: "Pendiente",
};

export default function SemaforoDot({
  value,
  label,
  size = "md",
}: {
  value: Semaforo;
  label?: string;
  size?: "sm" | "md" | "lg";
}) {
  const text = label ?? COPY[value];
  const dim = size === "lg" ? "h-3 w-3" : size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2",
        size === "lg" && "rounded-full px-3 py-1.5 text-sm font-semibold",
        size === "lg" && value === "verde" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        size === "lg" && value === "ambar" && "bg-amber-400/20 text-amber-800 dark:text-amber-200",
        size === "lg" && value === "rojo" && "bg-brand/15 text-brand",
      )}
    >
      <span
        className={cn(
          "inline-flex rounded-full",
          dim,
          value === "verde" && "bg-emerald-500",
          value === "ambar" && "bg-amber-400",
          value === "rojo" && "bg-brand",
        )}
        aria-hidden
      />
      <span className={cn(size === "lg" ? "text-sm font-semibold" : "text-xs font-semibold text-fg-muted")}>
        {text}
      </span>
    </span>
  );
}
