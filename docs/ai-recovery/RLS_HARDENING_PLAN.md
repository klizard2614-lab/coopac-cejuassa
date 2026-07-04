# RLS_HARDENING_PLAN.md

> **Plan de hardening de RLS por fases — derivado de SEC-3A**
> Fecha: 2026-07-02
> Basado en auditoría `RLS_AUDIT_RESULT.md`
> Ningún SQL aquí debe aplicarse sin autorización explícita del usuario.

---

## Resumen

SEC-3A reveló que el estado real de RLS es mucho mejor que lo esperado. La función `get_user_rol()` ya existe en producción con SECURITY DEFINER. Solo 2 tablas necesitan corrección urgente.

| Sub-fase | Nombre | Prioridad | Estado |
|---|---|---|---|
| SEC-3B | Verificación y documentación de `get_user_rol()` | Alta | ✅ Completada (función ya existía en prod) |
| SEC-3C | Policies write por rol — 2 tablas con USING(true) | Alta | ✅ Completada (2026-07-03) |
| SEC-3D | Migrar `TO public` → `TO authenticated` (higiene) | Baja | ⏳ Pendiente |
| SEC-3E | Migraciones locales de tablas sin archivo | Media | ⏳ Pendiente |
| SEC-3F | Pruebas por rol post-aplicación | Alta | ⏳ Pendiente |

---

## SEC-3B — Verificación de función helper `get_user_rol()`

**Objetivo:** Documentar y verificar que `get_user_rol()` funciona correctamente en producción antes de aplicar cualquier cambio. Esta sub-fase es SOLO LECTURA.

**Estado:** La función ya existe en producción (verificado en SEC-3A):
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

**Verificaciones a realizar (solo lectura):**

1. Confirmar que `get_user_rol()` devuelve NULL para usuario `anon` (sin sesión):
   ```sql
   -- Ejecutar como anon: debería devolver NULL
   SELECT public.get_user_rol();
   ```

2. Confirmar que devuelve el rol correcto para un usuario autenticado:
   ```sql
   -- Verificar con usuario de prueba autenticado
   SELECT public.get_user_rol();
   -- Debe devolver: 'admin' | 'tesoreria' | 'creditos' | 'contabilidad'
   ```

3. Verificar que `usuarios.rol` tiene los 4 valores esperados:
   ```sql
   SELECT DISTINCT rol FROM public.usuarios ORDER BY rol;
   -- Esperado: admin, contabilidad, creditos, tesoreria
   ```

**Acciones de esta sub-fase:**
- Ningún SQL de escritura
- Crear tests en `scripts/check-rls-audit.mjs` que validen cobertura de tablas
- Documentar que la función helper NO necesita crearse (ya existe)

**Entregable:** `scripts/check-rls-audit.mjs` — check automático de seguridad del estado RLS.

**Rollback:** N/A — no hay cambios.

---

## SEC-3C — Policies write por rol en tablas con USING(true)

**Objetivo:** Reemplazar las 2 policies amplias (`USING (true)`) con policies granulares por rol, siguiendo exactamente el patrón del resto de tablas.

**⚠️ REQUIERE AUTORIZACIÓN EXPLÍCITA: `APLICAR RLS TABLAS SEC-3C`**

### SEC-3C.1 — `socio_beneficiarios`

**Motivación:** Cualquier usuario autenticado puede CRUD en beneficiarios. Contabilidad y creditos no deberían poder escribir datos de beneficiarios.

> **Decisión de negocio (2026-07-03):** `creditos` queda con SELECT únicamente. La UI (`BeneficiariosSection.tsx`) ya implementa `canEdit = rol === 'admin' || rol === 'tesoreria'` — sin cambios al frontend necesarios.

**SQL final (migración 20260702000010):**
```sql
-- REQUIERE AUTORIZACIÓN: APLICAR RLS TABLAS SEC-3C
-- admin: SELECT/INSERT/UPDATE/DELETE
-- tesoreria: SELECT/INSERT/UPDATE
-- creditos: SELECT
-- contabilidad: SELECT

DROP POLICY IF EXISTS autenticados_pueden_operar ON public.socio_beneficiarios;

CREATE POLICY sb_select ON public.socio_beneficiarios
  FOR SELECT TO authenticated
  USING (get_user_rol() IN ('admin', 'tesoreria', 'creditos', 'contabilidad'));

CREATE POLICY sb_insert ON public.socio_beneficiarios
  FOR INSERT TO authenticated
  WITH CHECK (get_user_rol() IN ('admin', 'tesoreria'));

CREATE POLICY sb_update ON public.socio_beneficiarios
  FOR UPDATE TO authenticated
  USING (get_user_rol() IN ('admin', 'tesoreria'))
  WITH CHECK (get_user_rol() IN ('admin', 'tesoreria'));

CREATE POLICY sb_delete ON public.socio_beneficiarios
  FOR DELETE TO authenticated
  USING (get_user_rol() = 'admin');

ALTER TABLE public.socio_beneficiarios ENABLE ROW LEVEL SECURITY;
```

