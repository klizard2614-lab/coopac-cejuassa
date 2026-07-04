-- ============================================================
-- RPC B: registrar_aporte_socio
-- Estado:  PROPUESTA — NO APLICADA EN SUPABASE
-- Riesgo:  R6 — race condition en saldo de aportes
-- Revisión: Opus (2026-06-17)
-- ============================================================
--
-- Propósito:
--   Registrar un aporte de socio de forma atómica, calculando
--   el saldo acumulado sin race condition.
--   Usa pg_advisory_xact_lock para serializar inserts del mismo socio.
--
-- Tablas afectadas:
--   aportes (SELECT para leer último saldo + INSERT nuevo registro)
--
-- Parámetros:
--   p_id_socio      BIGINT   — id del socio
--   p_id_recibo     BIGINT   — id del recibo de pago asociado
--   p_fecha         DATE     — fecha del aporte
--   p_monto         NUMERIC  — monto del aporte (debe ser > 0)
--   p_observacion   TEXT     — observación opcional (puede ser NULL)
--
-- Retorna:
--   bigint — id del registro creado en la tabla aportes
--
-- Errores de negocio (código P0001):
--   - 'monto_invalido' si p_monto <= 0
--
-- Notas de diseño (Opus):
--   - pg_advisory_xact_lock serializa las transacciones del mismo socio.
--     El lock se libera automáticamente al final de la transacción.
--   - ORDER BY created_at DESC, id DESC garantiza determinismo si hay
--     dos aportes en el mismo segundo (el de mayor id es el más reciente).
--   - COALESCE(..., 0) maneja el caso de primer aporte del socio (sin historial).
--
-- NOTA IMPORTANTE para integración:
--   Esta RPC reemplaza el bloque de código en pagos/nuevo/page.tsx
--   (líneas 312-340) que actualmente:
--     1. Lee el último saldo con ORDER BY created_at DESC LIMIT 1
--     2. Calcula saldoNuevo = saldoAnterior + montoAporte
--     3. Inserta directamente en aportes
--   Ese bloque debe ser reemplazado por una llamada a esta RPC.
--   Ver Fase 4B-3.
-- ============================================================

CREATE OR REPLACE FUNCTION registrar_aporte_socio(
  p_id_socio     BIGINT,
  p_id_recibo    BIGINT,
  p_fecha        DATE,
  p_monto        NUMERIC,
  p_observacion  TEXT DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  v_saldo_anterior  NUMERIC;
  v_saldo_nuevo     NUMERIC;
  v_id_aporte       BIGINT;
BEGIN
  -- Validar que el monto sea positivo
  IF p_monto <= 0 THEN
    RAISE EXCEPTION 'monto_invalido: el monto del aporte debe ser mayor a 0, recibido: %', p_monto;
  END IF;

  -- Advisory lock por socio: serializa transacciones del mismo p_id_socio
  -- El lock se libera automáticamente al terminar la transacción
  PERFORM pg_advisory_xact_lock(p_id_socio);

  -- Leer el saldo más reciente del socio
  -- ORDER BY created_at DESC, id DESC: determinista si hay 2 registros en el mismo segundo
  SELECT COALESCE(saldo_nuevo, 0)
    INTO v_saldo_anterior
    FROM aportes
   WHERE id_socio = p_id_socio
   ORDER BY created_at DESC, id DESC
   LIMIT 1;

  -- COALESCE para primer aporte (sin historial previo)
  v_saldo_anterior := COALESCE(v_saldo_anterior, 0);
  v_saldo_nuevo    := v_saldo_anterior + p_monto;

  -- Insertar el nuevo aporte
  INSERT INTO aportes (
    id_socio,
    id_recibo,
    fecha,
    tipo,
    monto,
    saldo_anterior,
    saldo_nuevo,
    observacion
  ) VALUES (
    p_id_socio,
    p_id_recibo,
    p_fecha,
    'aporte',
    p_monto,
    v_saldo_anterior,
    v_saldo_nuevo,
    p_observacion
  )
  RETURNING id INTO v_id_aporte;

  RETURN v_id_aporte;
END;
$$;

-- ============================================================
-- ROLLBACK (para deshacer esta función si algo sale mal):
-- DROP FUNCTION IF EXISTS registrar_aporte_socio(BIGINT, BIGINT, DATE, NUMERIC, TEXT);
-- ============================================================
