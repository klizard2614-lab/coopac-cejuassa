# PROJECT_MANAGER.md — COOPAC CEJUASSA

> **Documento único de verdad.** Pegar este archivo al inicio de cada nueva sesión de Claude.
> Última actualización: 2026-06-24 (Fase 10J-1 completada).
> Para historial detallado de decisiones: ver `AI_HANDOFF.md` y `NEXT_STEPS.md`.

---

## 1. ¿QUÉ ES ESTE SISTEMA?

Sistema de gestión para **COOPAC CEJUASSA**, una cooperativa de ahorro y crédito peruana.
Permite gestionar socios, créditos, pagos, aportes, egresos, convenios, cartera en mora,
reportes regulatorios (Anexo 6 para SBS) y archivos BDCC para reporte a SBS.

**Usuario administrador:** `klizard2614@gmail.com`
**Proyecto Supabase:** `ljdjbhsipgkxlgnprzhm`
**URL Supabase:** `https://ljdjbhsipgkxlgnprzhm.supabase.co`

---

## 2. STACK TÉCNICO

| Capa | Tecnología |
|------|------------|
| Framework | Next.js 16.2.7 — App Router (NO es Next.js 13/14 — leer docs antes de escribir código) |
| UI | React 19 + TypeScript 5 + Tailwind CSS v4 (PostCSS — sin `tailwind.config.js`) |
| Backend | Supabase (Auth + PostgreSQL) via `@supabase/ssr` |
| Auth | Email + contraseña, roles en tabla `usuarios` |
| PDFs | `jspdf` + `jspdf-autotable` (importados dinámicamente para evitar SSR) |
| Excel | `xlsx` |
| Gráficos | `recharts` |
| Iconos | `lucide-react` |
| Colores brand | `#1E3A5F` navy sidebar, `#1A56DB` accent azul, `#F8FAFC` fondo |

**Archivos clave de infraestructura:**
- `lib/supabase.ts` — `createClient()` browser, usado en todos los `'use client'`
- `lib/useRol.ts` — hook `useRol()` que devuelve `{ rol, loading }`
- `lib/api/requireAdmin.ts` — único punto de acceso al service role key (solo API routes)
- `proxy.ts` — middleware de auth (rutas `/dashboard/*` redirigen a `/login` si no hay sesión)
- `lib/formatNombre.ts` — `formatNombrePersona(apellidos, nombres)` → Title Case

**Variables de entorno requeridas:**
```
NEXT_PUBLIC_SUPABASE_URL=https://ljdjbhsipgkxlgnprzhm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role — NUNCA exponer al cliente>
```

---

## 3. MÓDULOS DE LA APP (12 módulos operativos)

### 3.1 Socios — `/dashboard/socios`
- Lista, búsqueda, ficha completa, crear, editar, eliminar
- Campos: nro_socio, dni, apellidos, nombres, estado, fecha_nacimiento, direccion, id_convenio, genero, estado_civil
- Sub-módulo beneficiarios: tabla `socio_beneficiarios` con múltiples beneficiarios por socio
- PDF de ficha del socio: `socios/utils/generarFichaSocioPDF.ts`
- Guard de rol: crear/editar → `['admin', 'creditos']`

### 3.2 Créditos — `/dashboard/creditos`
- Lista con filtros, detalle completo, crear (con cronograma), editar
- Al crear: RPC `crear_credito_con_cronograma` genera crédito + cuotas en una transacción
- Detalle muestra: datos del socio, datos del crédito, descuentos, **ampliaciones**, cronograma de cuotas
- Ampliaciones: módulo funcional via RPC `aplicar_ampliacion_credito` (Fase 10J-1)
  - Campo "Monto a ampliar" + vista previa en tiempo real
  - Advertencia: "No se recalculará el cronograma de cuotas en esta fase"
  - Actualiza: `nro_pagare`, `monto_aprobado`, `saldo_capital` en `creditos`
- Guard de rol: crear/editar → `['admin', 'creditos']`

