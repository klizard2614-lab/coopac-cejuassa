# CAMBIOS REALIZADOS — COOPAC CEJUASSA

## Infraestructura Supabase
- 14 tablas creadas: `socios`, `creditos`, `cronograma_cuotas`, `pagos_recibos`, `aportes`, `convenios`, `cartera_mensual`, y otras de soporte
- Enums definidos: `estado_credito`, `estado_cuota`, `canal_pago`, `estado_flujo_pago`, `tipo_credito`, `tipo_movimiento_aporte`
- RLS configurado en Supabase Auth

## Proyecto Next.js
- Inicializado con `create-next-app` (Next.js 14, TypeScript, Tailwind CSS, App Router)
- Configurado `@supabase/ssr` para autenticación server/client
- `lib/supabase.ts` con `createBrowserClient`
- Deploy configurado en Vercel (`coopac-cejuassa.vercel.app`)

## Login (`/login`)
- Formulario de email + contraseña con Supabase Auth
- Redirección automática al dashboard si hay sesión activa
- Manejo de errores de autenticación

## Dashboard (`/dashboard`)
- Layout con sidebar fijo (`#1e3a5f`) y 8 ítems de navegación
- Indicador de ruta activa
- Botón de cierre de sesión
- Página principal del dashboard

## Módulo Socios (`/dashboard/socios`)
- Lista con buscador por nombre/DNI/nro_socio
- Formulario reutilizable `SocioForm.tsx` para nuevo y editar
- Vista detalle con todos los datos del socio
- CRUD completo

## Módulo Créditos (`/dashboard/creditos`)
- Lista con buscador por nombre/nro_pagare, badges de estado
- Formulario nuevo: cálculo automático de cuota mensual (fórmula francesa)
- Generación automática de cronograma de cuotas al registrar
- Vista detalle: cronograma completo con estados por cuota, totales
- Editar: actualiza datos del crédito
- Componente `SocioSearch.tsx` con búsqueda en tiempo real (dropdown)

## Módulo Pagos/Recibos (`/dashboard/pagos`)
- Lista con filtros por periodo, canal_pago y estado_flujo
- Badges de color por estado_flujo: azul/amarillo/verde/gris
- Total del período visible debajo de la tabla
- Formulario nuevo:
  - Busca socio → carga automáticamente crédito vigente y convenio
  - Desglose: aporte, capital, interés, fps, fps_extra, otros
  - `monto_total` calculado en tiempo real
  - Al guardar ejecuta 3 acciones atómicas:
    1. Inserta en `pagos_recibos`
    2. Actualiza `saldo_capital` en `creditos` (resta monto_capital)
    3. Marca cuota pendiente más antigua como `pagada` en `cronograma_cuotas`
    4. Inserta en `aportes` si `monto_aporte > 0` (con saldo_anterior/saldo_nuevo)
- Vista detalle: todos los datos + desglose + botón para pasar a `en_correccion`

## Módulo Aportes (`/dashboard/aportes`)
- Lista con 3 tarjetas resumen: total mes, total año, socios con aportes en el mes
- Filtros por nombre/DNI, mes y año (mes y año actual por defecto)
- Tabla: Socio, DNI, Fecha, Monto, Saldo Acumulado, Recibo, Ver
- Join a `socios` (nombres/apellidos/dni) y `pagos_recibos` (nro_recibo)
- Ordenado por fecha DESC
- Vista detalle (`/dashboard/aportes/[id]`): datos del socio, desglose del movimiento (saldo anterior/nuevo/monto), tipo, observación, link al recibo vinculado, metadatos de registro
- Sidebar ya tenía el ítem Aportes con ícono 📥

## Módulo Egresos (`/dashboard/egresos`)
- Página única `app/dashboard/egresos/page.tsx` con todo en un archivo (`'use client'`)
- Tarjeta superior con total de egresos (suma de montos filtrados) y contador de registros
- Filtros: tipo (retiro_socio / fondo_mortuorio / otro) + fecha desde + fecha hasta; botón "Limpiar" aparece cuando hay filtros activos
- Tabla: Fecha, Tipo (badge de color), Socio / Beneficiario, Descripción, Monto, Acciones
  - Tipo badge: azul=Retiro de Socio, morado=Fondo Mortuorio, gris=Otro
  - Columna socio: muestra `apellidos, nombres` si hay `id_socio` vinculado, sino muestra `beneficiario`
