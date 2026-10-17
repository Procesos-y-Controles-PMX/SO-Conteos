"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import AdminCountReview from "@/components/conteos/AdminCountReview";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import DiffReview from "@/components/conteos/DiffReview";
import IdentityGate from "@/components/conteos/IdentityGate";
import SkuStepper from "@/components/conteos/SkuStepper";
import PageHeader from "@/components/ui/PageHeader";
import { isConteosAdmin } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import {
  deleteConteo,
  getSession,
  patchLine,
  patchSession,
  removeEvidence,
  submitSession,
  uploadEvidence,
} from "@/lib/store";
import { setCountInProgress } from "@/lib/conteos/countLock";
import { scopeWeeklySession } from "@/lib/catalog/polvos";
import {
  countProgress,
  countQtyLocked,
  lineDiff,
  lineMissingEvidence,
  type CountLine,
  type CountSession,
  type EvidenceKind,
} from "@/lib/types";
import { weekLabel } from "@/lib/week";

type Step = "identidad" | "conteo" | "revision" | "revision_diffs" | "enviado";

const START_WARNING = (
  <>
    ¿Está seguro de que desea continuar con el proceso? Una vez iniciado, deberá completarse hasta el final.
    <span className="mt-2 block">
      Si tiene pendientes por entregar o por facturar, tenga a la mano las evidencias correspondientes antes de
      iniciar el conteo.
    </span>
  </>
);

const CLOSE_WARNING = (
  <>
    Al cerrar la captura ya no podrás cambiar cantidades ni fotos.
    <span className="mt-2 block">Después verás las diferencias contra SAP y solo podrás escribir comentarios.</span>
  </>
);

const MSG_NO_ENCONTRADO = "Conteo no encontrado.";

function saveErrorMessage(err: unknown) {
  const msg = err instanceof Error ? err.message : "";
  if (!msg || msg === "Load failed" || msg === "Failed to fetch") {
    return "No se pudo guardar. Revisa la conexión.";
  }
  return msg;
}

