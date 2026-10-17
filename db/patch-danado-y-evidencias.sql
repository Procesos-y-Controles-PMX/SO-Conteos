-- Material dañado per line + several evidence files per slot (físico, pendientes, dañado).
-- Run in the Cotizador Supabase SQL editor (same project as cnt_conteo_lineas).
-- The old evidencia_* columns stay: they hold files uploaded before this patch.

alter table cnt_conteo_lineas
  add column if not exists danado numeric default 0;

create table if not exists cnt_evidencias (
  id uuid primary key default gen_random_uuid(),
  id_conteo uuid not null references cnt_conteos (id) on delete cascade,
  sku text not null,
  kind text not null check (kind in ('general', 'entregar', 'facturar', 'danado')),
  path text not null unique,
  nombre text,
  mime text,
  created_at timestamptz not null default now()
);

create index if not exists cnt_evidencias_conteo_idx on cnt_evidencias (id_conteo, sku);

alter table cnt_evidencias enable row level security;
