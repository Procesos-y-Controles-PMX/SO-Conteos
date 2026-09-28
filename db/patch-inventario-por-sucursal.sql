-- Per-sucursal SAP stock from the national inventory file.
-- Run in the Cotizador Supabase SQL editor (project with ctz_sucursales),
-- not Equipo Móvil.
-- All lines are stored; the weekly count filters to L01–L12 (or blank) at read time.
-- PK is (sucursal, sku).

drop table if exists cnt_inventario_sku cascade;

create table cnt_inventario_sku (
  id_sucursal uuid not null references ctz_sucursales (id) on delete cascade,
  sku text not null,
  nombre text not null,
  um text not null,
  teorico numeric not null default 0,
  costo numeric not null default 0,
  linea text,
  updated_at timestamptz not null default now(),
  primary key (id_sucursal, sku)
);

create index if not exists cnt_inventario_sku_sucursal_idx on cnt_inventario_sku (id_sucursal);

alter table cnt_inventario_sku enable row level security;
