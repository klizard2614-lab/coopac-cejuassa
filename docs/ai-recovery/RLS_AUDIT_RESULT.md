# RLS_AUDIT_RESULT.md

> **Fase SEC-3A — Auditoría real de RLS remoto Supabase**
> Fecha: 2026-07-02
> Clasificación: SOLO USO INTERNO
> Proyecto: `ljdjbhsipgkxlgnprzhm`
> Modo: SOLO LECTURA — ningún dato modificado, ninguna policy tocada

---

## Resumen ejecutivo

**Estado real es SIGNIFICATIVAMENTE MEJOR que lo detectado en SEC-0.**

La auditoría revela que la mayoría de tablas ya tienen policies granulares por rol usando la función `get_user_rol()` (SECURITY DEFINER). Solo **2 tablas** tienen policies amplias (`USING (true)`). La función helper de rol ya existe en producción, lo que simplifica enormemente el plan de hardening en SEC-3B–3D.

| Métrica | Valor |
|---|---|
| Tablas auditadas | 16 |
| Tablas con RLS habilitado | 16 / 16 (100%) |
| Tablas con policies granulares por rol | 14 / 16 |
| Tablas con policy amplia `USING (true)` | 2 / 16 |
| Función `get_user_rol()` existe en prod | ✅ SÍ — SECURITY DEFINER |
| Tablas sin ninguna policy | 0 / 16 |
| DB modificada en esta auditoría | ❌ NO |

---

## Estado real de RLS por tabla

### ✅ Tablas con policies granulares — BIEN PROTEGIDAS

---

#### `ampliaciones`

| Operación | Policy | Roles | USING / WITH CHECK |
|---|---|---|---|
| SELECT | `ampliaciones_select` | public | `auth.uid() IS NOT NULL` |
| INSERT | `ampliaciones_insert` | public | WITH CHECK: `get_user_rol() IN ('admin','creditos')` |
| UPDATE | `ampliaciones_update` | public | USING: `get_user_rol() IN ('admin','creditos')` |
| DELETE | `ampliaciones_delete` | public | USING: `get_user_rol() = 'admin'` |

**Riesgo:** BAJO — policies correctas por rol. Solo admin/creditos pueden escribir.
**Nota:** Usa `TO public` en lugar de `TO authenticated` — equivalente en seguridad práctica (ver sección de riesgos).
**Recomendación:** Migrar `TO public` → `TO authenticated` en SEC-3D (cosmético pero más defensivo).
**Fase sugerida:** SEC-3D (opcional, baja prioridad)

---

#### `aportes`

| Operación | Policy | Roles | USING / WITH CHECK |
|---|---|---|---|
| SELECT | `aportes_select` | public | `auth.uid() IS NOT NULL` |
| INSERT | `aportes_insert` | public | WITH CHECK: `get_user_rol() IN ('admin','tesoreria')` |
| UPDATE | `aportes_update` | public | USING: `get_user_rol() IN ('admin','tesoreria')` |
| DELETE | `aportes_delete` | public | USING: `get_user_rol() = 'admin'` |

**Riesgo:** BAJO — correcto. Tesorería crea aportes; solo admin elimina.
**Recomendación:** Migrar `TO public` → `TO authenticated` en SEC-3D.
**Fase sugerida:** SEC-3D (opcional)

---

#### `cartera_mes`

| Operación | Policy | Roles | USING / WITH CHECK |
|---|---|---|---|
| SELECT | `cartera_mes_select` | public | `auth.uid() IS NOT NULL` |
| INSERT | `cartera_mes_insert` | public | WITH CHECK: `get_user_rol() IN ('admin','creditos')` |
| UPDATE | `cartera_mes_update` | public | USING: `get_user_rol() IN ('admin','creditos')` |
| DELETE | `cartera_mes_delete` | public | USING: `get_user_rol() = 'admin'` |

**Riesgo:** BAJO — tabla auxiliar de cartera por mes; protegida correctamente.
**Nota:** Esta tabla no aparece en las migraciones locales — fue creada directamente en Supabase Dashboard. Sin equivalente local.
**Fase sugerida:** SEC-3D (opcional)

---

#### `cartera_resumen_mes`

