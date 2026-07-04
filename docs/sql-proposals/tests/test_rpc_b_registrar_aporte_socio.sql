-- ============================================================
-- Script de pruebas: registrar_aporte_socio (RPC B)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- DESPUÉS de aplicar supabase/migrations/20260617000001_create_registrar_aporte_socio.sql
-- ============================================================
-- INSTRUCCIONES:
--   1. Reemplaza ID_SOCIO_AQUI con el id de un socio de prueba SIN aportes previos.
--   2. Reemplaza ID_RECIBO_AQUI con el id de un recibo de pago existente (o usa 1 como referencia).
--   3. Ejecuta cada bloque por separado para ver el resultado paso a paso.
--   4. Al final, limpia los registros de prueba con el bloque de cleanup.
-- ============================================================

-- ── VERIFICACIÓN PREVIA ───────────────────────────────────────────────────────

-- Confirmar que la función existe
SELECT routine_name, routine_type
  FROM information_schema.routines
 WHERE routine_schema = 'public'
   AND routine_name = 'registrar_aporte_socio';
-- Esperado: 1 fila con routine_type = 'FUNCTION'

-- Confirmar estado de aportes previos del socio de prueba
SELECT COUNT(*) AS aportes_previos
  FROM aportes
 WHERE id_socio = ID_SOCIO_AQUI;
-- Esperado: 0 para prueba limpia (si es socio nuevo)

-- ── CASO 1: Primer aporte del socio (sin historial) ──────────────────────────

SELECT registrar_aporte_socio(
  ID_SOCIO_AQUI,   -- p_id_socio
  ID_RECIBO_AQUI,  -- p_id_recibo
  CURRENT_DATE,    -- p_fecha
  100.00,          -- p_monto
  'prueba caso 1'  -- p_observacion
) AS id_aporte_creado;
-- Esperado: devuelve un BIGINT (el id del nuevo registro en aportes)

-- Verificar el registro creado
SELECT id, id_socio, monto, saldo_anterior, saldo_nuevo, tipo, observacion
  FROM aportes
 WHERE id_socio = ID_SOCIO_AQUI
 ORDER BY id DESC
 LIMIT 1;
-- Esperado:
--   saldo_anterior = 0.00  (primer aporte, sin historial)
--   saldo_nuevo    = 100.00
--   tipo           = 'aporte'

-- ── CASO 2: Segundo aporte del mismo socio (acumulativo) ─────────────────────

SELECT registrar_aporte_socio(
  ID_SOCIO_AQUI,
  ID_RECIBO_AQUI,
  CURRENT_DATE,
  50.00,
  'prueba caso 2'
) AS id_aporte_creado;

SELECT id, monto, saldo_anterior, saldo_nuevo
  FROM aportes
 WHERE id_socio = ID_SOCIO_AQUI
 ORDER BY id DESC
 LIMIT 1;
-- Esperado:
--   saldo_anterior = 100.00  (saldo_nuevo del caso 1)
--   saldo_nuevo    = 150.00

-- ── CASO 3: Monto cero — debe fallar ─────────────────────────────────────────

SELECT registrar_aporte_socio(
  ID_SOCIO_AQUI,
  ID_RECIBO_AQUI,
  CURRENT_DATE,
  0,
  NULL
);
-- Esperado: ERROR P0001 — monto_invalido: el monto del aporte debe ser mayor a 0, recibido: 0

-- Verificar que NO se insertó ningún registro adicional
SELECT COUNT(*) AS total_aportes
  FROM aportes
 WHERE id_socio = ID_SOCIO_AQUI;
-- Esperado: 2 (solo los casos 1 y 2)

-- ── CASO 4: Monto negativo — debe fallar ─────────────────────────────────────

SELECT registrar_aporte_socio(
  ID_SOCIO_AQUI,
  ID_RECIBO_AQUI,
  CURRENT_DATE,
  -10.00,
  NULL
);
-- Esperado: ERROR P0001 — monto_invalido

-- ── CASO 5: Tercer aporte — verifica acumulación correcta ────────────────────

SELECT registrar_aporte_socio(
  ID_SOCIO_AQUI,
  ID_RECIBO_AQUI,
  CURRENT_DATE,
  25.50,
  'prueba caso 5'
);

SELECT saldo_anterior, saldo_nuevo FROM aportes
 WHERE id_socio = ID_SOCIO_AQUI ORDER BY id DESC LIMIT 1;
-- Esperado: saldo_anterior=150.00, saldo_nuevo=175.50

-- ── VERIFICACIÓN FINAL ────────────────────────────────────────────────────────

SELECT id, monto, saldo_anterior, saldo_nuevo, observacion
  FROM aportes
 WHERE id_socio = ID_SOCIO_AQUI
 ORDER BY id ASC;
-- Esperado: 3 filas — historial de saldos coherente y creciente

-- ── CLEANUP — limpiar registros de prueba ────────────────────────────────────
-- ADVERTENCIA: ejecutar solo si los registros anteriores son datos de prueba
-- DELETE FROM aportes WHERE id_socio = ID_SOCIO_AQUI AND observacion LIKE 'prueba%';
