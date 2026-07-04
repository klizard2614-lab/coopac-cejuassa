# AMPLIACIONES_FUNCIONALES_PLAN.md

> Diseño seguro para convertir el módulo de ampliaciones de informativo a funcional.
> Fase 10J-0 — 2026-06-24 | Fase 10J-1 — 2026-06-24 | Fase 10J-2B — 2026-07-02

---

## Fase 10J-2B — Cuota, Plazo y Tasa TEA Editables (2026-07-02)

### Objetivo

Ampliar el módulo de ampliaciones para que el operador pueda editar manualmente la cuota mensual, el plazo y la tasa TEA al registrar una ampliación. La cooperativa confirmó que estos tres valores cambian con cada ampliación.

### Migración necesaria

**Archivo:** `supabase/migrations/20260702000001_ampliaciones_add_tasa_cuota_nuevas.sql`

```sql
ALTER TABLE public.ampliaciones
  ADD COLUMN IF NOT EXISTS tasa_nueva  numeric(8,4)  NULL,
  ADD COLUMN IF NOT EXISTS cuota_nueva numeric(12,2) NULL;
```

- `NULL` permitido para compatibilidad con registros históricos anteriores a esta fase.
- El listado muestra `—` si alguna columna es NULL (sin romper UI).

### RPC extendida

**Archivo:** `supabase/migrations/20260702000002_extend_aplicar_ampliacion_credito.sql`

Nuevos parámetros añadidos a `aplicar_ampliacion_credito`:
- `p_plazo_nuevo integer` — ya existía, ahora con validación `> 0`
- `p_tasa_nueva numeric` — nuevo, validación `>= 0`
- `p_cuota_nueva numeric` — nuevo, validación `> 0`

Campos que actualiza en `creditos`:
| Campo | ¿Antes? | ¿10J-2B? |
|---|---|---|
| `nro_pagare` | ✅ | ✅ |
| `monto_aprobado` | ✅ | ✅ |
| `saldo_capital` | ✅ | ✅ |
| `plazo_meses` | ❌ | ✅ |
| `tasa_interes` | ❌ | ✅ |
| `cuota_mensual` | ❌ | ✅ |

### Qué NO toca

- `cronograma_cuotas` — BLOQUEADO. No se recalcula en esta fase.
- `pagos_recibos` — intocable.
- `socios`, `aportes`, `egresos` — intocables.
- El formulario de edición histórica tampoco actualiza `creditos`.

### Riesgos

| Riesgo | Mitigación |
|---|---|
| RPC firma cambia → UI antigua falla | UI actualizada en la misma sesión |
| Registros históricos sin tasa_nueva | Columna NULL, UI muestra `—` |
| Cronograma queda desactualizado | Documentado. La cooperativa lo acepta explícitamente. |
| Apply sin migración previa → error en INSERT | dry-run verifica existencia de migraciones |

### Rollback

Si la migración causa problemas:

```sql
-- Deshacer columnas (DESTRUYE datos de tasa/cuota en registros 10J-2B)
ALTER TABLE public.ampliaciones
  DROP COLUMN IF EXISTS tasa_nueva,
  DROP COLUMN IF EXISTS cuota_nueva;

-- Restaurar RPC a versión 10J-1 (pegar SQL de 20260624000001_create_aplicar_ampliacion_credito.sql)
```

### Token de autorización

- Migración a Supabase: `APLICAR MIGRACION AMPLIACIONES 10J-2B`
- Prueba apply+revert: `PROBAR AMPLIACION EXTENDIDA 10J-2B`

---

---

## 1. Regla Confirmada por Contabilidad

> "En una ampliación se suma el monto al socio/crédito y cambia el número de pagaré."

Esto implica, en términos de DB:
- `creditos.monto_aprobado` += monto de la ampliación
- `creditos.saldo_capital` += monto de la ampliación
- `creditos.nro_pagare` = nro_pagare_nuevo
- Registro histórico en `ampliaciones`

---

## 2. Reglas NO Confirmadas (bloquean implementación completa)

| Pregunta | Estado | Impacto si no se confirma |
|----------|--------|--------------------------|
| ¿Se recalcula el cronograma de cuotas? | ❓ Sin confirmar | Si sí: requiere RPC atómica. Si no: cuotas antiguas quedan desactualizadas |
| ¿Cambia la cuota mensual? | ❓ Sin confirmar | Si cambia: requiere regenerar cronograma y actualizar `cuota_mensual` |
| ¿Cambia la tasa de interés? | ❓ Sin confirmar | Si cambia: falta campo `tasa_nueva` en tabla `ampliaciones` |
| ¿Se modifica el plazo real (`plazo_meses`)? | ❓ Sin confirmar | Si sí: actualizar `creditos.plazo_meses` |
| ¿Las cuotas anteriores se conservan? | ❓ Sin confirmar | Si no: riesgo de pérdida de historial de pagos |

