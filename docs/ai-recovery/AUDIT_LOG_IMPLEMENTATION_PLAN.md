# AUDIT_LOG_IMPLEMENTATION_PLAN.md

> **Fase SEC-4B — Implementación de audit log**
> Fecha: 2026-07-03 (revisión endurecida 2026-07-03 · aplicada en remoto 2026-07-03)
> Clasificación: SOLO USO INTERNO
> Proyecto: `ljdjbhsipgkxlgnprzhm`
> Estado: ✅ APLICADA EN REMOTO — autorizada con `APLICAR AUDIT LOG SEC-4B`
> Prerequisito: SEC-3E baseline → ✅ APLICADO en remoto (2026-07-03)

## Revisión de endurecimiento (2026-07-03)

La versión original de la RPC `registrar_auditoria` afirmaba en un comentario que
"sanitizaba metadata", pero no tenía ningún control técnico real — aceptaba cualquier
JSONB tal cual. Esta revisión reemplazó esa convención sin aplicar por **controles
técnicos reales dentro de la función**, antes de solicitar autorización para aplicar
en remoto.

## Aplicación en remoto (2026-07-03)

La migración se aplicó vía Supabase MCP `apply_migration`. Durante la verificación
post-apply se detectó que `EXECUTE` en la RPC también quedaba concedido a `anon`
(consecuencia de `ALTER DEFAULT PRIVILEGES` de Supabase, que otorga EXECUTE a
`anon`/`authenticated`/`service_role` en funciones nuevas del schema `public` —
esto no lo cubre `REVOKE ALL FROM PUBLIC`, ya que `anon` no es la pseudo-role
`PUBLIC`). Se ejecutó `REVOKE EXECUTE ... FROM anon` adicional y se agregó también
al archivo de migración local para que futuros despliegues lo repliquen. El control
interno A de la RPC (`auth.uid() IS NULL → RETURN`) ya bloqueaba cualquier
inserción sin sesión, por lo que el hallazgo era una brecha de permisos, no una
vulnerabilidad explotable — se corrigió de todas formas para alinear con el diseño.

Verificación post-apply: 13 columnas en `auditoria` (8 originales + 5 nuevas), solo
policy `auditoria_select` (INSERT directo eliminado), RPC con `prosecdef = true` y
ACL final `{postgres, authenticated, service_role}`, `row_count = 0`.

---

## Objetivo

Activar el sistema de audit log operativo en CEJUASSA para trazabilidad de
operaciones financieras y administrativas críticas. Basado en el diseño de
`AUDIT_LOG_DESIGN_PLAN.md`.

---

## Artefactos preparados (locales, no aplicados)

| Archivo | Propósito |
|---------|-----------|
| `supabase/migrations/20260703130000_sec4b_audit_log_implementation.sql` | Migración SQL completa |
| `lib/audit/types.ts` | Tipos TypeScript para el audit log |
| `lib/audit/auditClient.ts` | Helper de registro (desactivado hasta deploy) |

---

## SQL propuesto

### Columnas agregadas (ALTER TABLE IF NOT EXISTS)

```sql
ALTER TABLE public.auditoria
  ADD COLUMN IF NOT EXISTS actor_email    text,
  ADD COLUMN IF NOT EXISTS actor_rol      text,
  ADD COLUMN IF NOT EXISTS tabla_afectada text,
  ADD COLUMN IF NOT EXISTS metadata       jsonb,
  ADD COLUMN IF NOT EXISTS ip_hash        text;
```

Las columnas existentes (`id`, `id_usuario`, `modulo`, `accion`, `descripcion`,
`registro_id`, `ip`, `fecha_hora`) **no se modifican ni eliminan**.

### Policy SELECT restringida a admin + contabilidad

```sql
-- Reemplaza la policy actual (cualquier autenticado)
CREATE POLICY auditoria_select ON public.auditoria
  FOR SELECT USING (get_user_rol() IN ('admin', 'contabilidad'));
```