**Roles afectados:**
- `admin`: CRUD completo ✅
- `tesoreria`: SELECT/INSERT/UPDATE ✅ (DELETE bloqueado a nivel DB)
- `creditos`: solo SELECT ✅ (UI ya no mostraba botones de edición)
- `contabilidad`: solo SELECT ✅ (antes podía CRUD — ahora alineado con UI)

**Riesgo de romper la app:** BAJO — la UI ya implementa estos guards. El cambio solo alinea DB con lo que la UI ya impone.

**Verificación post-aplicación:**
```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'socio_beneficiarios'
ORDER BY cmd;
-- Debe mostrar 4 policies: DELETE, INSERT, SELECT, UPDATE
-- Ninguna debe tener USING (true)
```

**Rollback:**
```sql
-- ROLLBACK SEC-3C.1 — volver a policy amplia
DROP POLICY IF EXISTS sb_select ON public.socio_beneficiarios;
DROP POLICY IF EXISTS sb_insert ON public.socio_beneficiarios;
DROP POLICY IF EXISTS sb_update ON public.socio_beneficiarios;
DROP POLICY IF EXISTS sb_delete ON public.socio_beneficiarios;

CREATE POLICY autenticados_pueden_operar ON public.socio_beneficiarios
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
```

---

### SEC-3C.2 — `pagos_cuotas_aplicaciones`

**Motivación:** Tabla de trazabilidad financiera sin datos aún (pendiente Fase 10K-2). Corregir ahora, antes de aplicar datos.

> **Decisión de negocio (2026-07-03):** tesoreria INSERT pero no UPDATE. Solo admin puede UPDATE/DELETE. SELECT por rol explícito.

**SQL final (migración 20260702000010):**
```sql
-- REQUIERE AUTORIZACIÓN: APLICAR RLS TABLAS SEC-3C
-- admin: SELECT/INSERT/UPDATE/DELETE
-- tesoreria: SELECT/INSERT
-- creditos: SELECT
-- contabilidad: SELECT

DROP POLICY IF EXISTS autenticados_pueden_operar_pca ON public.pagos_cuotas_aplicaciones;

CREATE POLICY pca_select ON public.pagos_cuotas_aplicaciones
  FOR SELECT TO authenticated
  USING (get_user_rol() IN ('admin', 'tesoreria', 'creditos', 'contabilidad'));

CREATE POLICY pca_insert ON public.pagos_cuotas_aplicaciones
  FOR INSERT TO authenticated
  WITH CHECK (get_user_rol() IN ('admin', 'tesoreria'));

CREATE POLICY pca_update ON public.pagos_cuotas_aplicaciones
  FOR UPDATE TO authenticated
  USING (get_user_rol() = 'admin')
  WITH CHECK (get_user_rol() = 'admin');

CREATE POLICY pca_delete ON public.pagos_cuotas_aplicaciones
  FOR DELETE TO authenticated
  USING (get_user_rol() = 'admin');

ALTER TABLE public.pagos_cuotas_aplicaciones ENABLE ROW LEVEL SECURITY;
```

**Riesgo de romper la app:** MUY BAJO — la tabla no tiene datos ni escrituras reales en la app (Fase 10K-2 no implementada aún).

**Rollback:**
```sql
-- ROLLBACK SEC-3C.2 — volver a policy amplia
DROP POLICY IF EXISTS pca_select ON public.pagos_cuotas_aplicaciones;
DROP POLICY IF EXISTS pca_insert ON public.pagos_cuotas_aplicaciones;
DROP POLICY IF EXISTS pca_update ON public.pagos_cuotas_aplicaciones;
DROP POLICY IF EXISTS pca_delete ON public.pagos_cuotas_aplicaciones;

CREATE POLICY autenticados_pueden_operar_pca ON public.pagos_cuotas_aplicaciones
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
```

---

## SEC-3D — Migrar `TO public` → `TO authenticated` (higiene)

**Objetivo:** Reemplazar el rol `public` por `authenticated` en todas las policies existentes para mayor claridad y defensa en profundidad.

**⚠️ REQUIERE AUTORIZACIÓN EXPLÍCITA: `APLICAR RLS HIGIENE TO-AUTHENTICATED SEC-3D`**

**Tablas afectadas:** ampliaciones, aportes, cartera_mes, cartera_resumen_mes, configuracion, convenios, creditos, cronograma_cuotas, egresos, pagos_recibos, socios, usuarios, validacion_cuadre_mes, auditoria.