| Operación | Policy | Roles | USING / WITH CHECK |
|---|---|---|---|
| SELECT | `cartera_resumen_select` | public | `auth.uid() IS NOT NULL` |
| INSERT | `cartera_resumen_insert` | public | WITH CHECK: `get_user_rol() IN ('admin','creditos')` |
| UPDATE | `cartera_resumen_update` | public | USING: `get_user_rol() IN ('admin','creditos')` |
| DELETE | `cartera_resumen_delete` | public | USING: `get_user_rol() = 'admin'` |

**Riesgo:** BAJO — misma situación que `cartera_mes`.
**Nota:** Sin migración local — creada directamente en Supabase Dashboard.
**Fase sugerida:** SEC-3D (opcional)

---

#### `configuracion` ⭐ MUY BIEN PROTEGIDA

| Operación | Policy | Roles | USING / WITH CHECK |
|---|---|---|---|
| SELECT | `config_select` | public | `auth.uid() IS NOT NULL` |
| INSERT | `config_insert` | public | WITH CHECK: `get_user_rol() = 'admin'` |
| UPDATE | `config_update` | public | USING: `get_user_rol() = 'admin'` |
| DELETE | `config_delete` | public | USING: `get_user_rol() = 'admin'` |

**Riesgo:** MUY BAJO — tabla crítica protegida correctamente. Solo admin puede modificar tasas y parámetros.
**Recomendación:** Ninguna corrección requerida. `TO public` → `TO authenticated` en SEC-3D como higiene.
**Fase sugerida:** SEC-3D (cosmético)

---

#### `convenios`

| Operación | Policy | Roles | USING / WITH CHECK |
|---|---|---|---|
| SELECT | `convenios_select` | public | `auth.uid() IS NOT NULL` |
| INSERT | `convenios_insert` | public | WITH CHECK: `get_user_rol() IN ('admin','tesoreria')` |
| UPDATE | `convenios_update` | public | USING: `get_user_rol() IN ('admin','tesoreria')` |
| DELETE | `convenios_delete` | public | USING: `get_user_rol() = 'admin'` |

**Riesgo:** BAJO — correcto por modelo de negocio.
**Fase sugerida:** SEC-3D (opcional)

---

#### `creditos` ⭐ TABLA FINANCIERA CRÍTICA

| Operación | Policy | Roles | USING / WITH CHECK |
|---|---|---|---|
| SELECT | `creditos_select` | public | `auth.uid() IS NOT NULL` |
| INSERT | `creditos_insert` | public | WITH CHECK: `get_user_rol() IN ('admin','creditos')` |
| UPDATE | `creditos_update` | public | USING: `get_user_rol() IN ('admin','creditos')` |
| DELETE | `creditos_delete` | public | USING: `get_user_rol() = 'admin'` |

**Riesgo:** BAJO — tabla crítica adecuadamente protegida. Solo admin/creditos pueden crear o editar créditos.
**Nota pendiente:** Las RPCs `decrementar_saldo_capital` y `aplicar_ampliacion_credito` son SECURITY DEFINER — bypasan RLS por diseño correcto.
**Fase sugerida:** SEC-3D (opcional)

---

#### `cronograma_cuotas`

| Operación | Policy | Roles | USING / WITH CHECK |
|---|---|---|---|
| SELECT | `cronograma_select` | public | `auth.uid() IS NOT NULL` |
| INSERT | `cronograma_insert` | public | WITH CHECK: `get_user_rol() IN ('admin','creditos')` |
| UPDATE | `cronograma_update` | public | USING: `get_user_rol() IN ('admin','creditos')` |
| DELETE | `cronograma_delete` | public | USING: `get_user_rol() = 'admin'` |

**Riesgo:** BAJO — correcto. El cronograma se crea via RPC (bypasa RLS por SECURITY DEFINER). El UPDATE directo está restringido a admin/creditos.
**Fase sugerida:** SEC-3D (opcional)

---

#### `egresos`

