-- Shared Cotizador Supabase (Conteos, Permisos, Cartas Responsivas).
-- Sets the platform owner to each app's highest stored admin role.

update ctz_usuarios
set rol = 'admin', activo = true
where lower(email) = 'fernando.corella@ext.cemex.com';

update cr_usuarios
set
  rol = 'administrador_general',
  activo = true,
  id_sucursal = null,
  region = null
where lower(email) = 'fernando.corella@ext.cemex.com';

update perfiles
set
  id_rol = 1,
  id_tienda = null,
  id_region = null
where lower(email) = 'fernando.corella@ext.cemex.com';
