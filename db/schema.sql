-- SO Conteos tables in the Cotizador/Permisos Supabase project.
-- Identity: ctz_sucursales + ctz_usuarios. Gerente mail comes from tiendas.correo
-- (sucursal = cuenta). Service role bypasses RLS; anon has no policies.

create extension if not exists pgcrypto;

alter table if exists cnt_inventario_carga drop constraint if exists cnt_inventario_carga_uploaded_by_fkey;
alter table if exists cnt_conteos drop constraint if exists cnt_conteos_id_sucursal_fkey;

drop table if exists cnt_conteo_lineas cascade;
drop table if exists cnt_conteos cascade;
drop table if exists cnt_usuarios cascade;
drop table if exists cnt_sucursales cascade;

create table if not exists cnt_ajustes (
  clave text primary key,
  valor jsonb not null
);

create table if not exists cnt_inventario_sku (
  sku text primary key,
  nombre text not null,
  um text not null,
  teorico numeric not null default 0,
  costo numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists cnt_inventario_carga (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid
);

create table if not exists cnt_conteos (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('semanal', 'urgente')),
  id_sucursal uuid not null references ctz_sucursales (id) on delete cascade,
  week_key text not null,
  titulo text not null,
  status text not null default 'pendiente' check (status in ('pendiente', 'en_progreso', 'enviado')),
  counter_name text,
  counter_puesto text,
  comentario text,
  created_at timestamptz not null default now(),
  submitted_at timestamptz
);

create unique index if not exists cnt_conteos_semanal_uniq
  on cnt_conteos (id_sucursal, week_key)
  where kind = 'semanal';

create table if not exists cnt_conteo_lineas (
  id uuid primary key default gen_random_uuid(),
  id_conteo uuid not null references cnt_conteos (id) on delete cascade,
  sku text not null,
  nombre text not null,
  um text not null,
  teorico numeric not null default 0,
  fisico numeric,
  pendiente_entregar numeric default 0,
  pendiente_facturar numeric default 0,
  evidencia_nombre text,
  unique (id_conteo, sku)
);

create index if not exists cnt_conteos_sucursal_idx on cnt_conteos (id_sucursal, week_key, kind);

alter table cnt_ajustes enable row level security;
alter table cnt_inventario_sku enable row level security;
alter table cnt_inventario_carga enable row level security;
alter table cnt_conteos enable row level security;
alter table cnt_conteo_lineas enable row level security;

insert into cnt_ajustes (clave, valor) values
  ('upload_window', '{"start":"05:00","end":"08:00"}'::jsonb),
  ('ignore_upload_window', 'false'::jsonb)
on conflict (clave) do nothing;

delete from cnt_inventario_sku
where sku in ('CEM-040','CEM-050','VAR-3/8','VAR-1/2','BLK-12','PINT-BCO','CAL-25','YES-40','ALU-1','TIN-600');
delete from cnt_inventario_carga where file_name = 'inventario_costos_seed.xlsx';