| Operación | Policy | Roles | USING / WITH CHECK |
|---|---|---|---|
| SELECT | `egresos_select` | public | `auth.uid() IS NOT NULL` |
| INSERT | `egresos_insert` | public | WITH CHECK: `get_user_rol() IN ('admin','tesoreria')` |
| UPDATE | `egresos_update` | public | USING: `get_user_rol() IN ('admin','tesoreria')` |
| DELETE | `egresos_delete` | public | USING: `get_user_rol() = 'admin'` |

**Riesgo:** BAJO — correcto. El frontend también bloquea `creditos` via route guard.
**Fase sugerida:** SEC-3D (opcional)

---

#### `pagos_recibos` ⭐ TABLA FINANCIERA CRÍTICA

| Operación | Policy | Roles | USING / WITH CHECK |
|---|---|---|---|
| SELECT | `pagos_select` | public | `auth.uid() IS NOT NULL` |
| INSERT | `pagos_insert` | public | WITH CHECK: `get_user_rol() IN ('admin','tesoreria')` |
| UPDATE | `pagos_update` | public | USING: `get_user_rol() IN ('admin','tesoreria')` |
| DELETE | `pagos_delete` | public | USING: `get_user_rol() = 'admin'` |

**Riesgo:** BAJO — tabla financiera crítica correctamente protegida.
**Fase sugerida:** SEC-3D (opcional)

---

#### `socios` ⭐ TABLA CRÍTICA CON PII

| Operación | Policy | Roles | USING / WITH CHECK |
|---|---|---|---|
| SELECT | `socios_select` | public | `auth.uid() IS NOT NULL` |
| INSERT | `socios_insert` | public | WITH CHECK: `get_user_rol() IN ('admin','creditos')` |
| UPDATE | `socios_update` | public | USING: `get_user_rol() IN ('admin','creditos')` |
| DELETE | `socios_delete` | public | USING: `get_user_rol() = 'admin'` |

**Riesgo:** BAJO — datos personales protegidos. Solo admin/creditos pueden crear o editar socios.
**Nota:** SELECT abierto a todos los autenticados — es necesario para que tesorería y contabilidad accedan a datos de socios en sus flujos.
**Fase sugerida:** SEC-3D (opcional)

---

#### `usuarios` ⭐ MUY BIEN PROTEGIDA

| Operación | Policy | Roles | USING / WITH CHECK |
|---|---|---|---|
| SELECT | `usuarios_select` | public | `auth.uid() IS NOT NULL` |
| INSERT | `usuarios_insert` | public | WITH CHECK: `get_user_rol() = 'admin'` |
| UPDATE | `usuarios_update` | public | USING: `get_user_rol() = 'admin'` |
| DELETE | `usuarios_delete` | public | USING: `get_user_rol() = 'admin'` |

**Riesgo:** MUY BAJO — tabla sensible de administración de usuarios protegida correctamente. Solo admin puede crear/editar/eliminar usuarios.
**Nota:** SELECT abierto a todos los autenticados — necesario para `useRol()` hook y para que `get_user_rol()` funcione.
**Fase sugerida:** SEC-3D (opcional)

---

#### `validacion_cuadre_mes`

| Operación | Policy | Roles | USING / WITH CHECK |
|---|---|---|---|
| SELECT | `validacion_select` | public | `auth.uid() IS NOT NULL` |
| INSERT | `validacion_insert` | public | WITH CHECK: `get_user_rol() IN ('admin','contabilidad')` |
| UPDATE | `validacion_update` | public | USING: `get_user_rol() IN ('admin','contabilidad')` |
| DELETE | `validacion_delete` | public | USING: `get_user_rol() = 'admin'` |

**Riesgo:** BAJO — correcto para tabla contable.
**Nota:** Sin migración local — creada directamente en Supabase Dashboard.
**Fase sugerida:** SEC-3D (opcional)

---

### ⚠️ Tabla especial — política de auditoría abierta

#### `auditoria`

| Operación | Policy | Roles | USING / WITH CHECK |
|---|---|---|---|
| SELECT | `auditoria_select` | public | `auth.uid() IS NOT NULL` |
| INSERT | `auditoria_insert` | public | WITH CHECK: `auth.uid() IS NOT NULL` |

