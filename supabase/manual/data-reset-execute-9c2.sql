-- ============================================================
-- data-reset-execute-9c2.sql
-- LIMPIEZA REAL DE DATOS OPERATIVOS — CEJUASSA — Fase 9C-2
-- ============================================================
-- ⚠️  ACCIÓN DESTRUCTIVA E IRREVERSIBLE
-- ⚠️  Solo ejecutar con autorización explícita del administrador
-- ⚠️  El backup en backups/data-reset/20260620-1327/ fue verificado
--      con 27/27 checks PASS antes de generar este archivo.
-- ============================================================
--
-- Backup confirmado (Fase 9C-1 — 2026-06-20):
--   Ruta:    backups/data-reset/20260620-1327/
--   Conteos: socios=434, creditos=431, pagos_recibos=401, aportes=1
--   Total:   1267 registros respaldados
--   Check:   27/27 PASS (npm run check:operational-backup)
--
-- Cómo ejecutar:
--   1. Ir a Supabase Dashboard → SQL Editor
--      (proyecto ljdjbhsipgkxlgnprzhm)
--   2. Pegar este SQL completo
--   3. Ejecutar → verificar que los SELECTs de conteo muestran 0
--   4. Si todo es 0 → cambiar ROLLBACK por COMMIT y ejecutar de nuevo
--   5. Si algo salió mal → mantener ROLLBACK (no se pierde nada)
--
-- Lo que NO toca este script (NUNCA):
--   - public.usuarios         (acceso a la app — conservado intacto)
--   - public.configuracion    (config cooperativa — conservada intacta)
--   - auth.users              (Supabase Auth — no accesible por SQL)
--   - supabase_migrations     (historial de migraciones)
--   - Funciones RPC           (decrementar_saldo_capital, etc.)
--   - Estructura de tablas    (sin DROP TABLE ni ALTER)
--
-- ============================================================

BEGIN;

-- ── CONTEOS ANTES DEL BORRADO ────────────────────────────────────────────────
-- Verificar que los conteos coinciden con el backup antes de proceder.

SELECT
  'ANTES DEL BORRADO' AS momento,
  'cronograma_cuotas' AS tabla, COUNT(*) AS registros FROM public.cronograma_cuotas
UNION ALL SELECT 'ANTES', 'ampliaciones',   COUNT(*) FROM public.ampliaciones
UNION ALL SELECT 'ANTES', 'aportes',        COUNT(*) FROM public.aportes
UNION ALL SELECT 'ANTES', 'pagos_recibos',  COUNT(*) FROM public.pagos_recibos
UNION ALL SELECT 'ANTES', 'creditos',       COUNT(*) FROM public.creditos
UNION ALL SELECT 'ANTES', 'egresos',        COUNT(*) FROM public.egresos
UNION ALL SELECT 'ANTES', 'socios',         COUNT(*) FROM public.socios
UNION ALL SELECT 'ANTES', 'convenios',      COUNT(*) FROM public.convenios
UNION ALL SELECT 'ANTES — CONSERVADA', 'usuarios',      COUNT(*) FROM public.usuarios
UNION ALL SELECT 'ANTES — CONSERVADA', 'configuracion', COUNT(*) FROM public.configuracion;

-- ── PASO 1: Cuotas del cronograma ────────────────────────────────────────────
-- FK: cronograma_cuotas.id_credito → creditos.id
-- Debe borrarse ANTES que creditos.
DELETE FROM public.cronograma_cuotas;

-- ── PASO 2: Ampliaciones ─────────────────────────────────────────────────────
-- FK: ampliaciones.id_credito → creditos.id (confirmado: tabla existe, 0 registros)
-- Debe borrarse ANTES que creditos.
DELETE FROM public.ampliaciones;

-- ── PASO 3: Aportes ──────────────────────────────────────────────────────────
-- FK: aportes.id_socio → socios.id  y  aportes.id_recibo → pagos_recibos.id
-- Debe borrarse ANTES que socios y pagos_recibos.
DELETE FROM public.aportes;

-- ── PASO 4: Recibos de pago ──────────────────────────────────────────────────
-- FK: pagos_recibos.id_socio → socios.id  y  pagos_recibos.id_credito → creditos.id
-- Debe borrarse ANTES que socios y creditos.
DELETE FROM public.pagos_recibos;

-- ── PASO 5: Créditos ─────────────────────────────────────────────────────────
-- FK: creditos.id_socio → socios.id
-- Debe borrarse ANTES que socios.
DELETE FROM public.creditos;

-- ── PASO 6: Egresos ──────────────────────────────────────────────────────────
-- FK: egresos.id_socio → socios.id (nullable — puede tener NULL)
-- Puede borrarse antes o después de socios.
DELETE FROM public.egresos;

-- ── PASO 7: Socios ───────────────────────────────────────────────────────────
-- Tabla raíz operativa. Borrar DESPUÉS de todas las tablas que la referencian.
DELETE FROM public.socios;

-- ── PASO 8: Convenios ────────────────────────────────────────────────────────
-- FK inversa: socios.id_convenio → convenios.id
-- Ya no hay socios que la referencien — seguro borrar.
DELETE FROM public.convenios;

-- ── CONTEOS DESPUÉS DEL BORRADO ──────────────────────────────────────────────
-- Todos deben ser 0. usuarios y configuracion deben seguir con registros.

SELECT
  'DESPUES DEL BORRADO' AS momento,
  'cronograma_cuotas' AS tabla, COUNT(*) AS registros FROM public.cronograma_cuotas
UNION ALL SELECT 'DESPUES', 'ampliaciones',   COUNT(*) FROM public.ampliaciones
UNION ALL SELECT 'DESPUES', 'aportes',        COUNT(*) FROM public.aportes
UNION ALL SELECT 'DESPUES', 'pagos_recibos',  COUNT(*) FROM public.pagos_recibos
UNION ALL SELECT 'DESPUES', 'creditos',       COUNT(*) FROM public.creditos
UNION ALL SELECT 'DESPUES', 'egresos',        COUNT(*) FROM public.egresos
UNION ALL SELECT 'DESPUES', 'socios',         COUNT(*) FROM public.socios
UNION ALL SELECT 'DESPUES', 'convenios',      COUNT(*) FROM public.convenios
UNION ALL SELECT 'DESPUES — DEBE CONSERVARSE', 'usuarios',      COUNT(*) FROM public.usuarios
UNION ALL SELECT 'DESPUES — DEBE CONSERVARSE', 'configuracion', COUNT(*) FROM public.configuracion;

-- ── DECISIÓN FINAL ────────────────────────────────────────────────────────────
-- Si los conteos DESPUÉS son todos 0 para tablas operativas
-- Y usuarios y configuracion siguen con registros > 0:
--   → Cambiar ROLLBACK por COMMIT y ejecutar de nuevo.
-- Si algo salió mal o hay dudas:
--   → Mantener ROLLBACK (no se pierde nada, la transacción se deshace).

ROLLBACK; -- ← CAMBIAR A COMMIT SOLO CUANDO SE VERIFIQUEN LOS CONTEOS

-- ============================================================
-- DESPUÉS DE EJECUTAR (si se hizo COMMIT):
--   npm run plan:data-reset           → debe mostrar 0 en todas las tablas operativas
--   npm run check:operational-backup  → backup sigue válido
--   npm run check:data-reset-plan     → plan sigue siendo seguro
--   npm run verify:cejuassa           → tsc + build deben seguir OK
-- ============================================================
