-- Run this only if cnt_conteos already exists with id_sucursal as text
-- (the version without the Cotizador FK). Safe to skip if you created
-- cnt_conteos with uuid + references ctz_sucursales.

alter table cnt_conteos
  alter column id_sucursal type uuid using id_sucursal::uuid;

alter table cnt_conteos drop constraint if exists cnt_conteos_id_sucursal_fkey;
alter table cnt_conteos
  add constraint cnt_conteos_id_sucursal_fkey
  foreign key (id_sucursal) references ctz_sucursales (id) on delete cascade;