### RPC registrar_auditoria (SECURITY DEFINER) — controles técnicos reales

- Lee `auth.uid()` internamente para obtener usuario, email y rol
- No acepta `actor_user_id` como parámetro (evita suplantación)
- Solo usuarios autenticados pueden ejecutarla (`GRANT EXECUTE TO authenticated`)
- `SET search_path = public` — evita hijacking de search_path
- Silencia excepciones en el código que la llame (el audit log no debe romper flujos)

**Controles técnicos agregados en la revisión de endurecimiento (ya no son solo convención):**

| # | Control | Implementación |
|---|---------|-----------------|
| A | Requiere sesión activa y usuario con rol conocido | `auth.uid()` NULL o `rol` NULL → `RETURN` silencioso, no inserta nada |
| B | Whitelist de 14 acciones permitidas | `p_accion NOT IN (...)` → `RETURN` si no coincide |
| C | Whitelist de 10 módulos permitidos | `p_modulo NOT IN (...)` → `RETURN` si no coincide |
| D | Límites de longitud (truncado seguro) | `left(trim(...), N)` — accion/modulo 80, tabla_afectada 80, registro_id 120, descripcion 500 |
| E | Metadata debe ser objeto JSON o NULL | `jsonb_typeof(p_metadata) = 'object'`; arrays/strings/números/booleanos → reemplazados por `'{}'::jsonb` |
| F | Tamaño máximo de metadata serializada | `length(metadata::text) > 4000` → reemplazada por `'{}'::jsonb` |
| G | Rechazo de claves sensibles | Recorre `jsonb_object_keys(metadata)`; si alguna clave coincide (substring, case-insensitive) con la lista de términos sensibles → metadata completa se reemplaza por `'{}'::jsonb` |

**Claves sensibles rechazadas (regex case-insensitive sobre las claves, no sobre los valores):**
```
dni, documento, password, token, secret, key, email, telefono,
direccion / dirección, beneficiario, cuenta, tarjeta, auth, session, cookie, supabase
```

**Whitelist de acciones (14):**
```
CREAR_SOCIO, EDITAR_SOCIO, EDITAR_BENEFICIARIOS, CREAR_CREDITO, EDITAR_CREDITO,
APLICAR_AMPLIACION, REGISTRAR_PAGO, REGISTRAR_APORTE, CREAR_EGRESO, ELIMINAR_EGRESO,
INVITAR_USUARIO, CAMBIAR_ESTADO_USUARIO, EDITAR_CONFIGURACION, EXPORTAR_ANEXO6
```

**Whitelist de módulos (10):**
```
socios, creditos, beneficiarios, ampliaciones, pagos, aportes, egresos,
usuarios, configuracion, reportes
```

**Limitación documentada del control G:** la validación de claves sensibles solo
inspecciona claves de **primer nivel** del objeto `metadata`. Si un módulo envía un
objeto anidado (ej. `metadata: { pago: { dni: '...' } }`), la clave interna `dni` no
se inspecciona. Por diseño, los módulos que integren SEC-4C deben enviar metadata
**plana** (sin objetos anidados) — ver sección "Cómo evitar metadata sensible" abajo.

**✅ Inconsistencia con `lib/audit/types.ts` — CORREGIDA (2026-07-03):**
`types.ts` ahora coincide exactamente con las whitelists de la RPC (14 acciones,
10 módulos). Cambios aplicados en el tipo (archivo TypeScript inerte, sin uso
activo aún, `AUDIT_ENABLED = false`):
- Eliminado `EXPORTAR_BDCC` (no estaba en la whitelist SQL — BDCC fuera de alcance)
- Reemplazado `ACTIVAR_USUARIO` / `DESACTIVAR_USUARIO` por `CAMBIAR_ESTADO_USUARIO`
- Agregado `EDITAR_BENEFICIARIOS` a `AuditAccion`
- Agregados `beneficiarios` y `ampliaciones` a `AuditModulo`

