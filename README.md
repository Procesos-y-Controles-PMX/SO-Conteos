# SO Conteos

Conciliación de inventario físico vs SAP por sucursal.

## Arranque local

```bash
cd frontend
npm install
npm run dev                  # http://localhost:3004
```

Copia `frontend/.env.example` a `frontend/.env.local`. Usa el mismo proyecto de Supabase que Cotizador (`ctz_sucursales` / `ctz_usuarios`). En Supabase corre `db/schema.sql` una vez.

### Acceso

| Rol | Cómo entra |
|-----|------------|
| Sucursal | Nombre de la tienda + contraseña del gerente |
| Admin | Correo y contraseña de un admin de Cotizador |
| Portal | SSO desde SO Portal (`/auth/handoff`) |

## Datos

- Sucursales: `ctz_sucursales`
- Cuentas: `ctz_usuarios`, mapeadas con `tiendas.correo` (sucursal = gerente)
- Inventario teórico: Excel/CSV del día → `cnt_inventario_sku`
- Conteos: `cnt_conteos` / `cnt_conteo_lineas`
- Semanales: catálogo de polvos (cementos y morteros) de Cotizador

## Stack

Next.js App Router · Supabase · Tailwind · `@promexma/ui`
