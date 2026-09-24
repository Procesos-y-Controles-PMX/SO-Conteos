"use client";

import { useRouter } from "next/navigation";
import DiffReview from "@/components/conteos/DiffReview";
import EvidenceZipButton from "@/components/conteos/EvidenceZipButton";
import SemaforoDot from "@/components/conteos/SemaforoDot";
import PageHeader from "@/components/ui/PageHeader";
import { countProgress, sessionDiffStats, sessionSemaforo, type CountSession } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { weekLabel } from "@/lib/week";

const STATUS_TITLE: Record<CountSession["status"], string> = {
  pendiente: "Aún no empieza",
  en_progreso: "En captura en sucursal",
  enviado: "Conteo registrado",
};

export default function AdminCountReview({
  session,
  onDelete,
}: {
  session: CountSession;
  onDelete: () => void;
}) {
  const router = useRouter();
  const { filled, total } = countProgress(session);
  const diffs = sessionDiffStats(session);
  const hasEvidence = session.lines.some(
    (line) => line.evidenciaPath || line.evidenciaEntregarPath || line.evidenciaFacturarPath,
  );
  const who = session.counterName
    ? `${session.counterName}${session.counterPuesto ? ` · ${session.counterPuesto}` : ""}`
    : "La sucursal aún no indica quién cuenta";

  return (
    <div>
      <PageHeader
        eyebrow={session.kind === "semanal" ? weekLabel(session.weekKey) : "Urgente"}
        title={session.titulo}
        subtitle={`${filled}/${total} SKUs · ${diffs.skuCount} dif · ${formatMoney(diffs.monto)} · solo consulta`}
      />
      <div className="mx-auto max-w-lg space-y-4">
        <div className="neu-raised rounded-lg p-6">
          <SemaforoDot value={sessionSemaforo(session)} size="lg" />
          <h2 className="mt-3 font-display text-2xl font-semibold text-fg">{STATUS_TITLE[session.status]}</h2>
          <p className="mt-2 text-sm text-fg-subtle">{who}</p>
          {session.status !== "enviado" ? (
            <p className="mt-2 text-sm text-fg-subtle">
              La captura la hace la sucursal. Desde aquí solo puedes revisar y borrar.
            </p>
          ) : null}
        </div>
        <DiffReview session={session} mode="diferencias" readOnly />
        <DiffReview session={session} mode="captura" readOnly />
        {hasEvidence ? (
          <EvidenceZipButton
            ids={[session.id]}
            fileName={`evidencias-${session.titulo}`.replace(/[^\p{L}\p{N}-]+/gu, "-")}
            className="w-full"
          />
        ) : null}
        <button type="button" className="btn-secondary w-full" onClick={() => router.push("/admin")}>
          Volver al semáforo
        </button>
        <button type="button" className="btn-danger w-full" onClick={onDelete}>
          Borrar conteo
        </button>
      </div>
    </div>
  );
}
