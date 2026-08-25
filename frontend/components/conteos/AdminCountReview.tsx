"use client";

import { useRouter } from "next/navigation";
import DiffReview from "@/components/conteos/DiffReview";
import SemaforoDot from "@/components/conteos/SemaforoDot";
import PageHeader from "@/components/ui/PageHeader";
import { countProgress, sessionSemaforo, type CountSession } from "@/lib/types";
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
  const who = session.counterName
    ? `${session.counterName}${session.counterPuesto ? ` · ${session.counterPuesto}` : ""}`
    : "La sucursal aún no indica quién cuenta";

  return (
    <div>
      <PageHeader
        eyebrow={session.kind === "semanal" ? weekLabel(session.weekKey) : "Urgente"}
        title={session.titulo}
        subtitle={`${filled}/${total} SKUs · solo consulta`}
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
        <DiffReview
          session={session}
          comentario={session.comentario ?? ""}
          onComentario={() => undefined}
          readOnly
        />
        <button type="button" className="btn-secondary w-full" onClick={() => router.push("/admin")}>
          Volver al semáforo
        </button>
        <button type="button" className="w-full text-sm font-semibold text-brand" onClick={onDelete}>
          Borrar conteo
        </button>
      </div>
    </div>
  );
}
