"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import DropdownPanel from "@/components/ui/DropdownPanel";
import { cn } from "@/lib/utils";

export type SelectDropdownOption = {
  id: string;
  label: string;
  sublabel?: string;
};

type Props = {
  value: string;
  onChange: (id: string) => void;
  options: SelectDropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  emptyMessage?: string;
  className?: string;
};

export default function SelectDropdown({
  value,
  onChange,
  options,
  placeholder = "Selecciona…",
  disabled = false,
  emptyMessage = "Sin opciones",
  className,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((opt) => opt.id === value) ?? null;

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className={cn("relative", className)} ref={rootRef}>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        className="input-field flex w-full items-center justify-between gap-2 text-left"
        onClick={() => {
          if (!disabled) setOpen((v) => !v);
        }}
      >
        <span className={cn("min-w-0 truncate", selected ? "text-fg" : "text-fg-faint")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0 text-fg-faint transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      <DropdownPanel open={open && !disabled} id={listId} className="absolute left-0 right-0 z-50 mt-2 max-h-52">
        {options.length === 0 ? (
          <li className="px-3 py-2 text-xs text-fg-faint">{emptyMessage}</li>
        ) : (
          options.map((opt) => (
            <li key={opt.id}>
              <button
                type="button"
                role="option"
                aria-selected={opt.id === value}
                className="neu-option block w-full rounded-sm px-3 py-2 text-left text-xs"
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
              >
                <span className="block font-medium text-fg">{opt.label}</span>
                {opt.sublabel ? <span className="mt-0.5 block text-[10px] text-fg-faint">{opt.sublabel}</span> : null}
              </button>
            </li>
          ))
        )}
      </DropdownPanel>
    </div>
  );
}
