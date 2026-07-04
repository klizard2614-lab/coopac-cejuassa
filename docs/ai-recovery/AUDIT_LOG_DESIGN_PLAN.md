# AUDIT_LOG_DESIGN_PLAN.md

> **Fase SEC-4A — Diseño de audit log para operaciones críticas**
> Fecha: 2026-07-03
> Clasificación: SOLO USO INTERNO
> Proyecto: `ljdjbhsipgkxlgnprzhm`
> Modo: SOLO DISEÑO — ningún dato modificado, ninguna policy tocada, ninguna migración aplicada

---

## Objetivo

Diseñar un sistema de auditoría operativa que permita registrar quién realizó acciones críticas en CEJUASSA, cuándo las realizó y sobre qué módulo o registro actuó. El objetivo es proporcionar trazabilidad completa de operaciones financieras y administrativas para cumplir con los requisitos de auditoría de una cooperativa supervisada.

---

## Estado actual (2026-07-03)

### ¿Existe mecanismo de auditoría?

**SÍ — la tabla `auditoria` existe en Supabase** (proyecto `ljdjbhsipgkxlgnprzhm`).

Hallazgo de la auditoría SEC-3A:

| Operación | Policy | Roles | USING / WITH CHECK |
|---|---|---|---|
| SELECT | `auditoria_select` | public | `auth.uid() IS NOT NULL` |
| INSERT | `auditoria_insert` | public | WITH CHECK: `auth.uid() IS NOT NULL` |

**Características actuales de la tabla:**
- RLS: **ON** ✅
- UPDATE policy: **AUSENTE** ✅ (inmutabilidad preservada por omisión)
- DELETE policy: **AUSENTE** ✅ (inmutabilidad preservada por omisión)
- INSERT abierto a cualquier usuario autenticado ⚠️
- Sin migración local — creada directamente en Supabase Dashboard ⚠️
- Estructura de columnas: **DESCONOCIDA** desde archivos locales ⚠️
- Datos actuales: con "valor de trazabilidad" (data-reset-template.sql menciona no borrar sin autorización)
- En uso activo desde la app: **NO** — ningún componente React inserta en ella actualmente

### Campos `created_by` / `updated_by` existentes

| Tabla | Campo | Poblado activamente |
|---|---|---|
| `aportes` | `created_by` | ✅ Sí (`aportes/[id]/page.tsx` lo muestra) |
| `egresos` | `created_by` | ✅ Sí (`egresos/page.tsx` lo asigna con `user?.id`) |
| `ampliaciones` | `created_by` | ✅ Sí (pasado como `p_created_by` en RPC `aplicar_ampliacion_credito`) |
| `pagos_recibos` | `created_by` | ✅ Sí (mostrado en `pagos/[id]/page.tsx`) |
| `socios` | — | ❌ No tiene |
| `creditos` | — | ❌ No tiene |
| `cronograma_cuotas` | — | ❌ No tiene |
| `socio_beneficiarios` | — | ❌ No tiene |
| `pagos_cuotas_aplicaciones` | `aplicado_por` (FK usuarios) | ✅ Sí (diseñado en Fase 10K-1) |

### Triggers y RPCs de auditoría

- **Triggers SQL:** NINGUNO — toda la lógica vive en el frontend (cliente Supabase)
- **RPCs de auditoría:** NINGUNA — no existe función `registrar_auditoria` u similar
- **Logs de API routes:** NINGUNO — las rutas `/api/usuarios/invite` y `/api/usuarios/update` no registran en `auditoria`

---

## Operaciones críticas a auditar

### Criticidad ALTA — Operaciones financieras irreversibles

| Módulo | Acción | Tabla afectada | Por qué es crítica |
|---|---|---|---|
| Créditos | Crear crédito | `creditos` + `cronograma_cuotas` | Compromiso financiero con el socio |
| Créditos | Editar crédito (tasa, monto, plazo) | `creditos` | Afecta saldo y cronograma |
| Créditos | Aplicar ampliación | `creditos` + `ampliaciones` | Modifica deuda del socio |
| Pagos | Registrar pago | `pagos_recibos` + `cronograma_cuotas` | Movimiento de dinero |
| Aportes | Registrar aporte | `aportes` | Movimiento de dinero |
| Egresos | Crear egreso | `egresos` | Salida de fondos |
| Egresos | Eliminar egreso | `egresos` | Eliminación de registro financiero |