### 3.3 Pagos — `/dashboard/pagos`
- Lista de recibos, ver PDF de recibo, registrar nuevo pago
- Al registrar: RPC `decrementar_saldo_capital` (atómica) + RPC `registrar_aporte_socio` (atómica)
- Actualiza cronograma_cuotas (cuotas pendiente/vencida/parcial → parcial/pagada)
- Guard de rol: registrar → `['admin', 'tesoreria']`
- PDF de recibo: `pagos/utils/generarReciboPDF.ts`

### 3.4 Aportes — `/dashboard/aportes`
- Lista de aportes por socio con filtros de período
- Los aportes se crean al registrar un pago (no hay formulario independiente)
- Sin RPC propia — usa `registrar_aporte_socio` indirectamente via pagos

### 3.5 Egresos — `/dashboard/egresos`
- Lista de egresos (gastos), crear, editar, eliminar
- Tipos: `retiro_socio`, `fondo_mortuorio`, `otro`
- Guard de rol: CRUD → `['admin', 'tesoreria']`; `creditos` ve AccesoDenegado por URL directa

### 3.6 Convenios — `/dashboard/convenios`
- Lista de convenios institucionales, ver detalle
- Solo lectura para roles no-admin (sin formulario de creación en UI principal)

### 3.7 Cartera — `/dashboard/cartera`
- Tabla de cartera con clasificación SBS (Normal, CPP, Deficiente, Dudoso, Pérdida)
- Clasifica por días de atraso, aplica tasas de provisión desde `configuracion`
- Fallback a tasas SBS estándar si la query de config falla

### 3.8 Mora — `/dashboard/mora`
- Lista de créditos vencidos/en mora con días de atraso
- Calcula mora basada en cuotas con `estado = 'vencida'`

### 3.9 Reportes — `/dashboard/reportes`

**Subflujos:**
- **Anexo 6** (`/reportes/anexo6`): clasificación de deudores SBS, provisiones requeridas = provisiones constituidas (criterio contable confirmado). Exporta Excel. Banner demo cuando datos son temporales.
- **Aportes** (`/reportes/aportes`): consolidado de aportes por período
- **Caja** (`/reportes/caja`): movimientos de caja del período
- **BDCC** (`/reportes/bdcc`): archivos TXT para reporte mensual a SBS
  - Guard: solo `['admin', 'contabilidad']`
  - Genera: BD01 (cartera créditos), BD02-A (pagos período), BD03A/BD03B (solo encabezado — sin garantías)
  - Pendiente: BD02-B y BD04 (créditos cancelados)
  - Banner DEMO rojo prominente — NO ENVIAR A SBS con datos actuales

### 3.10 Ampliaciones — `/dashboard/ampliaciones`
- Vista global de historial de todas las ampliaciones (solo lectura)
- Filtros: socio, pagaré, crédito, fecha desde/hasta
- Roles: todos los autenticados pueden ver

### 3.11 Usuarios — `/dashboard/usuarios`
- CRUD de usuarios del sistema
- Flujo de invitación por email (service role via `/api/usuarios/invite`)
- Solo `admin` puede acceder

### 3.12 Configuración — `/dashboard/configuracion`
- Datos de la cooperativa, tasas de provisión, tasa de interés por defecto
- Una sola fila (id=1) en tabla `configuracion`
- Solo `admin` puede acceder

---

## 4. BASE DE DATOS — ESTADO ACTUAL (2026-06-24)

### Tablas y conteos

| Tabla | Registros | Estado |
|-------|-----------|--------|
| `convenios` | 8 | ✅ |
| `socios` | 782 | ✅ (genero=M DEMO · estado_civil=soltero DEMO) |
| `socio_beneficiarios` | 0 | ✅ tabla nueva, sin registros aún |
| `creditos` | 31 | ✅ (26 vigentes, 5 cancelados · subtipo_credito_sbs=por_confirmar DEMO) |
| `cronograma_cuotas` | 911 | ✅ (26 vigentes con cuotas · 5 cancelados sin cronograma) |
| `pagos_recibos` | 832 | ✅ (28 vinculados a crédito · 804 con id_credito NULL) |
| `aportes` | 785 | ✅ |
| `egresos` | 0 | Sin datos — se ingresan manualmente |
| `usuarios` | 2 | ✅ conservados |
| `ampliaciones` | 0 | ✅ tabla operativa (RPC aplicada) |
| `configuracion` | 1 | ✅ (id=1, tasa_interes_anual, tasas de provisión) |