export default function CountSessionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const user = useMemo(() => getCurrentUser(), []);
  const [session, setSession] = useState<CountSession | null>(null);
  const [step, setStep] = useState<Step>("identidad");
  const [skuIndex, setSkuIndex] = useState(0);
  const [missing, setMissing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmStart, setConfirmStart] = useState(false);
  const [pendingIdentity, setPendingIdentity] = useState<{
    nombre: string;
    puesto: string;
  } | null>(null);
  const [starting, setStarting] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const pendingRef = useRef<Record<string, Partial<CountLine>>>({});
  const sessionIdRef = useRef(params.id);
  const lastToastAt = useRef(0);
  sessionIdRef.current = params.id;

  const flushSaves = useCallback(async () => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const batch = pendingRef.current;
    const skus = Object.keys(batch);
    if (skus.length === 0) return;
    pendingRef.current = {};
    const id = sessionIdRef.current;
    const results = await Promise.allSettled(skus.map((sku) => patchLine(id, sku, batch[sku])));
    let failed = false;
    results.forEach((result, i) => {
      if (result.status !== "rejected") return;
      const sku = skus[i];
      pendingRef.current[sku] = { ...batch[sku], ...pendingRef.current[sku] };
      failed = true;
    });
    if (failed) {
      const now = Date.now();
      if (now - lastToastAt.current > 4000) {
        lastToastAt.current = now;
        const err = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
        reportError(err.reason);
      }
    }
  }, []);

  /** A 404 mid-capture means an admin deleted the count: show that instead of a toast loop. */
  function reportError(err: unknown) {
    if (err instanceof Error && err.message === MSG_NO_ENCONTRADO) {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      pendingRef.current = {};
      setMissing(true);
      return;
    }
    toast.error(saveErrorMessage(err));
  }

  function queueSave(sku: string, patch: Partial<CountLine>) {
    pendingRef.current[sku] = { ...pendingRef.current[sku], ...patch };
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void flushSaves();
    }, 400);
  }

  useEffect(() => {
    void getSession(params.id)
      .then((found) => {
        setSession(scopeWeeklySession(found));
        if (found.status === "enviado" || found.status === "no_concluido") setStep("enviado");
        else if (found.capturaCerradaAt) setStep("revision_diffs");
        else if (found.counterName && found.counterPuesto) setStep("conteo");
        else setStep("identidad");
      })
      .catch(() => setMissing(true));
  }, [params.id]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, []);

  const countRunning = step === "conteo" || step === "revision" || step === "revision_diffs";

  useEffect(() => {
    setCountInProgress(countRunning);
    return () => setCountInProgress(false);
  }, [countRunning]);

  if (missing) {
    return (
      <div className="neu-raised mx-auto max-w-lg rounded-lg p-6 text-center">
        <h2 className="font-display text-2xl font-semibold text-fg">Conteo no encontrado</h2>
        <p className="mt-2 text-sm text-fg-subtle">
          Este conteo ya no existe; es probable que un administrador lo haya borrado. Lo capturado aquí no se guardó.
        </p>
        <button type="button" className="btn-secondary mt-4 w-full" onClick={() => router.push("/conteos")}>
          Volver a conteos
        </button>
      </div>
    );
  }
  if (!session) return <p className="text-sm text-fg-subtle">Cargando…</p>;

  if (user?.rol === "tienda" && user.sucursalId !== session.sucursalId) {
    return <p className="text-sm text-fg-subtle">Este conteo no pertenece a tu sucursal.</p>;
  }

  const current = scopeWeeklySession(session);
  const adminView = isConteosAdmin(user?.rol);
  const { filled, total } = countProgress(current);
  const safeIndex = Math.min(skuIndex, Math.max(0, current.lines.length - 1));
  const locked = current.status === "enviado" || current.status === "no_concluido";
  const qtyLocked = countQtyLocked(current);
  const hubHref = current.kind === "semanal" ? "/conteos/semanales" : "/conteos/urgentes";

  async function applyIdentity(payload: { nombre: string; puesto: string }) {
    const next = await patchSession(current.id, {
      counterName: payload.nombre,
      counterPuesto: payload.puesto,
      status: current.status === "pendiente" ? "en_progreso" : current.status,
    });
    setSession(scopeWeeklySession(next));
    setStep("conteo");
  }

  function handleIdentity(payload: { nombre: string; puesto: string }) {
    if (current.status === "pendiente") {
      setPendingIdentity(payload);
      setConfirmStart(true);
      return;
    }
    void applyIdentity(payload).catch(reportError);
  }

  function handlePatch(sku: string, patch: Partial<CountLine>) {
    if (locked) return;
    const touchesQty =
      patch.fisico !== undefined ||
      patch.pendienteEntregar !== undefined ||
      patch.pendienteFacturar !== undefined ||
      patch.danado !== undefined;
    if (qtyLocked && touchesQty) {
      return;
    }
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        status: prev.status === "pendiente" ? "en_progreso" : prev.status,
        lines: prev.lines.map((line) => (line.sku === sku ? { ...line, ...patch } : line)),
      };
    });
    queueSave(sku, patch);
  }

  function patchLocalLine(sku: string, patch: (line: CountLine) => Partial<CountLine>) {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        status: prev.status === "pendiente" ? "en_progreso" : prev.status,
        lines: prev.lines.map((line) => (line.sku === sku ? { ...line, ...patch(line) } : line)),
      };
    });
  }

  async function handleEvidence(sku: string, file: File, kind: EvidenceKind = "general") {
    if (locked || qtyLocked) return;
    try {
      const evidencias = await uploadEvidence(current.id, sku, file, kind);
      patchLocalLine(sku, () => ({ evidencias }));
    } catch (err) {
      if (err instanceof Error && err.message === MSG_NO_ENCONTRADO) reportError(err);
      throw err;
    }
  }

  async function handleRemoveEvidence(sku: string, path: string) {
    if (locked || qtyLocked) return;
    const evidencias = await removeEvidence(current.id, sku, path);
    // Pre-patch files live in the line's single-file columns.
    patchLocalLine(sku, (line) => ({
      evidencias,
      evidenciaPath: line.evidenciaPath === path ? undefined : line.evidenciaPath,
      evidenciaEntregarPath: line.evidenciaEntregarPath === path ? undefined : line.evidenciaEntregarPath,
      evidenciaFacturarPath: line.evidenciaFacturarPath === path ? undefined : line.evidenciaFacturarPath,
    }));
  }

  async function handleSubmit() {
    await flushSaves();
    const missingComments = current.lines.filter((line) => {
      const diff = lineDiff(line);
      return diff != null && diff !== 0 && !(line.comentario ?? "").trim();
    });
    if (missingComments.length > 0) {
      toast.error(`Faltan comentarios en ${missingComments.length} diferencia(s).`);
      setStep("revision_diffs");
      return;
    }
    const submitted = await submitSession(current.id, {
      counterName: current.counterName ?? "",
      counterPuesto: current.counterPuesto ?? "",
      comentario: "",
    });
    setSession(scopeWeeklySession(submitted));
    setStep("enviado");
    toast.success("Conteo enviado.");
  }

  /** Validates the capture and shows "Tu captura"; the store can still go back and correct it. */
  async function reviewCapture() {
    await flushSaves();
    if (filled < total) {
      toast.error(`Faltan ${total - filled} SKU por capturar.`);
      return;
    }
    const missingEvidence = current.lines.filter(lineMissingEvidence);
    if (missingEvidence.length > 0) {
      toast.error("Falta foto del físico o evidencia en productos con pendientes o dañado.");
      const idx = current.lines.findIndex((l) => l.sku === missingEvidence[0].sku);
      if (idx >= 0) setSkuIndex(idx);
      return;
    }
    setStep("revision");
  }

  async function closeCapture() {
    setClosing(true);
    try {
      await flushSaves();
      const next = await patchSession(current.id, { cerrarCaptura: true });
      if (!next.capturaCerradaAt) {
        toast.error("No se pudo cerrar la captura. Falta aplicar la actualización de base de datos.");
        return;
      }
      setSession(scopeWeeklySession(next));
      setConfirmClose(false);
      setStep("revision_diffs");
    } catch (err: unknown) {
      reportError(err);
    } finally {
      setClosing(false);
    }
  }

  /** Solo vive en el paso de identidad: una vez iniciado el conteo ya no se puede regresar. */
  function handleRegresar() {
    router.push(hubHref === "/conteos/urgentes" ? "/conteos" : hubHref);
  }

  if (adminView) {
    return (
      <div>
        <AdminCountReview session={current} onDelete={() => setConfirmDelete(true)} />
        <ConfirmDialog
          open={confirmDelete}
          title="Borrar conteo"
          body="Se elimina este envío. La sucursal podrá capturarlo de nuevo."
          pending={deleting}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setDeleting(true);
            void deleteConteo(current.id)
              .then(() => {
                toast.success("Conteo borrado.");
                router.push("/admin");
              })
              .catch((err: Error) => toast.error(err.message))
              .finally(() => setDeleting(false));
          }}
        />
      </div>
    );
  }

  if (current.bloqueado) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="mb-4">
          <button type="button" className="btn-secondary min-h-10 gap-2 px-3 text-sm" onClick={handleRegresar}>
            <ArrowLeft className="h-4 w-4" />
            Regresar
          </button>
        </div>
        <div className="neu-raised rounded-lg p-6 text-center">
          <p className="field-label">{weekLabel(current.weekKey)}</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-fg">Semana bloqueada</h2>
          <p className="mt-2 text-sm text-fg-subtle">
            Esta semana ya pasó sin conteo. Pide a un administrador que la desbloquee para capturarla.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {step === "identidad" ? (
        <div className="mb-4">
          <button type="button" className="btn-secondary min-h-10 gap-2 px-3 text-sm" onClick={handleRegresar}>
            <ArrowLeft className="h-4 w-4" />
            Regresar
          </button>
        </div>
      ) : null}

      {step !== "conteo" || current.lines.length === 0 ? (
        <PageHeader
          eyebrow={current.kind === "semanal" ? weekLabel(current.weekKey) : "Urgente"}
          title={current.titulo}
          subtitle={`${user?.nombre ?? ""} · ${filled}/${total} SKUs`}
        />
      ) : null}

      {step === "identidad" ? (
        <IdentityGate
          initialName={current.counterName}
          initialPuesto={current.counterPuesto}
          onConfirm={handleIdentity}
        />
      ) : null}

      {step === "conteo" && !qtyLocked ? (
        <SkuStepper
          session={current}
          index={safeIndex}
          onIndex={setSkuIndex}
          onPatch={handlePatch}
          onEvidence={handleEvidence}
          onRemoveEvidence={handleRemoveEvidence}
          onFinish={() => void reviewCapture()}
        />
      ) : null}

      {step === "revision" && !locked && !qtyLocked ? (
        <div className="space-y-4 pb-32 lg:pb-0">
          <DiffReview session={current} mode="captura" readOnly />
          <p className="mx-auto max-w-lg text-center text-sm text-fg-subtle">
            Revisa tus cantidades. Si algo está mal, regresa a corregir antes de cerrar la captura.
          </p>
          <div className="fixed inset-x-0 bottom-0 z-40 bg-canvas/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm lg:static lg:bg-transparent lg:p-0">
            <div className="mx-auto flex max-w-lg flex-col gap-2 sm:flex-row">
              <button type="button" className="btn-secondary flex-1" onClick={() => setStep("conteo")}>
                <ArrowLeft className="h-4 w-4" />
                Regresar a corregir
              </button>
              <button type="button" className="btn-primary flex-1" onClick={() => setConfirmClose(true)}>
                Cerrar captura
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {step === "revision_diffs" && !locked ? (
        <div className="space-y-4 pb-24">
          <DiffReview
            session={current}
            mode="diferencias"
            onLineComment={(sku, comentario) => handlePatch(sku, { comentario })}
          />
          <div className="fixed inset-x-0 bottom-0 z-40 bg-canvas/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm lg:static lg:bg-transparent lg:p-0">
            <div className="mx-auto flex max-w-lg flex-col gap-2 sm:flex-row">
              <button type="button" className="btn-primary flex-1" onClick={() => void handleSubmit().catch(reportError)}>
                Confirmar y enviar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {step === "enviado" ? (
        <div className="mx-auto max-w-lg space-y-4">
          <div className="neu-raised rounded-lg p-6 text-center">
            <p className="field-label">{current.status === "no_concluido" ? "No concluido" : "Enviado"}</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-fg">
              {current.status === "no_concluido" ? "Conteo no concluido" : "Conteo registrado"}
            </h2>
            <p className="mt-2 text-sm text-fg-subtle">
              {current.counterName} · {current.counterPuesto}
            </p>
            <p className="mt-2 text-sm text-fg-subtle">
              {current.status === "no_concluido"
                ? "Se cerró el sábado a medianoche porque quedó empezado y sin enviar."
                : "Ya no se puede editar este conteo."}
            </p>
          </div>
          <DiffReview session={current} mode="diferencias" readOnly />
          <button type="button" className="btn-secondary w-full" onClick={() => router.push("/conteos")}>
            Volver a conteos
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmClose}
        title="Cerrar captura"
        body={CLOSE_WARNING}
        confirmLabel="Cerrar captura"
        cancelLabel="Seguir capturando"
        pending={closing}
        onCancel={() => setConfirmClose(false)}
        onConfirm={() => void closeCapture()}
      />

      <ConfirmDialog
        open={confirmStart}
        title="Iniciar conteo"
        body={START_WARNING}
        confirmLabel="Continuar"
        cancelLabel="Cancelar"
        pending={starting}
        onCancel={() => {
          setConfirmStart(false);
          setPendingIdentity(null);
        }}
        onConfirm={() => {
          if (!pendingIdentity) return;
          setStarting(true);
          void applyIdentity(pendingIdentity)
            .then(() => {
              setConfirmStart(false);
              setPendingIdentity(null);
            })
            .catch(reportError)
            .finally(() => setStarting(false));
        }}
      />
    </div>
  );
}
