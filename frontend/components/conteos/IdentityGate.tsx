"use client";

import { FormEvent, useState } from "react";
import { cn } from "@/lib/utils";

const PUESTOS = ["Almacenista", "Auxiliar", "Gerente"];

export default function IdentityGate({
  initialName,
  initialPuesto,
  onConfirm,
}: {
  initialName?: string;
  initialPuesto?: string;
  onConfirm: (payload: { nombre: string; puesto: string }) => void;
}) {
  const [nombre, setNombre] = useState(initialName ?? "");
  const [puesto, setPuesto] = useState(initialPuesto ?? "");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!nombre.trim() || !puesto.trim()) return;
    onConfirm({ nombre: nombre.trim(), puesto: puesto.trim() });
  }

  return (
    <form onSubmit={onSubmit} className="neu-raised mx-auto max-w-lg rounded-lg p-5 sm:p-7">
      <p className="field-label">Antes de contar</p>
      <h2 className="mt-1 font-display text-2xl font-semibold text-fg">Quién realiza el conteo</h2>
      <p className="mt-2 text-sm text-fg-subtle">
        Queda en el registro del conteo. El aviso llega al gerente de la sucursal.
      </p>

      <label className="mt-6 block">
        <span className="field-label mb-1.5 block">Nombre</span>
        <input
          className="input-field"
          autoComplete="name"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
        />
      </label>

      <label className="mt-4 block">
        <span className="field-label mb-1.5 block">Puesto</span>
        <input
          className="input-field"
          placeholder="Almacenista, auxiliar, gerente…"
          value={puesto}
          onChange={(e) => setPuesto(e.target.value)}
          required
        />
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        {PUESTOS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setPuesto(item)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold",
              puesto === item ? "neu-nav-active text-white" : "neu-button text-fg-muted",
            )}
          >
            {item}
          </button>
        ))}
      </div>

      <button type="submit" className="btn-primary mt-6 w-full">
        Empezar conteo
      </button>
    </form>
  );
}