**Riesgo:** BAJO-MEDIO — cualquier usuario autenticado puede insertar en la tabla de auditoría. No hay UPDATE ni DELETE policies (correcto para inmutabilidad). El INSERT abierto podría usarse para "contaminar" el log de auditoría, pero el daño operativo es bajo.
**Recomendación:** Evaluar si la tabla debe poblarse solo via trigger/RPC (SECURITY DEFINER) para garantizar integridad del log. En ese caso, revocar INSERT a `authenticated` y hacer todo via funciones con SECURITY DEFINER.
**Fase sugerida:** SEC-4 (junto con auditoría de acciones financieras)

---

### ❌ Tablas con policies AMPLIAS — REQUIEREN CORRECCIÓN

---

#### `pagos_cuotas_aplicaciones` — RIESGO ALTO

| Operación | Policy | Roles | USING / WITH CHECK |
|---|---|---|---|
| ALL | `autenticados_pueden_operar_pca` | authenticated | USING: `true` / WITH CHECK: `true` |

**Diagnóstico:**
- Policy única para TODOS los comandos (SELECT, INSERT, UPDATE, DELETE)
- Cualquier usuario autenticado puede ejecutar cualquier operación directamente via API
- Esta tabla registra la trazabilidad de pagos→cuotas — dato financiero sensible
- La policy fue creada en Fase 10K-1 como placeholder provisional ("mismo patrón que socio_beneficiarios")
- La tabla aún **no tiene datos reales** (pendiente Fase 10K-2), por lo que el riesgo de impacto inmediato es bajo pero debe corregirse antes de aplicar datos

**Riesgo:** ALTO (potencial) — un usuario de contabilidad podría insertar, modificar o borrar aplicaciones de pago directamente sin pasar por la lógica de la RPC.

**Corrección requerida:**
```sql
-- SEC-3C: Reemplazar policy amplia
-- Requiere autorización: APLICAR RLS PAGOS_CUOTAS_APLICACIONES SEC-3C
DROP POLICY IF EXISTS autenticados_pueden_operar_pca ON public.pagos_cuotas_aplicaciones;

CREATE POLICY pca_select ON public.pagos_cuotas_aplicaciones
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY pca_insert ON public.pagos_cuotas_aplicaciones
  FOR INSERT TO authenticated
  WITH CHECK (get_user_rol() IN ('admin', 'tesoreria'));

CREATE POLICY pca_update ON public.pagos_cuotas_aplicaciones
  FOR UPDATE TO authenticated
  USING (get_user_rol() IN ('admin', 'tesoreria'));

CREATE POLICY pca_delete ON public.pagos_cuotas_aplicaciones
  FOR DELETE TO authenticated
  USING (get_user_rol() = 'admin');
```

**Riesgo de romper la app:** BAJO — la tabla no tiene escrituras reales en la app aún (pendiente Fase 10K-2). El cambio es seguro ahora.
**Fase sugerida:** SEC-3C (alta prioridad, hacer antes de implementar Fase 10K-2)

---

#### `socio_beneficiarios` — RIESGO ALTO

| Operación | Policy | Roles | USING / WITH CHECK |
|---|---|---|---|
| ALL | `autenticados_pueden_operar` | authenticated | USING: `true` / WITH CHECK: `true` |

**Diagnóstico:**
- Policy única para TODOS los comandos
- Cualquier usuario autenticado puede hacer CRUD completo en beneficiarios de socios
- La UI de `BeneficiariosSection.tsx` tiene guards por rol (admin: CRUD, tesoreria: crear/editar, creditos/contabilidad: solo lectura), pero estos solo protegen la UI
- Un usuario de contabilidad podría via API directa borrar beneficiarios de cualquier socio

**Riesgo:** ALTO — datos PII de beneficiarios sin protección por rol a nivel DB.

**Corrección requerida:**
```sql
-- SEC-3C: Reemplazar policy amplia
-- Requiere autorización: APLICAR RLS SOCIO_BENEFICIARIOS SEC-3C
DROP POLICY IF EXISTS autenticados_pueden_operar ON public.socio_beneficiarios;

CREATE POLICY sb_select ON public.socio_beneficiarios
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY sb_insert ON public.socio_beneficiarios
  FOR INSERT TO authenticated
  WITH CHECK (get_user_rol() IN ('admin', 'creditos', 'tesoreria'));

CREATE POLICY sb_update ON public.socio_beneficiarios
  FOR UPDATE TO authenticated
  USING (get_user_rol() IN ('admin', 'creditos', 'tesoreria'));

CREATE POLICY sb_delete ON public.socio_beneficiarios
  FOR DELETE TO authenticated
  USING (get_user_rol() IN ('admin', 'creditos'));
```

