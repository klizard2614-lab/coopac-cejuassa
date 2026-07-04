-- Fase 8A-2: Campos mínimos para BDCC/SBS MVP
-- Seguro de ejecutar: ADD COLUMN IF NOT EXISTS es idempotente (PostgreSQL 9.6+)
-- Defaults conservadores aplicados solo donde hay certeza operativa
-- NO ejecutar supabase db push sin dry-run previo
--
-- Campos que YA EXISTEN y se omiten:
--   configuracion.codigo_coopac      — existe, solo se actualiza si NULL/vacío
--   creditos.fecha_cancelacion       — confirmado en creditos/[id]/editar/page.tsx
--   creditos.monto_girado_neto       — confirmado en RPC crear_credito_con_cronograma
--   creditos.descuento_fps           — confirmado en RPC y creditos/nuevo/page.tsx
--   creditos.descuento_seguro        — idem
--   creditos.descuento_otros         — idem
--
-- Campos de descuento omitidos por solapamiento con los existentes:
--   fps_descontado    → usar descuento_fps
--   autoseguro        → usar descuento_seguro
--   monto_girado      → usar monto_girado_neto

BEGIN;

-- ── socios: identificación personal para BDCC ────────────────────────────────
ALTER TABLE socios
  ADD COLUMN IF NOT EXISTS genero       TEXT,
  ADD COLUMN IF NOT EXISTS estado_civil TEXT;

-- ── creditos: campos regulatorios SBS y de desembolso ───────────────────────
ALTER TABLE creditos
  ADD COLUMN IF NOT EXISTS nro_expediente        TEXT,
  ADD COLUMN IF NOT EXISTS tipo_credito_sbs      TEXT DEFAULT 'consumo_no_revolvente',
  ADD COLUMN IF NOT EXISTS subtipo_credito_sbs   TEXT,
  ADD COLUMN IF NOT EXISTS cuenta_contable_bd01  TEXT DEFAULT '1411050604',
  ADD COLUMN IF NOT EXISTS aporte_descontado     NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tramite               NUMERIC DEFAULT 0;

-- ── pagos_recibos: tipo de pago para clasificación BDCC ─────────────────────
ALTER TABLE pagos_recibos
  ADD COLUMN IF NOT EXISTS tipo_pago TEXT;

-- ── configuracion: asegurar codigo_coopac = '01270' ─────────────────────────
-- Solo actualiza si está NULL o vacío (no sobreescribe un valor ya configurado)
UPDATE configuracion
   SET codigo_coopac = '01270'
 WHERE id = 1
   AND (codigo_coopac IS NULL OR TRIM(codigo_coopac) = '');

COMMIT;
