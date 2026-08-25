"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AccessLogsBoard from "@/components/admin/AccessLogsBoard";
import PageHeader from "@/components/ui/PageHeader";
import { isMajorAdmin } from "@/lib/access";
import { useAuth } from "@/lib/auth";

export default function AccesosPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isMajorAdmin(user)) router.replace("/admin");
  }, [loading, user, router]);

  if (loading || !isMajorAdmin(user)) return null;

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
