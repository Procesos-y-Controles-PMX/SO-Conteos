"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AccessLogsBoard from "@/components/admin/AccessLogsBoard";
import PageHeader from "@/components/ui/PageHeader";
import { isConteosAdmin } from "@/lib/access";
import { useAuth } from "@/lib/auth";

export default function AccesosPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isConteosAdmin(user?.rol)) router.replace("/conteos");
  }, [loading, user, router]);

  if (loading || !isConteosAdmin(user?.rol)) return null;

  return (
    <div>
      <PageHeader
        eyebrow="Administración"
        title="Accesos"
        subtitle="Logins de todas las apps de Soporte Operativo: Equipo Móvil, Cotizador, Permisos, Cartas Responsivas y Conteos."
      />
      <AccessLogsBoard />
    </div>
  );
}
