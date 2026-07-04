-- Fase 10C.1: Crear tabla socio_beneficiarios
-- Pendiente de aplicar en Supabase — tabla NO existe aún.
-- socio_id usa INTEGER para coincidir con socios.id (int4/serial).
-- Idempotente: CREATE TABLE IF NOT EXISTS, índice IF NOT EXISTS, policy guardada por nombre.
-- NO toca columnas legacy de socios ni ninguna otra tabla.

BEGIN;

CREATE TABLE IF NOT EXISTS socio_beneficiarios (
  id           SERIAL PRIMARY KEY,
  socio_id     INTEGER NOT NULL REFERENCES socios(id) ON DELETE CASCADE,
  nombres      TEXT NOT NULL,
  dni          TEXT,
  parentesco   TEXT,
  porcentaje   NUMERIC(5,2),
  es_principal BOOLEAN NOT NULL DEFAULT FALSE,
  observacion  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_socio_beneficiarios_socio_id
  ON socio_beneficiarios(socio_id);

-- RLS: mismo patrón que todas las tablas del proyecto (rowsecurity = true, autenticados)
ALTER TABLE socio_beneficiarios ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'socio_beneficiarios'
      AND policyname = 'autenticados_pueden_operar'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY autenticados_pueden_operar ON socio_beneficiarios
        FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true)
    $pol$;
  END IF;
END;
$$;

COMMIT;
