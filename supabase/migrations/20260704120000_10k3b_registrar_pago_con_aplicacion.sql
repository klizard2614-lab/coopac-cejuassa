-- Fase 10K-3B — RPC transaccional: registrar_pago_con_aplicacion
-- Estado: SOLO LOCAL — NO APLICAR EN SUPABASE SIN AUTORIZACIÓN EXACTA:
--   APLICAR RPC PAGOS NUEVOS 10K-3B
--
-- Por qué SECURITY DEFINER: cronograma_cuotas y creditos solo permiten
-- UPDATE directo a los roles admin/creditos (RLS_AUDIT_RESULT.md). El
-- usuario que registra un pago normalmente es tesoreria, que no está en esa
-- lista. Mismo mecanismo ya usado por decrementar_saldo_capital y
-- aplicar_ampliacion_credito para el mismo problema.
--
-- Propósito: reemplazar el flujo actual de app/dashboard/pagos/nuevo/page.tsx
-- (4 pasos secuenciales no atómicos, 1 sola cuota, sin tope, sin trazabilidad)
-- por una única operación transaccional que:
--   1. Valida la entrada y el rol del usuario que llama (RLS queda bypaseada
--      por SECURITY DEFINER, así que esta función hace su propia validación
--      de rol — ver bloque de validaciones más abajo).
--   2. Inserta el recibo en pagos_recibos.
--   3. Si el pago tiene componente de crédito (monto_capital + monto_interes > 0):
--      aplica en cascada contra cronograma_cuotas (fecha_vencimiento ASC),
--      con tope exacto por cuota, actualiza saldo_capital reutilizando la
--      RPC existente decrementar_saldo_capital, e inserta trazabilidad en
--      pagos_cuotas_aplicaciones por cada cuota tocada.
--   4. El componente de aporte (monto_aporte > 0) NO se procesa aquí —
--      queda explícitamente diferido a una fase futura (10K-3C/10K-3D) para
--      no aumentar el riesgo de esta primera versión. El frontend seguirá
--      llamando registrar_aporte_socio() por separado, igual que hoy.
--   5. Maneja el excedente (si sobra monto tras cubrir todas las cuotas
--      pendientes) devolviéndolo explícitamente en el resultado — nunca lo
--      aplica a otra cuota inventada ni a otro crédito.
--
-- Resuelve: R-K3 (ver docs/ai-recovery/RISKS_AND_BUGS.md) — pago nuevo que
-- solo actualizaba 1 cuota, sin tope, sin trazabilidad, no atómico.
--
-- Diseño completo, reglas de negocio y escenarios de prueba:
--   docs/ai-recovery/PAGOS_CUOTAS_10K_3B_RPC_PLAN.md
--
-- Tablas tocadas al INVOCAR la función (no al aplicar esta migración):
--   pagos_recibos           INSERT
--   creditos                SELECT (validación) + UPDATE (vía decrementar_saldo_capital)
--   cronograma_cuotas       SELECT + UPDATE
--   pagos_cuotas_aplicaciones  INSERT
--   usuarios                SELECT (validación de rol del caller)
--
-- Única excepción: el CREATE UNIQUE INDEX del Paso 0 SÍ se ejecuta en el
-- momento en que esta migración se aplique (crea un índice, no modifica ni
-- borra ninguna fila existente — 0 filas violan la restricción, confirmado
-- por auditoría de solo lectura antes de proponerla).
--
-- Gap de schema cerrado en Fase 10K-3B.1 (2026-07-04):
--   pagos_recibos.nro_recibo NO tenía constraint UNIQUE en el schema actual.
--   Auditoría de solo lectura sobre los 832 pagos_recibos existentes
--   (docs/ai-recovery/PAGOS_CUOTAS_10K_3B_RPC_PLAN.md, sección "Auditoría de
--   duplicados") confirmó: 0 nro_recibo NULL/vacíos, 0 duplicados exactos,
--   0 duplicados normalizados (lower+trim). Con el terreno confirmado limpio
--   se eligió la Opción A: agregar un índice único parcial normalizado
--   (ver Paso 0 más abajo) en vez de un advisory lock — es una garantía real
--   de base de datos, no solo una convención de aplicación, y no requiere
--   tocar ningún dato existente (0 filas violan la restricción).
--
-- Rollback (para deshacer todo lo de este archivo si algo sale mal):
--   DROP FUNCTION IF EXISTS public.registrar_pago_con_aplicacion(
--     text, bigint, bigint, bigint, date, text, text, text,
--     numeric, numeric, numeric, numeric, numeric, numeric, numeric, text
--   );
--   DROP INDEX IF EXISTS public.pagos_recibos_nro_recibo_unique_idx;
-- No implica pérdida de datos: los pagos ya registrados (pagos_recibos,
-- cronograma_cuotas, pagos_cuotas_aplicaciones) NO se borran al hacer DROP
-- de la función o del índice — solo deja de existir la RPC/la protección
-- para futuros pagos.

-- ═══════════════════════════════════════════════════════════════════════
-- Paso 0 — Índice único parcial normalizado sobre nro_recibo
-- ═══════════════════════════════════════════════════════════════════════
-- No usa CONCURRENTLY: la tabla tiene 832 filas (bajo volumen), el lock
-- breve de un CREATE INDEX normal es aceptable y permite que este paso viva
-- en la misma transacción de migración que el resto del archivo. Confirmado
-- por auditoría de solo lectura que 0 filas violan esta restricción antes
-- de proponerla — ver PAGOS_CUOTAS_10K_3B_RPC_PLAN.md.
CREATE UNIQUE INDEX IF NOT EXISTS pagos_recibos_nro_recibo_unique_idx
  ON public.pagos_recibos (lower(trim(nro_recibo)))
  WHERE nro_recibo IS NOT NULL AND trim(nro_recibo) <> '';

CREATE OR REPLACE FUNCTION public.registrar_pago_con_aplicacion(
  p_nro_recibo                  text,
  p_id_socio                    bigint,
  p_id_credito                  bigint    DEFAULT NULL,
  p_id_convenio                 bigint    DEFAULT NULL,
  p_fecha                       date      DEFAULT NULL,
  p_periodo                     text      DEFAULT NULL,
  p_canal_pago                  text      DEFAULT 'caja',
  p_tipo_pago                   text      DEFAULT NULL,
  p_monto_aporte                numeric   DEFAULT 0,
  p_monto_capital               numeric   DEFAULT 0,
  p_monto_interes               numeric   DEFAULT 0,
  p_monto_fps                   numeric   DEFAULT 0,
  p_monto_fps_extra             numeric   DEFAULT 0,
  p_monto_otros                 numeric   DEFAULT 0,
  p_interes_amortizado_pagado   numeric   DEFAULT 0,
  p_observacion                 text      DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Validación de rol del caller (RLS queda bypaseada por SECURITY DEFINER)
  v_caller_id        uuid;
  v_caller_rol       text;

  -- Datos del pago
  v_id_pago          bigint;
  v_monto_total       numeric;

  -- Datos del crédito
  v_credito          RECORD;
  v_monto_disponible numeric;
  v_ratio_capital    numeric;

  -- Cascada por cuota
  v_cuota            RECORD;
  v_capital_faltante numeric;
  v_interes_faltante numeric;
  v_saldo_cuota      numeric;
  v_capital_aplicar  numeric;
  v_interes_aplicar  numeric;

  -- Resultado
  v_cuotas_afectadas jsonb := '[]'::jsonb;
  v_cuotas_pagadas   int := 0;
  v_cuotas_parciales int := 0;
  v_aplicaciones_ins int := 0;
  v_advertencias     jsonb := '[]'::jsonb;
  v_monto_credito_aplicado numeric := 0;
BEGIN
  -- ══════════════════════════════════════════════════════════════════════
  -- A. VALIDACIONES DE ENTRADA
  -- ══════════════════════════════════════════════════════════════════════

  -- A.1 — Rol del usuario que llama (obligatorio: SECURITY DEFINER bypasa RLS,
  --       así que esta función DEBE revalidar el rol manualmente, igual que
  --       registrar_auditoria en SEC-4B)
  v_caller_id := auth.uid();

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'sin_sesion: se requiere una sesión autenticada para registrar pagos';
  END IF;

  SELECT rol::text INTO v_caller_rol
    FROM public.usuarios
   WHERE id = v_caller_id
   LIMIT 1;

  IF v_caller_rol IS NULL OR v_caller_rol NOT IN ('admin', 'tesoreria') THEN
    RAISE EXCEPTION 'rol_no_autorizado: el rol % no puede registrar pagos (solo admin/tesoreria)',
      COALESCE(v_caller_rol, 'desconocido');
  END IF;

  -- A.2 — Campos obligatorios
  IF p_nro_recibo IS NULL OR trim(p_nro_recibo) = '' THEN
    RAISE EXCEPTION 'nro_recibo_requerido: el número de recibo es obligatorio';
  END IF;

  IF p_id_socio IS NULL THEN
    RAISE EXCEPTION 'socio_requerido: debe indicarse un socio';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.socios WHERE id = p_id_socio) THEN
    RAISE EXCEPTION 'socio_no_encontrado: no existe socio con id %', p_id_socio;
  END IF;

  IF p_fecha IS NULL THEN
    RAISE EXCEPTION 'fecha_requerida: la fecha del pago es obligatoria';
  END IF;

  IF p_periodo IS NULL OR p_periodo !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'periodo_invalido: el periodo debe tener formato YYYY-MM, recibido: %', p_periodo;
  END IF;

  v_monto_total := COALESCE(p_monto_aporte,0) + COALESCE(p_monto_capital,0)
                  + COALESCE(p_monto_interes,0) + COALESCE(p_monto_fps,0)
                  + COALESCE(p_monto_fps_extra,0) + COALESCE(p_monto_otros,0);

  IF v_monto_total <= 0 THEN
    RAISE EXCEPTION 'monto_invalido: el monto total del recibo debe ser mayor a 0';
  END IF;

  -- A.3 — Evitar doble aplicación: rechazar si ya existe un recibo con el
  --       mismo nro_recibo (normalizado lower+trim, igual que el índice
  --       único creado en el Paso 0 de esta migración). Esta verificación
  --       previa da un mensaje de negocio claro (recibo_duplicado) en el
  --       caso normal; el índice único es la garantía real de base de datos
  --       para la ventana de carrera entre este SELECT y el INSERT del
  --       paso B (ver manejo de unique_violation más abajo).
  IF EXISTS (
    SELECT 1 FROM public.pagos_recibos
     WHERE lower(trim(nro_recibo)) = lower(trim(p_nro_recibo))
  ) THEN
    RAISE EXCEPTION 'recibo_duplicado: ya existe un pago registrado con nro_recibo %', trim(p_nro_recibo);
  END IF;

  -- A.4 — Si NO hay crédito, no debe venir monto_capital/monto_interes
  --       (no tiene sentido aplicar capital/interés sin un crédito asociado)
  IF p_id_credito IS NULL AND (COALESCE(p_monto_capital,0) + COALESCE(p_monto_interes,0)) > 0 THEN
    RAISE EXCEPTION 'monto_credito_sin_credito: monto_capital/monto_interes > 0 requiere id_credito';
  END IF;

  -- A.5 — Si hay crédito, validar que existe y que no está cancelado
  IF p_id_credito IS NOT NULL THEN
    SELECT id, estado, saldo_capital INTO v_credito
      FROM public.creditos
     WHERE id = p_id_credito
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'credito_no_encontrado: no existe credito con id %', p_id_credito;
    END IF;

    IF v_credito.estado = 'cancelado' AND (COALESCE(p_monto_capital,0) + COALESCE(p_monto_interes,0)) > 0 THEN
      RAISE EXCEPTION 'credito_cancelado_no_admite_pagos: el credito % esta cancelado, no admite pagos nuevos de capital/interes',
        p_id_credito;
    END IF;
  END IF;

  -- ══════════════════════════════════════════════════════════════════════
  -- B. INSERTAR pagos_recibos
  -- ══════════════════════════════════════════════════════════════════════
  -- BEGIN/EXCEPTION anidado: si dos llamadas concurrentes pasan ambas la
  -- verificación A.3 antes de que cualquiera inserte (ventana de carrera),
  -- el índice único pagos_recibos_nro_recibo_unique_idx (Paso 0) rechaza el
  -- segundo INSERT a nivel de base de datos. Se captura unique_violation y
  -- se traduce al mismo mensaje de negocio recibo_duplicado, en vez de
  -- dejar escapar el error crudo de Postgres.

  BEGIN
    INSERT INTO public.pagos_recibos (
      nro_recibo, id_socio, id_credito, id_convenio, fecha, periodo,
      canal_pago, tipo_pago, monto_aporte, monto_capital, monto_interes,
      monto_fps, monto_fps_extra, monto_otros, monto_total,
      interes_amortizado_pagado, estado_flujo, observacion
    ) VALUES (
      trim(p_nro_recibo), p_id_socio, p_id_credito, p_id_convenio, p_fecha, p_periodo,
      COALESCE(p_canal_pago, 'caja'), p_tipo_pago,
      COALESCE(p_monto_aporte,0), COALESCE(p_monto_capital,0), COALESCE(p_monto_interes,0),
      COALESCE(p_monto_fps,0), COALESCE(p_monto_fps_extra,0), COALESCE(p_monto_otros,0),
      v_monto_total, COALESCE(p_interes_amortizado_pagado,0), 'registrado',
      NULLIF(trim(COALESCE(p_observacion,'')), '')
    )
    RETURNING id INTO v_id_pago;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'recibo_duplicado: ya existe un pago registrado con nro_recibo % (detectado por índice único)', trim(p_nro_recibo);
  END;

  -- ══════════════════════════════════════════════════════════════════════
  -- C. APLICAR CONTRA CUOTAS (solo si hay credito y monto de capital/interes)
  -- ══════════════════════════════════════════════════════════════════════

  v_monto_disponible := COALESCE(p_monto_capital,0) + COALESCE(p_monto_interes,0);

  IF p_id_credito IS NOT NULL AND v_monto_disponible > 0 THEN
    v_ratio_capital := p_monto_capital / v_monto_disponible;

    FOR v_cuota IN
      SELECT id, capital, interes, capital_pagado, interes_pagado
        FROM public.cronograma_cuotas
       WHERE id_credito = p_id_credito
         AND estado IN ('pendiente', 'vencida', 'parcial')
       ORDER BY fecha_vencimiento ASC
       FOR UPDATE
    LOOP
      EXIT WHEN v_monto_disponible <= 0.005;

      v_capital_faltante := v_cuota.capital - COALESCE(v_cuota.capital_pagado, 0);
      v_interes_faltante := v_cuota.interes - COALESCE(v_cuota.interes_pagado, 0);
      v_saldo_cuota      := v_capital_faltante + v_interes_faltante;

      IF v_saldo_cuota <= 0.005 THEN
        CONTINUE;
      END IF;

      IF v_monto_disponible >= v_saldo_cuota THEN
        -- Cubre la cuota completa (tope exacto = lo que falta, nunca más)
        v_capital_aplicar := v_capital_faltante;
        v_interes_aplicar := v_interes_faltante;
        v_monto_disponible := round(v_monto_disponible - v_saldo_cuota, 2);

        UPDATE public.cronograma_cuotas
           SET capital_pagado = COALESCE(capital_pagado,0) + v_capital_aplicar,
               interes_pagado = COALESCE(interes_pagado,0) + v_interes_aplicar,
               estado = 'pagada',
               fecha_pago = p_fecha
         WHERE id = v_cuota.id;

        v_cuotas_pagadas := v_cuotas_pagadas + 1;
      ELSE
        -- Pago parcial: se distribuye proporcional, siempre con tope
        v_capital_aplicar := LEAST(round(v_monto_disponible * v_ratio_capital, 2), v_capital_faltante);
        v_interes_aplicar := LEAST(round(v_monto_disponible - v_capital_aplicar, 2), v_interes_faltante);
        v_monto_disponible := 0;

        UPDATE public.cronograma_cuotas
           SET capital_pagado = COALESCE(capital_pagado,0) + v_capital_aplicar,
               interes_pagado = COALESCE(interes_pagado,0) + v_interes_aplicar,
               estado = 'parcial'
         WHERE id = v_cuota.id;

        v_cuotas_parciales := v_cuotas_parciales + 1;
      END IF;

      INSERT INTO public.pagos_cuotas_aplicaciones (
        id_pago, id_cuota, id_credito, capital_aplicado, interes_aplicado,
        fecha_aplicacion, created_by
      ) VALUES (
        v_id_pago, v_cuota.id, p_id_credito, v_capital_aplicar, v_interes_aplicar,
        p_fecha, v_caller_id
      );

      v_aplicaciones_ins := v_aplicaciones_ins + 1;
      v_monto_credito_aplicado := round(v_monto_credito_aplicado + v_capital_aplicar + v_interes_aplicar, 2);

      v_cuotas_afectadas := v_cuotas_afectadas || jsonb_build_object(
        'id_cuota', v_cuota.id,
        'capital_aplicado', v_capital_aplicar,
        'interes_aplicado', v_interes_aplicar,
        'estado_resultante', CASE WHEN v_monto_disponible >= 0 AND v_capital_aplicar = v_capital_faltante
                                        AND v_interes_aplicar = v_interes_faltante
                                   THEN 'pagada' ELSE 'parcial' END
      );
    END LOOP;

    -- Actualizar saldo_capital reutilizando la RPC existente (no se
    -- duplica la lógica de R5 aquí)
    IF COALESCE(p_monto_capital,0) > 0 THEN
      PERFORM public.decrementar_saldo_capital(p_id_credito, p_monto_capital);
    END IF;

    -- Excedente: si sobra monto tras cubrir todas las cuotas disponibles,
    -- NO se inventa una cuota ni se aplica a otro crédito — se reporta.
    IF v_monto_disponible > 0.005 THEN
      v_advertencias := v_advertencias || to_jsonb(
        format('Excedente de %s sin cuota pendiente donde aplicarlo (crédito %s)', v_monto_disponible, p_id_credito)
      );
    END IF;
  END IF;

  -- ══════════════════════════════════════════════════════════════════════
  -- D. APORTE — DIFERIDO A FASE FUTURA (10K-3C/10K-3D)
  -- ══════════════════════════════════════════════════════════════════════
  -- Esta función NO procesa monto_aporte. El frontend sigue llamando
  -- registrar_aporte_socio() por separado, exactamente como hoy. Se deja
  -- documentado aquí para que quien lea este código no asuma que el aporte
  -- ya está cubierto.
  IF COALESCE(p_monto_aporte,0) > 0 THEN
    v_advertencias := v_advertencias || to_jsonb(
      'monto_aporte > 0: el caller debe llamar registrar_aporte_socio() por separado (no incluido en esta RPC todavia)'::text
    );
  END IF;

  -- ══════════════════════════════════════════════════════════════════════
  -- F. RESULTADO
  -- ══════════════════════════════════════════════════════════════════════

  RETURN jsonb_build_object(
    'id_pago', v_id_pago,
    'id_credito', p_id_credito,
    'monto_credito_aplicado', v_monto_credito_aplicado,
    'cuotas_afectadas', v_cuotas_afectadas,
    'cuotas_pagadas', v_cuotas_pagadas,
    'cuotas_parciales', v_cuotas_parciales,
    'excedente', COALESCE(v_monto_disponible, 0),
    'aplicaciones_insertadas', v_aplicaciones_ins,
    'advertencias', v_advertencias
  );
END;
$$;

-- Revocar ejecución pública y conceder solo a usuarios autenticados
-- (mismo patrón aplicado en SEC-4B para registrar_auditoria)
REVOKE ALL ON FUNCTION public.registrar_pago_con_aplicacion(
  text, bigint, bigint, bigint, date, text, text, text,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.registrar_pago_con_aplicacion(
  text, bigint, bigint, bigint, date, text, text, text,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, text
) TO authenticated;

-- Nota (igual que en SEC-4B): Supabase concede EXECUTE a anon/authenticated/
-- service_role automáticamente en funciones nuevas del schema public via
-- ALTER DEFAULT PRIVILEGES. El REVOKE ALL FROM PUBLIC no retira el privilegio
-- explícito de `anon`. Si se aplica esta migración, ejecutar también:
--   REVOKE EXECUTE ON FUNCTION public.registrar_pago_con_aplicacion(
--     text, bigint, bigint, bigint, date, text, text, text,
--     numeric, numeric, numeric, numeric, numeric, numeric, numeric, text
--   ) FROM anon;
-- (Se documenta aquí para no repetir el hallazgo de SEC-4B; no se ejecuta
-- en esta migración porque la función tampoco se está aplicando todavía.)

COMMENT ON FUNCTION public.registrar_pago_con_aplicacion IS
  'Fase 10K-3B (2026-07-04). Registra un pago nuevo y lo aplica en cascada contra cronograma_cuotas con trazabilidad en pagos_cuotas_aplicaciones. NO procesa monto_aporte (diferido a 10K-3C/10K-3D). NO aplicar sin autorización APLICAR RPC PAGOS NUEVOS 10K-3B.';

-- ============================================================
-- ROLLBACK (para deshacer esta función si algo sale mal):
-- DROP FUNCTION IF EXISTS public.registrar_pago_con_aplicacion(
--   text, bigint, bigint, bigint, date, text, text, text,
--   numeric, numeric, numeric, numeric, numeric, numeric, numeric, text
-- );
-- ============================================================
