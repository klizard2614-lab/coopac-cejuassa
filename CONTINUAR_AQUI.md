# CONTINUAR AQUÍ — COOPAC CEJUASSA

## Proyecto
**COOPAC CEJUASSA** — Sistema de gestión para cooperativa de ahorro y crédito.

## Stack
- **Frontend/Backend:** Next.js 14 + TypeScript + Tailwind CSS
- **Base de datos:** Supabase (PostgreSQL)
- **Deploy:** Vercel
- **Auth:** Supabase Auth

## Repositorio y URLs
- **Repo:** `klizard2614-lab/coopac-cejuassa`
- **Producción:** https://coopac-cejuassa.vercel.app
- **Supabase project:** `ljdjbhsipgkxlgnprzhm` (region: sa-east-1)

## Módulos completados
| Módulo | Rutas | Estado |
|--------|-------|--------|
| Login | `/login` | ✅ Completo |
| Dashboard | `/dashboard` | ✅ Completo |
| Socios | `/dashboard/socios` | ✅ Completo (lista, nuevo, ver, editar) |
| Créditos | `/dashboard/creditos` | ✅ Completo (lista, nuevo, ver, editar + cronograma) |
| Pagos/Recibos | `/dashboard/pagos` | ✅ Completo (lista, nuevo, ver + actualiza saldo y cuotas) |
| Aportes | `/dashboard/aportes` | ✅ Completo (lista con tarjetas resumen + filtros, detalle) |
| Egresos | `/dashboard/egresos` | ✅ Completo (lista + filtros por tipo/fecha, total, modal nuevo/editar, eliminar con confirmación) |
| Convenios | `/dashboard/convenios` | ✅ Completo (tarjetas por convenio + tabla resumen + detalle de pagos) |
| Cartera | `/dashboard/cartera` | ✅ Completo (lista con tarjetas por clasificación + filtros, detalle con cronograma) |
| Reportes | `/dashboard/reportes` | ✅ Completo (Anexo N°6 + Reporte de Aportes + Reporte de Caja — todos con filtros y exportación Excel) |
| Dashboard | `/dashboard` | ✅ Completo con indicadores reales (socios, cartera, mora, mes, provisiones, accesos rápidos) |
| Usuarios | `/dashboard/usuarios` | ✅ Completo (lista con protección admin, modal invitar usuario vía Supabase Auth, editar rol/estado, API routes invite+update) |
| Configuración | `/dashboard/configuracion` | ✅ Completo (datos cooperativa, parámetros financieros, gestión convenios) |
| Mora | `/dashboard/mora` | ✅ Completo (lista créditos en mora, filtros días/tipo, resumen, badges en créditos, alerta dashboard) |

## ESTADO: PRODUCCIÓN LISTA ✅
*Verificado el 2026-06-05 — Build limpio confirmado*

Todos los módulos funcionando con RLS activo y rediseño UI aplicado:
- Login, Dashboard, Socios, Créditos, Pagos/Recibos, Aportes, Egresos, Convenios, Cartera, Mora, Reportes, Usuarios, Configuración

### UI — Rediseño minimalista (2026-06-05)
- **Paleta**: #1A56DB (azul), #1E3A5F (navbar), #2D5A27 (acento), #F8FAFC (fondo)
- **Sidebar**: lucide-react icons, ítem activo con fondo #1A56DB, logo SVG
- **Login**: logo centrado, card blanca, inputs con iconos, botón azul
- **Dashboard**: KPI cards con iconos SVG, sin emojis
- **Zero emojis** en toda la app — reemplazados por lucide-react

## 🎉 MVP COMPLETO

Todos los módulos del MVP están implementados y funcionando.

## Pendientes post-MVP
- Auditoría (`/dashboard/auditoria`) — tabla ya existe en Supabase
- ~~RLS / Seguridad por rol en todas las tablas~~ ✅ Aplicado y verificado (2026-06-05)
- ~~Mejoras Dashboard (gráficos, evolución histórica)~~ ✅ Implementado — 3 gráficos recharts
- Integración completa Usuarios ↔ Supabase Auth (auto-crear perfil al primer login)
- PDF Reporte de cartera (pendiente, los dos primeros PDF ya están: recibo de pago y ficha de socio)
- Módulo Mora implementado: `/dashboard/mora` con alertas visuales, badges en créditos, banner en dashboard