### Criticidad MEDIA — Operaciones administrativas relevantes

| Módulo | Acción | Tabla afectada | Por qué es relevante |
|---|---|---|---|
| Socios | Crear socio | `socios` | Alta de nuevo miembro |
| Socios | Editar socio | `socios` | Modifica PII del socio |
| Socios | Editar beneficiarios | `socio_beneficiarios` | Afecta herencia de aportes |
| Usuarios | Invitar usuario | `usuarios` + `auth.users` | Control de acceso al sistema |
| Usuarios | Activar/desactivar | `usuarios` | Control de acceso al sistema |
| Configuración | Editar configuración | `configuracion` | Cambia tasas y parámetros base del sistema |

### Criticidad BAJA — Eventos informativos

| Módulo | Acción | Por qué es útil |
|---|---|---|
| Reportes | Exportar Anexo N°6 | Trazabilidad de envíos a SBS |
| Reportes | Exportar BDCC | Trazabilidad de archivos regulatorios |
| Sesiones | Login/Logout | Registro de acceso (Supabase Auth lo hace, no replicar) |

### Fuera del alcance de esta fase (NO auditar todavía)

- Lecturas/consultas (`SELECT`) — volumen alto, bajo valor de auditoría
- Exportaciones internas de Excel no regulatorias
- Cambios en `cartera_mes`, `cartera_resumen_mes`, `validacion_cuadre_mes` — tablas calculadas
- Cambios en `cronograma_cuotas` — creados atómicamente con el crédito vía RPC
- Conciliación de pagos a cuotas (`pagos_cuotas_aplicaciones`) — la trazabilidad ya está en la tabla misma

---

## Análisis de la tabla `auditoria` existente

### ¿Reutilizar o crear nueva?

**Recomendación: AMPLIAR la tabla `auditoria` existente.**

Razones:
1. Ya tiene RLS habilitado y políticas básicas
2. Tiene datos existentes de trazabilidad que no deben perderse
3. El nombre es apropiado para el propósito
4. La función `get_user_rol()` ya existe en producción — puede usarse en la RPC de auditoría
5. La policy de INSERT abierto se reemplazará por una RPC SECURITY DEFINER (más segura)

**Pasos de la ampliación (propuesta para SEC-4B — NO aplicar ahora):**

1. Crear migración local de sincronización que documente la estructura actual (Fase SEC-3E)
2. Agregar columnas faltantes con `ALTER TABLE` en nueva migración (Fase SEC-4B)
3. Revocar INSERT directo a `authenticated` y mover todo a RPC `registrar_auditoria` (Fase SEC-4B)

**Riesgo si se elige crear tabla nueva (`audit_operacional`):**
- Fragmentación — el sistema tendría dos tablas de auditoría con propósitos solapados
- Pérdida de los datos históricos existentes en `auditoria`
- Mayor complejidad de mantenimiento

---

## Modelo recomendado de audit log

### Estructura propuesta (tabla `auditoria` ampliada)

```sql
-- PROPUESTA SEC-4B — NO APLICAR SIN AUTORIZACIÓN
-- Pasos que deben ejecutarse en Supabase Dashboard o via migración aprobada

-- Paso 1: Crear migración local de sincronización (SEC-3E)
-- Verificar primero las columnas actuales en Dashboard:
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'auditoria' ORDER BY ordinal_position;

-- Paso 2: Agregar columnas faltantes (SEC-4B — solo si no existen)
ALTER TABLE public.auditoria
  ADD COLUMN IF NOT EXISTS actor_user_id   uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actor_email     text,
  ADD COLUMN IF NOT EXISTS actor_rol       text,
  ADD COLUMN IF NOT EXISTS accion          text,         -- 'CREAR_SOCIO', 'EDITAR_CREDITO', 'REGISTRAR_PAGO', etc.
  ADD COLUMN IF NOT EXISTS modulo          text,         -- 'socios', 'creditos', 'pagos', etc.
  ADD COLUMN IF NOT EXISTS tabla_afectada  text,         -- nombre de la tabla Supabase afectada
  ADD COLUMN IF NOT EXISTS registro_id     text,         -- ID del registro como string (flex para UUID e integer)
  ADD COLUMN IF NOT EXISTS descripcion     text,         -- Descripción legible por humanos
  ADD COLUMN IF NOT EXISTS metadata        jsonb,        -- Datos adicionales — SIN PII sensible, sin secretos
  ADD COLUMN IF NOT EXISTS ip_hash         text,         -- Hash SHA-256 de la IP del cliente (opcional)
  ADD COLUMN IF NOT EXISTS user_agent      text;         -- User agent abreviado (opcional)
```