**Riesgo de romper la app:** BAJO — los usuarios que hacen CRUD en la UI son admin/creditos/tesoreria, que seguirán teniendo acceso con las nuevas policies. Contabilidad solo lectura (ya protegida por UI) quedará consistente a nivel DB.
**Fase sugerida:** SEC-3C (alta prioridad)

---

## Estado de la función helper `get_user_rol()`

```sql
CREATE OR REPLACE FUNCTION public.get_user_rol()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT rol::text
  FROM public.usuarios
  WHERE id = auth.uid()
  LIMIT 1;
$$;
```

**Estado:** ✅ EXISTE EN PRODUCCIÓN
- Nombre: `get_user_rol` (no `get_current_user_role` como propuso SEC-3.2)
- Tipo: SECURITY DEFINER + STABLE
- Lógica: lee `rol` de `public.usuarios` donde `id = auth.uid()`
- Sin loops: es SECURITY DEFINER, bypasa RLS de `usuarios` correctamente

**Implicación para SEC-3B:** La función helper ya existe. No hay que crearla. SEC-3B puede enfocarse en documentar su comportamiento y verificar edge cases.

---

## Hallazgo transversal: `TO public` en lugar de `TO authenticated`

**Detalle técnico:** Todas las policies de tablas con restricción por rol usan `roles: {public}` (el rol PostgreSQL `public`) en lugar de `{authenticated}`. En Supabase:
- `TO public` se aplica a todos los roles: `anon`, `authenticated`, `service_role`
- `TO authenticated` se aplica solo a usuarios con JWT válido

**¿Por qué es seguro de todas formas?**
- Para SELECT: `USING (auth.uid() IS NOT NULL)` → `auth.uid()` es NULL para `anon` → acceso denegado ✅
- Para INSERT/UPDATE/DELETE: `get_user_rol() IN (...)` → `get_user_rol()` devuelve NULL para `anon` → `NULL IN ('admin', ...)` es FALSE → acceso denegado ✅

**Sin embargo**, usar `TO public` es menos defensivo que `TO authenticated`:
- Si una bug en `get_user_rol()` retorna un valor inesperado, `TO authenticated` añade una capa extra de protección
- `TO authenticated` documenta mejor la intención

**Riesgo:** BAJO-MEDIO (por defensa en profundidad)
**Recomendación:** Migrar todas las policies `TO public` → `TO authenticated` en SEC-3D como cambio de higiene.

---

## Tablas sin migración local (solo en Supabase Dashboard)

Las siguientes tablas existen en Supabase remoto pero **no tienen migración local**:

| Tabla | Policies | Observación |
|---|---|---|
| `auditoria` | 2 (SELECT + INSERT auth) | Creada directamente en Dashboard |
| `cartera_mes` | 4 (granulares por rol) | Creada directamente en Dashboard |
| `cartera_resumen_mes` | 4 (granulares por rol) | Creada directamente en Dashboard |
| `validacion_cuadre_mes` | 4 (granulares por rol) | Creada directamente en Dashboard |

**Riesgo:** MEDIO — sin migraciones locales, estas tablas no se pueden recrear desde cero con `supabase db push`. Si se hace un `reset` de la DB, se pierden.
**Recomendación SEC-3B adicional:** Crear migraciones locales de "sincronización" para estas 4 tablas.

---

## Modelo esperado de acceso por rol (propuesta preliminar)

Esta es la propuesta para validar con la cooperativa antes de aplicar en SEC-3C/3D.

### `admin`
Acceso completo a todas las tablas. SELECT, INSERT, UPDATE, DELETE sin restricción (dentro de las políticas actuales).

