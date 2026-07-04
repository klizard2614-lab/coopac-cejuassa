# PAGOS_MATCH_MEDIO_REVIEW.md

> Fase 9C-6G — Revisión manual de pagos con categoría `match_medio`.
> Generado: 2026-06-22. NO modificar la base de datos manualmente.

---

## Resumen

| Dato | Valor |
|---|---|
| Total casos match_medio | **3** |
| Socios distintos | 2 |
| Créditos propuestos distintos | 2 |
| Categoría | `match_medio` |
| Fase origen | 9C-6E (dry-run vinculación pagos → créditos) |
| Estado DB | SIN CAMBIOS — ningún pago fue modificado en esta fase |

---

## ¿Por qué no se aplicaron automáticamente?

Los 3 pagos son `match_medio` (no `match_alto`) porque cumplen **solo parcialmente** los criterios de vinculación automática:

- El socio tiene **un único crédito en DB** (sin ambigüedad de a cuál crédito corresponde).
- El crédito propuesto tiene **estado vigente**.
- **Pero**: la fecha del pago está **fuera del rango de fechas esperado** del crédito (fecha de pago anterior a la fecha de desembolso, o fuera del período de cuotas calculado).

El sistema solo aplica automáticamente pagos `match_alto`, que cumplen todos los criterios sin excepción.

---

## Casos a revisar

| # | pago_id | fecha_pago | socio_id | monto_total | credito_propuesto_id | Razón |
|---|---|---|---|---|---|---|
| 1 | `412****` | 04/03/2026 | `3336****` | S/ 500.00 | `1147****` | Único crédito del socio, fuera de rango fecha, estado: vigente |
| 2 | `413****` | 04/03/2026 | `3336****` | S/ 150.00 | `1147****` | Único crédito del socio, fuera de rango fecha, estado: vigente |
| 3 | `422****` | 25/03/2026 | `3344****` | S/ 100.00 | `1159****` | Único crédito del socio, fuera de rango fecha, estado: vigente |

> IDs enmascarados. El archivo Excel contiene la misma información con columnas de decisión para completar.

---

## Qué debe confirmar el área de Créditos

Para cada caso, el área de Créditos debe determinar **cuál es la decisión correcta** e ingresarla en la columna `decision_creditos` del archivo Excel:

**`exports/data-corrections/revision_pagos_match_medio.xlsx`**

### Valores permitidos en `decision_creditos`

| Valor | Significado |
|---|---|
| `vincular_al_credito_propuesto` | El pago sí corresponde al crédito propuesto. Aunque la fecha está fuera de rango, el pago es válido y debe vincularse. |
| `no_vincular` | El pago NO corresponde al crédito propuesto. Dejar `id_credito = NULL`. |
| `credito_faltante_en_importacion` | El pago corresponde a un crédito que NO fue importado en la Fase 9C-4B. El crédito real existe en los registros físicos pero no en la base de datos. |
| `requiere_revision` | No es posible determinar con la información disponible. Requiere revisión de documentación física (pagaré, expediente). |

### Columna `observacion_creditos`

Campo libre para anotar cualquier aclaración: número de pagaré real, fecha de desembolso real, motivo de la decisión, etc.

---

## Preguntas clave para el área de Créditos

1. **Para los pagos `412****` y `413****` (socio `3336****`):**
   - ¿El crédito propuesto (`1147****`) es el crédito correcto para este socio?
   - ¿La fecha del pago (04/03/2026) es plausible dado el desembolso del crédito?
   - ¿O este socio tiene un crédito anterior que no fue importado?

2. **Para el pago `422****` (socio `3344****`):**
   - ¿El crédito propuesto (`1159****`) es el crédito correcto?
   - El pago es solo de interés (S/ 100.00 en `monto_interes`). ¿Es un pago de interés anticipado o de un período anterior?
   - ¿O hay un crédito anterior no importado?

---

## Instrucciones para el área de Créditos

1. Abrir el archivo: `exports/data-corrections/revision_pagos_match_medio.xlsx`
2. Para cada fila, revisar los datos del pago y el crédito propuesto en el sistema.
3. Completar la columna `decision_creditos` con uno de los 4 valores permitidos.
4. Completar `observacion_creditos` con notas adicionales (opcional pero recomendado).
5. **NO modificar directamente la base de datos** — entregar el Excel completado al equipo técnico para aplicar los cambios mediante el proceso aprobado.

---

## Qué sucede después

- Si la decisión es `vincular_al_credito_propuesto`: se aplicará un UPDATE puntual en `pagos_recibos.id_credito` para los 3 pagos afectados (Fase 9C-6H).
- Si la decisión es `credito_faltante_en_importacion`: se deberá planificar una importación complementaria del crédito faltante antes de vincular el pago.
- Si la decisión es `no_vincular` o `requiere_revision`: el pago permanece con `id_credito = NULL`.

---

## Estado de la base de datos en esta fase

| Campo | Estado |
|---|---|
| `pagos_recibos.id_credito` (3 match_medio) | `NULL` — sin cambio |
| `pagos_recibos.id_credito` (28 match_alto) | ✅ Vinculados en Fase 9C-6F |
| `cronograma_cuotas` | Sin cambio |
| `creditos` | Sin cambio |
| `socios` | Sin cambio |

**Esta fase (9C-6G) es exclusivamente de preparación de documentación. La base de datos NO fue modificada.**
