"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PageHeader from "@/components/ui/PageHeader";
import SelectDropdown from "@/components/ui/SelectDropdown";
import UsuarioFormModal from "@/components/usuarios/UsuarioFormModal";
import { isMajorAdmin } from "@/lib/access";
import { useAuth } from "@/lib/auth";
import { SO_ACCOUNT_APP_LABELS, SO_ACCOUNT_APPS, type SoAccount, type SoAccountApp } from "@/lib/so-account-types";
import { deleteUsuario, listAdminUsuarios, listSoAccounts, updateUsuario } from "@/lib/store";
import type { CtzUsuario, Role, Sucursal } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

function rolLabel(rol: Role): string {
  if (rol === "administrador_general") return "Administrador general";
  return rol === "admin" ? "Administrador" : "Tienda";
}

function createdLabel(iso?: string) {
  if (!iso) return "—";
  return formatDateTime(iso);
}

const APP_FILTER_OPTIONS = [
  { id: "todas", label: "Todas" },
  ...SO_ACCOUNT_APPS.map((app) => ({ id: app, label: SO_ACCOUNT_APP_LABELS[app] })),
];

export default function UsuariosPage() {
  const { user } = useAuth();
  const showCreated = isMajorAdmin(user);
  const [usuarios, setUsuarios] = useState<CtzUsuario[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [cuentas, setCuentas] = useState<SoAccount[]>([]);
  const [cuentaApp, setCuentaApp] = useState<"todas" | SoAccountApp>("todas");
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<CtzUsuario | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CtzUsuario | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function reload() {
    const data = await listAdminUsuarios();
    setUsuarios(data.usuarios ?? []);
    setSucursales(data.sucursales ?? []);
  }

  useEffect(() => {
    void reload().catch((err: Error) => toast.error(err.message));
  }, []);

  useEffect(() => {
    if (!showCreated || !user?.email) return;
    void listSoAccounts(user.email)
      .then((data) => setCuentas(data.cuentas ?? []))
      .catch((err: Error) => toast.error(err.message));
  }, [showCreated, user?.email]);

  const createdByEmail = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of usuarios) {
      const email = row.email.trim().toLowerCase();
      if (email && row.created_at) map.set(email, row.created_at);
    }
    return map;
  }, [usuarios]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((row) =>
      `${row.email} ${row.nombre_completo ?? ""} ${rolLabel(row.rol)}`.toLowerCase().includes(q),
    );
  }, [query, usuarios]);

  const visibleCuentas = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cuentas.filter((row) => {
      if (cuentaApp !== "todas" && row.app !== cuentaApp) return false;
      if (!q) return true;
      const haystack = `${SO_ACCOUNT_APP_LABELS[row.app]} ${row.email} ${row.nombre ?? ""} ${row.rol}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [cuentas, cuentaApp, query]);

  function openCreate() {
    setFormMode("create");
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(row: CtzUsuario) {
    if (row.id === user?.id) {
      toast.error("No puedes modificar tu propia cuenta desde aquí.");
      return;
    }
    setFormMode("edit");
    setEditing(row);
    setFormOpen(true);
  }

  async function handleActivo(row: CtzUsuario, activo: boolean) {
    if (row.id === user?.id) {
      toast.error("No puedes modificar tu propia cuenta desde aquí.");
      return;
    }
    try {
      const saved = await updateUsuario(row.id, { activo });
      setUsuarios((prev) => prev.map((item) => (item.id === row.id ? saved : item)));
      toast.success(activo ? "Usuario activado." : "Usuario desactivado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar.");
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    if (deleteTarget.id === user?.id) {
      toast.error("No puedes borrar tu propia cuenta.");
      return;
    }
    setDeleting(true);
    try {
      await deleteUsuario(deleteTarget.id);
      toast.success("Usuario eliminado.");
      setDeleteTarget(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Administración"
        title="Usuarios"
        subtitle={
          showCreated
            ? "Directorio de todas las cuentas SO, más el alta y edición de Cotizador/Conteos."
            : "Cuentas de Cotizador/Conteos. El login de tienda usa la contraseña del gerente de esa sucursal."
        }
        actions={
          <button type="button" className="btn-primary" onClick={openCreate}>
            + Nuevo usuario
          </button>
        }
      />

      <div className={showCreated ? "grid gap-4 md:grid-cols-[1fr_16rem]" : undefined}>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-fg-faint">
          Buscar (correo o nombre)
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ej. garcia@cemex.com"
            className="input-field mt-1.5"
          />
        </label>
        {showCreated ? (
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-fg-faint">App</span>
            <SelectDropdown
              value={cuentaApp}
              onChange={(id) => setCuentaApp(id as "todas" | SoAccountApp)}
              options={APP_FILTER_OPTIONS}
            />
          </label>
        ) : null}
      </div>

      {showCreated ? (
        <div>
          <h2 className="mb-1 font-display text-base font-semibold text-fg">Cuentas de todas las apps</h2>
          <p className="mb-3 text-sm text-fg-subtle">
            Equipo Móvil, Cotizador/Conteos, Permisos y Cartas Responsivas. En Equipo Móvil no hay fecha de alta en la
            cuenta; se muestra el primer login registrado.
          </p>
          <div className="neu-raised overflow-hidden rounded-lg">
            <div className="divide-y divide-line-subtle md:hidden">
              {visibleCuentas.map((row) => (
                <article key={row.key} className="space-y-1 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-fg-faint">
                    {SO_ACCOUNT_APP_LABELS[row.app]}
                  </p>
                  <p className="truncate font-semibold text-fg">{row.email}</p>
                  <p className="text-sm text-fg-muted">{row.nombre || "—"}</p>
                  <p className="text-xs text-fg-subtle">{row.rol}</p>
                  <p className="text-xs text-fg-faint">
                    Alta {createdLabel(row.alta ?? undefined)}
                    {row.altaSource === "first_login" ? " (primer login)" : ""}
                    {row.activo == null ? "" : row.activo ? " · Activo" : " · Inactivo"}
                  </p>
                </article>
              ))}
              {visibleCuentas.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-fg-subtle">
                  {query || cuentaApp !== "todas" ? "Sin resultados." : "Sin cuentas."}
                </p>
              ) : null}
            </div>

            <table className="hidden min-w-full text-left text-sm md:table">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-wider text-fg-faint">
                  <th className="px-4 py-3">App</th>
                  <th className="px-4 py-3">Correo</th>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Activo</th>
                  <th className="px-4 py-3">Alta</th>
                </tr>
              </thead>
              <tbody>
                {visibleCuentas.map((row) => (
                  <tr key={row.key} className="border-t border-line-subtle">
                    <td className="px-4 py-2.5 text-fg-subtle">{SO_ACCOUNT_APP_LABELS[row.app]}</td>
                    <td className="px-4 py-2.5 font-semibold text-fg">{row.email}</td>
                    <td className="px-4 py-2.5">{row.nombre || "—"}</td>
                    <td className="px-4 py-2.5">{row.rol}</td>
                    <td className="px-4 py-2.5 text-xs">
                      {row.activo == null ? "—" : row.activo ? "Activo" : "Inactivo"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-fg-subtle">
                      {createdLabel(row.alta ?? undefined)}
                      {row.altaSource === "first_login" ? (
                        <span className="ml-1 font-sans text-fg-faint">(primer login)</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {visibleCuentas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-fg-subtle">
                      {query || cuentaApp !== "todas" ? "Sin resultados." : "Sin cuentas."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div>
        <h2 className="mb-3 font-display text-base font-semibold text-fg">Cuentas de Cotizador / Conteos</h2>
        <div className="neu-raised overflow-hidden rounded-lg">
          <div className="divide-y divide-line-subtle md:hidden">
          {visible.map((row) => {
            const isSelf = row.id === user?.id;
            return (
              <article key={row.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-fg">{row.email}</p>
                    <p className="mt-0.5 text-sm text-fg-muted">{row.nombre_completo?.trim() || "—"}</p>
                    <p className="mt-1 text-xs text-fg-subtle">{rolLabel(row.rol)}</p>
                    {showCreated ? (
                      <p className="mt-1 text-xs text-fg-faint">Alta {createdLabel(row.created_at)}</p>
                    ) : null}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-fg-muted">
                    <input
                      type="checkbox"
                      checked={row.activo}
                      disabled={isSelf}
                      onChange={(event) => void handleActivo(row, event.target.checked)}
                    />
                    Activo
                  </label>
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={isSelf} className="neu-button flex-1 rounded-sm px-3 py-2 text-sm font-semibold" onClick={() => openEdit(row)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={isSelf}
                    className="flex-1 rounded-sm border border-red-200 px-3 py-2 text-sm font-semibold text-red-700"
                    onClick={() => setDeleteTarget(row)}
                  >
                    Borrar
                  </button>
                </div>
              </article>
            );
          })}
          {visible.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-fg-subtle">{query ? "Sin resultados." : "Sin usuarios."}</p>
          ) : null}
        </div>

        <table className="hidden min-w-full text-left text-sm md:table">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-wider text-fg-faint">
              <th className="px-4 py-3">Correo</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Rol</th>
              {showCreated ? <th className="px-4 py-3">Alta</th> : null}
              <th className="px-4 py-3">Activo</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const isSelf = row.id === user?.id;
              return (
                <tr key={row.id} className="border-t border-line-subtle">
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-fg">{row.email}</div>
                    {isSelf ? <span className="text-xs text-amber-700">Tu cuenta (no editable)</span> : null}
                  </td>
                  <td className="px-4 py-2.5">{row.nombre_completo?.trim() || "—"}</td>
                  <td className="px-4 py-2.5">{rolLabel(row.rol)}</td>
                  {showCreated ? (
                    <td className="px-4 py-2.5 font-mono text-xs text-fg-subtle">{createdLabel(row.created_at)}</td>
                  ) : null}
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={row.activo}
                      disabled={isSelf}
                      onChange={(event) => void handleActivo(row, event.target.checked)}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={isSelf}
                        className="text-xs font-semibold text-fg-muted hover:underline disabled:opacity-50"
                        onClick={() => openEdit(row)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={isSelf}
                        className="text-xs font-semibold text-brand hover:underline disabled:opacity-50"
                        onClick={() => setDeleteTarget(row)}
                      >
                        Borrar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={showCreated ? 6 : 5} className="px-4 py-10 text-center text-fg-subtle">
                  {query ? "Sin resultados." : "Sin usuarios."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-display text-base font-semibold text-fg">Cuentas de sucursal</h2>
        <p className="mb-3 text-sm text-fg-subtle">
          En el login de tienda se muestra el nombre de la sucursal. La contraseña es la de la cuenta del gerente.
        </p>
        <div className="neu-raised overflow-x-auto rounded-lg">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-wider text-fg-faint">
                <th className="px-4 py-3">Sucursal</th>
                <th className="px-4 py-3">Zona</th>
                <th className="px-4 py-3">Gerente</th>
                <th className="px-4 py-3">Correo</th>
                <th className="px-4 py-3">Cuenta</th>
                {showCreated ? <th className="px-4 py-3">Alta</th> : null}
              </tr>
            </thead>
            <tbody>
              {sucursales.map((sucursal) => (
                <tr key={sucursal.id} className="border-t border-line-subtle">
                  <td className="px-4 py-2.5 font-semibold text-fg">{sucursal.nombre}</td>
                  <td className="px-4 py-2.5 text-fg-subtle">{sucursal.zona}</td>
                  <td className="px-4 py-2.5">{sucursal.gerenteNombre || "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-fg-faint">{sucursal.gerenteEmail || "—"}</td>
                  <td className="px-4 py-2.5 text-xs">{sucursal.hasAccount ? "Activa" : "Sin usuario"}</td>
                  {showCreated ? (
                    <td className="px-4 py-2.5 font-mono text-xs text-fg-subtle">
                      {createdLabel(createdByEmail.get(sucursal.gerenteEmail.trim().toLowerCase()))}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <UsuarioFormModal
        open={formOpen}
        mode={formMode}
        initial={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          toast.success(formMode === "create" ? "Usuario creado." : "Usuario actualizado.");
          setFormOpen(false);
          void reload();
        }}
      />

      <ConfirmDialog
        open={deleteTarget != null}
        title="Eliminar usuario"
        body={deleteTarget ? `¿Eliminar a ${deleteTarget.email}? Esta acción no se puede deshacer.` : ""}
        pending={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteConfirm()}
      />
    </div>
  );
}
