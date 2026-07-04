-- ============================================================
-- RPC C: crear_credito_con_cronograma
-- Estado:  PROPUESTA — NO APLICADA EN SUPABASE
-- Riesgo:  R8 — crédito sin cronograma si el bulk insert falla
-- Revisión: Opus (2026-06-17)
-- ============================================================
--
-- Propósito:
--   Crear un crédito y su cronograma de cuotas en una sola transacción.
--   Si el insert de cuotas falla, PostgreSQL hace rollback del crédito.
--   Elimina el riesgo de créditos huérfanos (sin cronograma).
--
-- Tablas afectadas:
--   creditos        (INSERT)
--   cronograma_cuotas (INSERT múltiple)
--
-- Parámetros:
--   p_credito  JSONB  — objeto con los campos del crédito (ver estructura abajo)
--   p_cuotas   JSONB  — array de objetos con las cuotas (ver estructura abajo)
--
-- Estructura p_credito (todos requeridos salvo los opcionales marcados):
--   {
--     "id_socio":           number,
--     "nro_pagare":         string,
--     "fecha_desembolso":   string (YYYY-MM-DD),
--     "monto_aprobado":     number,
--     "monto_girado_neto":  number,
--     "descuento_fps":      number | null,   (opcional)
--     "descuento_seguro":   number | null,   (opcional)
--     "descuento_otros":    number | null,   (opcional)
--     "tasa_interes":       number,
--     "plazo_meses":        number,
--     "cuota_mensual":      number,
--     "tipo_credito":       string,
--     "interes_acumulado":  number
--   }
--
-- Estructura p_cuotas (array de objetos):
--   [
--     {
--       "nro_cuota":         number,
--       "fecha_vencimiento": string (YYYY-MM-DD),
--       "capital":           number,
--       "interes":           number,
--       "cuota_total":       number,
--       "estado":            string (siempre "pendiente")
--     },
--     ...
--   ]
--
-- Retorna:
--   bigint — id del crédito creado
--
-- Errores de negocio (código P0001):
--   - 'cuotas_no_es_array'        si p_cuotas no es un array JSON
--   - 'longitud_cuotas_incorrecta' si jsonb_array_length(p_cuotas) != plazo_meses
--
-- Notas de diseño (Opus):
--   - NULLIF/COALESCE para campos opcionales (descuentos): si el frontend
--     envía null, NULLIF('null'::text, ...) no aplica — usar COALESCE directamente
--     sobre el campo JSONB con operador ->> que devuelve NULL si el campo no existe.
--   - No capturar excepciones de los INSERT si no se van a relanzar — dejar
--     que PostgreSQL las propague directamente para rollback automático.
--   - La validación jsonb_array_length == plazo_meses previene cronogramas incompletos.
--
-- NOTA IMPORTANTE para integración:
--   Esta RPC requiere refactorizar creditos/nuevo/page.tsx (líneas 122-192)
--   para construir los JSONB en el cliente y hacer una sola llamada RPC
--   en lugar de los dos inserts separados actuales.
--   Ver Fase 4B-4.
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
    COALESCE((p_credito->>'descuento_fps')::NUMERIC,    0),
    COALESCE((p_credito->>'descuento_seguro')::NUMERIC, 0),
    COALESCE((p_credito->>'descuento_otros')::NUMERIC,  0),
    (p_credito->>'tasa_interes')::NUMERIC,
    v_plazo_meses,
    (p_credito->>'cuota_mensual')::NUMERIC,
    (p_credito->>'tipo_credito')::tipo_credito,  -- cast requerido: columna es ENUM, no text
    (p_credito->>'monto_aprobado')::NUMERIC,  -- saldo_capital = monto_aprobado al crear
    COALESCE((p_credito->>'interes_acumulado')::NUMERIC, 0),
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
      estado
    ) VALUES (
      v_id_credito,
      (v_cuota->>'nro_cuota')::INT,
      (v_cuota->>'fecha_vencimiento')::DATE,
      (v_cuota->>'capital')::NUMERIC,
      (v_cuota->>'interes')::NUMERIC,
      (v_cuota->>'cuota_total')::NUMERIC,
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
