export type SoAccountApp = "equipo" | "cotizador" | "permisos" | "carta-responsiva";

export const SO_ACCOUNT_APP_LABELS: Record<SoAccountApp, string> = {
  equipo: "Equipo Móvil",
  cotizador: "Cotizador / Conteos",
  permisos: "Permisos",
  "carta-responsiva": "Cartas Responsivas",
};

export const SO_ACCOUNT_APPS = Object.keys(SO_ACCOUNT_APP_LABELS) as SoAccountApp[];

export type SoAccountAltaSource = "created_at" | "first_login";

export type SoAccount = {
  key: string;
  app: SoAccountApp;
  email: string;
  nombre: string | null;
  rol: string;
  activo: boolean | null;
  alta: string | null;
  altaSource: SoAccountAltaSource | null;
};

export type SoAccountsSourceStatus = "ok" | "missing_env" | "error";

export type SoAccountsResult = {
  cuentas: SoAccount[];
  sources: Record<SoAccountApp, SoAccountsSourceStatus>;
};
