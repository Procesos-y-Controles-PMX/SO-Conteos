-- Cierre automático "no concluido" + plazo de desbloqueo.
-- Run in the Cotizador Supabase SQL editor (same project as cnt_conteos).

alter table cnt_conteos
  add column if not exists desbloqueado_hasta timestamptz;

-- Allow status no_concluido (started but not finished by Saturday midnight).
do $$
declare
  cname text;
begin
  select con.conname into cname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where rel.relname = 'cnt_conteos'
    and nsp.nspname = 'public'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%status%';
  if cname is not null then
    execute format('alter table cnt_conteos drop constraint %I', cname);
  end if;
end $$;

alter table cnt_conteos
  add constraint cnt_conteos_status_check
  check (status in ('pendiente', 'en_progreso', 'enviado', 'no_concluido'));
