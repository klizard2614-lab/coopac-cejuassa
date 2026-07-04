-- Fase 10K-1 — Tabla de trazabilidad: pagos_cuotas_aplicaciones
-- SOLO LOCAL — NO APLICAR EN SUPABASE SIN AUTORIZACIÓN EXACTA:
--   APLICAR TRAZABILIDAD PAGOS CUOTAS 10K-1
--
-- Propósito: registrar exactamente qué pago (pagos_recibos) se aplicó
-- a qué cuota (cronograma_cuotas) y cuánto de cada componente.
-- Permite: auditoría, rollback, reportes, múltiples pagos por cuota
-- y un pago aplicado a varias cuotas.

CREATE TABLE IF NOT EXISTS public.pagos_cuotas_aplicaciones (
  id              serial                    PRIMARY KEY,
  id_pago         integer                   NOT NULL
                    REFERENCES public.pagos_recibos(id) ON DELETE RESTRICT,
  id_cuota        integer                   NOT NULL
                    REFERENCES public.cronograma_cuotas(id) ON DELETE RESTRICT,
  id_credito      integer                   NOT NULL
                    REFERENCES public.creditos(id) ON DELETE RESTRICT,
  capital_aplicado  numeric(12,2)           NOT NULL DEFAULT 0,
  interes_aplicado  numeric(12,2)           NOT NULL DEFAULT 0,
  monto_aplicado    numeric(12,2)           GENERATED ALWAYS AS (capital_aplicado + interes_aplicado) STORED,
  fecha_aplicacion  date                    NOT NULL,
  observacion       text,
  created_at        timestamptz             NOT NULL DEFAULT now(),
  created_by        uuid
                    REFERENCES public.usuarios(id) ON DELETE SET NULL,

  CONSTRAINT capital_aplicado_no_negativo CHECK (capital_aplicado >= 0),
  CONSTRAINT interes_aplicado_no_negativo CHECK (interes_aplicado >= 0),
  CONSTRAINT monto_aplicado_positivo      CHECK (capital_aplicado + interes_aplicado > 0)
);

-- Índices para consultas frecuentes (por pago, cuota, crédito)
CREATE INDEX IF NOT EXISTS idx_pca_id_pago    ON public.pagos_cuotas_aplicaciones (id_pago);
CREATE INDEX IF NOT EXISTS idx_pca_id_cuota   ON public.pagos_cuotas_aplicaciones (id_cuota);
CREATE INDEX IF NOT EXISTS idx_pca_id_credito ON public.pagos_cuotas_aplicaciones (id_credito);

-- Evitar registrar exactamente el mismo pago sobre la misma cuota dos veces
-- (se permite varios registros si hay más de una aplicación parcial en momentos distintos,
--  pero no el mismo evento idéntico)
CREATE UNIQUE INDEX IF NOT EXISTS uq_pca_pago_cuota_fecha
  ON public.pagos_cuotas_aplicaciones (id_pago, id_cuota, fecha_aplicacion);

-- Habilitar RLS
ALTER TABLE public.pagos_cuotas_aplicaciones ENABLE ROW LEVEL SECURITY;

-- Policy: usuarios autenticados pueden leer, insertar y actualizar
-- (patrón idéntico al de socio_beneficiarios — aprobado en Fase 10C)
CREATE POLICY autenticados_pueden_operar_pca
  ON public.pagos_cuotas_aplicaciones
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Comentario de tabla
COMMENT ON TABLE public.pagos_cuotas_aplicaciones IS
  'Trazabilidad de qué pago (pagos_recibos) aplicó cuánto capital e interés a cada cuota (cronograma_cuotas). Creada en Fase 10K-1 (2026-07-02). NO aplicar sin autorización APLICAR TRAZABILIDAD PAGOS CUOTAS 10K-1.';
