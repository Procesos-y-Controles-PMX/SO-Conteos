"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import type { CtzUsuario, Role } from "@/lib/types";
import { createUsuario, updateUsuario } from "@/lib/store";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial: CtzUsuario | null;
  onClose: () => void;
  onSaved: (usuario: CtzUsuario) => void;
};

export default function UsuarioFormModal({ open, mode, initial, onClose, onSaved }: Props) {
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [rol, setRol] = useState<Role>("tienda");
  const [activo, setActivo] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setEmail(initial?.email ?? "");
    setNombre(initial?.nombre_completo ?? "");
    setPassword("");
    setPasswordConfirm("");
    setRol(initial?.rol ?? "tienda");
    setActivo(initial?.activo ?? true);
    setSaving(false);
  }, [open, initial]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const nextEmail = email.trim().toLowerCase();
    if (!nextEmail) {
      toast.error("El correo es obligatorio.");
      return;
    }
    if (mode === "create" || password.trim()) {
      if (password.trim().length < 4) {
        toast.error("La contraseña debe tener al menos 4 caracteres.");
        return;
      }
      if (password !== passwordConfirm) {
        toast.error("Las contraseñas no coinciden.");
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        email: nextEmail,
        nombre_completo: nombre.trim(),
        rol,
        password: password.trim() || undefined,
        activo,
      };
      const saved =
        mode === "create"
          ? await createUsuario({ ...payload, password: password.trim() })
          : initial
            ? await updateUsuario(initial.id, payload)
            : null;
      if (!saved) throw new Error("Usuario no encontrado.");
      onSaved(saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/65" aria-label="Cerrar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="neu-raised relative z-10 w-full max-w-lg overflow-hidden rounded-t-lg sm:rounded-lg"
      >
        <div className="border-b border-line-subtle px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-fg">
            {mode === "create" ? "Nuevo usuario" : "Editar usuario"}
          </h2>
          <p className="mt-1 text-sm text-fg-subtle">
            {mode === "create"
              ? "El usuario inicia sesión con este correo y contraseña."
              : "Deja la contraseña vacía si no quieres cambiarla."}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-fg-faint">
              Correo electrónico *
            </span>
            <input
              type="email"
              required
              className="input-field"
              placeholder="ejemplo.usuario@cemex.com"
              value={email}
              onChange={(event) => setEmail(event.target.value.toLowerCase())}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-fg-faint">
              Nombre completo *
            </span>
            <input
              required
              className="input-field"
              placeholder="Nombre Apellido"
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-fg-faint">
              {mode === "create" ? "Contraseña *" : "Nueva contraseña"}
            </span>
            <input
              type="password"
              required={mode === "create"}
              autoComplete="new-password"
              className="input-field"
              placeholder={mode === "create" ? "Mínimo 4 caracteres" : "Vacío = sin cambio"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-fg-faint">
              Confirmar
            </span>
            <input
              type="password"
              required={mode === "create"}
              autoComplete="new-password"
              className="input-field"
              placeholder="Repite la contraseña"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-fg-faint">Rol *</span>
            <select className="input-field" value={rol} onChange={(event) => setRol(event.target.value as Role)}>
              <option value="tienda">Tienda</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
          <label className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              checked={activo}
              onChange={(event) => setActivo(event.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm font-semibold text-fg">Usuario activo</span>
          </label>
          <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
            <button type="button" className="neu-button min-h-11 rounded-sm px-4 text-sm font-semibold" disabled={saving} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
