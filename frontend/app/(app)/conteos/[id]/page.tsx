"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import AdminCountReview from "@/components/conteos/AdminCountReview";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import DiffReview from "@/components/conteos/DiffReview";
import IdentityGate from "@/components/conteos/IdentityGate";
import SkuStepper from "@/components/conteos/SkuStepper";
import PageHeader from "@/components/ui/PageHeader";
import { isConteosAdmin } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { deleteConteo, getSession, patchLine, patchSession, submitSession } from "@/lib/store";
import { scopeWeeklySession } from "@/lib/catalog/polvos";
import { countProgress, type CountLine, type CountSession } from "@/lib/types";
import { weekLabel } from "@/lib/week";

type Step = "identidad" | "conteo" | "revision" | "enviado";

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
  const [comentario, setComentario] = useState("");
  const [missing, setMissing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
        toast.error(saveErrorMessage(err.reason));
      }
    }
  }, []);

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
        setComentario(found.comentario ?? "");
        if (found.status === "enviado") setStep("enviado");
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

  if (missing) return <p className="text-sm text-fg-subtle">No se encontró este conteo.</p>;
  if (!session) return <p className="text-sm text-fg-subtle">Cargando…</p>;

  if (user?.rol === "tienda" && user.sucursalId !== session.sucursalId) {
    return <p className="text-sm text-fg-subtle">Este conteo no pertenece a tu sucursal.</p>;
  }

  const current = scopeWeeklySession(session);
  const adminView = isConteosAdmin(user?.rol);
  const { filled, total } = countProgress(current);
  const safeIndex = Math.min(skuIndex, Math.max(0, current.lines.length - 1));
  const locked = current.status === "enviado";

  async function handleIdentity(payload: { nombre: string; puesto: string }) {
    const next = await patchSession(current.id, {
      counterName: payload.nombre,
      counterPuesto: payload.puesto,
      status: current.status === "pendiente" ? "en_progreso" : current.status,
    });
    setSession(scopeWeeklySession(next));
    setStep("conteo");
  }

  function handlePatch(sku: string, patch: Partial<CountLine>) {
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

  async function handleSubmit() {
    await flushSaves();
    if (filled < total) {
      toast.error(`Faltan ${total - filled} SKU por capturar.`);
      setStep("conteo");
      return;
    }
    const submitted = await submitSession(current.id, {
      counterName: current.counterName ?? "",
      counterPuesto: current.counterPuesto ?? "",
      comentario,
    });
    setSession(scopeWeeklySession(submitted));
    setStep("enviado");
    toast.success("Conteo enviado.");
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

  return (
    <div>
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
          onConfirm={(payload) => void handleIdentity(payload)}
        />
      ) : null}

      {step === "conteo" ? (
        <SkuStepper
          session={current}
          index={safeIndex}
          onIndex={setSkuIndex}
          onPatch={handlePatch}
          onFinish={() => {
            void flushSaves().finally(() => setStep("revision"));
          }}
        />
      ) : null}

      {step === "revision" && !locked ? (
        <div className="space-y-4 pb-24">
          <DiffReview session={current} comentario={comentario} onComentario={setComentario} />
          <div className="fixed inset-x-0 bottom-0 z-40 bg-canvas/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm lg:static lg:bg-transparent lg:p-0">
            <div className="mx-auto flex max-w-lg flex-col gap-2 sm:flex-row">
              <button type="button" className="btn-primary flex-1" onClick={() => void handleSubmit()}>
                Enviar conteo
              </button>
              <button type="button" className="btn-secondary flex-1" onClick={() => setStep("conteo")}>
                Volver a SKUs
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {step === "enviado" ? (
        <div className="mx-auto max-w-lg space-y-4">
          <div className="neu-raised rounded-lg p-6 text-center">
            <p className="field-label">Enviado</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-fg">Conteo registrado</h2>
            <p className="mt-2 text-sm text-fg-subtle">
              {current.counterName} · {current.counterPuesto}
            </p>
          </div>
          <DiffReview
            session={current}
            comentario={current.comentario ?? ""}
            onComentario={() => undefined}
            readOnly
          />
          <button type="button" className="btn-secondary w-full" onClick={() => router.push("/conteos")}>
            Volver a conteos
          </button>
        </div>
      ) : null}
    </div>
  );
}
