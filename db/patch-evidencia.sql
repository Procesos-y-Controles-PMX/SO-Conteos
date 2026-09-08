-- Urgent-count evidence files. Retention lives in cnt_ajustes so it can change
-- without a migration. Default is 14 days.
-- Run in the Cotizador Supabase SQL editor (same project as cnt_conteo_lineas).

alter table cnt_conteo_lineas
  add column if not exists evidencia_path text,
  add column if not exists evidencia_at timestamptz,
  add column if not exists evidencia_mime text;

insert into cnt_ajustes (clave, valor)
values ('evidencia_retention_days', '14'::jsonb)
on conflict (clave) do nothing;
