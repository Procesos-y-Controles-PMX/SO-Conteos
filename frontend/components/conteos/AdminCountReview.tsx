"use client";

import { useRouter } from "next/navigation";
import DiffReview from "@/components/conteos/DiffReview";
import SemaforoDot from "@/components/conteos/SemaforoDot";
import PageHeader from "@/components/ui/PageHeader";
import { isImageMime } from "@/lib/evidence";
import { evidenceViewUrl } from "@/lib/store";
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
  const evidenceLines = session.kind === "urgente" ? session.lines.filter((line) => line.evidenciaPath) : [];
  const days = session.evidenceRetentionDays ?? 14;

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
        {session.kind === "urgente" ? (
          <div className="neu-raised rounded-lg p-5">
            <p className="field-label">Evidencia</p>
            <h2 className="mt-1 font-display text-xl font-semibold text-fg">
              {evidenceLines.length === 0 ? "Sin archivos" : `${evidenceLines.length} archivo${evidenceLines.length === 1 ? "" : "s"}`}
            </h2>
            <p className="mt-2 text-sm text-fg-subtle">Se borra sola a los {days} días.</p>
            {evidenceLines.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {evidenceLines.map((line) => (
                  <li key={line.sku}>
                    <a
                      href={evidenceViewUrl(session.id, line.sku)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 text-sm text-fg hover:underline"
                    >
                      {isImageMime(line.evidenciaMime) ? (
                        <img
                          src={evidenceViewUrl(session.id, line.sku)}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-sm object-cover"
                        />
                      ) : (
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-muted-strong font-mono text-[10px] text-fg-muted">
                          VIDEO
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{line.nombre}</span>
                        <span className="block truncate font-mono text-[11px] text-fg-faint">
                          {line.evidencia || line.sku}
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
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
