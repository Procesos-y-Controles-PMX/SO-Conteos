"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SemaforoDot from "@/components/conteos/SemaforoDot";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PageHeader from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import { sessionsForSucursal, weeklySessionFor } from "@/lib/store";
import { countProgress, sessionSemaforo, type CountSession } from "@/lib/types";
import { weekKeyFromDate, weekLabel } from "@/lib/week";

const START_WARNING =
  "¿Está seguro de que desea continuar con el proceso? Una vez iniciado, deberá completarse hasta el final.";

export default function SemanalesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const sucursalId = user?.sucursalId ?? "";
  const [rows, setRows] = useState<CountSession[]>([]);
  const [pendingStartId, setPendingStartId] = useState<string | null>(null);

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
          if (session.status === "pendiente") {
            return (
              <li key={session.id}>
                <button
                  type="button"
                  className="neu-raised flex w-full items-center justify-between gap-3 rounded-lg p-4 text-left"
                  onClick={() => setPendingStartId(session.id)}
                >
                  <div className="min-w-0">
                    <p className="font-display text-lg font-semibold text-fg">{weekLabel(session.weekKey)}</p>
                    <p className="text-xs text-fg-subtle">
                      {filled}/{total} SKUs · {session.counterName ?? "sin contador"}
                    </p>
                  </div>
                  <SemaforoDot value={sessionSemaforo(session)} />
                </button>
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

      <ConfirmDialog
        open={Boolean(pendingStartId)}
        title="Iniciar conteo"
        body={START_WARNING}
        confirmLabel="Continuar"
        cancelLabel="Cancelar"
        onCancel={() => setPendingStartId(null)}
        onConfirm={() => {
          if (!pendingStartId) return;
          const id = pendingStartId;
          setPendingStartId(null);
          router.push(`/conteos/${id}`);
        }}
      />
    </div>
  );
}
