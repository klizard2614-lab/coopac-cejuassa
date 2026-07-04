-- SEC-3C: Endurecer RLS en socio_beneficiarios y pagos_cuotas_aplicaciones
-- SOLO LOCAL — NO APLICAR EN SUPABASE SIN AUTORIZACIÓN EXACTA:
--   APLICAR RLS TABLAS SEC-3C
--
-- Objetivo: Reemplazar las policies FOR ALL ... USING (true) / WITH CHECK (true)
-- con policies granulares por rol usando get_user_rol().
--
-- Tablas modificadas: SOLO socio_beneficiarios y pagos_cuotas_aplicaciones.
-- No se tocan datos. No se tocan RPCs. No se tocan otras tablas.
--
-- ─── ROLLBACK DE EMERGENCIA ──────────────────────────────────────────────────
-- Si algo falla, ejecutar en Supabase SQL Editor:
--
-- BEGIN;
-- DROP POLICY IF EXISTS sb_select ON public.socio_beneficiarios;
-- DROP POLICY IF EXISTS sb_insert ON public.socio_beneficiarios;
-- DROP POLICY IF EXISTS sb_update ON public.socio_beneficiarios;
-- DROP POLICY IF EXISTS sb_delete ON public.socio_beneficiarios;
-- CREATE POLICY autenticados_pueden_operar ON public.socio_beneficiarios
--   FOR ALL TO authenticated USING (true) WITH CHECK (true);
--
-- DROP POLICY IF EXISTS pca_select ON public.pagos_cuotas_aplicaciones;
-- DROP POLICY IF EXISTS pca_insert ON public.pagos_cuotas_aplicaciones;
-- DROP POLICY IF EXISTS pca_update ON public.pagos_cuotas_aplicaciones;
-- DROP POLICY IF EXISTS pca_delete ON public.pagos_cuotas_aplicaciones;
-- CREATE POLICY autenticados_pueden_operar_pca ON public.pagos_cuotas_aplicaciones
--   FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- COMMIT;
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLA: socio_beneficiarios
-- Modelo de acceso:
--   admin      → SELECT, INSERT, UPDATE, DELETE
--   tesoreria  → SELECT, INSERT, UPDATE
--   creditos   → SELECT
--   contabilidad → SELECT
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS autenticados_pueden_operar ON public.socio_beneficiarios;

CREATE POLICY sb_select ON public.socio_beneficiarios
  FOR SELECT TO authenticated
  USING (get_user_rol() IN ('admin', 'tesoreria', 'creditos', 'contabilidad'));

CREATE POLICY sb_insert ON public.socio_beneficiarios
  FOR INSERT TO authenticated
  WITH CHECK (get_user_rol() IN ('admin', 'tesoreria'));

CREATE POLICY sb_update ON public.socio_beneficiarios
  FOR UPDATE TO authenticated
  USING (get_user_rol() IN ('admin', 'tesoreria'))
  WITH CHECK (get_user_rol() IN ('admin', 'tesoreria'));

CREATE POLICY sb_delete ON public.socio_beneficiarios
  FOR DELETE TO authenticated
  USING (get_user_rol() = 'admin');

ALTER TABLE public.socio_beneficiarios ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLA: pagos_cuotas_aplicaciones
-- Modelo de acceso:
--   admin      → SELECT, INSERT, UPDATE, DELETE
--   tesoreria  → SELECT, INSERT
--   creditos   → SELECT
--   contabilidad → SELECT
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS autenticados_pueden_operar_pca ON public.pagos_cuotas_aplicaciones;

CREATE POLICY pca_select ON public.pagos_cuotas_aplicaciones
  FOR SELECT TO authenticated
  USING (get_user_rol() IN ('admin', 'tesoreria', 'creditos', 'contabilidad'));

CREATE POLICY pca_insert ON public.pagos_cuotas_aplicaciones
  FOR INSERT TO authenticated
  WITH CHECK (get_user_rol() IN ('admin', 'tesoreria'));

CREATE POLICY pca_update ON public.pagos_cuotas_aplicaciones
  FOR UPDATE TO authenticated
  USING (get_user_rol() = 'admin')
  WITH CHECK (get_user_rol() = 'admin');

CREATE POLICY pca_delete ON public.pagos_cuotas_aplicaciones
  FOR DELETE TO authenticated
  USING (get_user_rol() = 'admin');

ALTER TABLE public.pagos_cuotas_aplicaciones ENABLE ROW LEVEL SECURITY;

COMMIT;
