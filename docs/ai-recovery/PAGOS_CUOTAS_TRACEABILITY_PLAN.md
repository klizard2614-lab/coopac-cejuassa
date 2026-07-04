# PAGOS_CUOTAS_TRACEABILITY_PLAN.md

**Fase:** 10K-1 — Trazabilidad segura de pagos aplicados a cuotas
**Modo:** SOLO DISEÑO — NINGÚN DATO FUE MODIFICADO
**Generado:** 2026-07-02
**Referencia previa:** Fase 10K-0 (`PAGOS_CUOTAS_APPLICATION_PLAN.md`)

---

## 1. Problema detectado (Fase 10K-0)

La tabla `cronograma_cuotas` tiene campos para registrar cuánto se ha pagado por cuota
(`capital_pagado`, `interes_pagado`, `estado`, `fecha_pago`), pero no tiene ningún
vínculo con la tabla `pagos_recibos`.

Esto significa que después de aplicar pagos a cuotas (Fase 10K-2), **no habrá forma
de saber qué recibo de pago cubrió qué cuota**, ni en qué momento, ni por qué monto
exacto de capital e interés.

---

## 2. Por qué agregar `id_pago` en `cronograma_cuotas` no basta (Modelo A descartado)

### Propuesta de Modelo A
```sql
ALTER TABLE public.cronograma_cuotas
  ADD COLUMN IF NOT EXISTS id_pago integer REFERENCES pagos_recibos(id) ON DELETE SET NULL;
```

### Limitaciones fatales del Modelo A

| Problema | Impacto |
|---|---|
| Solo permite un pago por cuota | CEJUASSA tiene cuotas con múltiples pagos parciales (confirmado en dry-run: 26/26 cuotas afectadas son parciales) |
| No guarda cuánto aportó cada pago | Si un pago cubrió S/50 de capital y otro S/80, no hay registro de cuánto vino de dónde |
| Un pago aplicado a varias cuotas queda sin registro | Pago 411**** (S/1,896.96) cubre múltiples cuotas — no hay forma de saber cuáles ni cuánto por cuota |
| Sin auditoría de aplicaciones | Si se aplica mal y se necesita revertir, no hay registro del estado anterior |
| No soporta reapliques parciales | Si un pago se aplica en dos momentos distintos (Fase 10K-2 + Fase 10K-3), ambas aplicaciones se perderían |

**Conclusión:** Modelo A es insuficiente para las necesidades reales de CEJUASSA y representa un riesgo de auditoría inaceptable.

---

## 3. Modelo recomendado: Tabla intermedia `pagos_cuotas_aplicaciones` (Modelo B) ✅

### Ventajas

| Ventaja | Detalle |
|---|---|
| Un pago puede aplicarse a N cuotas | Con 34 propuestas de aplicación para 28 pagos, esto es la norma |
| N pagos pueden aplicarse a una cuota | Cuotas parciales reciben varios pagos mensuales |
| Registro exacto de capital e interés | Cada fila guarda exactamente cuánto capital e interés vino de ese pago |
| Auditoría completa | Toda la historia de aplicaciones queda registrada, con fecha y usuario |
| Rollback granular | Basta con borrar las filas de `pagos_cuotas_aplicaciones` y revertir los acumulados en `cronograma_cuotas` |
| Reportabilidad | Se puede consultar "¿qué pagos cubrieron la cuota 3 del crédito 1138?"  |
| No modifica tablas existentes | `cronograma_cuotas` y `pagos_recibos` no reciben columnas nuevas |
| Independiente de la aplicación | Se puede usar con o sin Fase 10K-2 —  la tabla existe vacía hasta que se aplique |

### Riesgos del Modelo B (manejables)

| Riesgo | Mitigación |
|---|---|
| Requiere tabla nueva | Migración simple e idempotente — sin datos en tablas existentes |
| Más lógica en el apply (10K-2) | El script ya existe como dry-run — se extiende para insertar en esta tabla |
| Consistencia entre tabla intermedia y acumulados | El apply debe ser atómico: insertar en `pagos_cuotas_aplicaciones` Y actualizar `cronograma_cuotas` juntos |

---

## 4. Esquema propuesto

