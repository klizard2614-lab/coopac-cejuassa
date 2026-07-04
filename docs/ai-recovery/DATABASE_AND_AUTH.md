# DATABASE_AND_AUTH.md

> Base de datos y autenticación. Inferido de queries y tipos en el código fuente.

## Tablas detectadas (inferidas de las queries — no se leyó el esquema SQL directamente)

### `socios`
Campos detectados: `id`, `nro_socio`, `dni`, `apellidos`, `nombres`, `estado`, `id_convenio`, `fecha_nacimiento`, `direccion`, `created_at`
Relaciones: `convenios` (FK id_convenio)

### `creditos`
Campos detectados: `id`, `nro_pagare`, `id_socio`, `monto_aprobado`, `monto_girado_neto`, `descuento_fps`, `descuento_seguro`, `descuento_otros`, `saldo_capital`, `cuota_mensual`, `tasa_interes`, `plazo_meses`, `tipo_credito`, `estado`, `fecha_desembolso`, `interes_acumulado`, `created_at`
Relaciones: `socios` (FK id_socio)

### `cronograma_cuotas`
Campos detectados: `id`, `id_credito`, `nro_cuota`, `fecha_vencimiento`, `capital`, `interes`, `cuota_total`, `capital_pagado`, `interes_pagado`, `estado`, `fecha_pago`
Estados: `pendiente`, `vencida`, `parcial`, `pagada`

### `pagos_recibos`
Campos detectados: `id`, `nro_recibo`, `id_socio`, `id_credito`, `id_convenio`, `fecha`, `periodo`, `canal_pago`, `estado_flujo`, `monto_aporte`, `monto_capital`, `monto_interes`, `monto_fps`, `monto_fps_extra`, `monto_otros`, `monto_total`, `interes_amortizado_pagado`, `observacion`, `created_at`

### `aportes`
Campos detectados: `id`, `id_socio`, `id_recibo`, `fecha`, `tipo`, `monto`, `saldo_anterior`, `saldo_nuevo`, `observacion`
Tipos (enum): `aporte`, `retiro_parcial`, `retiro_total`

### `egresos`
Campos detectados: `id`, `fecha`, `tipo`, `monto`, `beneficiario`, `descripcion`, `id_socio`, `created_by`, `created_at`
Tipos (enum): `retiro_socio`, `fondo_mortuorio`, `otro`

### `convenios`
Campos detectados: `id`, `nombre`

### `usuarios`
Campos detectados: `id`, `auth_id`, `nombre`, `email`, `rol`, `activo`, `created_at`, `updated_at`
Roles: `admin`, `tesoreria`, `creditos`, `contabilidad`
Nota: `id` y `auth_id` almacenan el mismo UUID de `auth.users`.

### `configuracion`
Campos detectados: `id`, `nombre_cooperativa`, `codigo_coopac`, `ruc`, `direccion`, `telefono`, `email`, `tasa_interes_anual`, `tasa_fps`, `provision_normal`, `provision_cpp`, `provision_deficiente`, `provision_dudoso`, `provision_perdida`, `updated_at`
Nota: siempre hay exactamente 1 fila con `id = 1`.

## ID del proyecto Supabase (confirmado en código)

`ljdjbhsipgkxlgnprzhm` — visible en el link hardcodeado en `configuracion/page.tsx`.

## Autenticación

- Proveedor: Supabase Auth (email + contraseña)
- Sin OAuth/SSO configurado (pendiente de validar)
- Flujo de invitación: Admin llama a `POST /api/usuarios/invite` → API usa service role para `supabase.auth.admin.inviteUserByEmail()` → Supabase envía email con link para setear contraseña

## Roles y permisos

| Rol | Acceso |
|---|---|
| `admin` | Todo el sistema. Únicos que pueden acceder a Configuración y Usuarios. |
| `tesoreria` | Pendiente de validar — no hay guards en el código para este rol. |
| `creditos` | Pendiente de validar — no hay guards en el código para este rol. |
| `contabilidad` | Pendiente de validar — no hay guards en el código para este rol. |

**Importante**: Los guards de rol en el frontend solo existen en `Configuración` y `Usuarios`. El resto de módulos son accesibles a cualquier usuario autenticado, independientemente de su rol.

## Cliente Supabase (confirmado en código)

- **Browser** (`lib/supabase.ts`): `createBrowserClient` de `@supabase/ssr`. Usado en todos los componentes `'use client'`.
- **Server** (API routes): `createServerClient` de `@supabase/ssr` con cookies de `next/headers`.
- **Admin** (API routes con service role): `createClient` de `@supabase/supabase-js` con `SUPABASE_SERVICE_ROLE_KEY`.

## Variables de entorno requeridas

```
NEXT_PUBLIC_SUPABASE_URL=https://ljdjbhsipgkxlgnprzhm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key — NUNCA exponer al cliente>
```
