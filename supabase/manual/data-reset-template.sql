-- ============================================================
-- data-reset-template.sql
-- PLANTILLA DE LIMPIEZA DE DATOS — CEJUASSA
-- ============================================================
-- ⚠️  NO EJECUTAR SIN AUTORIZACIÓN EXPLÍCITA DEL ADMINISTRADOR
-- ⚠️  ESTE ARCHIVO ES SOLO UNA REFERENCIA / PLANTILLA
-- ⚠️  NO ESTÁ REFERENCIADO POR NINGÚN COMANDO npm
-- ============================================================
--
-- Propósito:
--   Borrar datos operativos de prueba de la base de datos,
--   respetando el orden de FK para evitar errores de constraint.
--
-- Lo que NO toca (NUNCA modificar):
--   - usuarios
--   - configuracion
--   - auth.users (Supabase Auth)
--   - supabase_migrations
--   - Funciones RPC existentes
--
-- Requisito previo:
--   1. Backup confirmado en Supabase Dashboard → Backups
--   2. Revisión de conteos con: npm run plan:data-reset
--   3. Aprobación explícita del administrador
--
-- Rollback:
--   No hay rollback automático para DELETE/TRUNCATE.
--   Solo se puede restaurar desde el backup de Supabase.
--   Por eso el backup previo es OBLIGATORIO.
--
-- ============================================================

-- Ejecutar en Supabase Dashboard → SQL Editor
-- Descomentar cada sección solo después de revisar.

BEGIN;

-- ── PASO 1: Cuotas del cronograma ────────────────────────────────────────────
-- Debe borrarse antes que creditos (FK: cronograma_cuotas.id_credito → creditos.id)
-- DELETE FROM public.cronograma_cuotas;

-- ── PASO 2: Ampliaciones ─────────────────────────────────────────────────────
-- Verificar FK exacta antes de ejecutar (tabla existe pero schema no confirmado en código)
-- DELETE FROM public.ampliaciones;

-- ── PASO 3: Aportes ──────────────────────────────────────────────────────────
-- Depende de socios (id_socio) y pagos_recibos (id_recibo)
-- DELETE FROM public.aportes;

-- ── PASO 4: Recibos de pago ───────────────────────────────────────────────────
-- Depende de socios y creditos
-- DELETE FROM public.pagos_recibos;

-- ── PASO 5: Créditos ─────────────────────────────────────────────────────────
-- Depende de socios
-- DELETE FROM public.creditos;

-- ── PASO 6: Egresos ──────────────────────────────────────────────────────────
-- FK opcional a socios (puede ser NULL)
-- DELETE FROM public.egresos;

-- ── PASO 7: Socios ───────────────────────────────────────────────────────────
-- Tabla raíz operativa — borrar al final de las tablas que dependen de ella
-- DELETE FROM public.socios;

-- ── PASO 8: Convenios ────────────────────────────────────────────────────────
-- Referenciados por socios.id_convenio — borrar solo si se van a recargar
-- DELETE FROM public.convenios;

-- ── PASO 9 (OPCIONAL): Tablas calculadas ─────────────────────────────────────
-- Solo si contienen datos de prueba — revisar con: npm run plan:data-reset
-- DELETE FROM public.cartera_mes;
-- DELETE FROM public.cartera_resumen_mes;
-- DELETE FROM public.validacion_cuadre_mes;

-- ── PASO 10 (REQUIERE DECISIÓN EXPLÍCITA): Auditoría ─────────────────────────
-- Puede tener valor de trazabilidad — no borrar sin autorización del cliente
-- DELETE FROM public.auditoria;

-- ── VERIFICACIÓN INMEDIATA ────────────────────────────────────────────────────
-- Ejecutar después de descomentar y antes de COMMIT:
-- SELECT 'cronograma_cuotas' AS tabla, COUNT(*) FROM public.cronograma_cuotas
-- UNION ALL SELECT 'aportes',      COUNT(*) FROM public.aportes
-- UNION ALL SELECT 'pagos_recibos',COUNT(*) FROM public.pagos_recibos
-- UNION ALL SELECT 'creditos',     COUNT(*) FROM public.creditos
-- UNION ALL SELECT 'egresos',      COUNT(*) FROM public.egresos
-- UNION ALL SELECT 'socios',       COUNT(*) FROM public.socios
-- UNION ALL SELECT 'convenios',    COUNT(*) FROM public.convenios;

-- Si los conteos son 0 → COMMIT
-- Si algo salió mal → ROLLBACK

ROLLBACK; -- ← CAMBIA A COMMIT SOLO CUANDO ESTÉS SEGURO

-- ============================================================
-- IMPORTANTE: Todo está en ROLLBACK por defecto.
-- Cambiar a COMMIT solo después de verificar los conteos.
-- ============================================================
