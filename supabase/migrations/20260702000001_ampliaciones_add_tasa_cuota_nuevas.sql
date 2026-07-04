-- Fase 10J-2B: Ampliar tabla ampliaciones con tasa y cuota editables
-- Regla confirmada: en una ampliación pueden cambiar cuota, plazo y tasa TEA.
-- cuota_nueva y tasa_nueva son NULL para registros históricos anteriores a esta fase.

ALTER TABLE public.ampliaciones
  ADD COLUMN IF NOT EXISTS tasa_nueva numeric(8,4)  NULL,
  ADD COLUMN IF NOT EXISTS cuota_nueva numeric(12,2) NULL;

COMMENT ON COLUMN public.ampliaciones.tasa_nueva  IS 'Tasa TEA nueva aplicada en la ampliación (%). NULL en registros anteriores a Fase 10J-2B.';
COMMENT ON COLUMN public.ampliaciones.cuota_nueva IS 'Cuota mensual nueva resultante de la ampliación (S/). NULL en registros anteriores a Fase 10J-2B.';