**Recomendación:** Confirmar estas preguntas con la contadora antes de implementar la Fase 10J-1 (apply real).

---

## 3. Resolución de Ambigüedad: `monto_nuevo`

### Contexto del problema

La tabla `ampliaciones` tiene el campo `monto_nuevo` (numeric 12,2).
La UI actual lo etiqueta como "Monto Nuevo (S/)" — ambiguo.
La contadora dijo "se suma el monto" → el operador ingresa un **monto adicional** (delta).

### Opciones evaluadas

| Opción | Semántica de `monto_nuevo` | ¿Requiere migración? |
|--------|--------------------------|----------------------|
| A | Monto adicional a sumar (delta) | No |
| B | Monto aprobado total resultante | No |

### Decisión: Opción B — `monto_nuevo` = monto aprobado total resultante

**Justificación:**
1. El nombre del campo ("monto_nuevo") indica claramente el monto resultante, no el delta.
2. El campo `saldo_nuevo` sigue la misma semántica (saldo resultante, no delta).
3. El análisis previo (Fase 10D-0) confirmó: "El monto adicional = `monto_nuevo - saldo_anterior` (calculable)."
4. No se necesita migración para agregar `monto_ampliacion` como campo separado.
5. El delta siempre es recuperable: `delta = monto_nuevo[i] - monto_nuevo[i-1]` (o `monto_nuevo[1] - monto_aprobado_original` para la primera ampliación).

### Implementación en UI (sin cambio de DB)

El formulario de ampliación funcional debe:
1. Mostrar el `monto_aprobado` actual del crédito (read-only).
2. Pedir "Monto a ampliar" (campo temporal, solo en la UI).
3. Calcular y mostrar en tiempo real: `monto_aprobado_actual + monto_a_ampliar = nuevo monto aprobado`.
4. Guardar en `ampliaciones.monto_nuevo` el resultado final (= monto_aprobado_actual + monto_a_ampliar).
5. Guardar en `ampliaciones.saldo_nuevo` = `saldo_capital_actual + monto_a_ampliar`.

**Etiqueta visible en UI:** "Monto a ampliar (S/)"
**Vista previa:** "S/ {monto_aprobado_actual} + S/ {monto_a_ampliar} = S/ {monto_nuevo}"

---

## 4. Modelo Recomendado para Fase Apply (10J-1)

### Nombre: Modelo D-Funcional

Basado en el Modelo D del plan anterior, extendido con las actualizaciones a `creditos`.

### Flujo propuesto (cuando se implemente apply)

```
1. Operador abre formulario de "Aplicar Ampliación" para un crédito vigente.
2. Sistema pre-carga:
   - credito.nro_pagare (campo nro_pagare_anterior)
   - credito.monto_aprobado (para calcular monto_nuevo)
   - credito.saldo_capital (para calcular saldo_nuevo)
3. Operador ingresa:
   - nro_pagare_nuevo (string único)
   - monto_ampliacion (delta en S/)
   - plazo_nuevo (en meses — solo informativo por ahora)
   - observacion (texto libre)
4. Sistema muestra VISTA PREVIA (sin guardar):
   - Crédito actual: pagaré, monto_aprobado, saldo_capital
   - Tras ampliación: nro_pagare_nuevo, monto_aprobado+delta, saldo_capital+delta
   - Advertencia: "No se recalculará el cronograma de cuotas en esta fase"
5. Operador confirma.
6. Sistema ejecuta (en una sola operación atómica):
   a. INSERT en ampliaciones (historial)
   b. UPDATE creditos SET
        nro_pagare = nro_pagare_nuevo,
        monto_aprobado = monto_aprobado + monto_ampliacion,
        saldo_capital = saldo_capital + monto_ampliacion
      WHERE id = id_credito
7. Sistema muestra confirmación con los valores actualizados.
```

### Tablas afectadas en Fase Apply (10J-1)

| Tabla | Operación | Campos |
|-------|-----------|--------|
| `ampliaciones` | INSERT | id_credito, fecha, nro_pagare_anterior, nro_pagare_nuevo, monto_nuevo, plazo_nuevo, saldo_nuevo, observacion, created_by |
| `creditos` | UPDATE | nro_pagare, monto_aprobado, saldo_capital |
| `cronograma_cuotas` | **NO TOCAR** | — |
| `pagos_recibos` | **NO TOCAR** | — |
| `socios` | **NO TOCAR** | — |

---

