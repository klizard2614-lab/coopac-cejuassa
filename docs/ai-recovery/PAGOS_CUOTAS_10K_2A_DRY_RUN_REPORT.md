# PAGOS_CUOTAS_10K_2A_DRY_RUN_REPORT.md

> Fase 10K-2A — Revisión final y dry-run de pagos contra cuotas.
> **Modo: SOLO LECTURA.** Ningún dato fue modificado. Este documento y el Excel adjunto
> son una propuesta para revisión de Tesorería/Créditos antes de cualquier apply.

---

## Resumen ejecutivo

Se auditaron los **832 pagos_recibos** existentes y se generó una simulación (dry-run)
de cómo se aplicarían contra `cronograma_cuotas` usando el mismo algoritmo de cascada
diseñado y validado en la Fase 10K-0. El resultado es **idéntico** al de 10K-0
(8 cuotas pagadas + 26 parciales = 34 propuestas), lo que confirma que el estado de la
base de datos no ha cambiado desde entonces y que el algoritmo sigue siendo determinista.

Se confirmó además que la tabla de trazabilidad `pagos_cuotas_aplicaciones` (creada en
Fase 10K-1) **sigue en 0 filas** — no se ha aplicado ningún pago todavía.

**Recomendación: revisar manualmente los 2 casos ambiguos antes de autorizar 10K-2B.**
Ver sección "Pagos que requieren revisión manual".

---

## Reglas usadas

- **Monto aplicable a cuotas** = `monto_capital + monto_interes` (excluye `monto_aporte`,
  `monto_fps`, `monto_fps_extra`, `monto_otros`).
- **Algoritmo de cascada:** cada pago se aplica a la cuota más antigua en estado
  `pendiente`, `vencida` o `parcial`. Si el monto cubre la cuota completa, el sobrante
  pasa a la siguiente cuota pendiente del mismo crédito. Si no alcanza, se distribuye
  proporcionalmente entre capital e interés y la cuota queda `parcial`.
- **Pagos sin `id_credito`** (804) no se simulan — no hay forma de determinar a qué
  crédito/cuota corresponden sin una decisión de negocio previa (ver Fase 9C-6F/9C-6G).
- **Casos ambiguos** se marcan cuando: (a) el monto aplicable de un pago supera S/1,500
  en un solo recibo (posible prepago múltiple o error de digitación), (b) el crédito del
  pago no tiene cronograma de cuotas generado, o (c) queda un excedente sin cuota
  pendiente donde aplicarlo.
- **Nada se escribe.** El script (`scripts/dry-run-pagos-cuotas-10k2a.mjs`) solo hace
  `SELECT` sobre `pagos_recibos`, `cronograma_cuotas`, `creditos` y
  `pagos_cuotas_aplicaciones` (esta última solo para contar filas).

---

## Resultados cuantitativos

| Métrica | Valor |
|---|---|
| Total pagos_recibos | **832** |
| Pagos con `id_credito` | **28** |
| Pagos sin `id_credito` | **804** |
| Pagos aplicables (monto > 0, con crédito) | **26** |
| — de los cuales: solo crédito (sin mezcla) | 1 |
| — de los cuales: mixtos (crédito + aporte/FPS) | 25 |
| Pagos con `id_credito` pero monto = 0 (no aplicables) | 2 |
| Pagos ambiguos (requieren revisión manual) | **2** |
| Cuotas pendientes/vencidas (global, 911 totales) | 911 |
| Cuotas parciales (global) | 0 |
| Cuotas pagadas (global) | 0 |
| Créditos con pagos vinculados | 27 |
| — de los cuales: sin cronograma (cancelados) | 1 |
| Propuestas de aplicación generadas | **34** |
| Cuotas que quedarían **PAGADAS** | **8** |
| Cuotas que quedarían **PARCIALES** | **26** |
| Cuotas únicas afectadas | 33 |
| **Monto total propuesto a aplicar** | **S/ 8,870.70** |
| Filas en `pagos_cuotas_aplicaciones` (confirmado) | **0** |

---

## Pagos que requieren revisión manual (casos ambiguos)

| # | Pago | Crédito | Tipo | Detalle |
|---|---|---|---|---|
| 1 | 411**** | 1138**** | `monto_alto` | Monto aplicable S/1,896.96 para una cuota de S/285.59. Con cascada cubriría ~6 cuotas completas + 1 parcial. Ya identificado en Fase 10K-0 como **R-K2**. Pendiente de verificación con Tesorería: ¿es un prepago real de varias cuotas o un error de importación (posible dígito extra)? |
| 2 | (crédito cancelado) | 1145**** | `sin_cronograma` | El crédito asociado no tiene `cronograma_cuotas` (es un crédito cancelado, sin cuotas generadas al importar). No hay dónde aplicar este pago sin una decisión de negocio (¿descartar, o generar cronograma retroactivo?). |

Ambos casos ya estaban documentados como riesgos activos en `RISKS_AND_BUGS.md`
(**R-K**, **R-K2**) y en `PAGOS_CUOTAS_APPLICATION_PLAN.md` (Fase 10K-0). Esta fase no
agrega hallazgos nuevos — **confirma que siguen siendo los únicos 2 casos ambiguos**
sobre los 28 pagos vinculados a crédito.

Adicionalmente, siguen pendientes de decisión (no analizados por este dry-run porque no
tienen `id_credito` todavía):

