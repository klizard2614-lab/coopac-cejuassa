-- Migration: create_decrementar_saldo_capital
-- Estado: APLICADA en Supabase (2026-06-17) — registro histórico
-- Resuelve: R5 — race condition en saldo_capital
-- Probada: monto válido ✓, monto 0 ✗, negativo ✗, sobrepago ✗, app ✓
-- Ver propuesta original: docs/sql-proposals/02_decrementar_saldo_capital.sql
-- Rollback: DROP FUNCTION IF EXISTS decrementar_saldo_capital(BIGINT, NUMERIC);

CREATE OR REPLACE FUNCTION decrementar_saldo_capital(
  p_id_credito  BIGINT,
  p_monto       NUMERIC
)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  v_saldo_actual   NUMERIC;
  v_saldo_nuevo    NUMERIC;
BEGIN
  IF p_monto <= 0 THEN
    RAISE EXCEPTION 'monto_invalido: el monto debe ser mayor a 0, recibido: %', p_monto;
  END IF;

  SELECT saldo_capital
    INTO v_saldo_actual
    FROM creditos
   WHERE id = p_id_credito
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'credito_no_encontrado: no existe credito con id %', p_id_credito;
  END IF;

  IF p_monto > v_saldo_actual THEN
    RAISE EXCEPTION 'sobrepago: monto % supera saldo_capital actual % para credito %',
      p_monto, v_saldo_actual, p_id_credito;
  END IF;

  v_saldo_nuevo := v_saldo_actual - p_monto;

  UPDATE creditos
     SET saldo_capital = v_saldo_nuevo
   WHERE id = p_id_credito;

  RETURN v_saldo_nuevo;
END;
$$;