## 5. ¿Requiere Migración?

### Con la tabla actual (sin migración)

| Requisito | Tabla actual soporta | Notas |
|-----------|---------------------|-------|
| Registrar historial de ampliación | ✅ Sí | Todos los campos necesarios presentes |
| Cambio de pagaré | ✅ Sí | `nro_pagare_anterior` + `nro_pagare_nuevo` (UNIQUE) |
| Monto total resultante | ✅ Sí | `monto_nuevo` = monto aprobado final |
| Saldo total resultante | ✅ Sí | `saldo_nuevo` = saldo capital final |
| Plazo nuevo | ✅ Sí | `plazo_nuevo` (solo informativo en esta fase) |
| Auditoría de quién aplicó | ✅ Sí | `created_by` + `created_at` |
| Workflow de aprobación | ❌ No | Falta campo `estado` |
| Tasa nueva si cambia | ❌ No | Falta campo `tasa_nueva` |
| Cuota nueva si cambia | ❌ No | Falta campo `cuota_nueva` |

### Conclusión

**La Fase 10J-1 (apply básico sin cronograma) puede implementarse sin migración.**

Solo si en fases posteriores se confirma:
- Workflow de aprobación → agregar `estado` TEXT CHECK ('registrada', 'aprobada', 'rechazada', 'anulada')
- Cambio de tasa → agregar `tasa_nueva` NUMERIC(8,4)
- Cambio de cuota → agregar `cuota_nueva` NUMERIC(12,2)

Estas migraciones son menores y se proponen solo, no se aplican aquí.

---

## 6. Flujo Dry-Run (esta fase — 10J-0)

El script `scripts/plan-ampliaciones-funcionales.mjs` hace:
1. Consulta `creditos` (solo SELECT) y elige el primer crédito vigente con saldo > 0.
2. Simula una ampliación de ejemplo (S/ 1,000):
   - Calcula `monto_nuevo = monto_aprobado + 1000`
   - Calcula `saldo_nuevo = saldo_capital + 1000`
   - Propone `nro_pagare_nuevo = {nro_pagare_actual}-AMP1`
3. Muestra el estado ANTES y DESPUÉS (sin guardar nada).
4. Verifica que `cronograma_cuotas` y `pagos_recibos` no se tocarían.
5. Analiza si el campo `monto_nuevo` es suficiente o si falta `monto_ampliacion`.
6. Reporta riesgos identificados.

**El script NO inserta, actualiza ni elimina nada en la base de datos.**

---

## 7. Flujo Apply Futuro (Fase 10J-1 — aún no implementado)

```
PRECONDICIONES:
  - Contadora confirmó regla: monto_aprobado += delta, saldo_capital += delta, nro_pagare cambia
  - Cronograma NO se recalcula (confirmado por esta fase)

APPLY:
  BEGIN TRANSACTION (idealmente vía RPC):
    1. INSERT INTO ampliaciones (...valores...)
    2. UPDATE creditos
         SET nro_pagare = nro_pagare_nuevo,
             monto_aprobado = monto_aprobado + monto_ampliacion,
             saldo_capital = saldo_capital + monto_ampliacion
         WHERE id = id_credito
           AND estado = 'vigente'
  COMMIT

VERIFICACIÓN POST-APPLY:
  - SELECT * FROM ampliaciones WHERE id_credito = ? ORDER BY created_at DESC LIMIT 1
  - SELECT nro_pagare, monto_aprobado, saldo_capital FROM creditos WHERE id = ?
  - Confirmar que nro_pagare = nro_pagare_nuevo
  - Confirmar que monto_aprobado = monto_aprobado_anterior + delta
  - Confirmar que saldo_capital = saldo_capital_anterior + delta
  - Confirmar que cronograma_cuotas NO fue modificado
```

**Nota:** Si se implementa con RPC en Supabase, el INSERT + UPDATE se ejecutan atómicamente. Si la actualización de `creditos` falla, el INSERT de `ampliaciones` también se revierte.

---

## 8. Rollback Propuesto

En caso de error en la Fase 10J-1 apply:

```sql
-- ROLLBACK PROPUESTO (NO EJECUTAR SIN VERIFICAR PRIMERO)
-- 1. Recuperar el registro de la ampliación aplicada
SELECT * FROM ampliaciones WHERE id_credito = ? ORDER BY created_at DESC LIMIT 1;

-- 2. Revertir el crédito a los valores anteriores
UPDATE creditos SET
  nro_pagare = <nro_pagare_anterior>,         -- de ampliaciones.nro_pagare_anterior
  monto_aprobado = monto_aprobado - <delta>,  -- delta = ampliaciones.monto_nuevo - monto_aprobado_anterior
  saldo_capital = saldo_capital - <delta>
WHERE id = <id_credito>;

-- 3. Eliminar el registro de la ampliación
DELETE FROM ampliaciones WHERE id = <id_ampliacion>;
```