## Estado de producción
- `SUPABASE_SERVICE_ROLE_KEY` ✅ configurada en `.env.local` y Vercel
- Middleware de autenticación ✅ (`proxy.ts` — redirige a /login si no hay sesión)
- Protección por rol ✅ implementada (ver tabla abajo)
- APIs protegidas ✅ (`/api/usuarios/invite` y `/api/usuarios/update` verifican rol admin)

### Mapa de protecciones por rol

| Ruta | admin | tesoreria | creditos | contabilidad |
|------|-------|-----------|----------|--------------|
| `/dashboard/*` (todas) | ✅ | ✅ | ✅ | ✅ |
| `/dashboard/usuarios` | ✅ | 🔒 | 🔒 | 🔒 |
| `/dashboard/usuarios/nuevo` | ✅ | 🔒 | 🔒 | 🔒 |
| `/dashboard/usuarios/[id]` | ✅ | 🔒 | 🔒 | 🔒 |
| `/dashboard/configuracion` | ✅ | 🔒 | 🔒 | 🔒 |
| `/dashboard/configuracion/convenios` | ✅ | 🔒 | 🔒 | 🔒 |
| `/dashboard/socios/nuevo` | ✅ | 🔒 | ✅ | 🔒 |
| `/dashboard/socios/[id]/editar` | ✅ | 🔒 | ✅ | 🔒 |
| Resto del dashboard | ✅ | ✅ | ✅ | ✅ |

## Convenciones del proyecto
- Todos los archivos de página usan `'use client'`
- Color principal: `#1e3a5f`
- Cliente Supabase: `import { createClient } from '@/lib/supabase'`
- IDs en Supabase son **integers**, no UUIDs
- Componente `SocioSearch` reutilizable en `app/dashboard/creditos/_components/SocioSearch.tsx`

## Columnas reales confirmadas por código

### Tabla `socios`
| Columna | Nota |
|---------|------|
| `nro_socio` | ⚠️ NO es `codigo_socio` |
| `apellidos` | ⚠️ NO es `apellido` (con 's') |
| `nombres` | ⚠️ NO es `nombre` (con 's') |
| `dni` | |
| `fecha_nacimiento` | nullable |
| `telefono` | nullable |
| `email` | nullable |
| `direccion` | nullable |
| `id_convenio` | integer nullable, FK → convenios.id |
| `fecha_ingreso` | nullable |
| `estado` | enum: activo, retirado, suspendido, fallecido |
| `beneficiario_nombre` | nullable |
| `beneficiario_dni` | nullable |
| `beneficiario_parentesco` | nullable |

### Tabla `pagos_recibos`
| Columna | Tipo |
|---------|------|
| `id` | integer PK |
| `nro_recibo` | text |
| `id_socio` | integer FK → socios |
| `id_credito` | integer nullable FK → creditos |
| `id_convenio` | integer nullable FK → convenios |
| `fecha` | date |
| `periodo` | text (formato YYYY-MM) |
| `canal_pago` | enum: caja, convenio |
| `monto_aporte` | numeric |
| `monto_capital` | numeric |
| `monto_interes` | numeric |
| `monto_fps` | numeric |
| `monto_fps_extra` | numeric |
| `monto_otros` | numeric |
| `monto_total` | numeric |
| `interes_amortizado_pagado` | numeric |
| `estado_flujo` | enum: registrado, en_correccion, validado, cerrado |
| `observacion` | text nullable |
| `created_at` | timestamptz |
| `created_by` | uuid nullable |

### Tabla `aportes`
| Columna | Tipo |
|---------|------|
| `id` | integer PK |
| `id_socio` | integer FK → socios |
| `fecha` | date |
| `tipo` | enum tipo_movimiento_aporte (default 'aporte') |
| `monto` | numeric |
| `saldo_anterior` | numeric |
| `saldo_nuevo` | numeric |
| `observacion` | text nullable |
| `id_recibo` | integer nullable FK → pagos_recibos |
| `created_at` | timestamptz |
| `created_by` | uuid nullable |

### Tabla `convenios`
| Columna confirmada por código |
|-------------------------------|
| `id` | integer PK |
| `nombre` | text |
| (posibles columnas adicionales no confirmadas desde el código) |

### Otras tablas confirmadas
- `creditos`: nro_pagare, saldo_capital, cuota_mensual, estado, id_socio + más
- `cronograma_cuotas`: id_credito, nro_cuota, estado, capital_pagado, interes_pagado, fecha_pago
- Tablas mencionadas en CAMBIOS_REALIZADOS pero no confirmadas: `cartera_mensual` y otras de soporte
