-- Evidence columns on count lines (físico / urgente + pendientes).
-- Run in the Cotizador Supabase SQL editor (same project as cnt_conteo_lineas).

alter table cnt_conteo_lineas
  add column if not exists evidencia_nombre text,
  add column if not exists evidencia_path text,
  add column if not exists evidencia_at timestamptz,
  add column if not exists evidencia_mime text,
  add column if not exists evidencia_entregar_nombre text,
  add column if not exists evidencia_entregar_path text,
  add column if not exists evidencia_entregar_at timestamptz,
  add column if not exists evidencia_entregar_mime text,
  add column if not exists evidencia_facturar_nombre text,
  add column if not exists evidencia_facturar_path text,
  add column if not exists evidencia_facturar_at timestamptz,
  add column if not exists evidencia_facturar_mime text;

insert into cnt_ajustes (clave, valor)
values ('evidencia_retention_days', '14'::jsonb)
on conflict (clave) do nothing;