### Tipos de datos importantes (no son UUID)

```
creditos.id           → integer (SERIAL)
ampliaciones.id       → integer (SERIAL)
ampliaciones.id_credito → integer FK→creditos.id
socios.id             → integer (SERIAL)
socio_beneficiarios.socio_id → integer FK→socios.id
pagos_recibos.id      → integer
cronograma_cuotas.id  → integer
usuarios.id / auth_id → uuid (mismo valor, es el UUID de auth.users)
ampliaciones.created_by → uuid FK→usuarios.id
```

### Campos con datos DEMO (⚠️ reemplazar antes de BDCC oficial)

| Campo | Valor demo | Registros | Backup |
|-------|------------|-----------|--------|
| `socios.genero` | `'M'` | 782 | `backups/demo-data-fill/2026-06-23T02-18/socios.json` |
| `socios.estado_civil` | `'soltero'` | 782 | idem |
| `creditos.subtipo_credito_sbs` | `'por_confirmar'` | 31 | `backups/demo-data-fill/2026-06-23T02-18/creditos.json` |

### Datos pendientes de confirmar (no inventar)

| Dato | Quién confirma | Estado |
|------|----------------|--------|
| `socios.genero` real | Tesorería | ⏳ Pendiente |
| `socios.estado_civil` real | Tesorería | ⏳ Pendiente |
| `tipo_credito_sbs` código SBS C19 | Créditos | ⏳ Parcial |
| `subtipo_credito_sbs` código SBS C20 | Créditos | ⏳ Pendiente |
| TPINT — ¿TEA o nominal? | Créditos | ⏳ Pendiente |
| Cuentas CCVE/CCJU para BD01 | Contabilidad | ⏳ Pendiente |
| DNI real de socio nro 0001606 (SINDNI) | Tesorería | ⏳ Pendiente |
| Decisión 3 pagos match_medio | Créditos | ⏳ Pendiente (Excel en `exports/data-corrections/revision_pagos_match_medio.xlsx`) |

---

## 5. RPCs EN SUPABASE (todas aplicadas y verificadas)

| Función | Parámetros clave | Qué hace |
|---------|-----------------|----------|
| `decrementar_saldo_capital` | `p_id_credito int, p_monto numeric` | UPDATE atómico saldo_capital en creditos con row lock |
| `registrar_aporte_socio` | `p_id_socio int, p_id_recibo int, p_fecha date, p_monto numeric, ...` | INSERT aporte con advisory lock por socio |
| `crear_credito_con_cronograma` | `p_credito JSONB, p_cuotas JSONB` | Crea crédito + bulk insert cuotas en una transacción |
| `aplicar_ampliacion_credito` | `p_id_credito integer, p_fecha date, p_nro_pagare_nuevo text, p_monto_a_ampliar numeric, p_plazo_nuevo integer, p_observacion text, p_created_by uuid` | INSERT ampliacion + UPDATE creditos (nro_pagare, monto_aprobado, saldo_capital) atómico |

**Nota crítica:** La RPC `aplicar_ampliacion_credito` recibe `p_id_credito` como `integer`, NO `uuid`.

---

## 6. ROLES Y PERMISOS

| Rol | Acceso |
|-----|--------|
| `admin` | Todo. Incluyendo Usuarios, Configuración, BDCC |
| `tesoreria` | Pagos ✅ · Aportes ✅ · Egresos ✅ (CRUD) · Socios (lectura) · Sin Usuarios/Config |
| `creditos` | Créditos ✅ (CRUD) · Socios ✅ (CRUD) · Ampliaciones ✅ · Egresos ❌ (guard activo) · BDCC ❌ (guard activo) |
| `contabilidad` | Reportes ✅ · BDCC ✅ · Cartera ✅ · Egresos (lectura) · Sin crear/editar |

