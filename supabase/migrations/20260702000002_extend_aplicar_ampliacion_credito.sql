-- Fase 10J-2B: Extender RPC aplicar_ampliacion_credito
-- Agrega soporte para tasa TEA, cuota mensual y plazo como campos editables.
-- Actualiza creditos.plazo_meses, creditos.tasa_interes y creditos.cuota_mensual.
-- NO toca cronograma_cuotas, pagos_recibos, socios, aportes, egresos.

CREATE OR REPLACE FUNCTION public.aplicar_ampliacion_credito(
  p_id_credito       integer,
  p_fecha            date,
  p_nro_pagare_nuevo text,
  p_monto_a_ampliar  numeric,
  p_plazo_nuevo      integer,
  p_tasa_nueva       numeric,
  p_cuota_nueva      numeric,
  p_observacion      text    DEFAULT NULL,
  p_created_by       uuid    DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credito       RECORD;
  v_monto_nuevo   numeric;
  v_saldo_nuevo   numeric;
  v_ampliacion_id integer;
BEGIN
  -- Bloquear y leer crédito actual (incluye plazo_meses, tasa_interes, cuota_mensual)
  SELECT id, nro_pagare, monto_aprobado, saldo_capital, plazo_meses, tasa_interes, cuota_mensual
  INTO v_credito
  FROM creditos
  WHERE id = p_id_credito
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Crédito no encontrado: %', p_id_credito;
  END IF;

  -- Validaciones
  IF p_monto_a_ampliar <= 0 THEN
    RAISE EXCEPTION 'El monto a ampliar debe ser mayor a 0.';
  END IF;

  IF p_nro_pagare_nuevo IS NULL OR trim(p_nro_pagare_nuevo) = '' THEN
    RAISE EXCEPTION 'El número de pagaré nuevo no puede estar vacío.';
  END IF;

  IF p_plazo_nuevo <= 0 THEN
    RAISE EXCEPTION 'El plazo nuevo debe ser mayor a 0.';
  END IF;

  IF p_tasa_nueva < 0 THEN
    RAISE EXCEPTION 'La tasa TEA no puede ser negativa.';
  END IF;

  IF p_cuota_nueva <= 0 THEN
    RAISE EXCEPTION 'La cuota nueva debe ser mayor a 0.';
  END IF;

  -- Validar unicidad en creditos (excluyendo el crédito actual)
  IF EXISTS (
    SELECT 1 FROM creditos
    WHERE nro_pagare = trim(p_nro_pagare_nuevo)
      AND id <> p_id_credito
  ) THEN
    RAISE EXCEPTION 'El pagaré "%" ya existe en otro crédito.', trim(p_nro_pagare_nuevo);
  END IF;

  -- Validar unicidad en historial de ampliaciones
  IF EXISTS (
    SELECT 1 FROM ampliaciones
    WHERE nro_pagare_nuevo = trim(p_nro_pagare_nuevo)
  ) THEN
    RAISE EXCEPTION 'El pagaré "%" ya existe en el historial de ampliaciones.', trim(p_nro_pagare_nuevo);
  END IF;

  -- Calcular valores resultantes
  v_monto_nuevo := v_credito.monto_aprobado + p_monto_a_ampliar;
  v_saldo_nuevo := v_credito.saldo_capital  + p_monto_a_ampliar;

  -- Insertar historial en ampliaciones (con tasa_nueva y cuota_nueva)
  INSERT INTO ampliaciones (
    id_credito,
    fecha,
    nro_pagare_anterior,
    nro_pagare_nuevo,
    monto_nuevo,
    plazo_nuevo,
    saldo_nuevo,
    tasa_nueva,
    cuota_nueva,
    observacion,
    created_by
  ) VALUES (
    p_id_credito,
    p_fecha,
    v_credito.nro_pagare,
    trim(p_nro_pagare_nuevo),
    v_monto_nuevo,
    p_plazo_nuevo,
    v_saldo_nuevo,
    p_tasa_nueva,
    p_cuota_nueva,
    p_observacion,
    p_created_by
  )
  RETURNING id INTO v_ampliacion_id;

  -- Actualizar creditos: nro_pagare, monto, saldo, plazo, tasa y cuota
  -- NO toca: cronograma_cuotas, pagos_recibos, socios, aportes, egresos
  UPDATE creditos SET
    nro_pagare     = trim(p_nro_pagare_nuevo),
    monto_aprobado = v_monto_nuevo,
    saldo_capital  = v_saldo_nuevo,
    plazo_meses    = p_plazo_nuevo,
    tasa_interes   = p_tasa_nueva,
    cuota_mensual  = p_cuota_nueva
  WHERE id = p_id_credito;

  RETURN json_build_object(
    'ok',            true,
    'ampliacion_id', v_ampliacion_id,
    'antes', json_build_object(
      'nro_pagare',     v_credito.nro_pagare,
      'monto_aprobado', v_credito.monto_aprobado,
      'saldo_capital',  v_credito.saldo_capital,
      'plazo_meses',    v_credito.plazo_meses,
      'tasa_interes',   v_credito.tasa_interes,
      'cuota_mensual',  v_credito.cuota_mensual
    ),
    'despues', json_build_object(
      'nro_pagare',     trim(p_nro_pagare_nuevo),
      'monto_aprobado', v_monto_nuevo,
      'saldo_capital',  v_saldo_nuevo,
      'plazo_meses',    p_plazo_nuevo,
      'tasa_interes',   p_tasa_nueva,
      'cuota_mensual',  p_cuota_nueva
    )
  );
END;
$$;

COMMENT ON FUNCTION public.aplicar_ampliacion_credito IS
  'Fase 10J-2B: Aplica una ampliación de crédito de forma atómica. Inserta historial en ampliaciones y actualiza nro_pagare, monto_aprobado, saldo_capital, plazo_meses, tasa_interes y cuota_mensual en creditos. NO toca cronograma_cuotas ni pagos_recibos.';
