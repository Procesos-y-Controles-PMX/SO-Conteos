"use client";

import { InteractiveGridPattern } from "@promexma/ui";
import {
  Bell,
  ClipboardList,
  Download,
  LayoutGrid,
  LogOut,
  Package,
  PanelLeftClose,
  Shield,
  Siren,
  Users,
} from "lucide-react";
import Image from "next/image";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { isConteosAdmin, sessionRoleLabel } from "@/lib/access";
import { goToLogin, useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: ReactNode;
  roles: Array<"admin" | "administrador_general" | "tienda">;
};

const NAV: NavItem[] = [
  { label: "Conteos", href: "/conteos", icon: <ClipboardList className="h-[18px] w-[18px]" />, roles: ["tienda"] },
  { label: "Semanales", href: "/conteos/semanales", icon: <LayoutGrid className="h-[18px] w-[18px]" />, roles: ["tienda"] },
  { label: "Urgentes", href: "/conteos/urgentes", icon: <Siren className="h-[18px] w-[18px]" />, roles: ["tienda"] },
  { label: "Semáforo", href: "/admin", icon: <LayoutGrid className="h-[18px] w-[18px]" />, roles: ["admin", "administrador_general"] },
  { label: "Inventario", href: "/admin/inventario", icon: <Package className="h-[18px] w-[18px]" />, roles: ["admin", "administrador_general"] },
  { label: "Nuevo urgente", href: "/admin/urgentes/nuevo", icon: <Bell className="h-[18px] w-[18px]" />, roles: ["admin", "administrador_general"] },
  { label: "Descargas", href: "/admin/descargas", icon: <Download className="h-[18px] w-[18px]" />, roles: ["admin", "administrador_general"] },
  { label: "Usuarios", href: "/admin/usuarios", icon: <Users className="h-[18px] w-[18px]" />, roles: ["admin", "administrador_general"] },
  { label: "Accesos", href: "/admin/accesos", icon: <Shield className="h-[18px] w-[18px]" />, roles: ["administrador_general"] },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  const { user, loading } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!loading && !user) goToLogin();
  }, [loading, user]);

  const items = useMemo(
    () => NAV.filter((item) => (user ? item.roles.includes(user.rol) : false)),
    [user],
  );

  const isActive = (href: string) => {
    if (href === "/conteos") return pathname === "/conteos";
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  if (loading || !user) {
    return (
      <div className="app-canvas flex min-h-dvh items-center justify-center text-sm text-fg-subtle">
        Verificando sesión...
      </div>
    );
  }

  const isCountSession = /^\/conteos\/[^/]+$/.test(pathname);

  function handleLogout() {
    goToLogin();
  }

  return (
    <div className="app-canvas min-h-dvh lg:h-dvh lg:overflow-hidden">
      <aside
        className={cn(
          "neu-sidebar fixed inset-y-0 left-0 z-40 hidden flex-col transition-all duration-300 lg:flex",
          sidebarCollapsed ? "w-[72px]" : "w-[250px]",
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-5">
          <Link href={isConteosAdmin(user.rol) ? "/admin" : "/conteos"} className="flex min-w-0 items-center gap-2.5">
            <Image
              src="/circulo-promexma.png"
              alt="Promexma"
              width={30}
              height={30}
              className="neu-raised-sm shrink-0 rounded-full"
            />
            {!sidebarCollapsed ? (
              <div className="min-w-0">
                <p className="font-display text-sm font-bold leading-none text-fg">Promexma</p>
                <p className="mt-0.5 truncate text-[10px] font-medium text-fg-subtle">SO Conteos</p>
              </div>
            ) : null}
          </Link>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            className={cn(
              "neu-button flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-fg-subtle hover:text-fg",
              sidebarCollapsed && "absolute left-[58px]",
            )}
            aria-label={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
          >
            <PanelLeftClose className={cn("h-3.5 w-3.5 transition-transform", sidebarCollapsed && "rotate-180")} />
          </button>
        </div>

        <nav className="sidebar-scroll flex-1 space-y-1.5 px-3 py-4">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={sidebarCollapsed ? item.label : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-sm px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
                sidebarCollapsed && "justify-center",
                isActive(item.href) ? "neu-nav-active text-white" : "neu-nav-idle text-fg-muted hover:text-fg",
              )}
            >
              <span className="shrink-0">{item.icon}</span>
              {!sidebarCollapsed ? <span className="truncate">{item.label}</span> : null}
            </Link>
          ))}
        </nav>

        <div className="space-y-2 p-3">
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <ThemeToggle />
              <button
                type="button"
                onClick={handleLogout}
                title="Cerrar sesión"
                className="neu-button inline-flex h-9 w-9 items-center justify-center rounded-full text-fg-subtle hover:text-fg"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="neu-tray px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-faint">Sesión</p>
                <p className="mt-0.5 truncate text-xs font-semibold text-fg">{user.nombre}</p>
                <p className="truncate text-[10px] text-fg-faint">
                  {sessionRoleLabel(user)}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <ThemeToggle />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="neu-button flex flex-1 items-center justify-center gap-2 rounded-sm px-3 py-2 text-[12px] font-medium text-fg-muted hover:text-fg"
                >
                  <LogOut className="h-4 w-4" />
                  Salir
                </button>
              </div>
            </>
          )}
        </div>
      </aside>

      <div
        className={cn(
          "relative flex min-h-dvh flex-col transition-all duration-300 lg:h-full lg:min-h-0 lg:ml-[250px]",
          sidebarCollapsed && "lg:ml-[72px]",
        )}
      >
        <div className="app-grid-tile pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
          <InteractiveGridPattern
            key={mounted ? resolvedTheme : "light"}
            cellSize={64}
            skewY={6}
            wave
            waveDuration={5}
            waveGap={4}
            className="absolute inset-0"
            squaresClassName="stroke-[var(--grid-line)]"
          />
        </div>
        <header className="app-safe-x z-30 flex shrink-0 items-center justify-between gap-2 bg-transparent py-3 lg:hidden">
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold text-fg">SO Conteos</p>
            <p className="truncate text-[11px] text-fg-subtle">{user.nombre}</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={handleLogout}
              className="neu-button inline-flex h-9 items-center justify-center rounded-sm px-3 text-xs font-semibold text-fg"
            >
              Salir
            </button>
          </div>
        </header>
        <main className="app-main-pad app-safe-x relative z-10 flex flex-col overflow-x-hidden py-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:py-6">
          {children}
        </main>
      </div>

      {isCountSession ? null : (
        <MobileBottomNav
          items={items.slice(0, 4).map((item) => ({
            label: item.label,
            href: item.href,
            icon: item.icon,
            active: isActive(item.href),
          }))}
        />
      )}
    </div>
  );
}