**Guards de ruta activos (route-level):**
- `/creditos/nuevo` → `['admin', 'creditos']`
- `/creditos/[id]/editar` → `['admin', 'creditos']`
- `/pagos/nuevo` → `['admin', 'tesoreria']`
- `/egresos` → `creditos` ve AccesoDenegado
- `/reportes/bdcc` → solo `['admin', 'contabilidad']`
- `/usuarios` y `/configuracion` → solo `admin`

---

## 7. MIGRACIONES LOCALES

Ubicadas en `supabase/migrations/`. Todas aplicadas en Supabase.

| Archivo | Función |
|---------|---------|
| `20260605112510_remote_existing_migration_placeholder.sql` | No-op placeholder para alinear historial |
| `20260617000000_create_decrementar_saldo_capital.sql` | RPC A |
| `20260617000001_create_registrar_aporte_socio.sql` | RPC B |
| `20260617000002_create_crear_credito_con_cronograma.sql` | RPC C |
| `20260617000003_fix_tipo_credito_cast.sql` | Fix cast ENUM tipo_credito |
| `20260617000004_fix_estado_cuota_cast.sql` | Fix cast ENUM estado_cuota |
| `20260620000001_bdcc_min_fields.sql` | Campos mínimos BDCC |
| `20260623000001_create_socio_beneficiarios.sql` | Tabla socio_beneficiarios |
| `20260624000001_create_aplicar_ampliacion_credito.sql` | RPC ampliaciones (tipo integer) |

---

## 8. REGLAS DE NEGOCIO CONFIRMADAS

- **Provisiones constituidas = provisiones requeridas** por deudor (C37 = C36). Criterio oficial de Contabilidad.
- **Tasa de interés** = `26.82` (porcentaje). La app calcula `r = tasa/100/12`.
- **Sistema de amortización** = francés (cuota fija, interés sobre saldo).
- **Aportes** = siempre se crean vía pago, nunca directamente.
- **Ampliación** = suma monto al crédito y cambia número de pagaré. NO recalcula cronograma en Fase 10J-1.
- **Código COOPAC SBS** = `01270`.
- **Cuenta contable BD01** = `1411050604` (candidata confirmada por Contabilidad).
- **Sin garantías preferidas** → BD03A y BD03B solo llevan encabezado.
- **`monto_nuevo` en ampliaciones** = monto aprobado total resultante (no el delta).

---

## 9. BUGS ACTIVOS (no bloqueantes)

| ID | Archivo | Descripción | Prioridad |
|----|---------|-------------|-----------|
| B1 | `aportes/page.tsx` ~L99 | `useMemo` async — variable nunca usada | Baja |
| B2 | `egresos/page.tsx`, `reportes/caja`, `reportes/aportes` | `any` types | Baja |
| B4 | `socio_beneficiarios` | Sin constraint de suma de porcentajes ≤ 100% | Media |

---

## 10. PENDIENTES ABIERTOS POR FASE

### 10A — Fase 9C-6H (bloqueada por cliente)

Área de Créditos debe completar `decision_creditos` en:
`exports/data-corrections/revision_pagos_match_medio.xlsx`

Opciones: `vincular_al_credito_propuesto` / `no_vincular` / `credito_faltante_en_importacion` / `requiere_revision`

Una vez decidido → **Fase 9C-6H.1**: apply de cuotas (actualizar `cronograma_cuotas` para reflejar los 28 pagos como parciales).
Script listo: `npm run pagos:to-cuotas:dry-run` (37/37 PASS).

### 10B — BDCC SBS (fecha límite: 20/07/2026)

Archivos requeridos: BD01 + BD02-A de **marzo 2026** y **junio 2026**.