El check `scripts/check-audit-log-implementation-plan.mjs` ahora valida
automáticamente esta alineación (parsea `types.ts` y compara contra la whitelist
SQL) — si alguna futura edición desincroniza los tipos, el check fallará.

### Revocación de INSERT directo

```sql
DROP POLICY IF EXISTS auditoria_insert ON public.auditoria;
```

Después de esto, ningún cliente puede INSERT directo — solo vía RPC.

---

## Rollback documentado

```sql
-- 1. Restaurar INSERT directo (estado SEC-3E)
DROP POLICY IF EXISTS auditoria_select ON public.auditoria;
CREATE POLICY auditoria_select ON public.auditoria FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY auditoria_insert ON public.auditoria FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 2. Eliminar RPC
DROP FUNCTION IF EXISTS public.registrar_auditoria(text, text, text, text, text, jsonb);

-- 3. Eliminar columnas agregadas (CUIDADO: perderá datos en esas columnas)
ALTER TABLE public.auditoria
  DROP COLUMN IF EXISTS actor_email,
  DROP COLUMN IF EXISTS actor_rol,
  DROP COLUMN IF EXISTS tabla_afectada,
  DROP COLUMN IF EXISTS metadata,
  DROP COLUMN IF EXISTS ip_hash;
```

---

## Operaciones a auditar (por fases)

### Fase SEC-4C — Alta criticidad (implementar primero)

| Módulo | Acción | Tabla | Acción auditada |
|--------|--------|-------|-----------------|
| Créditos | Crear crédito | creditos | `CREAR_CREDITO` |
| Créditos | Editar crédito | creditos | `EDITAR_CREDITO` |
| Créditos | Aplicar ampliación | creditos + ampliaciones | `APLICAR_AMPLIACION` |
| Pagos | Registrar pago | pagos_recibos | `REGISTRAR_PAGO` |
| Aportes | Registrar aporte | aportes | `REGISTRAR_APORTE` |
| Egresos | Crear egreso | egresos | `CREAR_EGRESO` |
| Egresos | Eliminar egreso | egresos | `ELIMINAR_EGRESO` |

### Fase SEC-4D — Criticidad media (implementar después)

| Módulo | Acción | Acción auditada |
|--------|--------|-----------------|
| Socios | Crear socio | `CREAR_SOCIO` |
| Socios | Editar socio | `EDITAR_SOCIO` |
| Usuarios | Invitar usuario | `INVITAR_USUARIO` |
| Usuarios | Activar/desactivar | `CAMBIAR_ESTADO_USUARIO` |
| Configuración | Editar configuración | `EDITAR_CONFIGURACION` |

### Fase SEC-4E — Pantalla de visualización (opcional)

- Página `/dashboard/reportes/auditoria` solo para admin
- Filtros: módulo, acción, usuario, fecha desde/hasta
- Sin exportación de audit log a Excel (riesgo de extracción masiva)

---

## Módulos a integrar en SEC-4C (archivos a modificar)

```
app/dashboard/creditos/nuevo/page.tsx         → CREAR_CREDITO
app/dashboard/creditos/[id]/editar/page.tsx   → EDITAR_CREDITO
app/dashboard/creditos/_components/AmpliacionesSection.tsx → APLICAR_AMPLIACION
app/dashboard/pagos/nuevo/page.tsx            → REGISTRAR_PAGO
app/dashboard/egresos/page.tsx                → CREAR_EGRESO + ELIMINAR_EGRESO
app/api/usuarios/invite/route.ts              → INVITAR_USUARIO
app/api/usuarios/update/route.ts              → CAMBIAR_ESTADO_USUARIO
```

