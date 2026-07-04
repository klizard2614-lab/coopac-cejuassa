-- Fase 10K-3B.2 — Hotfix: registrar_pago_con_aplicacion vs enum canal_pago
-- Estado: SOLO LOCAL — NO APLICAR EN SUPABASE SIN AUTORIZACIÓN EXACTA:
--   APLICAR HOTFIX CANAL PAGO 10K-3B.2
--
-- Corrige el bug crítico R-K4 (docs/ai-recovery/RISKS_AND_BUGS.md), detectado
-- en la prueba controlada 10K-3C.1 (docs/ai-recovery/PAGOS_CUOTAS_10K3C1_PRUEBA_CONTROLADA_REPORT.md):
--
--   ERROR: 42804: column "canal_pago" is of type canal_pago but expression is
--   of type text
--
-- Causa raíz confirmada por auditoría de solo lectura (2026-07-04):
--   - public.pagos_recibos.canal_pago es un ENUM de Postgres (udt_name=canal_pago),
--     con valores permitidos: 'caja', 'convenio' (confirmado vía pg_enum).
--   - La función registrar_pago_con_aplicacion (10K-3B) declara
--     p_canal_pago text DEFAULT 'caja' e inserta COALESCE(p_canal_pago,'caja'),
--     que sigue siendo tipo text — Postgres no lo castea implícitamente a un
--     enum de usuario (a diferencia de un literal sin tipo, que sí se resuelve
--     automáticamente).
--   - Esta sección del INSERT corre para TODO pago (con o sin crédito), por lo
--     que el bug bloquea el 100% de los pagos nuevos.
--
-- Otros campos de pagos_recibos auditados en la misma fase (solo lectura):
--   - estado_flujo es también un ENUM (udt_name=estado_flujo_pago), pero se
--     inserta como literal sin tipo ('registrado', no una variable text) —
--     Postgres SÍ resuelve ese caso automáticamente. No requiere corrección.
--   - tipo_pago es text plano (no enum). No requiere corrección.
--   - Ningún otro campo del INSERT de pagos_recibos presenta este problema.
--   Por eso este hotfix corrige ÚNICAMENTE canal_pago — no se amplía el alcance.
--
-- Corrección aplicada (única diferencia de fondo vs la versión 10K-3B):
--   1. Se normaliza p_canal_pago con lower(trim(...)), con default 'caja' si
--      viene NULL o vacío.
--   2. Se valida explícitamente contra los valores reales del enum
--      ('caja', 'convenio') — RAISE EXCEPTION 'canal_pago_invalido: ...' si no
--      coincide, en vez de dejar que Postgres lance un error críptico de tipos.
--   3. Solo después de validar, se castea a canal_pago (variable tipada
--      v_canal_pago canal_pago) y se usa esa variable en el INSERT — nunca un
--      cast directo sin validar.
--
-- No se toca: UI (pagos/nuevo/page.tsx, lib/pagos/registrarPagoConAplicacion.ts),
-- Anexo 6, seguridad existente (RLS/policies/auditoria), AUDIT_ENABLED, ninguna
-- tabla (solo se reemplaza la función), pagos históricos, Fase 10K-2B.
--
-- Firma sin cambios: misma lista de parámetros, mismo orden, mismos tipos,
-- mismo valor de retorno (jsonb) — CREATE OR REPLACE FUNCTION es seguro aquí
-- porque no se altera la signature.
--
-- Rollback (para volver a la versión 10K-3B tal cual, con el bug presente):
--   Re-aplicar el CREATE OR REPLACE FUNCTION de
--   supabase/migrations/20260704120000_10k3b_registrar_pago_con_aplicacion.sql
--   (sección de la función, sin el Paso 0 del índice que no se toca aquí).
-- No implica pérdida de datos: esta migración solo reemplaza el cuerpo de una
-- función, no toca ninguna fila existente.

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

  -- Hotfix 10K-3B.2: canal_pago normalizado/validado/tipado
  v_canal_pago_raw   text;
  v_canal_pago       public.canal_pago;

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

  -- A.2.1 — Hotfix 10K-3B.2: normalizar y validar canal_pago contra el enum
  --         real (caja/convenio) ANTES de castear, para dar un mensaje de
  --         negocio claro en vez de un error críptico de tipos de Postgres.
  v_canal_pago_raw := lower(trim(COALESCE(p_canal_pago, 'caja')));
  IF v_canal_pago_raw = '' THEN
    v_canal_pago_raw := 'caja';
  END IF;

  IF v_canal_pago_raw NOT IN ('caja', 'convenio') THEN
    RAISE EXCEPTION 'canal_pago_invalido: el canal de pago debe ser "caja" o "convenio", recibido: %',
      COALESCE(p_canal_pago, '(vacio)');
  END IF;

  v_canal_pago := v_canal_pago_raw::public.canal_pago;

  v_monto_total := COALESCE(p_monto_aporte,0) + COALESCE(p_monto_capital,0)
                  + COALESCE(p_monto_interes,0) + COALESCE(p_monto_fps,0)
                  + COALESCE(p_monto_fps_extra,0) + COALESCE(p_monto_otros,0);

  IF v_monto_total <= 0 THEN
    RAISE EXCEPTION 'monto_invalido: el monto total del recibo debe ser mayor a 0';
  END IF;

  -- A.3 — Evitar doble aplicación: rechazar si ya existe un recibo con el
  --       mismo nro_recibo (normalizado lower+trim, igual que el índice
  --       único creado en el Paso 0 de la migración 10K-3B). Esta verificación
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
  -- el índice único pagos_recibos_nro_recibo_unique_idx (Paso 0 de 10K-3B)
  -- rechaza el segundo INSERT a nivel de base de datos. Se captura
  -- unique_violation y se traduce al mismo mensaje de negocio
  -- recibo_duplicado, en vez de dejar escapar el error crudo de Postgres.
  --
  -- Hotfix 10K-3B.2: se usa v_canal_pago (ya validado y tipado como
  -- public.canal_pago) en vez de COALESCE(p_canal_pago, 'caja') (texto plano
  -- sin cast, causa del bug R-K4).

  BEGIN
    INSERT INTO public.pagos_recibos (
      nro_recibo, id_socio, id_credito, id_convenio, fecha, periodo,
      canal_pago, tipo_pago, monto_aporte, monto_capital, monto_interes,
      monto_fps, monto_fps_extra, monto_otros, monto_total,
      interes_amortizado_pagado, estado_flujo, observacion
    ) VALUES (
      trim(p_nro_recibo), p_id_socio, p_id_credito, p_id_convenio, p_fecha, p_periodo,
      v_canal_pago, p_tipo_pago,
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
-- (mismo patrón aplicado en SEC-4B para registrar_auditoria y en 10K-3B)
REVOKE ALL ON FUNCTION public.registrar_pago_con_aplicacion(
  text, bigint, bigint, bigint, date, text, text, text,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.registrar_pago_con_aplicacion(
  text, bigint, bigint, bigint, date, text, text, text,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, text
) TO authenticated;

-- Igual que en 10K-3B/SEC-4B: Supabase concede EXECUTE a anon/authenticated/
-- service_role automáticamente vía ALTER DEFAULT PRIVILEGES en funciones
-- nuevas o reemplazadas. El REVOKE ALL FROM PUBLIC no retira el privilegio
-- explícito de `anon`. Si se aplica esta migración, ejecutar también:
--   REVOKE EXECUTE ON FUNCTION public.registrar_pago_con_aplicacion(
--     text, bigint, bigint, bigint, date, text, text, text,
--     numeric, numeric, numeric, numeric, numeric, numeric, numeric, text
--   ) FROM anon;
-- (Documentado aquí para no repetir el hallazgo de SEC-4B; no se ejecuta en
-- esta migración local porque la función tampoco se está aplicando todavía.)

COMMENT ON FUNCTION public.registrar_pago_con_aplicacion IS
  'Fase 10K-3B.2 (2026-07-04) — hotfix de R-K4: valida y castea canal_pago al enum real antes de insertar (antes fallaba con 42804 en TODO pago). Resto de la lógica idéntico a 10K-3B. NO aplicar sin autorización APLICAR HOTFIX CANAL PAGO 10K-3B.2.';

-- ============================================================
-- ROLLBACK (para volver a la versión 10K-3B, con el bug presente):
-- Re-ejecutar el CREATE OR REPLACE FUNCTION de la sección de función de
-- supabase/migrations/20260704120000_10k3b_registrar_pago_con_aplicacion.sql
-- (sin repetir el Paso 0 del índice único, que esta migración no toca).
-- No implica pérdida de datos: solo reemplaza el cuerpo de la función.
-- ============================================================