Bloqueado hasta confirmar con equipo:
- Tesorería → género y estado civil reales de socios
- Créditos → TPINT (¿TEA o nominal?), códigos exactos TIPCRED/SUBTIPCRED
- Contabilidad → cuentas CCVE y CCJU para BD01

Ver análisis detallado: `docs/ai-recovery/BDCC_SBS_32791_2026_ANALYSIS.md`

### 10C — Fase 10J-2 (bloqueada)

Recálculo de cronograma al ampliar un crédito.
Bloqueado hasta que Contabilidad confirme si el cronograma se regenera al ampliar.
**No implementar hasta confirmación explícita.**

### 10D — Datos operativos por ingresar

1. Egresos: 0 registros — ingresar manualmente en la app.
2. Género y estado civil reales de socios (reemplazar valores DEMO antes de BDCC).
3. DNI real del socio con placeholder SINDNI (nro_socio 0001606).

---

## 11. COMANDOS NPM DISPONIBLES

### Verificación y auditoría

```bash
npm run verify:cejuassa              # lint + tsc + build (OBLIGATORIO antes de commit)
npm run audit:post-excel-import      # estado de la DB
npm run audit:service-role           # verifica que service role no esté en frontend
npm run audit:ui-roles               # 34/34 guards de rol — stática
npm run audit:form-validations       # 68/68 validaciones de formularios
```

### Smoke tests

```bash
npm run smoke:demo-app               # 28/28 — rutas y datos demo
npm run smoke:report-exports         # 37/37 — reportes y exportaciones
npm run smoke:bdcc                   # 51/51 — pantalla BDCC
```

### Verificaciones de módulos

```bash
npm run check:ampliaciones-funcionales    # 51/51 — RPC + UI + scripts
npm run check:ampliaciones-crud          # 22/22 — CRUD básico ampliaciones
npm run check:ampliaciones-ui            # 10/10 — UI ampliaciones
npm run check:beneficiarios-module       # 26/26 — módulo beneficiarios
npm run check:beneficiarios-schema-sync  # 29/29 — esquema socio_beneficiarios
npm run check:provision:constituida      # 10/10 — Anexo 6 provisiones
npm run check:bdcc:mvp-exporters         # 38/38 — exportadores BDCC
npm run check:bdcc:min-fields            # 16/16 — campos mínimos BDCC
npm run check:bdcc:ui-fields             # 26/26 — campos UI BDCC
npm run check:monday-readiness           # 37/37 — checklist de entrega
npm run check:pre-demo-readiness         # 46/46 — preparación demo
npm run check:pagos-to-cuotas-plan       # 37/37 — plan pagos→cuotas
npm run check:pagos-match-medio-review   # 15/15 — revisión match_medio
```

### Scripts de ampliaciones funcionales

```bash
npm run ampliaciones-funcionales:dry-run  # simulación sin modificar datos
npm run ampliaciones-funcionales:apply    # apply+revert (requiere APPLY_TOKEN)
npm run check:ampliaciones-funcionales    # 51/51 — verificación completa
```

### Scripts de datos (peligrosos — requieren autorización)

```bash
npm run pagos:to-cuotas:dry-run           # dry-run solo lectura
npm run demo:reg-fields:dry-run           # ver campos demo
npm run plan:data-reset                   # ver conteos (solo lectura)
```

### Pruebas de RPCs

```bash
npm run test:rpc:b                        # RPC B: registrar_aporte_socio
npm run test:rpc:c                        # RPC C: crear_credito_con_cronograma
npm run test:provision:config             # tasas de provisión desde configuracion
npm run ampliaciones:crud:dry-run         # CRUD básico ampliaciones
```

---

## 12. SKILLS DISPONIBLES (invocar con `/nombre-skill`)

Las skills son instrucciones especializadas que cambian el modo de operación de Claude.
Se activan al inicio del prompt con la barra `/`.

