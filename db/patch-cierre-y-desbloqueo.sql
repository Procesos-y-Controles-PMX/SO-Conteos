-- Conteos: cierre de captura, desbloqueo de semanas y totales de diferencia.
-- Run in the Cotizador Supabase SQL editor (same project as cnt_conteos).

alter table cnt_conteos
  add column if not exists captura_cerrada_at timestamptz,
  add column if not exists desbloqueado_at timestamptz,
  add column if not exists desbloqueado_por text,
  add column if not exists dif_skus integer,
  add column if not exists dif_monto numeric;