- Modal "+ Nuevo Egreso": fecha (pre-rellena con hoy), tipo (select obligatorio), monto (numérico obligatorio), beneficiario (texto opcional), socio (SocioSearch reutilizable), descripción (textarea opcional)
- Modal "Editar Egreso": carga todos los campos del registro existente, incluyendo label del socio
- Modal de confirmación para eliminar ("¿Eliminar egreso?") antes de ejecutar DELETE
- `created_by` = `supabase.auth.getUser().user.id` al insertar (FK → public.usuarios.id)
- Sidebar: ítem "💸 Egresos" agregado entre Aportes y Convenios en `app/dashboard/layout.tsx`
- RLS confirmada: INSERT/UPDATE para admin+tesoreria, DELETE para admin, SELECT para todos los autenticados
- Enum `tipo_egreso`: retiro_socio, fondo_mortuorio, otro (ya existía en Supabase)

## Gráficos históricos en Dashboard (`/dashboard`)

### Instalación
- `recharts` instalado (client-side con `'use client'`)

### Nueva sección "Evolución histórica — últimos 6 meses"
Ubicada entre Mes actual y Provisiones. Grid responsive: 3 columnas desktop / 1 columna mobile.

**Gráfico 1 — Ingresos vs Egresos (BarChart)**
- Barras azul (#3B82F6) para ingresos (`pagos_recibos.monto_total`) y roja (#EF4444) para egresos (`egresos.monto`)
- Datos de los últimos 6 meses, agrupados por mes en JS
- Eje X: mes abreviado "Ene 25", Y: valores en k
- Tooltip personalizado con formato S/ xxx.xx

**Gráfico 2 — Evolución de Aportes (AreaChart)**
- Línea verde con área sombreada, `aportes WHERE tipo='aporte'`
- Puntos en cada mes, gradiente lineal como relleno
- Últimos 6 meses, tooltip personalizado S/

**Gráfico 3 — Estado de Cartera (PieChart donut)**
- Dona (innerRadius=45, outerRadius=72), datos de TODOS los créditos por estado
- Colores: vigente=azul, cancelado=verde, castigado=rojo, refinanciado=amarillo
- Leyenda manual con nombre del estado y cantidad de créditos
- Tooltip muestra cantidad y monto S/

### Queries (añadidas a Promise.all existente — 8 queries paralelas total)
- `pagos_recibos` filtrado por `fecha >= inicio_6m` → ingresos históricos
- `egresos` filtrado por `fecha >= inicio_6m` → egresos históricos
- `aportes WHERE tipo='aporte'` filtrado por fecha → evolución aportes
- `creditos` sin filtro de estado → distribución por estado (dona)

### Skeletons mientras cargan los gráficos (mismo loading state del resto del dashboard)

---

## Módulo Mora (`/dashboard/mora`) — Alertas visuales

### Lógica de mora implementada
Una cuota está en mora cuando: `estado = 'vencida'` O (`fecha_vencimiento < hoy` AND `estado IN ('pendiente','parcial')`).
Un crédito está en mora cuando es vigente y tiene al menos 1 cuota en mora.

### Sidebar (`app/dashboard/layout.tsx`)
- Ítem "⚠️ Mora" agregado entre Cartera y Reportes

### Dashboard (`app/dashboard/page.tsx`)
- Indicador `creditosEnMora: number` añadido al tipo `Indicadores`
- Lógica de mora actualizada a definición completa (antes solo chequeaba `estado='vencida'`)
- Banner de alerta: verde "✅ Sin mora" cuando 0 moras, rojo "🚨 X créditos en mora — S/ X en riesgo" con botón "Ver detalle →" a `/dashboard/mora`
- Tarjeta "Mora actual" actualizada: sub muestra conteo de créditos afectados
- Acceso rápido "⚠️ Ver Mora" añadido

### Créditos (`app/dashboard/creditos/page.tsx`)
- Fetch paralelo de `cronograma_cuotas` junto con créditos
- Badge "EN MORA" rojo en columna Estado para créditos vigentes con mora
- Fila resaltada en `bg-red-50` cuando en mora
- Botón "⚠️ Solo en mora" que filtra la tabla + badge contador

### Nueva página Mora (`app/dashboard/mora/page.tsx`)
- 4 tarjetas resumen: créditos en mora, socios afectados, monto vencido, capital en riesgo
- Filtro por banda de días: 1-30 / 31-60 / 61-90 / +90 días
- Filtro por tipo de crédito: consumo / microempresa / hipotecario / otro
- Buscador por socio o Nº pagaré
- Tabla ordenada por días de atraso DESC: Nro Socio, Apellidos y Nombres, Nro Pagaré, F. Desembolso, Cuotas vencidas, Días atraso (badge coloreado), Saldo Capital, Monto Vencido, Ver crédito
- Estado vacío verde "✅ No hay créditos en mora"

---

## Exportación PDF — Recibo de Pago y Ficha de Socio

### Instalación
- `jspdf` + `jspdf-autotable` instalados (client-side, sin rutas API)

### Recibo de Pago PDF (`/dashboard/pagos`)
- Utilitario: `app/dashboard/pagos/utils/generarReciboPDF.ts`
- Botón "📄 PDF" agregado en cada fila junto a "Ver"
- Al clicar: fetch completo de `pagos_recibos` + join `socios` + `configuracion` (nombre_cooperativa, ruc)
- Diseño: encabezado cooperativa, datos del socio, tabla de conceptos (solo filas con monto > 0), observación, estado, firma
- Nombre de archivo: `recibo_[nro_recibo]_[YYYYMMDD].pdf`
- Estado "Generando..." mientras procesa; alert si hay error

### Ficha de Socio PDF (`/dashboard/socios`)
- Utilitario: `app/dashboard/socios/utils/generarFichaSocioPDF.ts`
- Botón "📄 PDF" agregado en cada fila junto a "Ver" y "Editar"
- Al clicar: fetch de `socios` (con join convenios) + `configuracion` + `aportes` (últimos 12) + `creditos` + `pagos_recibos` (últimos 6)
- Diseño: encabezado cooperativa, datos personales en 2 columnas, tabla aportes con total, tabla créditos, tabla últimos pagos
- Nombre de archivo: `ficha_socio_[nro_socio]_[APELLIDOS].pdf`
- Estado "Generando..." mientras procesa; alert si hay error

---

## Rediseño UI — Estilo moderno minimalista (2026-06-05)

### Dependencias agregadas
- `lucide-react@1.17.0` instalado

### Archivos nuevos
- `public/logo-cejuassa.svg` — logo SVG placeholder (reemplazar con PNG real cuando esté disponible)

### Archivos modificados
| Archivo | Cambio |
|---------|--------|
| `app/dashboard/layout.tsx` | Sidebar con lucide-react icons, logo, paleta #1E3A5F/#1A56DB, ítem activo azul |
| `app/login/page.tsx` | Rediseño completo: logo centrado, iconos Mail/Lock/ArrowRight/Loader2, fondo #F8FAFC |
| `app/dashboard/page.tsx` | Tarjetas KPI con iconos SVG, accesoRapido con iconos, SeccionLabel, tooltips actualizados |
| `components/AccesoDenegado.tsx` | ShieldOff icon, ArrowLeft, paleta nueva |
| `app/dashboard/socios/page.tsx` | `📄 PDF` → `<FileText/>` |
| `app/dashboard/creditos/page.tsx` | `⚠️ Solo en mora` → `<AlertTriangle/>` |
| `app/dashboard/pagos/page.tsx` | `📄 PDF` → `<FileText/>` |
| `app/dashboard/mora/page.tsx` | `✅` → `<CheckCircle2/>` |
| `app/dashboard/usuarios/page.tsx` | `🔒/✅/⚠️` → iconos Lock/CheckCircle2/AlertCircle |
| `app/dashboard/usuarios/nuevo/page.tsx` | `✅` → `<CheckCircle2/>` |
| `app/dashboard/configuracion/page.tsx` | `🏢/🔐` → `<Building2/>/<UserCog/>` |

### Correcciones TypeScript pre-existentes (build fix)
Todos los `data as Type[]` con joins Supabase cambiados a `data as unknown as Type[]` en:
`aportes/page.tsx`, `cartera/page.tsx`, `cartera/[id]/page.tsx`, `convenios/page.tsx`, `convenios/[id]/page.tsx`, `pagos/page.tsx`, `reportes/anexo6/page.tsx`, `socios/page.tsx`

### Paleta aplicada
| Token | Valor | Uso |
|-------|-------|-----|
| Azul principal | `#1A56DB` | Botones, ítem activo sidebar, iconos KPI |
| Azul oscuro | `#1E3A5F` | Fondo sidebar, texto títulos |
| Verde pino | `#2D5A27` | Gráfico aportes |
| Fondo | `#F8FAFC` | Fondo app y login |
| Texto principal | `#1E293B` | Títulos y body |
| Texto secundario | `#64748B` | Labels y subtítulos |
| Bordes | `#E2E8F0` | Cards, inputs, separadores |

---

## Seguridad y preparación para producción

### Middleware de autenticación (`proxy.ts`)
- Ya existía en el proyecto — protege todas las rutas `/dashboard/*`
- Si no hay sesión activa → redirige automáticamente a `/login`
- Usa `createServerClient` de `@supabase/ssr` con cookies del request
- Verificado: usuario no autenticado accediendo a `/dashboard` → redirige a `/login`

### Nuevos archivos de seguridad
- **`lib/useRol.ts`** — hook cliente que obtiene el rol del usuario autenticado desde `public.usuarios`
- **`components/AccesoDenegado.tsx`** — componente reutilizable con icono 🔒, mensaje personalizable y link "Volver al dashboard"

### Páginas protegidas con verificación de rol (admin-only)
- `app/dashboard/usuarios/page.tsx` — ya tenía protección, mantiene misma lógica
- `app/dashboard/usuarios/nuevo/page.tsx` — agregado `useRol` + `AccesoDenegado`
- `app/dashboard/usuarios/[id]/page.tsx` — agregado `useRol` + `AccesoDenegado`
- `app/dashboard/configuracion/page.tsx` — agregado `useRol` + `AccesoDenegado`
- `app/dashboard/configuracion/convenios/page.tsx` — agregado `useRol` + `AccesoDenegado`

### Páginas protegidas con restricción de rol (admin + creditos solamente)
- `app/dashboard/socios/nuevo/page.tsx` — convertida a `'use client'` + `useRol` + `AccesoDenegado`
- `app/dashboard/socios/[id]/editar/page.tsx` — agregado `useRol` + `AccesoDenegado`
- Roles permitidos para crear/editar socios: `admin`, `creditos`
- Roles bloqueados: `tesoreria`, `contabilidad`

### APIs protegidas con verificación server-side
- `app/api/usuarios/invite/route.ts` — verifica sesión activa + rol admin antes de invitar
- `app/api/usuarios/update/route.ts` — verifica sesión activa + rol admin antes de actualizar
- Usa `createServerClient` con `cookies()` de `next/headers` para leer la sesión desde el servidor
- Devuelve 401 si no autenticado, 403 si no es admin

### Pruebas realizadas (verificadas en navegador)
- ✅ Sin sesión → `/dashboard` redirige a `/login`
- ✅ Admin → accede a `/configuracion`, `/usuarios`, `/socios/nuevo`
- ✅ Rol `creditos` → bloqueado en `/usuarios` y `/configuracion`, puede entrar a `/socios/nuevo`
- ✅ Rol `tesoreria` → bloqueado en `/socios/nuevo` con mensaje "Solo Administrador y Créditos"

## Auditoría y corrección de políticas RLS (2026-06-04)

### Hallazgos
- Todas las 14 tablas tenían RLS habilitado y políticas individuales por operación ✅
- **Problema crítico detectado**: política `auth_only` FOR ALL con `auth.uid() IS NOT NULL` presente en todas las tablas — al ser PERMISSIVE y aplicar a ALL, anula las restricciones de rol en INSERT/UPDATE/DELETE
- **Problema adicional**: políticas INSERT sin `WITH CHECK`, permitiendo que cualquier usuario autenticado inserte en cualquier tabla

### SQL correctivo generado (para ejecutar manualmente en Supabase SQL Editor)
El SQL NO fue ejecutado — se entregó para revisión del administrador. Cubre:
1. **DROP `auth_only`** en las 14 tablas públicas
2. **Recrear INSERT con `WITH CHECK` y restricción de rol** en todas las tablas:
   - `usuarios`, `configuracion`: solo `admin`
   - `socios`, `creditos`, `cronograma_cuotas`, `ampliaciones`, `cartera_mes`, `cartera_resumen_mes`: `admin` + `creditos`
   - `aportes`, `egresos`, `pagos_recibos`, `convenios`: `admin` + `tesoreria`
   - `validacion_cuadre_mes`: `admin` + `contabilidad`
   - `auditoria`: sin restricción de rol (todos pueden registrar acciones)
3. **Corregir `socios_update`**: remover `tesoreria` (dejar solo `admin` + `creditos`)

### Bug encontrado y corregido durante verificación
- **Causa**: `get_user_rol()` usaba `WHERE auth_id = auth.uid()` pero la columna `auth_id` era nullable y no se llenaba al invitar usuarios (solo se llenaba `id`)
- **Efecto**: usuarios invitados vía API tenían `get_user_rol() = NULL` → todas las políticas de rol fallaban → HTTP 403 en cualquier INSERT/UPDATE
- **Corrección 1 (Supabase)**: migración `fix_get_user_rol_use_id_column` — cambia función a `WHERE id = auth.uid()` (misma lógica que `useRol.ts`) + `UPDATE usuarios SET auth_id = id WHERE auth_id IS NULL`
- **Corrección 2 (API)**: `app/api/usuarios/invite/route.ts` — al insertar en `public.usuarios` ahora incluye `auth_id: userId` junto con `id: userId`

### Notas importantes
- Las APIs `/api/usuarios/invite` y `/api/usuarios/update` usan `service_role` key → bypasan RLS → siguen funcionando sin cambios
- La función `get_user_rol()` ahora usa `WHERE id = auth.uid()` (columna PK / FK a auth.users)

---

## 🎉 MVP COMPLETO — Resumen final
10 módulos construidos sobre Supabase + Next.js 14:
Login, Dashboard (indicadores reales), Socios, Créditos, Pagos/Recibos,
Aportes, Convenios, Cartera (clasificación SBS), Reportes (Anexo N°6 Excel),
Usuarios, Configuración.
14 tablas en Supabase, todos los módulos con 'use client' y #1e3a5f.

## Módulo Configuración (`/dashboard/configuracion`)
- Tabla `configuracion` ya existía con 1 fila (nombre_cooperativa, codigo_coopac, ruc, direccion, telefono, email, tasa_interes_anual, tasa_fps, provision_normal/cpp/deficiente/dudoso/perdida)
- Tabla `convenios` ya tenía columnas extra: ruc, contacto, telefono, activo
- Página principal: 2 formularios separados (datos cooperativa + parámetros financieros), cada uno con su botón "Guardar" y UPDATE a `configuracion WHERE id=1`; sección de accesos rápidos (Convenios, Usuarios, Panel Supabase)
- Los valores de provisiones se muestran en % y se convierten a decimal al guardar (0.01 ↔ 1%)
- Gestión de convenios (`/dashboard/configuracion/convenios`): tabla con edición inline de nombre (click → input → Enter/blur), formulario de nuevo convenio (nombre, RUC, contacto, teléfono), botón activar/desactivar, contador de socios por convenio
- Sidebar: "Configuración" con ⚙️ ya estaba, no se modificó

## Módulo Usuarios (`/dashboard/usuarios`) — Actualización completa

### Versión anterior
- Lista simple, formulario "Nuevo" con instrucciones manuales, editar rol/estado

### Versión actual (Gestión completa con API)
- **Protección admin**: al cargar la página, verifica el rol del usuario autenticado en `public.usuarios`; si no es `admin` muestra pantalla "Acceso restringido"
- **Modal "Invitar usuario"**: botón en encabezado abre modal con campos nombre, email y selector de rol (admin/tesoreria/creditos/contabilidad); llama a `POST /api/usuarios/invite`; muestra mensaje de éxito o error; recarga la lista automáticamente
- **`app/api/usuarios/invite/route.ts`** (POST): usa `SUPABASE_SERVICE_ROLE_KEY` para llamar `supabase.auth.admin.inviteUserByEmail(email)`; inserta (o actualiza si ya existe) en `public.usuarios` con el rol asignado; maneja el caso de que el auth.user ya exista
- **`app/api/usuarios/update/route.ts`** (PUT): actualiza `rol`, `activo` y/o `nombre` en `public.usuarios` por `id`; usa cliente admin con service role key
- **`.env.local`**: agregado placeholder `SUPABASE_SERVICE_ROLE_KEY=` con instrucciones — debe completarse con la clave del panel Supabase → Project Settings → API
- **Editar (`/dashboard/usuarios/[id]`)**: sin cambios, sigue funcionando con cliente directo
- Tabla `public.usuarios`: id (uuid FK→auth.users), nombre, email, rol (enum: admin/tesoreria/creditos/contabilidad), activo, created_at, updated_at

## Dashboard con indicadores reales (`/dashboard`)
- Reemplazados todos los placeholders con datos reales cargados en paralelo (Promise.all)
- 4 queries paralelas: socios activos (count), créditos vigentes, cuotas pendientes/vencidas, pagos del mes
- Toda la lógica de cálculo en el frontend (JS):
  - Socios activos, socios con crédito vigente (distinct id_socio)
  - Saldo total cartera, créditos vigentes
  - Mora actual: saldo de créditos con cuotas estado='vencida'
  - Recaudado / aportes / pagos del período actual
  - Provisión total y % sobre cartera (usando misma lógica de clasificación)
- Badge verde/rojo según si hay créditos vencidos
- Skeleton loaders mientras cargan los datos
- 4 secciones: Socios (2 tarjetas), Cartera (3), Mes actual (3), Provisiones (2)
- Fila de accesos rápidos: Nuevo Socio, Nuevo Crédito, Nuevo Pago, Generar Anexo N°6

## Reporte de Caja (`/dashboard/reportes/caja`)
- Subpágina `app/dashboard/reportes/caja/page.tsx` con mismo patrón visual que los otros reportes
- Filtros: mes, año, canal de pago (todos/caja/convenio) — canal aplica solo a Ingresos
- Dos queries paralelas en `handleGenerar`: `pagos_recibos` (con filtro de canal) + `egresos` (siempre completo)
- **Resumen destacado** (cuadro con borde): Total Ingresos (fondo verde), Total Egresos (fondo rojo), Saldo del período (verde si ≥ 0 / rojo si < 0) con etiqueta "Superávit" o "Déficit"
- **Sección Ingresos**: tabla con Fecha, Nro Recibo, Socio, Canal (badge azul/morado), Aporte, Capital, Interés, FPS, Otros (fps_extra + otros), Total; fila pie verde con total
- **Sección Egresos**: tabla con Fecha, Tipo (badge), Beneficiario, Descripción, Monto; fila pie roja con total
- **Exportación Excel** con 2 hojas: "Ingresos" y "Egresos", cada una con filas de totales al pie; `import('xlsx')` dinámico
- Menú `/dashboard/reportes`: Reporte de Caja activado (`activo: true`, href, descripción)

## Reporte de Aportes (`/dashboard/reportes/aportes`)
- Subpágina con mismo patrón visual que Anexo N°6 (back link, título, badge COOPAC CEJUASSA)
- Filtros server-side: mes, año, tipo (todos/aporte/retiro_parcial/retiro_total) → botón "Generar Reporte"
- Filtro client-side por nombre o Nro Socio (aparece tras generar, useMemo sobre filas ya cargadas)
- 3 tarjetas resumen: Total aportes (verde), Total retiros (rojo), Total movimientos (azul)
- Tabla: Nro Socio, Apellidos y Nombres, Tipo (badge verde/amarillo/rojo), Fecha, Saldo Anterior, Monto, Saldo Nuevo, Observación
- Exportación Excel: `ReporteAportes_CEJUASSA_MMYYYY.xlsx` con import dinámico de xlsx (mismo patrón Anexo N°6); incluye filas de totales al pie
- Menú `/dashboard/reportes`: Reporte de Aportes activado (`activo: true`, href actualizado, descripción agregada)

## Módulo Reportes (`/dashboard/reportes`)
- Instalado `xlsx` (SheetJS) para exportación Excel
- Menú (`/dashboard/reportes`): grid de 3 tarjetas — Anexo N°6 activo con botón "Generar →", Reporte de Aportes activo con botón "Generar →", Reporte de Caja como "Próximamente" (opacidad 50%)
- Anexo N°6 (`/dashboard/reportes/anexo6`):
  - Selector de período (mes + año) + botón "Generar Reporte"
  - Carga créditos vigentes + todas las cuotas en dos queries paralelas
  - Calcula dias_mora, clasificación, provision_requerida, capital_vigente/vencido/judicial para cada crédito
  - Tabla ordenada por clasificación DESC (Pérdida primero) con badge de color y días mora en rojo
  - 4 tarjetas resumen: total deudores, saldo, provisión, créditos con mora
  - Paginación de 50 filas por página
  - Botón "Exportar Excel" → descarga `Anexo6_CEJUASSA_MMYYYY.xlsx` con 60 columnas en formato SBS real (import dinámico de xlsx para no bloquear el render)
- Sidebar ya tenía ítem Reportes con ícono 📊 apuntando a `/dashboard/reportes`

## Módulo Cartera (`/dashboard/cartera`)
- Carga créditos con `estado = 'vigente'` + JOIN a socios y convenios
- Trae cuotas `pendiente/vencida/parcial` de todos los créditos en una sola query
- Calcula `dias_mora` = MAX(0, hoy − MIN(fecha_vencimiento)) por crédito en el frontend
- Funciones helper: `getClasificacion(dias_mora)` y `getTasaProvision(clasificacion)`
- `provision_requerida = saldo_capital × tasa_provision`
- Lista (`/dashboard/cartera`): 5 tarjetas de clasificación + tarjeta TOTAL, filtros por nombre/DNI/clasificación/convenio, tabla ordenada por días_mora DESC con badges de color por clasificación
- Detalle (`/dashboard/cartera/[id]`): sección datos del crédito, sección estado actual con mora/clasificación/provisión, cronograma completo con badges por estado de cuota y filas vencidas resaltadas en rojo
- Sidebar ya tenía ítem Cartera con ícono 📂 apuntando a `/dashboard/cartera`

## Módulo Convenios (`/dashboard/convenios`)
- Agregado al sidebar con ícono 🏢 entre Aportes y Cartera
- Lista (`/dashboard/convenios`): filtros mes/año → tarjetas por convenio con total, capital, intereses, aportes, FPS y N° pagos + tabla resumen con fila TOTAL GENERAL
- Datos de `pagos_recibos` WHERE `canal_pago = 'convenio'` agrupados en JS por `id_convenio`
- Botón "Ver detalle" en cada tarjeta → pasa mes y año como query params
- Detalle (`/dashboard/convenios/[id]`): lee `mes` y `anio` de searchParams, muestra 4 tarjetas resumen (total, N° socios, N° pagos, promedio por socio), tabla de pagos con buscador, botón "Ver recibo" → `/dashboard/pagos/[id]`
- Tabla ordenada por apellidos ASC; buscador filtra por nombre o DNI en cliente
- `useSearchParams` envuelto en `<Suspense>` para compatibilidad con Next.js App Router