| Skill | Cuándo usar |
|-------|-------------|
| `/cejuassa-safe-change` | **Antes de cualquier edición de código.** Obliga a leer contexto, declarar plan mínimo y verificar al final. |
| `/cejuassa-risk-review` | Antes de cambios en pagos, créditos, aportes, reportes SBS o API routes con service role. Hace análisis de riesgos. |
| `/cejuassa-checkpoint` | Antes de `/compact` o `/clear`. Actualiza documentación y genera resumen de continuación. |
| `/cejuassa-verify` | Después de implementar. Ejecuta lint/tsc/build y reporta errores sin arreglar nada. |
| `/cejuassa-db-plan` | Para cualquier cambio en Supabase: tablas, RPC, triggers, RLS. Genera plan + SQL + rollback SIN ejecutar nada. |

### Flujo recomendado — cambio de código

```
1. /cejuassa-safe-change   → declarar plan mínimo
2. /cejuassa-risk-review   → si toca lógica financiera (opcional)
3. [implementar]
4. /cejuassa-verify        → lint/tsc/build pasan
5. /cejuassa-checkpoint    → antes de cerrar sesión
```

### Flujo recomendado — cambio de base de datos

```
1. /cejuassa-db-plan       → genera SQL + rollback
2. [usuario revisa y aprueba con token exacto]
3. Claude aplica via MCP Supabase
4. /cejuassa-verify        → código sigue funcionando
```

---

## 13. HERRAMIENTAS DISPONIBLES EN SESIÓN

### MCP Supabase (`mcp__d4294ae0-f0bf-4b51-90dd-4fd261ca3dd8__*`)

- `execute_sql` — consultas SQL de lectura/análisis
- `apply_migration` — DDL (CREATE, ALTER, DROP) — usar para RPCs y migraciones
- `list_migrations` — ver historial de migraciones aplicadas
- `list_tables` — ver tablas existentes

**Importante:** Para DDL usar siempre `apply_migration`. Para DML de datos usar `execute_sql`.

### MCP Vercel (`mcp__3b3fd7db-*`)

- `deploy_to_vercel` — deploy a producción
- `get_deployment` — estado del último deploy
- `get_runtime_logs` — logs en producción
- `get_runtime_errors` — errores en producción

### Herramientas locales (siempre disponibles)

- `Read`, `Edit`, `Write`, `Grep`, `Glob` — operaciones de archivos
- `Bash` — comandos de shell (PowerShell en Windows)
- `Agent` / `Explore` — búsqueda exploratoria en el codebase

---

## 14. PROTOCOLO DE TRABAJO CON CLAUDE

### Reglas de autonomía controlada

Claude Code opera en **modo autónomo controlado** en este proyecto:

- Lee solo los archivos mínimos necesarios para cada tarea.
- Implementa cambios aprobados sin pedir confirmación en cada paso.
- Ejecuta `npm run verify:cejuassa` (lint/tsc/build) después de **todo** cambio de código.
- Corrige automáticamente errores causados por el cambio y repite hasta que pase.
- No termina una tarea sin haber verificado.
- No imprime archivos completos ni logs largos.

### Hard stops — SIEMPRE pedir permiso antes de:

- Ejecutar SQL / crear RPC / triggers / modificar RLS
- Usar service role key
- Cambiar variables de entorno (.env)
- Instalar paquetes npm
- Borrar archivos o datos
- Refactor global
- Lógica financiera fuera del alcance aprobado
- Reportes SBS sin plan aprobado
- Modificar `_client_files/`
- `supabase db push` a producción

### Tokens de autorización usados en este proyecto

Estos tokens exactos activan operaciones peligrosas. Claude bloquea todo sin ellos.