### Tabla: `pagos_cuotas_aplicaciones`

```sql
CREATE TABLE IF NOT EXISTS public.pagos_cuotas_aplicaciones (
  id              serial                    PRIMARY KEY,
  id_pago         integer NOT NULL          REFERENCES public.pagos_recibos(id) ON DELETE RESTRICT,
  id_cuota        integer NOT NULL          REFERENCES public.cronograma_cuotas(id) ON DELETE RESTRICT,
  id_credito      integer NOT NULL          REFERENCES public.creditos(id) ON DELETE RESTRICT,
  capital_aplicado  numeric(12,2) NOT NULL  DEFAULT 0,
  interes_aplicado  numeric(12,2) NOT NULL  DEFAULT 0,
  monto_aplicado    numeric(12,2)           GENERATED ALWAYS AS (capital_aplicado + interes_aplicado) STORED,
  fecha_aplicacion  date NOT NULL,
  observacion       text,
  created_at        timestamptz NOT NULL    DEFAULT now(),
  created_by        uuid                    REFERENCES public.usuarios(id) ON DELETE SET NULL,

  CONSTRAINT capital_aplicado_no_negativo CHECK (capital_aplicado >= 0),
  CONSTRAINT interes_aplicado_no_negativo CHECK (interes_aplicado >= 0),
  CONSTRAINT monto_aplicado_positivo      CHECK (capital_aplicado + interes_aplicado > 0)
);
```

### Índices

```sql
CREATE INDEX IF NOT EXISTS idx_pca_id_pago    ON public.pagos_cuotas_aplicaciones (id_pago);
CREATE INDEX IF NOT EXISTS idx_pca_id_cuota   ON public.pagos_cuotas_aplicaciones (id_cuota);
CREATE INDEX IF NOT EXISTS idx_pca_id_credito ON public.pagos_cuotas_aplicaciones (id_credito);

-- Evitar duplicar exactamente el mismo evento pago+cuota+fecha
CREATE UNIQUE INDEX IF NOT EXISTS uq_pca_pago_cuota_fecha
  ON public.pagos_cuotas_aplicaciones (id_pago, id_cuota, fecha_aplicacion);
```

### RLS

```sql
ALTER TABLE public.pagos_cuotas_aplicaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY autenticados_pueden_operar_pca
  ON public.pagos_cuotas_aplicaciones
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

---

## 5. Migración local creada

**Archivo:** `supabase/migrations/20260702000003_create_pagos_cuotas_aplicaciones.sql`

**Estado:** SOLO LOCAL — no aplicada en Supabase.

**Para aplicar:** requiere autorización exacta `APLICAR TRAZABILIDAD PAGOS CUOTAS 10K-1`.

---

## 6. Cómo se usará en Fase 10K-2 (apply de pagos)

Cuando el script de apply ejecute cada aplicación de pago a cuota, hará:

### Paso 1 — Insertar trazabilidad

```sql
INSERT INTO public.pagos_cuotas_aplicaciones
  (id_pago, id_cuota, id_credito, capital_aplicado, interes_aplicado, fecha_aplicacion, observacion, created_by)
VALUES
  ($id_pago, $id_cuota, $id_credito, $capital, $interes, $fecha, $obs, $user_id);
```

### Paso 2 — Actualizar acumulados en cronograma_cuotas

```sql
UPDATE public.cronograma_cuotas
SET
  capital_pagado = capital_pagado + $capital,
  interes_pagado = interes_pagado + $interes,
  estado = CASE
    WHEN (capital_pagado + $capital) >= capital AND (interes_pagado + $interes) >= interes
    THEN 'pagada'
    ELSE 'parcial'
  END,
  fecha_pago = CASE
    WHEN (capital_pagado + $capital) >= capital AND (interes_pagado + $interes) >= interes
    THEN $fecha
    ELSE fecha_pago
  END
