"use client";

import { useState } from "react";
import { formatQtyInput, parseQtyDraft, sanitizeQtyDraft } from "@/lib/conteos/qtyMode";
import { cn } from "@/lib/utils";

export default function QuantityField({
  label,
  hint,
  caption,
  value,
  onChange,
  onCommit,
  size = "md",
  autoFocus,
}: {
  label: string;
  /** Unidad de medida: se muestra a la derecha del cuadro de texto. */
  hint?: string;
  caption?: string;
  value: number | null;
  onChange: (next: number | null) => void;
  onCommit?: () => void;
  size?: "lg" | "md";
  autoFocus?: boolean;
}) {
  const large = size === "lg";
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

  function commitAndMaybeNext() {
    const parsed = parseQtyDraft(shown());
    if (parsed != null) onChange(parsed);
    else if (shown() === "" || shown() === "." || shown() === "0.") onChange(0);
    setDraft(null);
    onCommit?.();
  }

  return (
    <div className="block">
      <span
        className={cn(
          "mb-2 block",
          large ? "text-[11px] font-bold uppercase tracking-[0.14em] text-fg" : "field-label",
        )}
      >
        {label}
      </span>
      <div className="flex items-stretch gap-2">
        <input
          type="text"
          inputMode="decimal"
          lang="en"
          autoComplete="off"
          enterKeyHint="next"
          autoFocus={autoFocus}
          className={cn(
            "input-field min-w-0 flex-1 text-center font-mono tabular-nums",
            large ? "h-12 text-xl font-semibold" : "h-10 text-base",
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
        {hint ? (
          <span
            className={cn(
              "flex shrink-0 items-center justify-center font-mono font-semibold uppercase text-fg-muted",
              large ? "h-12 min-w-14 text-xs" : "h-10 min-w-12 text-[11px]",
            )}
          >
            {hint}
          </span>
        ) : null}
      </div>
      {caption ? <p className="mt-1.5 text-right font-mono text-[11px] tabular-nums text-fg-faint">{caption}</p> : null}
    </div>
  );
}
