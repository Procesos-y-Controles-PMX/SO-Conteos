"use client";

import { useCallback, useEffect, useState } from "react";
import { Camera, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import QuantityField from "@/components/conteos/QuantityField";
import SearchCombobox, { type SearchComboboxOption } from "@/components/ui/SearchCombobox";
import {
  bagKgFromName,
  canCountBags,
  conversionCaption,
  fromDisplay,
  pesoStep,
  readPreferredQtyMode,
  toDisplay,
  unitHint,
  writePreferredQtyMode,
  type QtyMode,
} from "@/lib/conteos/qtyMode";
import type { CountLine, CountSession } from "@/lib/types";
import { cn } from "@/lib/utils";
import { weekLabel } from "@/lib/week";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function lineToOption(item: CountLine): SearchComboboxOption {
  return {
    id: item.sku,
    label: item.nombre,
    sublabel: item.fisico != null ? `● ${item.sku}` : item.sku,
  };
}

export default function SkuStepper({
  session,
  index,
  onIndex,
  onPatch,
  onFinish,
}: {
  session: CountSession;
  index: number;
  onIndex: (next: number) => void;
  onPatch: (sku: string, patch: Partial<CountLine>) => void;
  onFinish: () => void;
}) {
  const line = session.lines[index];
  const total = session.lines.length;
  const [qtyMode, setQtyMode] = useState<QtyMode>("sacos");

  useEffect(() => {
    setQtyMode(readPreferredQtyMode());
  }, []);

  function chooseQtyMode(next: QtyMode) {
    setQtyMode(next);
    writePreferredQtyMode(next);
  }

  const searchLines = useCallback(
    (query: string): SearchComboboxOption[] => {
      const q = normalize(query);
      const matched: SearchComboboxOption[] = [];
      for (const item of session.lines) {
        if (q && !normalize(`${item.nombre} ${item.sku}`).includes(q)) continue;
        matched.push(lineToOption(item));
      }
      return matched;
    },
    [session.lines],
  );

  if (!line) {
    return (
      <div className="neu-raised mx-auto max-w-lg rounded-lg p-6 text-center">
        <p className="field-label">Sin SKUs</p>
        <h2 className="mt-1 font-display text-xl font-semibold text-fg">No hay productos para contar</h2>
        <p className="mt-2 text-sm text-fg-subtle">
          No hay materiales L1–L12 (ni líneas en blanco) de SAP para esta sucursal.
        </p>
      </div>
    );
  }

  const requireEvidence = session.kind === "urgente";
  const last = index >= total - 1;
  const counted = session.lines.filter((l) => l.fisico != null).length;
  const bagKg = bagKgFromName(line.nombre);
  const bags = canCountBags(line.nombre, line.um);
  const mode: QtyMode = bags ? qtyMode : "peso";
  const step = bags && bagKg != null ? (mode === "sacos" ? 1 : pesoStep(line.um, bagKg)) : 1;

  function bindQty(stored: number | null, patch: (next: number | null) => void) {
    return {
      hint: bags && mode === "sacos" ? "SACOS" : line.um,
      value: bags && bagKg != null ? toDisplay(stored, line.um, mode, bagKg) : stored,
      caption: bags && bagKg != null ? conversionCaption(stored, line.um, mode, bagKg) : undefined,
      step,
      onChange: (next: number | null) => {
        patch(bags && bagKg != null ? fromDisplay(next, line.um, mode, bagKg) : next);
      },
    };
  }

  function goNext() {
    if (line.fisico == null) {
      onPatch(line.sku, { fisico: 0 });
    }
    if (requireEvidence && !line.evidencia) {
      toast.error("Adjunta foto o video de este producto.");
      return;
    }
    if (last) onFinish();
    else onIndex(index + 1);
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col pb-28 lg:pb-8">
      <div className="mb-4">
        <p className="field-label">
          {session.kind === "semanal" ? weekLabel(session.weekKey) : "Urgente"} · producto {index + 1} de {total}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted-strong">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${(counted / Math.max(total, 1)) * 100}%` }}
            />
          </div>
          <p className="shrink-0 font-mono text-xs tabular-nums text-fg-muted">
            {counted}/{total} capturados
          </p>
        </div>
        <label className="mt-3 block">
          <span className="sr-only">Buscar producto</span>
          <SearchCombobox
            value={lineToOption(line)}
            placeholder="Buscar producto…"
            minChars={0}
            clearOnType={false}
            onSearch={searchLines}
            onChange={(opt) => {
              if (!opt) return;
              const next = session.lines.findIndex((item) => item.sku === opt.id);
              if (next >= 0) onIndex(next);
            }}
          />
        </label>
      </div>

      <article className="neu-raised rounded-lg p-5">
        <h2 className="font-display text-xl font-semibold leading-tight text-fg">{line.nombre}</h2>
        <p className="mt-1.5 cursor-text select-all font-mono text-sm tabular-nums tracking-wide text-fg-muted">
          {line.sku}
        </p>

        {bags && bagKg != null ? (
          <div className="mt-5">
            <p id="captura-unidad-label" className="field-label mb-2">
              Capturar en
            </p>
            <div
              role="radiogroup"
              aria-labelledby="captura-unidad-label"
              className="neu-tray grid grid-cols-2 gap-1 p-1"
            >
              {(["sacos", "peso"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  role="radio"
                  aria-checked={mode === item}
                  onClick={() => chooseQtyMode(item)}
                  className={cn(
                    "rounded-sm px-3 py-2 text-sm font-semibold",
                    mode === item ? "neu-nav-active text-white" : "text-fg-muted",
                  )}
                >
                  {item === "sacos" ? "Sacos" : "Peso"}
                </button>
              ))}
            </div>
            <p className="mt-2 text-center text-[11px] text-fg-faint">{unitHint(line.um, bagKg, mode)}</p>
          </div>
        ) : null}

        <div className="mt-5">
          <QuantityField
            key={`${line.sku}-${mode}`}
            size="lg"
            label="Inventario físico"
            autoFocus
            onCommit={goNext}
            {...bindQty(line.fisico, (fisico) => onPatch(line.sku, { fisico }))}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <QuantityField
            key={`${line.sku}-${mode}-pe`}
            label="Pendiente entregar"
            {...bindQty(line.pendienteEntregar, (pendienteEntregar) => onPatch(line.sku, { pendienteEntregar }))}
          />
          <QuantityField
            key={`${line.sku}-${mode}-pf`}
            label="Pendiente facturar"
            {...bindQty(line.pendienteFacturar, (pendienteFacturar) => onPatch(line.sku, { pendienteFacturar }))}
          />
        </div>

        {requireEvidence ? (
          <label className="neu-button mt-5 flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-4 py-3 text-sm text-fg">
            <Camera className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">{line.evidencia ? line.evidencia : "Adjuntar foto o video"}</span>
            <input
              type="file"
              accept="image/*,video/*"
              capture="environment"
              className="hidden"
              onChange={(e) => onPatch(line.sku, { evidencia: e.target.files?.[0]?.name })}
            />
          </label>
        ) : null}
      </article>

      <div className="fixed inset-x-0 bottom-0 z-40 bg-canvas/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm lg:static lg:mt-4 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="mx-auto flex max-w-lg gap-3">
          <button type="button" className="btn-secondary flex-1" disabled={index === 0} onClick={() => onIndex(index - 1)}>
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </button>
          <button type="button" className="btn-primary flex-[1.3]" onClick={goNext}>
            {last ? "Revisar diferencias" : "Siguiente"}
            {!last ? <ChevronRight className="h-4 w-4" /> : null}
          </button>
        </div>
      </div>
    </div>
  );
}