Patrón de integración:
```ts
// Después de la operación principal (no antes, no en lugar de):
await registrarAudit({
  accion: 'REGISTRAR_PAGO',
  modulo: 'pagos',
  tabla_afectada: 'pagos_recibos',
  registro_id: String(nuevoRecibo.id),
  descripcion: `Pago S/ ${monto} — Crédito #${idCredito}`,
  // metadata: sin DNI, sin saldos individuales completos
});
```

---

## Módulos que quedan fuera

| Módulo | Por qué |
|--------|---------|
| Lectura/consulta (SELECT) | Volumen alto, bajo valor de auditoría |
| BDCC/TXT | Fuera del alcance actual del sistema |
| Cartera, cronograma_cuotas | Datos calculados, no operaciones |
| pagos_cuotas_aplicaciones | La trazabilidad ya está en la tabla misma |

---

## Riesgos

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| RPC lanza excepción y rompe flujo principal | Alto | `registrarAudit()` silencia errores internamente |
| metadata incluye PII (DNI, saldo) por descuido en objetos de primer nivel | Medio (antes Alto) | **Mitigado con control técnico G**: la RPC rechaza (vacía) metadata cuyas claves de primer nivel coincidan con términos sensibles — ya no depende solo de disciplina de código |
| metadata incluye PII en objetos **anidados** | Medio | **No mitigado técnicamente** — el control G solo inspecciona primer nivel; los módulos deben enviar metadata plana (documentado explícitamente) |
| p_accion o p_modulo con valores fuera de whitelist | Bajo (antes no controlado) | **Mitigado con controles B/C**: la RPC ignora silenciosamente inserciones con acción/módulo desconocidos |
| Campos de texto excesivamente largos | Bajo (antes no controlado) | **Mitigado con control D**: truncado seguro a límites fijos, nunca falla la inserción por longitud |
| `types.ts` permitía acciones fuera de whitelist SQL | ~~Medio~~ Resuelto | ✅ `types.ts` alineado (2026-07-03) — check automatizado valida coincidencia |
| La RPC se llama antes de que el INSERT principal confirme | Medio | Llamar `registrarAudit` DESPUÉS del `await` de la operación principal |
| Lentitud por INSERT adicional en cada operación | Bajo | `fecha_hora` indexado; INSERT auditoria es muy rápido |
| actor_email vacío si usuario no está en tabla `usuarios` | Bajo | RPC maneja graciosamente (NULL) — solo si usuario fue eliminado |

---

## Cómo evitar metadata sensible

**NUNCA incluir en `metadata`:**
- DNI del socio (`dni`)
- Contraseñas o tokens
- Saldos individuales completos (ok `monto_pago`, no `saldo_total_socio`)
- Datos personales de beneficiarios
- Claves API o secretos

**SÍ incluir en `metadata`:**
- Monto de la operación
- Número de pagaré o recibo
- Estado antes/después (solo campos no PII)
- Período (YYYY-MM)

---

## Estado de integración en la app

| Paso | Estado |
|------|--------|
| Tipos TypeScript (`lib/audit/types.ts`) | ✅ Creado y alineado con whitelist SQL — sin uso activo |
| Helper (`lib/audit/auditClient.ts`) | ✅ Creado — `AUDIT_ENABLED = false` |
| Migración SEC-4B (`20260703130000_sec4b_audit_log_implementation.sql`) | ✅ APLICADA en remoto (2026-07-03) |
| RPC `registrar_auditoria` en Supabase | ✅ Existe en remoto, con controles técnicos reales |
| Llamadas en módulos SEC-4C | ❌ Pendiente — RPC ya disponible, integración no iniciada |
| Llamadas en módulos SEC-4D | ❌ Pendiente |
| Pantalla de visualización (SEC-4E) | ❌ Pendiente |

---

## Autorizaciones (histórico de esta fase)

| Autorización | Descripción | Estado |
|-------------|-------------|--------|
| `APLICAR BASELINE AUDITORIA SEC-3E` | Registrar migración baseline en historial local | ✅ APLICADA (2026-07-03) |
| `APLICAR AUDIT LOG SEC-4B` | Aplicar en Supabase: columnas + RPC endurecida + policies | ✅ APLICADA (2026-07-03) |

**Sin autorizaciones pendientes en esta fase.** La siguiente fase (SEC-4C: integrar
`registrarAudit()` en módulos) requerirá su propia autorización cuando se decida iniciarla.
