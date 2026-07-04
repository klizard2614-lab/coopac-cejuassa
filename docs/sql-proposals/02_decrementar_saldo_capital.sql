-- ============================================================
-- RPC A: decrementar_saldo_capital
-- Estado:  PROPUESTA — NO APLICADA EN SUPABASE
-- Riesgo:  R5 — race condition en saldo_capital
-- Revisión: Opus (2026-06-17)
-- ============================================================
--
-- Propósito:
--   Decrementar saldo_capital de un crédito de forma atómica.
--   El UPDATE de PostgreSQL adquiere un row-level lock implícito,
--   eliminando la race condition del fallback actual en el frontend.
--
-- Tabla afectada:
--   creditos (UPDATE en fila específica por id)
--
-- Parámetros:
--   p_id_credito  BIGINT  — id del crédito a actualizar
--   p_monto       NUMERIC — monto a decrementar (debe ser > 0)
--
-- Retorna:
--   numeric — saldo_capital resultante después del decremento
--
-- Errores de negocio (código P0001, no caen al fallback):
--   - 'monto_invalido'    si p_monto <= 0
--   - 'credito_no_encontrado' si no existe el crédito con ese id
--   - 'sobrepago'         si p_monto > saldo_capital actual
--
-- ADVERTENCIA CRÍTICA antes de aplicar:
--   El frontend en pagos/nuevo/page.tsx tiene un fallback que se activa
--   con CUALQUIER error de la RPC (líneas 251-267).
--   Si esta RPC lanza 'sobrepago' o 'monto_invalido', el fallback
--   ejecutaría un UPDATE directo con Math.max(0,...) — comportamiento
--   incorrecto para errores de negocio.
--
--   ANTES de aplicar esta RPC, el frontend DEBE ser corregido para
--   distinguir error code '42883' (función no existe) de 'P0001'
--   (error de negocio de la RPC). Ver Fase 4B-1.
-- ============================================================

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
  -- Validar que el monto sea positivo
  IF p_monto <= 0 THEN
    RAISE EXCEPTION 'monto_invalido: el monto debe ser mayor a 0, recibido: %', p_monto;
  END IF;

  -- Leer y bloquear la fila del crédito (FOR UPDATE adquiere row lock)
  SELECT saldo_capital
    INTO v_saldo_actual
    FROM creditos
   WHERE id = p_id_credito
     FOR UPDATE;

  -- Verificar que el crédito existe
  IF NOT FOUND THEN
    RAISE EXCEPTION 'credito_no_encontrado: no existe credito con id %', p_id_credito;
  END IF;

  -- Verificar que no hay sobrepago
  IF p_monto > v_saldo_actual THEN
    RAISE EXCEPTION 'sobrepago: monto % supera saldo_capital actual % para credito %',
      p_monto, v_saldo_actual, p_id_credito;
  END IF;

  -- Calcular saldo nuevo (sin GREATEST — si hay sobrepago, ya se lanzó excepción)
  v_saldo_nuevo := v_saldo_actual - p_monto;

  -- Actualizar el saldo
  UPDATE creditos
     SET saldo_capital = v_saldo_nuevo
   WHERE id = p_id_credito;

  RETURN v_saldo_nuevo;
END;
$$;

-- ============================================================
-- ROLLBACK (para deshacer esta función si algo sale mal):
-- DROP FUNCTION IF EXISTS decrementar_saldo_capital(BIGINT, NUMERIC);
-- ============================================================
