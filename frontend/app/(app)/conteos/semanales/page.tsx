"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import SemaforoDot from "@/components/conteos/SemaforoDot";
import PageHeader from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import { sessionsForSucursal, weeklySessionFor } from "@/lib/store";
import { countProgress, sessionSemaforo, type CountSession } from "@/lib/types";
import { weekKeyFromDate, weekLabel } from "@/lib/week";

export default function SemanalesPage() {
  const { user } = useAuth();
  const sucursalId = user?.sucursalId ?? "";
  const [rows, setRows] = useState<CountSession[]>([]);

  useEffect(() => {
    if (!sucursalId) return;
    void weeklySessionFor(sucursalId, weekKeyFromDate()).then(() =>
      sessionsForSucursal(sucursalId, "semanal").then(setRows),
    );
  }, [sucursalId]);

  return (
    <div>
      <PageHeader
        eyebrow="Tienda"
        title="Conteos semanales"
        subtitle="Un conteo por semana. El semáforo indica si ya se envió."
      />
      <ul className="space-y-3">
        {rows.map((session) => {
          const { filled, total } = countProgress(session);
          const href = `/conteos/${session.id}`;
          if (session.bloqueado) {
            return (
              <li key={session.id}>
                <div className="neu-raised flex items-center justify-between gap-3 rounded-lg p-4 opacity-70" aria-disabled>
                  <div className="min-w-0">
                    <p className="font-display text-lg font-semibold text-fg">{weekLabel(session.weekKey)}</p>
                    <p className="text-xs text-fg-subtle">Bloqueada · pide a un administrador que la desbloquee.</p>
                  </div>
                  <Lock className="h-4 w-4 shrink-0 text-brand" aria-label="Bloqueada" />
                </div>
              </li>
            );
          }
          return (
            <li key={session.id}>
              <Link href={href} className="neu-raised flex items-center justify-between gap-3 rounded-lg p-4">
                <div className="min-w-0">
                  <p className="font-display text-lg font-semibold text-fg">{weekLabel(session.weekKey)}</p>
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
    </div>
  );
}