**Riesgo de rollback:** Si entre el apply y el rollback se registró un pago, el rollback podría desincronizar `saldo_capital`. Siempre verificar el estado del crédito antes de hacer rollback.

---

## 9. Riesgos Identificados

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| Cronograma desactualizado tras apply | Alto | Advertir al operador en UI. Confirmar con contadora si se regenera en Fase 10J-2. |
| `nro_pagare_nuevo` ya existe (constraint UNIQUE) | Alto | Validar en UI antes de guardar. Error de Supabase es claro. |
| Doble ampliación del mismo crédito | Medio | No hay guard en DB. Implementar check en UI: "¿Está seguro?" |
| Saldo negativo si delta > saldo_capital | Medio | Validar en UI: `monto_ampliacion > 0`. El saldo aumenta, no disminuye. ✅ (no aplica — la ampliación suma, no resta) |
| Cronograma obsoleto afecta Anexo 6 | Medio | Anexo 6 lee `monto_aprobado` y `saldo_capital` desde `creditos`. Tras apply, Anexo 6 mostrará monto ampliado ✅. Cuotas individuales pueden no cuadrar. |
| Cronograma obsoleto afecta BDCC BD01 | Medio | BD01 lee `saldo_capital` desde `creditos`. Tras apply, BD01 refleja monto ampliado ✅. |
| Race condition si dos operadores ampliamos el mismo crédito | Bajo | Improbable en operación normal. Mitigar con RPC atómica en Fase 10J-1. |

---

## 10. Checks Necesarios Antes de Fase 10J-1 (Apply)

- [ ] Confirmar con contadora: ¿cronograma se recalcula o no?
- [ ] Confirmar con contadora: ¿cuota mensual cambia?
- [ ] Confirmar con Créditos: ¿tasa cambia al ampliar?
- [ ] Confirmar con Créditos: ¿plazo real cambia (o solo se registra)?
- [ ] Confirmar: ¿un crédito puede tener múltiples ampliaciones?
- [ ] Confirmar: ¿solo créditos vigentes pueden ampliarse?

---

## 11. Vista Previa UI (diseño propuesto para Fase 10J-1)

```
┌─────────────────────────────────────────────────────────┐
│  APLICAR AMPLIACIÓN — VISTA PREVIA                       │
├─────────────────────────────────────────────────────────┤
│  Crédito actual                                         │
│    Pagaré:           2024-0001                          │
│    Monto aprobado:   S/ 5,000.00                        │
│    Saldo capital:    S/ 3,200.00                        │
│    Plazo:            24 meses                           │
├─────────────────────────────────────────────────────────┤
│  Ampliación propuesta                                   │
│    Monto a ampliar:  S/ 2,000.00  ← ingresa operador   │
│    Nuevo pagaré:     2024-0001-A  ← ingresa operador   │
├─────────────────────────────────────────────────────────┤
│  Después de aplicar                                     │
│    Pagaré:           2024-0001-A                        │
│    Monto aprobado:   S/ 7,000.00  (= 5,000 + 2,000)   │
│    Saldo capital:    S/ 5,200.00  (= 3,200 + 2,000)   │
├─────────────────────────────────────────────────────────┤
│  ⚠ ADVERTENCIA                                          │
│  El cronograma de cuotas NO se recalculará.             │
│  Las cuotas existentes quedan sin cambio.               │
└─────────────────────────────────────────────────────────┘
```

---

## 12. Estado de la Fase

| Item | Estado |
|------|--------|
| Tabla `ampliaciones` auditada | ✅ (Fase 10D-0) |
| CRUD informativo operativo | ✅ (Fase 10D-1/1A) |
| Pantalla global ampliaciones | ✅ (Fase 10D-1B) |
| Ambigüedad `monto_nuevo` resuelta | ✅ (esta fase — Opción B: monto total) |
| Flujo apply diseñado | ✅ (esta fase — documentado) |
| Vista previa diseñada | ✅ (esta fase — documentado) |
| Rollback propuesto | ✅ (esta fase — documentado) |
| Confirmar reglas con contadora | ⏳ Pendiente — bloquea Fase 10J-1 |
| RPC atómica para apply | ⏳ Pendiente — diseñar en Fase 10J-1 |
| UI apply con vista previa | ⏳ Pendiente — implementar en Fase 10J-1 |

---

*Generado por Fase 10J-0 — 2026-06-24 — Solo análisis y diseño. NO modifica DB.*
