-- ============================================================
-- RPC C: crear_credito_con_cronograma
-- Migración: 20260617000002
-- Estado:  PENDIENTE DE APLICAR — NO APLICAR SIN REVISAR
-- Riesgo:  R8 — crédito sin cronograma si el bulk insert falla
-- Revisión: Opus (2026-06-17), fix capital_pagado/interes_pagado (2026-06-17)
-- ============================================================
--
-- Propósito:
--   Crear un crédito y su cronograma de cuotas en una sola transacción.
--   Si el insert de cuotas falla, PostgreSQL hace rollback del crédito.
--   Elimina el riesgo de créditos huérfanos (sin cronograma).
--
-- Tablas afectadas:
--   creditos          (INSERT)
--   cronograma_cuotas (INSERT múltiple)
--
-- Firma:
--   crear_credito_con_cronograma(p_credito JSONB, p_cuotas JSONB) RETURNS bigint
--
-- Errores de negocio (código P0001):
--   - 'cuotas_no_es_array'         si p_cuotas no es un array JSON
--   - 'longitud_cuotas_incorrecta'  si jsonb_array_length(p_cuotas) != plazo_meses
--
-- ============================================================

CREATE OR REPLACE FUNCTION crear_credito_con_cronograma(
  p_credito  JSONB,
  p_cuotas   JSONB
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  v_id_credito   BIGINT;
  v_plazo_meses  INT;
  v_cuota        JSONB;
BEGIN
  -- Extraer plazo_meses para validación
  v_plazo_meses := (p_credito->>'plazo_meses')::INT;

  -- Validar que p_cuotas sea un array JSON
  IF jsonb_typeof(p_cuotas) != 'array' THEN
    RAISE EXCEPTION 'cuotas_no_es_array: p_cuotas debe ser un array JSON';
  END IF;

  -- Validar que la longitud del array coincida con plazo_meses
  IF jsonb_array_length(p_cuotas) != v_plazo_meses THEN
    RAISE EXCEPTION 'longitud_cuotas_incorrecta: se esperaban % cuotas, se recibieron %',
      v_plazo_meses, jsonb_array_length(p_cuotas);
  END IF;

  -- Insertar el crédito
  INSERT INTO creditos (
    id_socio,
    nro_pagare,
    fecha_desembolso,
    monto_aprobado,
    monto_girado_neto,
    descuento_fps,
    descuento_seguro,
    descuento_otros,
    tasa_interes,
    plazo_meses,
    cuota_mensual,
    tipo_credito,
    saldo_capital,
    interes_acumulado,
    estado
  ) VALUES (
    (p_credito->>'id_socio')::BIGINT,
    p_credito->>'nro_pagare',
    (p_credito->>'fecha_desembolso')::DATE,
    (p_credito->>'monto_aprobado')::NUMERIC,
    (p_credito->>'monto_girado_neto')::NUMERIC,
    COALESCE(NULLIF(p_credito->>'descuento_fps',    '')::NUMERIC, 0),
    COALESCE(NULLIF(p_credito->>'descuento_seguro', '')::NUMERIC, 0),
    COALESCE(NULLIF(p_credito->>'descuento_otros',  '')::NUMERIC, 0),
    (p_credito->>'tasa_interes')::NUMERIC,
    v_plazo_meses,
    (p_credito->>'cuota_mensual')::NUMERIC,
    (p_credito->>'tipo_credito')::tipo_credito,  -- cast requerido: columna es ENUM, no text
    (p_credito->>'monto_aprobado')::NUMERIC,  -- saldo_capital = monto_aprobado al crear
    COALESCE(NULLIF(p_credito->>'interes_acumulado', '')::NUMERIC, 0),
    'vigente'
  )
  RETURNING id INTO v_id_credito;

  -- Insertar cada cuota del cronograma
  FOR v_cuota IN SELECT * FROM jsonb_array_elements(p_cuotas)
  LOOP
    INSERT INTO cronograma_cuotas (
      id_credito,
      nro_cuota,
      fecha_vencimiento,
      capital,
      interes,
      cuota_total,
      capital_pagado,
      interes_pagado,
      estado
    ) VALUES (
      v_id_credito,
      (v_cuota->>'nro_cuota')::INT,
      (v_cuota->>'fecha_vencimiento')::DATE,
      (v_cuota->>'capital')::NUMERIC,
      (v_cuota->>'interes')::NUMERIC,
      (v_cuota->>'cuota_total')::NUMERIC,
      COALESCE(NULLIF(v_cuota->>'capital_pagado',  '')::NUMERIC, 0),
      COALESCE(NULLIF(v_cuota->>'interes_pagado',  '')::NUMERIC, 0),
      COALESCE(v_cuota->>'estado', 'pendiente')
    );
  END LOOP;

  RETURN v_id_credito;
END;
$$;

-- ============================================================
-- ROLLBACK (para deshacer esta función si algo sale mal):
-- DROP FUNCTION IF EXISTS crear_credito_con_cronograma(JSONB, JSONB);
-- ============================================================