- **3 pagos `match_medio`** (Fase 9C-6G) — Excel de revisión en
  `exports/data-corrections/revision_pagos_match_medio.xlsx`. Requiere que Créditos
  complete la columna `decision_creditos`.
- **804 pagos sin `id_credito`** — desglosados previamente (Fase 9C-6F) como 417
  `no_aplica_credito` (solo aporte/FPS, correcto que no tengan crédito) + 384 `sin_match`
  (socios sin crédito importado) + 3 `match_medio` (arriba). Ver hoja `pagos_sin_credito`
  del Excel adjunto para el listado completo enmascarado.

---

## Riesgos

1. **25 de 26 pagos aplicables son mixtos** (crédito + aporte/FPS en el mismo recibo).
   El split de campos viene de la importación Excel del cliente — no verificado campo
   por campo contra los recibos físicos. Riesgo medio, ya documentado como **R-K**.
2. **Pago 411**** con monto excesivo** — si el monto es un error de digitación, aplicar
   esta propuesta marcaría 6-7 cuotas como pagadas incorrectamente. Riesgo alto,
   documentado como **R-K2**. Bloqueante para 10K-2B hasta verificación de Tesorería.
3. **Crédito cancelado sin cronograma** — el pago asociado quedaría permanentemente sin
   aplicar si no se decide una acción (aceptable si el crédito realmente está cancelado
   y el pago ya fue contabilizado de otra forma).
4. **Cuotas parciales acumulativas** — el algoritmo asume que pagos posteriores sobre la
   misma cuota se acumulan (capital_pagado + interes_pagado). Esto es coherente con la
   regla de negocio confirmada en R7 (`pagos/nuevo/page.tsx`), pero el apply real deberá
   procesar los pagos de un mismo crédito en orden de fecha para que la cascada sea
   correcta (el dry-run ya ordena por `fecha` ascendente).
5. **Ningún control de concurrencia en el dry-run** — es una lectura puntual. Si se
   registran pagos o cuotas nuevas entre este dry-run y un futuro apply, los números
   deberán regenerarse antes de ejecutar 10K-2B.

---

## Qué NO se aplicó

- **NO** se modificó `cronograma_cuotas` (ni `capital_pagado`, `interes_pagado`,
  `estado`, ni `fecha_pago`).
- **NO** se insertó nada en `pagos_cuotas_aplicaciones` (confirmado en 0 filas antes y
  después de correr el script).
- **NO** se modificó `saldo_capital` ni ningún campo de `creditos`.
- **NO** se tocó `pagos_recibos`, `aportes`, `egresos` ni `socios`.
- **NO** se tocó Anexo 6 (`reportes/anexo6/page.tsx` ni sus datos).
- **NO** se tocó RLS, políticas ni ninguna tabla de seguridad (`auditoria`, `usuarios`).
- **NO** se ejecutó ningún `UPDATE`/`DELETE`/`INSERT` — el script solo usa `.select()`.

---

## Archivos generados

- Excel: `exports/pagos-cuotas-dryrun/10k_2a_propuesta_aplicacion_pagos_cuotas.xlsx`
  (hojas: `resumen`, `pagos_aplicables`, `aplicaciones_propuestas`, `casos_ambiguos`,
  `pagos_sin_credito`, `cuotas_afectadas`, `advertencias`)
- Preview JSON: `docs/ai-recovery/pagos_cuotas_10k2a_dryrun_preview.json`
- Script dry-run: `scripts/dry-run-pagos-cuotas-10k2a.mjs` (`npm run pagos-cuotas-10k2a:dry-run`)
- Script de verificación: `scripts/check-pagos-cuotas-10k2a-dryrun.mjs` (`npm run check:pagos-cuotas-10k2a`)
- Este reporte: `docs/ai-recovery/PAGOS_CUOTAS_10K_2A_DRY_RUN_REPORT.md`

---

## Recomendación antes de 10K-2B

**No proceder directamente a un apply automático.** Antes de cualquier Fase 10K-2B
(apply real e inserción en `pagos_cuotas_aplicaciones`):

1. Tesorería debe confirmar o corregir el pago 411**** (R-K2) — bloqueante.
2. Créditos debe completar `decision_creditos` para los 3 pagos `match_medio`
   (Fase 9C-6G) — si alguno resulta vinculable, cambiaría el universo de pagos
   aplicables y este dry-run debería regenerarse.
3. Decidir qué hacer con el pago del crédito cancelado sin cronograma (aceptar como
   "no aplicable permanentemente" o investigar).
4. Confirmar con Tesorería 2-3 casos de pagos mixtos al azar, para validar que
   `monto_capital + monto_interes` en `pagos_recibos` corresponde exactamente al pago
   real de cuota (riesgo R-K).
5. Solo después de (1)-(4), solicitar la autorización explícita
   `APLICAR PAGOS A CUOTAS 10K-2` para diseñar el script de apply real
   (Fase 10K-2B), que deberá:
   - Insertar en `pagos_cuotas_aplicaciones` una fila por cada aplicación.
   - Actualizar `cronograma_cuotas` (`capital_pagado`, `interes_pagado`, `estado`,
     `fecha_pago`) de forma atómica (RPC con row lock, siguiendo el patrón ya usado en
     `decrementar_saldo_capital` / `registrar_aporte_socio` / `crear_credito_con_cronograma`).
   - Excluir explícitamente los 2 casos ambiguos de este reporte hasta su resolución.

**Este dry-run (10K-2A) queda como la propuesta congelada de referencia para esa
decisión.**
