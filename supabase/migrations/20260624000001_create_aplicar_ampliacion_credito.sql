-- Fase 10J-1: RPC atómica para aplicar ampliación de crédito
-- Regla confirmada por Contabilidad: suma monto al crédito, cambia nro_pagare.
-- NO toca cronograma_cuotas, pagos_recibos, socios, aportes, egresos.

CREATE OR REPLACE FUNCTION public.aplicar_ampliacion_credito(
  p_id_credito       integer,
  p_fecha            date,
  p_nro_pagare_nuevo text,
  p_monto_a_ampliar  numeric,
  p_plazo_nuevo      integer,
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
  -- Bloquear y leer crédito actual
  SELECT id, nro_pagare, monto_aprobado, saldo_capital
  INTO v_credito
  FROM creditos
  WHERE id = p_id_credito
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Crédito no encontrado: %', p_id_credito;
  END IF;

  IF p_monto_a_ampliar <= 0 THEN
    RAISE EXCEPTION 'El monto a ampliar debe ser mayor a 0.';
  END IF;

  IF p_nro_pagare_nuevo IS NULL OR trim(p_nro_pagare_nuevo) = '' THEN
    RAISE EXCEPTION 'El número de pagaré nuevo no puede estar vacío.';
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

  -- Insertar historial en ampliaciones
  INSERT INTO ampliaciones (
    id_credito,
    fecha,
    nro_pagare_anterior,
    nro_pagare_nuevo,
    monto_nuevo,
    plazo_nuevo,
    saldo_nuevo,
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
    p_observacion,
    p_created_by
  )
  RETURNING id INTO v_ampliacion_id;

  -- Actualizar únicamente los 3 campos permitidos del crédito
  UPDATE creditos SET
    nro_pagare     = trim(p_nro_pagare_nuevo),
    monto_aprobado = v_monto_nuevo,
    saldo_capital  = v_saldo_nuevo
  WHERE id = p_id_credito;

  RETURN json_build_object(
    'ok',            true,
    'ampliacion_id', v_ampliacion_id,
    'antes', json_build_object(
      'nro_pagare',     v_credito.nro_pagare,
      'monto_aprobado', v_credito.monto_aprobado,
      'saldo_capital',  v_credito.saldo_capital
    ),
    'despues', json_build_object(
      'nro_pagare',     trim(p_nro_pagare_nuevo),
      'monto_aprobado', v_monto_nuevo,
      'saldo_capital',  v_saldo_nuevo
    )
  );
END;
$$;

COMMENT ON FUNCTION public.aplicar_ampliacion_credito IS
  'Aplica una ampliación de crédito de forma atómica: inserta historial en ampliaciones y actualiza nro_pagare, monto_aprobado, saldo_capital en creditos. NO toca cronograma_cuotas ni pagos_recibos.';
