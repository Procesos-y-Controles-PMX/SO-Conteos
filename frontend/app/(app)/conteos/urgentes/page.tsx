"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SemaforoDot from "@/components/conteos/SemaforoDot";
import PageHeader from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import { sessionsForSucursal } from "@/lib/store";
import { countProgress, sessionSemaforo, type CountSession } from "@/lib/types";

export default function UrgentesPage() {
  const { user } = useAuth();
  const sucursalId = user?.sucursalId ?? "";
  const [rows, setRows] = useState<CountSession[]>([]);

  useEffect(() => {
    if (!sucursalId) return;
    void sessionsForSucursal(sucursalId, "urgente").then(setRows);
  }, [sucursalId]);

  return (
    <div>
      <PageHeader
        eyebrow="Tienda"
        title="Conteos urgentes"
        subtitle="Solicitudes puntuales. Aquí sí se pide evidencia."
      />
      {rows.length === 0 ? (
        <p className="neu-raised rounded-lg px-4 py-12 text-center text-sm text-fg-subtle">
          No hay conteos urgentes para esta sucursal.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((session) => {
            const { filled, total } = countProgress(session);
            return (
              <li key={session.id}>
                <Link href={`/conteos/${session.id}`} className="neu-raised flex items-center justify-between gap-3 rounded-lg p-4">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-semibold text-fg">{session.titulo}</p>
                    <p className="text-xs text-fg-subtle">
                      {filled}/{total} SKUs · {session.counterName ?? "sin contador"}
                    </p>
                  </div>
                  <SemaforoDot value={sessionSemaforo(session)} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
