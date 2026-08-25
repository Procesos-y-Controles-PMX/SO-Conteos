import { decodeSpreadsheetBuffer, keepConteoSpreadsheet, parseDelimitedText } from "@/lib/excel/parseInventario";
import type { CountKind, CountLine, CountSession, CtzUsuario, InventarioMeta, Producto, SemaforoResumen, Sucursal, ZonaSemaforo } from "@/lib/types";

export type InventarioPayload = {
  meta: InventarioMeta;
  ignoreUploadWindow: boolean;
  productos?: Producto[];
  skuCount?: number;
  catalogCount?: number;
  sapCount?: number;
  unmatchedStores?: string[];
  matchedStores?: number;
  imported?: number;
  skipped?: number;
};

async function parse<T>(res: Response): Promise<T> {
  const body = (await res.json()) as T & { ok?: boolean; message?: string };
  if (!res.ok || body.ok === false) {
    throw new Error(body.message ?? "Error de servidor.");
  }
  return body;
}

export async function listSucursales(): Promise<Sucursal[]> {
  const data = await parse<{ sucursales: Sucursal[] }>(await fetch("/api/sucursales"));
  return data.sucursales;
}

export async function listSucursalesConUsuarios(): Promise<Sucursal[]> {
  const data = await parse<{ sucursales: Sucursal[] }>(await fetch("/api/admin/usuarios"));
  return data.sucursales;
}

export async function listAdminUsuarios() {
  return parse<{ sucursales: Sucursal[]; usuarios: CtzUsuario[] }>(await fetch("/api/admin/usuarios"));
}

export type UsuarioPayload = {
  email: string;
  nombre_completo: string;
  rol: CtzUsuario["rol"];
  password?: string;
  activo: boolean;
};

export async function createUsuario(payload: UsuarioPayload): Promise<CtzUsuario> {
  const data = await parse<{ usuario: CtzUsuario }>(
    await fetch("/api/admin/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
  return data.usuario;
}

export async function updateUsuario(id: string, payload: Partial<UsuarioPayload>): Promise<CtzUsuario> {
  const data = await parse<{ usuario: CtzUsuario }>(
    await fetch("/api/admin/usuarios", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...payload }),
    }),
  );
  return data.usuario;
}

export async function deleteUsuario(id: string): Promise<void> {
  await parse(await fetch("/api/admin/usuarios", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  }));
}

export async function listProductos(sucursalId?: string): Promise<Producto[]> {
  const q = sucursalId ? `?sucursalId=${encodeURIComponent(sucursalId)}` : "";
  const data = await parse<{ productos: Producto[] }>(await fetch(`/api/productos${q}`));
  return data.productos;
}

export async function getInventario() {
  return parse<InventarioPayload>(await fetch("/api/inventario"));
}

export async function uploadInventario(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const utf16 = decodeSpreadsheetBuffer(bytes);
  if (utf16) {
    const rows = keepConteoSpreadsheet(parseDelimitedText(utf16));
    return parse<InventarioPayload>(
      await fetch("/api/inventario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name.trim(), rows }),
      }),
    );
  }
  const form = new FormData();
  form.append("file", file);
  return parse<InventarioPayload>(await fetch("/api/inventario", { method: "POST", body: form }));
}

export async function setIgnoreUploadWindow(value: boolean) {
  return parse<InventarioPayload>(
    await fetch("/api/inventario", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ignoreUploadWindow: value }),
    }),
  );
}

export async function sessionsForSucursal(sucursalId: string, kind?: CountKind) {
  const q = new URLSearchParams({ sucursalId });
  if (kind) q.set("kind", kind);
  const data = await parse<{ sessions: CountSession[] }>(await fetch(`/api/conteos?${q}`));
  return data.sessions;
}

export async function sessionsForWeek(weekKey: string) {
  const data = await parse<{ sessions: CountSession[] }>(await fetch(`/api/conteos?weekKey=${weekKey}`));
  return data.sessions;
}

export async function getSession(id: string) {
  const data = await parse<{ session: CountSession }>(
    await fetch(`/api/conteos/${id}`, { cache: "no-store" }),
  );
  return data.session;
}

export async function weeklySessionFor(sucursalId: string, weekKey?: string) {
  const data = await parse<{ session: CountSession }>(
    await fetch("/api/conteos/semanal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sucursalId, weekKey }),
    }),
  );
  return data.session;
}

export async function patchSession(id: string, patch: Partial<CountSession>) {
  const data = await parse<{ session: CountSession }>(
    await fetch(`/api/conteos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  );
  return data.session;
}

export async function patchLine(sessionId: string, sku: string, patch: Partial<CountLine>) {
  await parse<{ saved?: boolean }>(
    await fetch(`/api/conteos/${sessionId}/lineas`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku, patch }),
    }),
  );
}

export async function submitSession(
  id: string,
  payload: { counterName: string; counterPuesto: string; comentario: string },
) {
  const data = await parse<{ session: CountSession }>(
    await fetch(`/api/conteos/${id}/enviar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
  return data.session;
}

export async function createUrgent(input: { sucursalId: string; titulo: string; skus: string[] }) {
  const data = await parse<{ session: CountSession; gerenteEmail: string | null }>(
    await fetch("/api/conteos/urgentes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return data;
}

export async function fetchSemaforo(weekKey?: string, opts?: { zona?: string; page?: number }) {
  const q = new URLSearchParams();
  if (weekKey) q.set("weekKey", weekKey);
  if (opts?.zona) q.set("zona", opts.zona);
  if (opts?.page) q.set("page", String(opts.page));
  const suffix = q.size ? `?${q}` : "";
  return parse<{
    weekKey: string;
    sucursales: Sucursal[];
    zonas: string[];
    zonaOpciones?: ZonaSemaforo[];
    sessions: CountSession[];
    history?: CountSession[];
    historyWeeks?: string[];
    total: number;
    page: number;
    pageSize: number;
    resumen?: SemaforoResumen;
  }>(await fetch(`/api/admin/semaforo${suffix}`, { cache: "no-store" }));
}

export async function deleteConteo(id: string) {
  return parse<{ deleted: boolean }>(await fetch(`/api/admin/conteos/${id}`, { method: "DELETE" }));
}
