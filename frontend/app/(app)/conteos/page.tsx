"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarClock, ChevronRight, Siren } from "lucide-react";
import SemaforoDot from "@/components/conteos/SemaforoDot";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PageHeader from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import { getInventario, sessionsForSucursal, weeklySessionFor } from "@/lib/store";
import { countProgress, sessionSemaforo, type CountSession, type InventarioMeta } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { weekKeyFromDate, weekLabel } from "@/lib/week";

const START_WARNING =
  "¿Está seguro de que desea continuar con el proceso? Una vez iniciado, deberá completarse hasta el final.";

export default function ConteosHubPage() {
  const router = useRouter();
  const { user } = useAuth();
  const sucursalId = user?.sucursalId ?? "";
  const [weekly, setWeekly] = useState<CountSession | null>(null);
  const [urgentes, setUrgentes] = useState<CountSession[]>([]);
  const [inventario, setInventario] = useState<InventarioMeta | null>(null);
  const [skuCount, setSkuCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [confirmStart, setConfirmStart] = useState(false);

  useEffect(() => {
    if (!sucursalId) return;
    void Promise.all([
      weeklySessionFor(sucursalId, weekKeyFromDate()),
      sessionsForSucursal(sucursalId, "urgente"),
      getInventario(),
    ])
      .then(([week, urg, inv]) => {
        setWeekly(week);
        setUrgentes(urg);
        setInventario(inv.meta);
        setSkuCount(week.lines.length);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  }, [sucursalId]);

  const urgentesPendientes = urgentes.filter((s) => s.status !== "enviado");
  const urgentePendiente = urgentesPendientes[0] ?? urgentes[0];
  const weeklyProgress = weekly ? countProgress(weekly) : { filled: 0, total: skuCount };
  const weeklyHref = weekly ? `/conteos/${weekly.id}` : "/conteos/semanales";
  const needsStartWarning = Boolean(weekly && weekly.status === "pendiente");

  function openWeekly() {
    if (needsStartWarning) {
      setConfirmStart(true);
      return;
    }
    router.push(weeklyHref);
  }

  return (
    <div>
      <PageHeader
        eyebrow={user?.zona ? `${user.zona} · ${user.nombre}` : user?.nombre}
        title="Conteos"
        subtitle={`${weekLabel(weekKeyFromDate())}. Materiales L1–L12 de esta sucursal (incluye líneas sin tag).`}
      />
      {error ? <p className="mb-4 text-sm text-brand">{error}</p> : null}

      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="neu-raised rounded-lg px-3 py-3">
          <p className="field-label">SKUs</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-fg">{skuCount || "—"}</p>
        </div>
        <div className="neu-raised rounded-lg px-3 py-3">
          <p className="field-label">Semanal</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-fg">
            {weeklyProgress.filled}/{weeklyProgress.total}
          </p>
        </div>
        <div className="neu-raised rounded-lg px-3 py-3">
          <p className="field-label">Urgentes</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-fg">{urgentesPendientes.length}</p>
        </div>
      </div>

      {inventario ? (
        <p className="mb-5 text-xs text-fg-subtle">
          {inventario.lastUpdatedAt
            ? `Inventario ${formatDateTime(inventario.lastUpdatedAt)} · ${inventario.lastFileName}`
            : "Sin carga SAP: el teórico es 0 y al revisar verás la diferencia vs 0."}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <button type="button" onClick={openWeekly} className="neu-raised rounded-lg p-5 text-left">
          <div className="flex items-start justify-between gap-3">
            <CalendarClock className="h-5 w-5 text-steel" />
            <SemaforoDot value={sessionSemaforo(weekly ?? undefined)} />
          </div>
          <h2 className="mt-3 font-display text-xl font-semibold text-fg">Conteo semanal</h2>
          <p className="mt-1 text-sm text-fg-subtle">
            Stock L1–L12 de esta sucursal. Foto de evidencia si hay pendientes.
          </p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted-strong">
            <div
              className="h-full rounded-full bg-steel transition-all"
              style={{
                width: `${(weeklyProgress.filled / Math.max(weeklyProgress.total, 1)) * 100}%`,
              }}
            />
          </div>
          <p className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-steel">
            {weekly?.status === "enviado" ? "Ver enviado" : weeklyProgress.filled > 0 ? "Continuar" : "Empezar"}
            <ChevronRight className="h-4 w-4" />
          </p>
        </button>

        <Link
          href={urgentePendiente ? `/conteos/${urgentePendiente.id}` : "/conteos/urgentes"}
          className="neu-raised rounded-lg p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <Siren className="h-5 w-5 text-brand" />
            <SemaforoDot
              value={sessionSemaforo(urgentePendiente)}
              label={urgentes.length === 0 ? "Sin solicitudes" : undefined}
            />
          </div>
          <h2 className="mt-3 font-display text-xl font-semibold text-fg">Conteos urgentes</h2>
          <p className="mt-1 text-sm text-fg-subtle">
            {urgentesPendientes.length === 0
              ? "No hay solicitudes puntuales."
              : `${urgentesPendientes.length} pendiente(s). Requiere foto o video.`}
          </p>
          <p className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-steel">
            {urgentesPendientes.length > 0 ? "Abrir pendiente" : "Ver listado"}
            <ChevronRight className="h-4 w-4" />
          </p>
        </Link>
      </div>

      <ConfirmDialog
        open={confirmStart}
        title="Iniciar conteo"
        body={START_WARNING}
        confirmLabel="Continuar"
        cancelLabel="Cancelar"
        onCancel={() => setConfirmStart(false)}
        onConfirm={() => {
          setConfirmStart(false);
          router.push(weeklyHref);
        }}
      />
    </div>
  );
}
