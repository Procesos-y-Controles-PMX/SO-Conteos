-- Per-line diff comments + separate evidence for pendiente entregar / facturar.
-- Run in the Cotizador Supabase SQL editor (same project as cnt_conteo_lineas).

alter table cnt_conteo_lineas
  add column if not exists comentario text,
  add column if not exists costo numeric not null default 0,
  add column if not exists evidencia_entregar_nombre text,
  add column if not exists evidencia_entregar_path text,
  add column if not exists evidencia_entregar_at timestamptz,
  add column if not exists evidencia_entregar_mime text,
  add column if not exists evidencia_facturar_nombre text,
  add column if not exists evidencia_facturar_path text,
  add column if not exists evidencia_facturar_at timestamptz,
  add column if not exists evidencia_facturar_mime text;
