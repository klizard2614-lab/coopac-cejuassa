# SECURITY_BACKUP_AND_RECOVERY_RUNBOOK.md

> **Fase SEC-5 — Procedimientos de seguridad operacional para CEJUASSA**
> Fecha: 2026-07-03
> Clasificación: SOLO USO INTERNO
> Este documento NO ejecuta backups — es solo un runbook de procedimientos.

---

## Índice

1. [Checklist antes de aplicar migraciones](#1-checklist-antes-de-migraciones)
2. [Procedimiento de backup manual](#2-backup-manual)
3. [Export de tablas críticas](#3-export-de-tablas-críticas)
4. [Procedimiento de rollback](#4-rollback)
5. [Qué hacer si falla RLS](#5-falla-rls)
6. [Qué hacer si falla una migración](#6-falla-migración)
7. [Qué hacer si un usuario pierde acceso](#7-usuario-pierde-acceso)
8. [Checklist antes de demo](#8-checklist-demo)
9. [Checklist antes de producción](#9-checklist-producción)

---

## 1. Checklist antes de migraciones

Ejecutar **ANTES** de cualquier `npx supabase db push` o cambio en Supabase Dashboard:

```
[ ] 1. Leer la migración completa (confirmar que no hay DROP TABLE, DELETE, TRUNCATE inesperados)
[ ] 2. Ejecutar el check asociado: npm run check:<fase>
[ ] 3. Ejecutar: npm run verify:cejuassa (lint + tsc + build debe pasar)
[ ] 4. Hacer backup de las tablas afectadas (ver sección 2)
[ ] 5. Confirmar autorización explícita del usuario: "APLICAR <FASE>"
[ ] 6. En Supabase Dashboard: verificar que el proyecto ljdjbhsipgkxlgnprzhm está activo
[ ] 7. Ejecutar: npx supabase db push --dry-run PRIMERO (ver qué aplicará)
[ ] 8. Si dry-run muestra más de lo esperado: DETENER y revisar
[ ] 9. Aplicar solo si el dry-run muestra exactamente la(s) migración(es) esperadas
[ ] 10. Post-apply: ejecutar npx supabase migration list y verificar sincronía Local + Remote
```

---

## 2. Backup manual

### Tablas críticas a respaldar antes de cambios en DB

| Tabla | Criticidad | Script disponible |
|-------|-----------|-------------------|
| `socios` | 🔴 ALTA | `npm run backup:operational-data` |
| `creditos` | 🔴 ALTA | `npm run backup:operational-data` |
| `pagos_recibos` | 🔴 ALTA | `npm run backup:operational-data` |
| `aportes` | 🔴 ALTA | `npm run backup:operational-data` |
| `cronograma_cuotas` | 🟡 MEDIA | Manual (ver abajo) |
| `auditoria` | 🟡 MEDIA | Manual |
| `configuracion` | 🟡 MEDIA | Manual |
| `usuarios` | 🔴 ALTA | Manual (contiene emails de usuarios reales) |

### Script automático disponible

```bash
npm run backup:operational-data
# Genera backup en backups/operational/<timestamp>/
```

### Backup manual vía Supabase CLI

```bash
# Export completo de una tabla
npx supabase db dump --data-only --table socios > backups/manual/socios_$(date +%Y%m%d_%H%M).sql

# Export de todas las tablas (schema + data)
npx supabase db dump > backups/manual/full_$(date +%Y%m%d_%H%M).sql
```

### Backups existentes

| Directorio | Contenido | Fecha |
|-----------|-----------|-------|
| `backups/data-reset/20260620-1327/` | socios, creditos, pagos, aportes, cronograma, egresos, convenios, ampliaciones | 2026-06-20 |
| `backups/demo-data-fill/2026-06-23T02-18/` | socios, creditos (antes de campos demo genero/estado_civil) | 2026-06-23 |

---

## 3. Export de tablas críticas

### Export via Supabase Dashboard (sin CLI)

1. Ir a Supabase Dashboard → proyecto `ljdjbhsipgkxlgnprzhm`
2. Table Editor → seleccionar tabla
3. Export → CSV o JSON
4. Guardar en `backups/manual/` con nombre descriptivo y fecha

### Export mínimo antes de SEC-4B (audit log)

Antes de aplicar `APLICAR AUDIT LOG SEC-4B`, exportar:

```bash
# Via CLI
npx supabase db dump --data-only --table auditoria > backups/manual/auditoria_pre_sec4b.sql
```

Si la tabla está vacía (0 registros): no es crítico, pero exportar igual por consistencia.

---

## 4. Rollback

### Rollback de migración reciente

Cada migración de seguridad tiene su sección de ROLLBACK documentada como comentario SQL:

| Migración | Rollback documentado en |
|-----------|------------------------|
| `20260702000010_sec3c_rls_hardening.sql` | Sección `-- ROLLBACK` en el mismo archivo |
| `20260703120000_sec3e_auditoria_baseline.sql` | Sección `-- ROLLBACK` en el mismo archivo |
| `20260703130000_sec4b_audit_log_implementation.sql` | Sección `-- ROLLBACK` en el mismo archivo |

### Proceso de rollback manual

```
1. Leer la sección ROLLBACK del archivo de migración
2. Copiar el SQL de rollback (sin los comentarios --)
3. Ejecutar en Supabase Dashboard → SQL Editor
4. Verificar que la tabla/función/policy fue restaurada
5. Ejecutar: npx supabase migration repair --status reverted <timestamp>
   (para marcar la migración como no aplicada en el historial local)
6. Ejecutar: npm run verify:cejuassa
7. Documentar el rollback en RISKS_AND_BUGS.md
```

### Emergencia: restaurar desde backup JSON

```bash
# Ejemplo: restaurar socios desde backup JSON
# (requiere script o import manual via Dashboard)
# Los backups JSON están en backups/data-reset/20260620-1327/socios.json
```

---

## 5. Falla RLS

**Síntoma:** Un usuario puede acceder o modificar datos que no debería.

### Diagnóstico

```sql
-- Verificar RLS activo en la tabla afectada
SELECT relrowsecurity FROM pg_class
WHERE relname = '<tabla>' AND relnamespace = 'public'::regnamespace;

-- Ver policies actuales
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE tablename = '<tabla>' AND schemaname = 'public';
```

### Pasos de respuesta

```
1. INMEDIATO: Si el fallo permite escritura no autorizada → revocar permisos temporalmente
   (en Dashboard: Table Editor → RLS → Enable/Disable por tabla)
2. Identificar qué policy permite el acceso no deseado
3. Revisar si get_user_rol() retorna el valor esperado para el usuario afectado
4. Aplicar corrección en Dashboard → SQL Editor
5. Ejecutar: npm run check:rls-sec3c (y otros checks RLS relevantes)
6. Documentar en RISKS_AND_BUGS.md
```

### Rollback de emergencia de policies granulares

Si las policies granulares de SEC-3C fallan, restaurar a la policy amplia temporal:

```sql
-- EMERGENCIA SOLO — restaurar policy amplia en tabla afectada
-- Reemplazar <tabla> con: socio_beneficiarios o pagos_cuotas_aplicaciones
DROP POLICY IF EXISTS sb_select ON public.<tabla>;
DROP POLICY IF EXISTS sb_insert ON public.<tabla>;
DROP POLICY IF EXISTS sb_update ON public.<tabla>;
DROP POLICY IF EXISTS sb_delete ON public.<tabla>;

CREATE POLICY autenticados_emergencia ON public.<tabla>
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
```

---

## 6. Falla una migración

**Síntoma:** `npx supabase db push` falla con error.

### Pasos de respuesta

```
1. Leer el error completo (Supabase muestra qué falló)
2. Verificar: ¿la migración se aplicó parcialmente?
   → En Dashboard: SQL Editor → ejecutar SELECT para ver si la tabla/columna existe
3. Si se aplicó parcialmente:
   a. Ejecutar manualmente el rollback de esa migración
   b. Marcar en historial: npx supabase migration repair --status reverted <timestamp>
4. Si NO se aplicó (error antes de BEGIN):
   a. Corregir el error en el archivo .sql local
   b. Volver a intentar push
5. Nunca forzar con --force si no se entiende el error
6. Documentar en RISKS_AND_BUGS.md con fecha y resolución
```

### Patrón conocido — conflict de firma en RPC

Ver `RISKS_AND_BUGS.md` sección "Patrón conocido — RPC signature conflict":
- `CREATE OR REPLACE FUNCTION` falla si cambia la firma de una RPC existente
- Solución: `DROP FUNCTION IF EXISTS` primero, luego `CREATE OR REPLACE`

---

## 7. Usuario pierde acceso

**Síntoma:** Un usuario no puede iniciar sesión o ve "Acceso Denegado" inesperado.

### Diagnóstico

```bash
# Verificar estado del usuario en la tabla usuarios
# (ejecutar en SQL Editor del Dashboard)
SELECT id, email, rol, activo FROM public.usuarios WHERE email = '<email>';
```

### Escenarios y solución

| Escenario | Síntoma | Solución |
|-----------|---------|---------|
| Usuario desactivado (`activo = false`) | Acceso Denegado en login | Admin activa desde `/dashboard/usuarios` |
| Rol incorrecto | Ve páginas equivocadas | Admin edita rol desde `/dashboard/usuarios` |
| Usuario no existe en `usuarios` (solo en `auth.users`) | Login OK pero app cuelga | Insertar registro en `public.usuarios` manualmente |
| Supabase Auth bloqueado | No puede hacer login | Verificar en Dashboard → Authentication → Users |

### Acceso de emergencia (admin bloqueado)

Si el único admin pierde acceso:

```sql
-- Desde Dashboard → SQL Editor (con service role)
-- Verificar usuario en auth
SELECT id, email, banned_until FROM auth.users WHERE email = '<admin_email>';

-- Si activo=false en tabla usuarios:
UPDATE public.usuarios SET activo = true WHERE email = '<admin_email>';

-- Si rol incorrecto:
UPDATE public.usuarios SET rol = 'admin' WHERE email = '<admin_email>';
```

---

## 8. Checklist antes de demo

```
[ ] 1. npm run verify:cejuassa → LINT OK + TYPECHECK OK + BUILD OK
[ ] 2. npm run smoke:demo-app → 28/28 PASS
[ ] 3. npm run audit:ui-roles → 34/34 PASS
[ ] 4. npm run smoke:report-exports → PASS (3 WARN demo esperados)
[ ] 5. Variables de entorno: NEXT_PUBLIC_SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY — todas SET
[ ] 6. Banner DEMO visible en BDCC y Anexo 6 (datos no oficiales)
[ ] 7. Confirmar que no hay datos de prueba residuales (socios/pagos TEST)
[ ] 8. Confirmar que el servidor dev está corriendo: npm run dev
[ ] 9. Probar login con las credenciales del usuario demo
[ ] 10. Navegar manualmente por: Dashboard → Socios → Créditos → Pagos → Reportes
```

---

## 9. Checklist antes de producción

```
[ ] 1. Todas las fases de seguridad completadas: SEC-1, SEC-2, SEC-3C (✅) + SEC-3E, SEC-4B (pendientes)
[ ] 2. CSP activa (no Report-Only) — requiere SEC-1B
[ ] 3. Rate limiting en API routes — requiere infra Redis (SEC-2.4)
[ ] 4. Datos reales de socios: género, estado civil, subtipo_credito_sbs confirmados
[ ] 5. DNI SINDNI corregido (1 socio pendiente)
[ ] 6. match_medio resuelto (3 pagos pendientes con área de Créditos)
[ ] 7. Backup verificado y accesible antes del go-live
[ ] 8. Credenciales de producción diferentes a las de desarrollo
[ ] 9. SUPABASE_SERVICE_ROLE_KEY rotada si fue expuesta en algún momento
[ ] 10. npm audit --audit-level=moderate → revisar vulnerabilidades pendientes (xlsx HIGH)
[ ] 11. Prueba de carga mínima: verificar que la app responde con los 782 socios reales
[ ] 12. Documentar URL de producción y credenciales de acceso en canal seguro (no en código)
[ ] 13. Notificar a los usuarios finales (Tesorería, Contabilidad, Créditos) con instrucciones de acceso
```

---

## Comandos de diagnóstico rápido

```bash
# Estado general
npm run verify:cejuassa

# Estado de migraciones (Local vs Remote)
npx supabase migration list

# Auditoría de seguridad
npm run check:security-audit
npm run check:security-sec1
npm run check:security-api
npm run check:rls-sec3c

# Smoke tests
npm run smoke:demo-app
npm run smoke:report-exports
npm run audit:ui-roles

# npm vulnerabilidades
npm audit --audit-level=moderate
```
