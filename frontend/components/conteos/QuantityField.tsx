"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export default function QuantityField({
  label,
  hint,
  value,
  onChange,
  onCommit,
  size = "md",
  autoFocus,
}: {
  label: string;
  hint?: string;
  value: number | null;
  onChange: (next: number | null) => void;
  onCommit?: () => void;
  size?: "lg" | "md";
  autoFocus?: boolean;
}) {
  const large = size === "lg";
  const current = value ?? 0;

  function bump(delta: number) {
    onChange(Math.max(0, current + delta));
  }

  return (
    <label className="block">
      <span className="mb-2 flex items-baseline justify-between gap-2">
        <span className="field-label">{label}</span>
        {hint ? <span className="font-mono text-[11px] text-fg-faint">{hint}</span> : null}
      </span>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          className={cn(
            "neu-button flex shrink-0 items-center justify-center rounded-sm text-fg",
            large ? "h-11 w-11" : "h-10 w-10",
          )}
          aria-label="Restar"
          onClick={() => bump(-1)}
        >
          <Minus className="h-4 w-4" strokeWidth={2.4} />
        </button>
        <input
          inputMode="decimal"
          autoFocus={autoFocus}
          className={cn(
            "input-field min-w-0 flex-1 text-center font-mono tabular-nums",
            large ? "h-11 text-xl font-semibold" : "h-10 text-base",
          )}
          value={value ?? ""}
          placeholder="0"
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === "") {
              onChange(null);
              return;
            }
            if (!/^\d+([.]\d*)?$/.test(raw)) return;
            onChange(Number(raw));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCommit?.();
            }
          }}
        />
        <button
          type="button"
          className={cn(
            "neu-button flex shrink-0 items-center justify-center rounded-sm text-fg",
            large ? "h-11 w-11" : "h-10 w-10",
          )}
          aria-label="Sumar"
          onClick={() => bump(1)}
        >
          <Plus className="h-4 w-4" strokeWidth={2.4} />
        </button>
      </div>
    </label>
  );
}