| Token | Qué autoriza |
|-------|-------------|
| `APLICAR RPC AMPLIACIONES 10J-1` | Aplicar RPC ampliaciones a Supabase (ya ejecutado) |
| `PROBAR AMPLIACION FUNCIONAL 10J-1` | Apply+revert de prueba controlada (ya ejecutado) |
| `SINCRONIZAR BENEFICIARIOS 10C.1` | Migración tabla socio_beneficiarios (ya ejecutado) |
| `PROBAR CRUD BENEFICIARIOS 10C.2` | Prueba CRUD beneficiarios (ya ejecutado) |
| `INSERTAR CRONOGRAMA 9C-6D` | Inserción de 911 cuotas (ya ejecutado) |
| `VINCULAR 28 PAGOS 9C-6F` | Vinculación pagos→créditos (ya ejecutado) |
| `EJECUTAR IMPORTACION EXCEL 9C-4B` | Importación de datos desde Excel (ya ejecutado) |

Para las **próximas fases** se necesitarán tokens nuevos. Los tokens siempre son:
`ACCIÓN DESCRIPCIÓN FASE`. No ejecutar nunca sin el token exacto.

### Definition of Done

Un cambio está **completo** cuando:
1. ✅ Código implementado
2. ✅ `npm run verify:cejuassa` pasa (lint + tsc + build)
3. ✅ Errores nuevos corregidos (cero errores introducidos)
4. ✅ Scripts de check relevantes pasan (si aplica)
5. ✅ `AI_HANDOFF.md` y `NEXT_STEPS.md` actualizados (si cambió riesgo, flujo o fase)

---

## 15. ESTADO DE RIESGOS Y BUGS

### Riesgos RESUELTOS (historial)

| ID | Descripción | Resolución |
|----|-------------|------------|
| R1 | Sin protección de rutas | `proxy.ts` ya existía y funciona |
| R2 | Tasas de provisión hardcodeadas | Lee de `configuracion` en los 3 módulos |
| R3 | Guards de rol incompletos | Implementados en todas las rutas críticas |
| R4 | Service role key duplicada en API routes | Centralizada en `lib/api/requireAdmin.ts` |
| R5 | Race condition saldo capital | RPC `decrementar_saldo_capital` con row lock |
| R6 | Race condition saldo aportes | RPC `registrar_aporte_socio` con advisory lock |
| R7 | Cuotas vencidas/parciales no actualizadas | Filtro `.in('estado', ['pendiente','vencida','parcial'])` |
| R8 | Crédito sin cronograma si insert bulk falla | RPC `crear_credito_con_cronograma` transaccional |
| R9 | cronograma_cuotas vacío post-importación | 911 cuotas insertadas en Fase 9C-6D |
| B3 | Provisiones constituidas = requiere fuente contable | Criterio oficial C37=C36 confirmado por Contabilidad |
| B5 | Cuenta contable Excel incorrecta | `1411030604` → `1411050604` |
| B6 | `por_confirmar` no generaba advertencia en BDCC | Condición corregida + banner DEMO |

### Bugs activos (no bloqueantes)

| ID | Severidad | Descripción |
|----|-----------|-------------|
| B1 | Baja | `useMemo` async en `aportes/page.tsx` L99 (variable sin uso) |
| B2 | Baja | `any` types en egresos y reportes |
| B4 | Media | Sin validación suma porcentajes beneficiarios ≤ 100% |

---

## 16. PRÓXIMAS FASES RECOMENDADAS (en orden de prioridad)

### 🔴 URGENTE — Fase BDCC-SBS (20/07/2026)

**Acción del equipo (no código):** Confirmar con Tesorería, Créditos y Contabilidad los 8 datos pendientes listados en §4.
Luego Claude implementará las correcciones en el generador BDCC.
Ver: `docs/ai-recovery/BDCC_SBS_32791_2026_ANALYSIS.md`

### 🟡 Pendiente cliente — Fase 9C-6H

1. Área de Créditos completa Excel `revision_pagos_match_medio.xlsx`
2. Claude aplica decisiones con token `VINCULAR MATCH_MEDIO 9C-6H`
3. Claude aplica pagos→cuotas con token `APLICAR CUOTAS 9C-6H.1`

### 🟢 Disponibles cuando se necesiten