**Patrón de cambio:**
```sql
-- Para cada policy existente con TO public, recrearla con TO authenticated
-- Ejemplo para socios_select:
DROP POLICY IF EXISTS socios_select ON public.socios;
CREATE POLICY socios_select ON public.socios
  FOR SELECT TO authenticated    -- ← cambio: public → authenticated
  USING (auth.uid() IS NOT NULL);
```

**Riesgo:** BAJO — el comportamiento efectivo no cambia (ver análisis en RLS_AUDIT_RESULT.md). Es un cambio cosmético de defensa en profundidad.

**Prioridad:** BAJA — puede hacerse en cualquier momento sin urgencia.

**Rollback:** Recrear las policies con `TO public` (o eliminar el `TO` clause, que en Supabase equivale a `public`).

---

## SEC-3E — Crear migraciones locales para tablas sin archivo

**Objetivo:** Crear archivos SQL locales en `supabase/migrations/` para las 4 tablas que existen en producción sin migración local correspondiente.

**Tablas a sincronizar:**
- `auditoria` — tabla de auditoría de acciones
- `cartera_mes` — datos de cartera por mes
- `cartera_resumen_mes` — resumen de cartera por mes
- `validacion_cuadre_mes` — validación de cuadres contables

**Acción:** Obtener el DDL real de cada tabla con:
```sql
SELECT pg_get_tabledef('public.auditoria');  -- si disponible
-- o usar: supabase db dump --local > /tmp/schema.sql
```

**Riesgo:** NINGUNO — solo crea archivos locales, no modifica la DB.

**Prioridad:** MEDIA — importante para poder hacer `supabase db reset` o migrar de proyecto en el futuro.

---

## SEC-3F — Pruebas por rol (verificación post-cambio)

**Objetivo:** Verificar que después de aplicar SEC-3C, las restricciones funcionan correctamente para cada rol.

**Casos de prueba para `socio_beneficiarios` post-SEC-3C:**

| Rol | SELECT | INSERT | UPDATE | DELETE | Esperado |
|---|---|---|---|---|---|
| admin | ✅ | ✅ | ✅ | ✅ | Acceso completo |
| creditos | ✅ | ✅ | ✅ | ✅ | Puede borrar |
| tesoreria | ✅ | ✅ | ✅ | ❌ | No puede borrar |
| contabilidad | ✅ | ❌ | ❌ | ❌ | Solo lectura |
| anon | ❌ | ❌ | ❌ | ❌ | Sin acceso |

**Casos de prueba para `pagos_cuotas_aplicaciones` post-SEC-3C:**

| Rol | SELECT | INSERT | UPDATE | DELETE | Esperado |
|---|---|---|---|---|---|
| admin | ✅ | ✅ | ✅ | ✅ | Acceso completo |
| tesoreria | ✅ | ✅ | ✅ | ❌ | Puede crear/editar |
| creditos | ✅ | ❌ | ❌ | ❌ | Solo lectura |
| contabilidad | ✅ | ❌ | ❌ | ❌ | Solo lectura |
| anon | ❌ | ❌ | ❌ | ❌ | Sin acceso |

**Script de prueba:** Crear `scripts/test-rls-roles.mjs` que use las credenciales de cada rol para verificar acceso.

---

## Plan de rollback global

Si algo sale mal tras aplicar cualquier cambio de SEC-3C o SEC-3D:

1. **Identificar:** Verificar qué policy causó el problema con:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'socio_beneficiarios';
   ```

2. **Revertir individual:** Cada sub-sección incluye su SQL de rollback específico.

3. **Revertir total:** Si múltiples cambios están en cuestión:
   ```sql
   -- Volver a policy amplia en ambas tablas
   -- [usar rollback individual de cada tabla]
   ```

4. **Verificar:** Tras revertir, ejecutar `npm run check:rls-audit` y `npm run smoke:demo-app`.

---

## Checklist de progreso SEC-3

- [x] SEC-3B: Verificar `get_user_rol()` en producción — **COMPLETADA** (función ya existía como SECURITY DEFINER)
- [x] SEC-3C.1: Corregir policy `socio_beneficiarios` — **APLICADA 2026-07-03** · 41/41 checks ✅
- [x] SEC-3C.2: Corregir policy `pagos_cuotas_aplicaciones` — **APLICADA 2026-07-03** · 41/41 checks ✅
- [ ] SEC-3D: Migrar `TO public` → `TO authenticated` — **requiere: `APLICAR RLS HIGIENE TO-AUTHENTICATED SEC-3D`**
- [ ] SEC-3E: Crear migraciones locales de tablas sin archivo
- [ ] SEC-3F: Pruebas por rol post-aplicación
