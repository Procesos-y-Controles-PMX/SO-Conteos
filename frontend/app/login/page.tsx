"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { GridLoadingScreen } from "@promexma/ui";
import LoginShell from "@/components/login/LoginShell";
import SearchCombobox, { type SearchComboboxOption } from "@/components/ui/SearchCombobox";
import { loginButtonClass, loginInputClass, loginLabelClass, loginTitleClass } from "@/components/login/loginStyles";
import { staffHomePath } from "@/lib/access";
import { loginAdmin, loginSucursal, portalLoginUrl } from "@/lib/auth";
import { listSucursales } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Sucursal } from "@/lib/types";

type Mode = "tienda" | "admin";

export default function LoginPage() {
  const router = useRouter();
  const portalUrl = portalLoginUrl();
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [mode, setMode] = useState<Mode>("tienda");
  const [sucursalId, setSucursalId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (portalUrl) window.location.replace(portalUrl);
  }, [portalUrl]);

  useEffect(() => {
    if (portalUrl) return;
    void listSucursales()
      .then((rows) => {
        setSucursales(rows);
        setSucursalId((prev) => prev || rows[0]?.id || "");
      })
      .catch((err: Error) => setError(err.message));
  }, [portalUrl]);

  if (portalUrl) {
    return <GridLoadingScreen variant="dark" message="Redirigiendo al portal..." />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (mode === "tienda" && !sucursalId) {
      setError("Elige una sucursal.");
      toast.error("Elige una sucursal.");
      return;
    }
    setLoading(true);
    const result =
      mode === "admin" ? await loginAdmin(email, password) : await loginSucursal(sucursalId, password);
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }
    toast.success(`Bienvenido, ${result.user.nombre}`);
    router.replace(staffHomePath(result.user.rol));
  }

  return (
    <LoginShell heroLine1="Conteos de" heroLine2="inventario">
      <div className="mb-6 sm:mb-8">
        <h2 className={loginTitleClass}>Iniciar sesión</h2>
        <p className="mt-2 text-sm text-fg-subtle">
          Elige tu sucursal. La contraseña es la del gerente de tienda.
        </p>
      </div>

      <div className="neu-tray mb-5 grid grid-cols-2 gap-1 p-1">
        {(["tienda", "admin"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setMode(item)}
            className={cn(
              "rounded-sm px-3 py-2 text-sm font-semibold",
              mode === item ? "neu-nav-active text-white" : "text-fg-muted",
            )}
          >
            {item === "tienda" ? "Sucursal" : "Admin"}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        {mode === "tienda" ? (
          <label className="block">
            <span className={loginLabelClass}>Sucursal</span>
            <SearchCombobox
              minChars={0}
              clearOnType={false}
              placeholder="Buscar sucursal…"
              value={
                sucursales.find((s) => s.id === sucursalId)
                  ? {
                      id: sucursalId,
                      label: sucursales.find((s) => s.id === sucursalId)!.nombre,
                      sublabel: sucursales.find((s) => s.id === sucursalId)!.zona,
                    }
                  : null
              }
              onChange={(opt) => setSucursalId(opt?.id ?? "")}
              onSearch={(query) => {
                const q = query.trim().toLowerCase();
                return sucursales
                  .filter((s) => !q || `${s.nombre} ${s.zona}`.toLowerCase().includes(q))
                  .slice(0, 40)
                  .map((s) => ({ id: s.id, label: s.nombre, sublabel: s.zona }) satisfies SearchComboboxOption);
              }}
            />
          </label>
        ) : (
          <label className="block">
            <span className={loginLabelClass}>Correo</span>
            <input
              type="email"
              className={loginInputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
        )}

        <label className="block">
          <span className={loginLabelClass}>Contraseña</span>
          <input
            type="password"
            className={loginInputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error ? (
          <div className="flex items-center gap-2.5 rounded-lg bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
            <AlertCircle size={15} className="shrink-0" />
            {error}
          </div>
        ) : null}

        <button type="submit" disabled={loading} className={loginButtonClass}>
          {loading ? "Verificando..." : "Acceder"}
        </button>
      </form>
    </LoginShell>
  );
}
