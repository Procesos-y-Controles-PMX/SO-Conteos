# SO Conteos

Conciliación de inventario físico vs SAP por sucursal.

## Arranque local

```bash
cd frontend
npm install
npm run dev                  # http://localhost:3004
```

Copia `frontend/.env.example` a `frontend/.env.local`. Usa el mismo proyecto de Supabase que Cotizador (`ctz_sucursales` / `ctz_usuarios`). En Supabase corre `db/schema.sql` una vez. Si `cnt_inventario_sku` ya existía con PK solo por SKU, corre también `db/patch-inventario-por-sucursal.sql`. Para fotos de urgentes y pendientes semanales, corre `db/patch-evidencia.sql` y `db/patch-feedback-lineas.sql`.

### Acceso

| Rol | Cómo entra |
|-----|------------|
| Sucursal | Nombre de la tienda + contraseña del gerente |
| Admin | Correo y contraseña de un admin de Cotizador |
| Portal | SSO desde SO Portal (`/auth/handoff`) |

## Datos

- Sucursales: `ctz_sucursales`
- Cuentas: `ctz_usuarios`, mapeadas con `tiendas.correo` (sucursal = gerente)
- Inventario teórico: archivo nacional SAP (L1–L12 + líneas en blanco) → `cnt_inventario_sku` por sucursal
- Conteos: `cnt_conteos` / `cnt_conteo_lineas`
- Evidencia de urgentes: bucket `cnt-evidencia` (se borra a los 14 días; cambia `cnt_ajustes.evidencia_retention_days`)
- Semanales: el surtido y el teórico de esa sucursal en el archivo SAP

## Stack

Next.js App Router · Supabase · Tailwind · `@promexma/ui`
