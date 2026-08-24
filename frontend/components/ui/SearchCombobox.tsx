"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import DropdownPanel from "@/components/ui/DropdownPanel";
import { cn } from "@/lib/utils";

export type SearchComboboxOption = {
  id: string;
  label: string;
  sublabel?: string;
};

type Props = {
  value: SearchComboboxOption | null;
  onChange: (value: SearchComboboxOption | null) => void;
  onSearch: (query: string) => Promise<SearchComboboxOption[]> | SearchComboboxOption[];
  placeholder?: string;
  disabled?: boolean;
  minChars?: number;
  className?: string;
  /** When false, typing does not emit onChange(null). Use for jump-to lists. */
  clearOnType?: boolean;
};

export default function SearchCombobox({
  value,
  onChange,
  onSearch,
  placeholder = "Buscar…",
  disabled = false,
  minChars = 2,
  className,
  clearOnType = true,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState(value?.label ?? "");
  const [options, setOptions] = useState<SearchComboboxOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  useEffect(() => {
    setInputText(value?.label ?? "");
  }, [value?.id, value?.label]);

  const canSearch = useCallback(
    (query: string) => minChars === 0 || query.trim().length >= minChars,
    [minChars],
  );

  const runSearch = useCallback(
    async (query: string) => {
      if (!canSearch(query)) {
        setOptions([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const results = await onSearch(query.trim());
        setOptions(results);
        const current = value?.id ? results.findIndex((opt) => opt.id === value.id) : -1;
        setHighlightIndex(current >= 0 ? current : results.length ? 0 : -1);
      } finally {
        setLoading(false);
      }
    },
    [canSearch, onSearch, value?.id],
  );

  useEffect(() => {
    if (!open) return;
    const query = value && inputText.trim() === value.label.trim() ? "" : inputText;
    const delay = !query.trim() ? 0 : 280;
    const timer = window.setTimeout(() => {
      void runSearch(query);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [inputText, open, minChars, runSearch, value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setInputText(value?.label ?? "");
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [value?.label]);

  function selectOption(option: SearchComboboxOption) {
    setInputText(option.label);
    onChange(option);
    setOpen(false);
    setOptions([]);
  }

  const trimmed = inputText.trim();
  const showMinHint = open && minChars > 0 && trimmed.length < minChars;
  const showEmpty = open && !loading && canSearch(inputText) && options.length === 0;
  const showList = open && options.length > 0;
  const panelOpen = open && !disabled && (loading || showMinHint || showEmpty || showList);

  useEffect(() => {
    if (!open || highlightIndex < 0) return;
    document.getElementById(`${listId}-opt-${highlightIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [open, highlightIndex, listId, options.length]);

  return (
    <div className={cn("relative", className)} ref={rootRef}>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        className="input-field"
        disabled={disabled}
        placeholder={placeholder}
        value={inputText}
        autoComplete="off"
        onFocus={(e) => {
          setOpen(true);
          e.currentTarget.select();
        }}
        onChange={(e) => {
          const next = e.target.value;
          setInputText(next);
          if (clearOnType && value && next !== value.label) onChange(null);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setInputText(value?.label ?? "");
            return;
          }
          if (!showList) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightIndex((i) => Math.min(i + 1, options.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && highlightIndex >= 0) {
            e.preventDefault();
            const opt = options[highlightIndex];
            if (opt) selectOption(opt);
          }
        }}
      />
      <DropdownPanel open={panelOpen} id={listId} className="absolute left-0 right-0 z-50 mt-2 max-h-[min(24rem,55vh)]">
        {loading ? <li className="px-3 py-2 text-xs text-fg-faint">Buscando…</li> : null}
        {showMinHint && !loading ? (
          <li className="px-3 py-2 text-xs text-fg-faint">Escribe al menos {minChars} caracteres</li>
        ) : null}
        {showEmpty && !loading ? <li className="px-3 py-2 text-xs text-fg-faint">Sin resultados</li> : null}
        {showList
          ? options.map((opt, index) => (
              <li key={opt.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === highlightIndex}
                  className={cn(
                    "neu-option block w-full rounded-sm px-3 py-2.5 text-left",
                    index === highlightIndex && "shadow-[var(--neu-pressed-sm)]",
                  )}
                  id={`${listId}-opt-${index}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectOption(opt)}
                >
                  <span className="block text-sm font-semibold leading-snug text-fg">{opt.label}</span>
                  {opt.sublabel ? (
                    <span className="mt-0.5 block font-mono text-[11px] tabular-nums tracking-wide text-fg-muted">
                      {opt.sublabel}
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          : null}
      </DropdownPanel>
    </div>
  );
}
