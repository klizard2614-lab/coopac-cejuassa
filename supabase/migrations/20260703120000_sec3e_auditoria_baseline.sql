-- SEC-3E: Migración local baseline de tabla `auditoria`
-- Fecha: 2026-07-03
-- Propósito: Sincronizar historial local con tabla ya existente en Supabase remoto.
--            Esta tabla fue creada manualmente en el Dashboard sin migración local.
-- ACCIÓN REQUERIDA: Solo aplicar con autorización explícita "APLICAR BASELINE AUDITORIA SEC-3E"
-- NO modifica datos — solo declara estructura ya existente en producción.
-- NO agrega columnas futuras de SEC-4B.
-- NO crea RPC.
-- NO toca tablas distintas a public.auditoria.

BEGIN;

-- ─── Tabla principal ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auditoria (
  id          bigserial PRIMARY KEY,
  id_usuario  uuid        NULL REFERENCES public.usuarios(id),
  modulo      text        NOT NULL,
  accion      text        NOT NULL,
  descripcion text        NULL,
  registro_id text        NULL,
  ip          text        NULL,
  fecha_hora  timestamptz NOT NULL DEFAULT now()
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

-- ─── Indexes (idempotentes) ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON public.auditoria (id_usuario);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha   ON public.auditoria (fecha_hora);

-- ─── Policies (estado actual de producción) ──────────────────────────────────
-- NOTA: estas policies son las actuales en remoto.
-- SEC-4B reemplazará auditoria_insert por control via RPC SECURITY DEFINER.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'auditoria' AND schemaname = 'public' AND policyname = 'auditoria_select'
  ) THEN
    CREATE POLICY auditoria_select
      ON public.auditoria
      FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'auditoria' AND schemaname = 'public' AND policyname = 'auditoria_insert'
  ) THEN
    CREATE POLICY auditoria_insert
      ON public.auditoria
      FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END$$;

COMMIT;

-- ─── ROLLBACK (solo para emergencias — no ejecutar en operación normal) ──────
-- BEGIN;
-- DROP TABLE IF EXISTS public.auditoria CASCADE;
-- COMMIT;
-- ADVERTENCIA: el rollback eliminaría la tabla con todos sus datos.
-- Solo ejecutar si la tabla fue creada erróneamente por esta migración.
-- En producción (tabla ya existe con datos), NO ejecutar el rollback.
