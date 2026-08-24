"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import {
  formatQtyInput,
  insertDecimal,
  parseQtyDraft,
  roundQty,
  sanitizeQtyDraft,
} from "@/lib/conteos/qtyMode";
import { cn } from "@/lib/utils";

export default function QuantityField({
  label,
  hint,
  caption,
  value,
  onChange,
  onCommit,
  step = 1,
  size = "md",
  autoFocus,
}: {
  label: string;
  hint?: string;
  caption?: string;
  value: number | null;
  onChange: (next: number | null) => void;
  onCommit?: () => void;
  step?: number;
  size?: "lg" | "md";
  autoFocus?: boolean;
}) {
  const large = size === "lg";
  const current = value ?? 0;
  const [draft, setDraft] = useState<string | null>(null);

  function shown() {
    return draft ?? formatQtyInput(value);
  }

  function applyDraft(raw: string, commitIncompleteZero = false) {
    const sanitized = sanitizeQtyDraft(raw);
    if (sanitized == null) return;
    setDraft(sanitized);
    if (sanitized === "") {
      onChange(null);
      return;
    }
    const parsed = parseQtyDraft(sanitized);
    if (parsed != null) {
      onChange(parsed);
      return;
    }
    if (commitIncompleteZero && (sanitized === "." || sanitized === "0.")) {
      onChange(0);
    }
  }

  function bump(delta: number) {
    setDraft(null);
    onChange(Math.max(0, roundQty(current + delta)));
  }

  function addDecimal() {
    const next = insertDecimal(shown());
    applyDraft(next, true);
  }

  function commitAndMaybeNext() {
    const parsed = parseQtyDraft(shown());
    if (parsed != null) onChange(parsed);
    else if (shown() === "" || shown() === "." || shown() === "0.") onChange(0);
    setDraft(null);
    onCommit?.();
  }

  return (
    <div className="block">
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
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => bump(-step)}
        >
          <Minus className="h-4 w-4" strokeWidth={2.4} />
        </button>
        <input
          type="text"
          inputMode="decimal"
          lang="en"
          autoComplete="off"
          enterKeyHint="next"
          autoFocus={autoFocus}
          className={cn(
            "input-field min-w-0 flex-1 text-center font-mono tabular-nums",
            large ? "h-11 text-xl font-semibold" : "h-10 text-base",
          )}
          value={shown()}
          placeholder="0"
          onFocus={() => setDraft(formatQtyInput(value))}
          onBlur={() => {
            const parsed = parseQtyDraft(shown());
            if (parsed != null) onChange(parsed);
            setDraft(null);
          }}
          onChange={(e) => applyDraft(e.target.value, true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitAndMaybeNext();
            }
          }}
        />
        <button
          type="button"
          className={cn(
            "neu-button flex shrink-0 items-center justify-center rounded-sm font-mono text-fg",
            large ? "h-11 w-11 text-lg font-semibold" : "h-10 w-10 text-base font-semibold",
          )}
          aria-label="Punto decimal"
          onMouseDown={(e) => e.preventDefault()}
          onClick={addDecimal}
        >
          .
        </button>
        <button
          type="button"
          className={cn(
            "neu-button flex shrink-0 items-center justify-center rounded-sm text-fg",
            large ? "h-11 w-11" : "h-10 w-10",
          )}
          aria-label="Sumar"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => bump(step)}
        >
          <Plus className="h-4 w-4" strokeWidth={2.4} />
        </button>
      </div>
      {caption ? <p className="mt-1.5 text-right font-mono text-[11px] tabular-nums text-fg-faint">{caption}</p> : null}
    </div>
  );
}
