"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PageHeader from "@/components/ui/PageHeader";
import SelectDropdown from "@/components/ui/SelectDropdown";
import UsuarioFormModal from "@/components/usuarios/UsuarioFormModal";
import { isConteosAdmin, isMajorAdmin, isMajorAdminEmail } from "@/lib/access";
import { useAuth } from "@/lib/auth";
import { SO_ACCOUNT_APP_LABELS, SO_ACCOUNT_APPS, type SoAccount, type SoAccountApp } from "@/lib/so-account-types";
import { deleteUsuario, listAdminUsuarios, listSoAccounts, updateUsuario } from "@/lib/store";
import type { CtzUsuario, Role, Sucursal } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

function rolLabel(rol: Role, email?: string): string {
  if (isMajorAdminEmail(email) || rol === "administrador_general") return "Administrador general";
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

type CuentaSort = "app" | "email" | "nombre" | "rol" | "activo" | "alta";
type SortDir = "asc" | "desc";

const SORT_COLUMNS: Array<{ id: CuentaSort; label: string }> = [
  { id: "alta", label: "Alta" },
  { id: "email", label: "Correo" },
  { id: "nombre", label: "Nombre" },
  { id: "app", label: "App" },
  { id: "rol", label: "Rol" },
  { id: "activo", label: "Activo" },
];

function sortId(key: CuentaSort, dir: SortDir) {
  return `${key}-${dir}`;
}

function parseSort(id: string): { key: CuentaSort; dir: SortDir } {
  const [key, dir] = id.split("-") as [CuentaSort, SortDir];
  if (!SORT_COLUMNS.some((col) => col.id === key) || (dir !== "asc" && dir !== "desc")) {
    return { key: "alta", dir: "desc" };
  }
  return { key, dir };
}

function sortLabel(key: CuentaSort, dir: SortDir) {
  if (key === "alta") return dir === "desc" ? "Alta · más reciente" : "Alta · más antigua";
  if (key === "activo") return dir === "desc" ? "Activos primero" : "Inactivos primero";
  const name = SORT_COLUMNS.find((col) => col.id === key)?.label ?? key;
  return dir === "asc" ? `${name} A–Z` : `${name} Z–A`;
}

const SORT_OPTIONS = SORT_COLUMNS.flatMap((col) => {
  const dirs: SortDir[] = col.id === "alta" || col.id === "activo" ? ["desc", "asc"] : ["asc", "desc"];
  return dirs.map((dir) => ({ id: sortId(col.id, dir), label: sortLabel(col.id, dir) }));
});

function cuentaSortValue(row: SoAccount, key: CuentaSort): string | number {
  switch (key) {
    case "app":
      return SO_ACCOUNT_APP_LABELS[row.app];
    case "email":
      return row.email;
    case "nombre":
      return row.nombre ?? "";
    case "rol":
      return row.rol;
    case "activo":
      return row.activo === true ? 2 : row.activo === false ? 1 : 0;
    case "alta":
      return row.alta ?? "";
  }
}

function compareCuentas(a: SoAccount, b: SoAccount, key: CuentaSort, dir: SortDir) {
  if (key === "alta") {
    if (!a.alta && !b.alta) return a.email.localeCompare(b.email, "es");
    if (!a.alta) return 1;
    if (!b.alta) return -1;
  }
  const av = cuentaSortValue(a, key);
  const bv = cuentaSortValue(b, key);
  const cmp =
    typeof av === "number" && typeof bv === "number"
      ? av - bv
      : String(av).localeCompare(String(bv), "es", { sensitivity: "base", numeric: true });
  if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
  return a.email.localeCompare(b.email, "es");
}

function SortHead({
  label,
  col,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  col: CuentaSort;
  sortKey: CuentaSort;
  sortDir: SortDir;
  onSort: (col: CuentaSort) => void;
}) {
  const active = col === sortKey;
  return (
    <th className="px-4 py-3">
      <button
        type="button"
        className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-fg"
        onClick={() => onSort(col)}
      >
        {label}
        {active ? (
          sortDir === "asc" ? (
            <ChevronUp className="h-3 w-3 text-fg" aria-hidden />
          ) : (
            <ChevronDown className="h-3 w-3 text-fg" aria-hidden />
          )
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-30" aria-hidden />
        )}
      </button>
    </th>
  );
}

export default function UsuariosPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const showCreated = isMajorAdmin(user);
  const [usuarios, setUsuarios] = useState<CtzUsuario[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [cuentas, setCuentas] = useState<SoAccount[]>([]);
  const [cuentaApp, setCuentaApp] = useState<"todas" | SoAccountApp>("todas");
  const [cuentaSort, setCuentaSort] = useState(sortId("alta", "desc"));
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<CtzUsuario | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CtzUsuario | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!loading && !isConteosAdmin(user?.rol)) router.replace("/admin");
  }, [loading, user, router]);

  async function reload() {
    const data = await listAdminUsuarios();
    setUsuarios(data.usuarios ?? []);
    setSucursales(data.sucursales ?? []);
  }

  useEffect(() => {
    if (!isConteosAdmin(user?.rol)) return;
    void reload().catch((err: Error) => toast.error(err.message));
  }, [user]);

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
      `${row.email} ${row.nombre_completo ?? ""} ${rolLabel(row.rol, row.email)}`.toLowerCase().includes(q),
    );
  }, [query, usuarios]);

  const { key: sortKey, dir: sortDir } = parseSort(cuentaSort);

  const visibleCuentas = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = cuentas.filter((row) => {
      if (cuentaApp !== "todas" && row.app !== cuentaApp) return false;
      if (!q) return true;
      const haystack = `${SO_ACCOUNT_APP_LABELS[row.app]} ${row.email} ${row.nombre ?? ""} ${row.rol}`.toLowerCase();
      return haystack.includes(q);
    });
    return [...filtered].sort((a, b) => compareCuentas(a, b, sortKey, sortDir));
  }, [cuentas, cuentaApp, query, sortKey, sortDir]);

  function handleCuentaSort(col: CuentaSort) {
    if (col === sortKey) {
      setCuentaSort(sortId(col, sortDir === "asc" ? "desc" : "asc"));
      return;
    }
    setCuentaSort(sortId(col, col === "alta" || col === "activo" ? "desc" : "asc"));
  }

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

  if (loading || !isConteosAdmin(user?.rol)) return null;

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

      <div className={showCreated ? "grid gap-4 md:grid-cols-[1fr_12rem_16rem]" : undefined}>
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
          <>
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-fg-faint">App</span>
              <SelectDropdown
                value={cuentaApp}
                onChange={(id) => setCuentaApp(id as "todas" | SoAccountApp)}
                options={APP_FILTER_OPTIONS}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-fg-faint">Orden</span>
              <SelectDropdown value={cuentaSort} onChange={setCuentaSort} options={SORT_OPTIONS} />
            </label>
          </>
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
                  <SortHead label="App" col="app" sortKey={sortKey} sortDir={sortDir} onSort={handleCuentaSort} />
                  <SortHead label="Correo" col="email" sortKey={sortKey} sortDir={sortDir} onSort={handleCuentaSort} />
                  <SortHead label="Nombre" col="nombre" sortKey={sortKey} sortDir={sortDir} onSort={handleCuentaSort} />
                  <SortHead label="Rol" col="rol" sortKey={sortKey} sortDir={sortDir} onSort={handleCuentaSort} />
                  <SortHead label="Activo" col="activo" sortKey={sortKey} sortDir={sortDir} onSort={handleCuentaSort} />
                  <SortHead label="Alta" col="alta" sortKey={sortKey} sortDir={sortDir} onSort={handleCuentaSort} />
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
                    <p className="mt-1 text-xs text-fg-subtle">{rolLabel(row.rol, row.email)}</p>
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
                  <td className="px-4 py-2.5">{rolLabel(row.rol, row.email)}</td>
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
