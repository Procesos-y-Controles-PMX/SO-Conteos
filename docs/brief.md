# Conteos de inventario

## Problema

Las sucursales concilian inventario SAP vs físico con tablas impresas.

## Solución

App SO: la tienda cuenta SKUs en el teléfono; administración carga el inventario del día, dispara urgentes y ve semáforos por zona/sucursal.

Identidad: una cuenta por sucursal (gerente de tienda). En el login se elige el nombre de la tienda; la contraseña es la de ese correo.

## Persistencia

Tablas `cnt_*` en el mismo Supabase que Cotizador. Sucursales y usuarios no se duplican: `ctz_sucursales` + `ctz_usuarios`. Ver `db/schema.sql`.