### `tesoreria`
- **SELECT:** Todas las tablas (pagos, aportes, socios, créditos, etc.)
- **INSERT/UPDATE:** pagos_recibos, aportes, egresos, convenios, socio_beneficiarios, pagos_cuotas_aplicaciones
- **DELETE:** Ninguno (solo admin)
- **Bloqueado:** creditos (no puede crear créditos), usuarios, configuracion

### `creditos`
- **SELECT:** Todas las tablas
- **INSERT/UPDATE:** creditos, cronograma_cuotas, ampliaciones, socios, socio_beneficiarios, cartera_mes, cartera_resumen_mes
- **DELETE:** Ninguno (solo admin)
- **Bloqueado:** aportes, egresos, pagos_recibos, usuarios, configuracion

### `contabilidad`
- **SELECT:** Todas las tablas (incluyendo anexo6, reportes, cartera, mora)
- **INSERT/UPDATE:** validacion_cuadre_mes, auditoria (log propio)
- **DELETE:** Ninguno (solo admin)
- **Bloqueado:** Todo lo operativo (socios, créditos, pagos, etc.)

**Evaluación del modelo actual vs el modelo esperado:**

| Tabla | Esperado tesorería | Actual | Brecha |
|---|---|---|---|
| pagos_recibos INSERT | tesorería | admin/tesorería | ✅ correcto |
| creditos INSERT | bloqueado | admin/creditos | ✅ correcto |
| egresos INSERT | tesorería | admin/tesorería | ✅ correcto |
| usuarios INSERT | bloqueado | admin | ✅ correcto |
| socio_beneficiarios INSERT | tesorería/creditos | ANYONE | ❌ amplio |
| pagos_cuotas_aplicaciones INSERT | tesorería | ANYONE | ❌ amplio |

**Conclusión: solo 2 brechas a cerrar.**

---

## Riesgos de implementación de RLS por rol

### ¿Aplicar RLS por rol rompería consultas actuales?

**Para las 14 tablas con policies granulares:** NO — ya tienen policies por rol y la app funciona.
**Para `socio_beneficiarios`:** Al cambiar de `USING (true)` a `get_user_rol() IN (...)`, los roles que actualmente no pueden escribir via UI (contabilidad) perderán acceso directo via API. Pero la app los UI-guards ya los bloqueaban. **No rompe nada.**
**Para `pagos_cuotas_aplicaciones`:** Sin datos aún. Cambio seguro.

### ¿La app usa ANON key para writes?

**Respuesta:** NO. Toda la app usa la sesión de usuario autenticado (ANON key de Supabase pero con JWT de usuario). `get_user_rol()` lee el rol del JWT. Los writes correctamente pasan a través del JWT.

### ¿Hacen falta RPCs adicionales?

**Para SEC-3C (solo las 2 tablas):** NO — las operaciones directas de cliente son suficientes con las nuevas policies.
**Para la tabla `auditoria`:** Se recomienda una RPC SECURITY DEFINER para garantizar inmutabilidad del log (SEC-4).

### ¿Hay que mover operaciones a API routes?

**No para SEC-3C.** Las writes de `socio_beneficiarios` y `pagos_cuotas_aplicaciones` pueden quedarse en el cliente con las policies corregidas.

### ¿El modelo de roles en `usuarios` es suficiente para RLS?

**SÍ.** La función `get_user_rol()` ya lee el rol desde `usuarios.rol` y está funcionando en producción para 14 tablas.

### ¿Conviene usar claims JWT o funciones SQL?

**Recomendación actual:** Mantener el modelo SQL (`get_user_rol()` → query a `usuarios`). Las razones:
- Ya funciona y está probado en producción
- JWT custom claims requieren Edge Functions o hooks de auth que agregan complejidad
- El overhead de `get_user_rol()` es una query SELECT con índice primario (muy rápida)
- Para el volumen de CEJUASSA (pocos usuarios simultáneos), no hay problema de performance

---

## Confirmación de restricciones

- ❌ No se modificó la base de datos
- ❌ No se crearon migraciones aplicadas
- ❌ No se modificaron policies
- ❌ No se modificó RLS
- ❌ No se insertaron, actualizaron ni borraron datos
- ❌ No se tocó lógica financiera
- ❌ No se tocó Anexo 06
- ✅ Solo lectura, auditoría, documentación y plan