WHERE id = $id_cuota;
```

### Reglas del apply

- **NO modificar `pagos_recibos`** — el recibo original no cambia.
- **NO recalcular `creditos.saldo_capital`** en esta fase.
- **Ambas operaciones deben ser atómicas** — si una falla, revertir la otra.
- **Insertar primero en `pagos_cuotas_aplicaciones`**, luego actualizar `cronograma_cuotas`.
- **Una fila en `pagos_cuotas_aplicaciones`** por cada par (pago, cuota) impactado.

---

## 7. Rollback

Si se necesita revertir el apply de Fase 10K-2 después de haber aplicado la migración:

### Rollback de datos (revertir apply de cuotas)

```sql
-- 1. Revertir acumulados en cronograma_cuotas
-- (requiere recalcular a partir de pagos_cuotas_aplicaciones)
UPDATE public.cronograma_cuotas cc
SET
  capital_pagado = 0,
  interes_pagado = 0,
  estado = 'pendiente',
  fecha_pago = NULL
WHERE cc.id IN (
  SELECT DISTINCT id_cuota FROM public.pagos_cuotas_aplicaciones
);

-- 2. Borrar todas las aplicaciones
DELETE FROM public.pagos_cuotas_aplicaciones;
```

### Rollback de migración (eliminar tabla)

```sql
-- Solo si se desea deshacer la creación de la tabla
DROP TABLE IF EXISTS public.pagos_cuotas_aplicaciones;
```

**Advertencia:** El rollback de la tabla elimina todo el historial de aplicaciones. Solo usarlo si el apply de datos nunca se ejecutó o si ya se realizó el rollback de datos primero.

---

## 8. Riesgos de esta fase

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Migración crea tabla con FK a tablas existentes | Baja | FKs apuntan a PK de tablas que existen. `ON DELETE RESTRICT` previene borrar pagos/cuotas que ya fueron aplicados |
| `GENERATED ALWAYS AS` no soportado en Postgres viejo | Baja | Supabase usa Postgres 15+ que soporta columnas generadas STORED |
| UNIQUE en (id_pago, id_cuota, fecha_aplicacion) puede ser muy estricto | Media | Si se necesitan dos aplicaciones del mismo pago a la misma cuota el mismo día (raro), se puede cambiar el índice. Por ahora cubre todos los escenarios detectados |
| La tabla queda vacía hasta el apply de 10K-2 | Ninguno | Es lo esperado — la tabla existe como infraestructura, no tiene datos de prueba |

---

## 9. Qué NO se modificó en esta fase

- ✅ `cronograma_cuotas` — NO modificada
- ✅ `pagos_recibos` — NO modificada
- ✅ `creditos` — NO modificada
- ✅ `socios` — NO modificada
- ✅ `usuarios` — NO modificada
- ✅ `configuracion` — NO modificada
- ✅ `auth.users` — NO modificada
- ✅ Ningún dato de producción modificado
- ✅ Migración creada SOLO localmente — no aplicada en Supabase

---

## 10. Autorización requerida para continuar

Para aplicar la migración en Supabase (crear la tabla en producción):

```
APLICAR TRAZABILIDAD PAGOS CUOTAS 10K-1
```

Esta autorización habilita exclusivamente:
1. `npx supabase db push` de la migración `20260702000003_create_pagos_cuotas_aplicaciones.sql`
2. Verificación post-apply de la tabla en Supabase

No habilita el apply de pagos a cuotas (eso es Fase 10K-2 con su propia autorización).

---

## 11. Siguiente fase recomendada

**Fase 10K-2 — Apply controlado de pagos a cuotas**

Bloqueada hasta:
1. ✅ Tabla `pagos_cuotas_aplicaciones` aplicada en Supabase (autorización `APLICAR TRAZABILIDAD PAGOS CUOTAS 10K-1`)
2. ⏳ Confirmación de los 3 match_medio con área de Créditos
3. ⏳ Verificación del pago 411**** (S/1,896.96) con Tesorería — ¿prepago o error?

**Autorización de Fase 10K-2:** `APLICAR PAGOS A CUOTAS 10K-2`

---

## 12. Archivos de esta fase

| Archivo | Descripción |
|---|---|
| `supabase/migrations/20260702000003_create_pagos_cuotas_aplicaciones.sql` | Migración local (NO aplicada) |
| `scripts/check-pagos-cuotas-traceability.mjs` | Verificación de seguridad |
| `docs/ai-recovery/PAGOS_CUOTAS_TRACEABILITY_PLAN.md` | Este documento |
