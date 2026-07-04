-- Migration: create_registrar_aporte_socio
-- Estado: PENDIENTE — no aplicada todavía en Supabase
-- Resuelve: R6 — race condition en saldo de aportes
-- Fase: 4B-3B (frontend refactor) depende de que esta migración esté aplicada primero
-- Ver propuesta original: docs/sql-proposals/01_registrar_aporte_socio.sql
-- Ver pruebas: docs/sql-proposals/tests/test_rpc_b_registrar_aporte_socio.sql
-- IMPORTANTE: aplicar ANTES de refactorizar app/dashboard/pagos/nuevo/page.tsx
-- Rollback: DROP FUNCTION IF EXISTS registrar_aporte_socio(BIGINT, BIGINT, DATE, NUMERIC, TEXT);

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
  IF p_monto <= 0 THEN
    RAISE EXCEPTION 'monto_invalido: el monto del aporte debe ser mayor a 0, recibido: %', p_monto;
  END IF;

  PERFORM pg_advisory_xact_lock(p_id_socio);

  SELECT COALESCE(saldo_nuevo, 0)
    INTO v_saldo_anterior
    FROM aportes
   WHERE id_socio = p_id_socio
   ORDER BY created_at DESC, id DESC
   LIMIT 1;

  v_saldo_anterior := COALESCE(v_saldo_anterior, 0);
  v_saldo_nuevo    := v_saldo_anterior + p_monto;

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