- **Fase 10J-2:** Recálculo de cronograma al ampliar (requiere confirmación de Contabilidad)
- **Fase BD02-B/BD04:** Créditos cancelados para reporte SBS (nuevo subproyecto)
- **Fase validación porcentajes B4:** Constraint suma beneficiarios ≤ 100%
- **Fase BDCC histórico 2024/2025:** Proyecto futuro separado

---

## 17. ESTRUCTURA DE ARCHIVOS CLAVE

```
/
├── proxy.ts                          # Middleware de auth (rutas protegidas)
├── CLAUDE.md                         # Instrucciones para Claude (cargado automáticamente)
├── AGENTS.md                         # Advertencia sobre Next.js 16
├── lib/
│   ├── supabase.ts                   # createClient() browser
│   ├── useRol.ts                     # useRol() hook
│   ├── formatNombre.ts               # formatNombrePersona()
│   └── api/requireAdmin.ts           # service role — solo API routes
├── app/
│   ├── login/page.tsx                # Login público
│   └── dashboard/
│       ├── layout.tsx                # Sidebar + nav filtrado por rol
│       ├── page.tsx                  # Dashboard con gráficos
│       ├── socios/                   # Módulo socios
│       │   └── _components/
│       │       ├── SocioForm.tsx
│       │       └── BeneficiariosSection.tsx
│       ├── creditos/                 # Módulo créditos
│       │   └── _components/
│       │       ├── AmpliacionesSection.tsx  # ← FUNCIONAL con RPC
│       │       └── SocioSearch.tsx
│       ├── pagos/                    # Módulo pagos
│       │   └── utils/generarReciboPDF.ts
│       ├── socios/utils/generarFichaSocioPDF.ts
│       ├── ampliaciones/page.tsx     # Vista global ampliaciones
│       ├── reportes/
│       │   ├── anexo6/page.tsx
│       │   └── bdcc/page.tsx         # ← guard: solo admin+contabilidad
│       ├── egresos/page.tsx          # ← guard: creditos → AccesoDenegado
│       ├── usuarios/
│       └── configuracion/
├── app/api/usuarios/
│   ├── invite/route.ts               # Invitación por email (service role)
│   └── update/route.ts              # Actualizar rol (service role)
├── lib/bdcc/format.ts                # Helpers de formato TXT para BDCC
├── supabase/migrations/              # Migraciones SQL locales (8 aplicadas)
├── scripts/                          # 60+ scripts de verificación y datos
├── docs/ai-recovery/                 # Documentación del proyecto
│   ├── PROJECT_MANAGER.md            # ← ESTE ARCHIVO
│   ├── AI_HANDOFF.md                 # Historial detallado de decisiones
│   ├── NEXT_STEPS.md                 # Fases completadas y próximas
│   ├── RISKS_AND_BUGS.md             # Registro de riesgos y bugs
│   ├── DATABASE_AND_AUTH.md          # Esquema inferido de la DB
│   └── BDCC_SBS_32791_2026_ANALYSIS.md  # Análisis técnico para reporte SBS
├── backups/                          # Backups JSON de datos
│   └── demo-data-fill/2026-06-23T02-18/  # Backup pre-datos-demo
└── exports/data-corrections/
    └── revision_pagos_match_medio.xlsx   # Excel pendiente de Créditos
```

---

## 18. INSTRUCCIONES PARA INICIAR UNA NUEVA SESIÓN

1. Leer este archivo completo (`PROJECT_MANAGER.md`)
2. Si hay cambios recientes, leer también `AI_HANDOFF.md` las últimas 50-100 líneas
3. Preguntar al usuario qué quiere hacer
4. Verificar en `NEXT_STEPS.md` si la tarea solicitada tiene fases o dependencias previas
5. Antes de **cualquier** cambio de código → usar `/cejuassa-safe-change`
6. Antes de **cualquier** cambio de DB → usar `/cejuassa-db-plan`
7. Después de implementar → `npm run verify:cejuassa` (obligatorio)
8. Al terminar → actualizar `AI_HANDOFF.md` y `NEXT_STEPS.md` si cambió algo importante