### Campos completos propuestos

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id` | bigserial PK | ✅ | Autoincremental — puede existir ya |
| `created_at` | timestamptz DEFAULT now() | ✅ | Timestamp inmutable del evento |
| `actor_user_id` | uuid FK → usuarios | ❌ nullable | ID del usuario que ejecutó la acción |
| `actor_email` | text | ✅ | Email del actor (desnormalizado para trazabilidad) |
| `actor_rol` | text | ✅ | Rol del actor en el momento de la acción |
| `accion` | text | ✅ | Código de acción: `CREAR_SOCIO`, `EDITAR_CREDITO`, etc. |
| `modulo` | text | ✅ | Módulo: `socios`, `creditos`, `pagos`, etc. |
| `tabla_afectada` | text | ✅ | Tabla Supabase afectada |
| `registro_id` | text | ❌ nullable | ID del registro afectado (como string) |
| `descripcion` | text | ❌ nullable | Descripción legible: "Crédito #1145 — monto S/ 8,500" |
| `metadata` | jsonb | ❌ nullable | Datos adicionales sin PII sensible ni secretos |
| `ip_hash` | text | ❌ nullable | SHA-256 de la IP (nunca la IP en texto claro) |
| `user_agent` | text | ❌ nullable | User agent abreviado |

### Códigos de acción estandarizados

```
CREAR_SOCIO          EDITAR_SOCIO         CREAR_CREDITO
EDITAR_CREDITO       APLICAR_AMPLIACION   REGISTRAR_PAGO
REGISTRAR_APORTE     CREAR_EGRESO         ELIMINAR_EGRESO
INVITAR_USUARIO      ACTIVAR_USUARIO      DESACTIVAR_USUARIO
EDITAR_CONFIGURACION EXPORTAR_ANEXO6      EXPORTAR_BDCC
```

### Qué NO incluir en `metadata`

- DNI del socio
- Contraseñas o tokens
- Saldos individuales completos
- Datos personales de beneficiarios
- Claves o secretos de la app

---

## Permisos recomendados

### Lectura del audit log

| Rol | Puede leer | Scope |
|---|---|---|
| `admin` | ✅ Sí | Todo el log — todas las acciones |
| `contabilidad` | ✅ Sí (parcial) | Solo módulos: `pagos`, `aportes`, `egresos`, `reportes`, `configuracion` |
| `creditos` | ❌ No | Sin acceso al audit log |
| `tesoreria` | ❌ No | Sin acceso al audit log |

### Escritura del audit log

| Origen | Puede insertar | Mecanismo |
|---|---|---|
| RPC `registrar_auditoria` (SECURITY DEFINER) | ✅ Sí | Única vía autorizada |
| Cliente Supabase directo | ❌ No | Revocar policy `auditoria_insert` actual |
| API routes Next.js | A través de RPC | Llaman a `registrar_auditoria` |

### Modificación/eliminación del audit log

| Operación | Quién puede | Estado |
|---|---|---|
| UPDATE | Nadie | Policy ausente — inmutabilidad garantizada ✅ |
| DELETE | Nadie | Policy ausente — inmutabilidad garantizada ✅ |

---

## Comparación de opciones de implementación

### A. Logs desde el frontend (cliente Supabase)

| Criterio | Evaluación |
|---|---|
| Seguridad | ❌ BAJO — el cliente puede omitir el log, el usuario puede inspeccionar el código |
| Mantenimiento | ❌ DIFÍCIL — lógica dispersa en múltiples páginas |
| Riesgo de saltarse logs | ❌ ALTO — acciones directas via Supabase no se loguean |
| Facilidad de rollback | ✅ Fácil — solo borrar llamadas en frontend |
| Compatibilidad con RLS | ⚠️ Parcial — depende de INSERT policy abierta |
| Riesgo de exponer PII | ❌ ALTO — el código del cliente puede incluir datos sensibles en el log |

**Veredicto: NO RECOMENDADO** para datos financieros críticos.

---

### B. Logs desde API routes Next.js

| Criterio | Evaluación |
|---|---|
| Seguridad | ✅ MEDIO-ALTO — server-side, validado antes de loguear |
| Mantenimiento | ✅ MODERADO — lógica centralizada en `/api/audit` |
| Riesgo de saltarse logs | ⚠️ MEDIO — operaciones que van directo a Supabase no pasan por API |
| Facilidad de rollback | ✅ Fácil — desactivar endpoint o quitar llamadas |
| Compatibilidad con RLS | ✅ Buena — usa service role o sesión de usuario |
| Riesgo de exponer PII | ✅ BAJO — controlado server-side |

**Veredicto: VIABLE para operaciones que ya tienen API routes (usuarios).**

---

### C. Triggers SQL en Supabase

| Criterio | Evaluación |
|---|---|
| Seguridad | ✅ MUY ALTO — opera en DB, no se puede eludir |
| Mantenimiento | ❌ DIFÍCIL — requiere conocimiento SQL + migraciones por cada tabla nueva |
| Riesgo de saltarse logs | ✅ MÍNIMO — toda operación a la tabla dispara el trigger |
| Facilidad de rollback | ⚠️ MODERADO — DROP TRIGGER requiere migración |
| Compatibilidad con RLS | ✅ Excelente — opera a nivel DB, RLS no aplica a triggers |
| Riesgo de exponer PII | ✅ BAJO si se diseñan bien — control total sobre qué se guarda |
| Costo adicional | ⚠️ Performance overhead en tablas de alto volumen |

**Veredicto: VIABLE para tablas de muy alta criticidad** (creditos, pagos_recibos). Complejidad de implementación y mantenimiento más alta.

---

### D. RPC `registrar_auditoria` (SECURITY DEFINER)

| Criterio | Evaluación |
|---|---|
| Seguridad | ✅ ALTO — SECURITY DEFINER bypasa RLS, el cliente no puede INSERT directo |
| Mantenimiento | ✅ MODERADO — una función centralizada, callers en frontend |
| Riesgo de saltarse logs | ⚠️ MEDIO — el cliente puede olvidar llamar a la RPC |
| Facilidad de rollback | ✅ Fácil — DROP FUNCTION + restaurar INSERT policy |
| Compatibilidad con RLS | ✅ Excelente — bypasa RLS por diseño (SECURITY DEFINER) |
| Riesgo de exponer PII | ✅ BAJO — la RPC controla qué acepta y guarda |
| Integración con arquitectura actual | ✅ ALTA — la app ya usa RPCs (A, B, C) |

**Veredicto: RECOMENDADO** como mecanismo principal para CEJUASSA.

---

## Opción recomendada para CEJUASSA: D + B (híbrido)

**Implementación en dos capas:**

### Capa primaria: RPC `registrar_auditoria`
- Función PostgreSQL SECURITY DEFINER
- Lee `auth.uid()` internamente para obtener actor_user_id, actor_email, actor_rol desde `usuarios`
- Recibe solo: `p_accion`, `p_modulo`, `p_tabla_afectada`, `p_registro_id`, `p_descripcion`, `p_metadata`
- Previene log tampering porque el INSERT solo ocurre via esta función
- El cliente la llama via `supabase.rpc('registrar_auditoria', {...})` después de la operación principal

### Capa secundaria: API routes para operaciones de usuarios
- Las rutas `/api/usuarios/invite` y `/api/usuarios/update` ya existen como server-side
- Agregar llamada a `registrar_auditoria` en estas rutas
- Más confiable que el cliente porque es server-side y no se puede omitir

### Cobertura esperada
- Operaciones de crédito/pago/aportes/egresos: cubiertos por RPC llamada desde frontend
- Operaciones de usuarios: cubiertos por API route
- Configuración: cubierta por RPC desde frontend
- Acciones directas via Supabase SDK (bypass de UI): no cubiertas — riesgo residual aceptable para MVP

---

## Fases de implementación

### SEC-4A — Diseño y documentación ✅ ESTA FASE (2026-07-03)
- Documento de diseño: `AUDIT_LOG_DESIGN_PLAN.md`
- Matriz de alcance: `exports/security/audit_log_scope.xlsx`
- Script de verificación: `scripts/check-audit-log-design.mjs`
- **Sin tocar DB. Sin cambiar código funcional.**

### SEC-3E — Migración local de sincronización (prerequisito)
- Crear `supabase/migrations/XXXXXXXX_sync_auditoria_table.sql`
- Documentar la estructura actual de `auditoria` tal como existe en Supabase Dashboard
- Verificar con `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'auditoria'`
- **Requiere autorización: `APLICAR MIGRACION SYNC SEC-3E`**

### SEC-4B — Ampliación de tabla y RPC
- Crear migración `XXXXXXXX_extend_auditoria_sec4b.sql`:
  1. `ALTER TABLE auditoria ADD COLUMN IF NOT EXISTS ...` (columnas del modelo)
  2. `DROP POLICY IF EXISTS auditoria_insert` (revocar INSERT directo)
  3. `CREATE FUNCTION registrar_auditoria(...)` SECURITY DEFINER
  4. `CREATE POLICY auditoria_select` (solo admin + contabilidad_financiera)
- **Requiere autorización: `APLICAR AUDIT LOG SEC-4B`**

### SEC-4C — Integración en módulos de alta criticidad
- Agregar llamadas a `supabase.rpc('registrar_auditoria', {...})` en:
  1. `creditos/nuevo/page.tsx` — después de `crear_credito_con_cronograma` ✅
  2. `pagos/nuevo/page.tsx` — después del insert de `pagos_recibos` ✅
  3. `egresos/page.tsx` — en `handleSubmit` y `handleDelete` ✅
  4. `app/api/usuarios/invite/route.ts` — desde API route ✅
  5. `app/api/usuarios/update/route.ts` — desde API route ✅

### SEC-4D — Integración en módulos de criticidad media
- `socios/nuevo/page.tsx` — después del insert
- `socios/[id]/editar/page.tsx` — después del update
- `creditos/[id]/editar/page.tsx` — después del update
- `configuracion/page.tsx` — después del update
- `aportes` — si se agrega formulario directo

### SEC-4E — Pantalla de visualización de auditoría (admin only)
- Ruta nueva `app/dashboard/auditoria/page.tsx`
- Solo visible para `admin` en el sidebar
- Filtros: módulo, acción, actor, rango de fechas
- Sin opción de editar ni eliminar

---

## Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| El modelo actual de `auditoria` tiene columnas incompatibles | Media | Alto | Verificar estructura ANTES de aplicar ALTER TABLE |
| El cliente omite llamar a `registrar_auditoria` | Alta | Medio | Aceptar como riesgo residual para MVP; mitigar con triggers en SEC-4F |
| La RPC falla silenciosamente y el log no se registra | Media | Medio | La operación principal no debe depender del audit log; try/catch en cliente |
| El audit log crece sin límite y afecta performance | Baja | Bajo | Supabase maneja bien BIGSERIAL; agregar índice en `created_at` |
| PII sensible en campo `metadata` | Media | Alto | Documentar qué NO incluir; revisión de código en SEC-4C |
| El audit log muestra información a roles no autorizados | Baja | Alto | Policy de SELECT solo para admin + contabilidad (SEC-4B) |

---

## Rollback

Si el sistema de auditoría causa problemas:

```sql
-- ROLLBACK SEC-4B — REQUIERE AUTORIZACIÓN
-- 1. Eliminar la RPC
DROP FUNCTION IF EXISTS public.registrar_auditoria(text, text, text, text, text, jsonb);

-- 2. Restaurar INSERT policy original
CREATE POLICY auditoria_insert ON public.auditoria
  FOR INSERT TO public
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Las columnas agregadas con ADD COLUMN pueden dejarse (no causan daño)
-- Si se requiere eliminar: DROP COLUMN IF EXISTS ... (irreversible si hay datos)
```

---

## Qué NO se auditará en esta fase

- Consultas (SELECT) — volumen excesivo, bajo valor
- Cambios en `cronograma_cuotas` — manejados atómicamente por RPC
- Cambios en `cartera_mes`, `cartera_resumen_mes`, `validacion_cuadre_mes` — tablas calculadas
- Exportaciones de Excel no regulatorias (aportes, caja)
- Inicio/cierre de sesión — Supabase Auth ya tiene logs propios
- Cambios en beneficiarios (`socio_beneficiarios`) — contemplado para SEC-4D

---

## Confirmación de restricciones

- ❌ No se tocó la base de datos
- ❌ No se crearon migraciones aplicadas
- ❌ No se modificaron RLS ni policies
- ❌ No se modificó lógica financiera
- ❌ No se tocó Anexo 06
- ❌ No se tocaron pagos a cuotas
- ✅ Solo diseño, auditoría, documentación y plan
