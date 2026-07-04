# PAGOS_TO_CUOTAS_DRY_RUN_REPORT.md

**Fase:** 9C-6H.0 — Dry-run: simular aplicación de pagos a cronograma_cuotas
**Modo:** DRY-RUN — NINGÚN DATO FUE MODIFICADO
**Generado:** 2026-06-23T01:42:51.539Z

---

## Objetivo

Simular cómo los 28 pagos vinculados en Fase 9C-6F (id_credito IS NOT NULL) afectarían
el estado de las cuotas en `cronograma_cuotas`, sin modificar ningún dato.

## Metodología

1. Se cargan todos los `pagos_recibos` con `id_credito IS NOT NULL` (los 28 vinculados en 9C-6F).
2. Para cada crédito referenciado, se cargan sus cuotas en `cronograma_cuotas` ordenadas por `nro_cuota`.
3. Se ordenan los pagos por `fecha` ascendente (del más antiguo al más reciente).
4. Por cada pago, se busca la cuota más antigua en estado `pendiente`, `vencida` o `parcial`.
5. Se simula la acumulación de `capital_pagado` e `interes_pagado` en memoria.
6. Se determina el estado propuesto: `pagada` si capital + interés cubiertos, `parcial` si no.
7. Esta lógica es idéntica a la del frontend (`pagos/nuevo/page.tsx`, Fase 3B / R7).

## Regla de monto aplicable

| Campo | ¿Incluido en monto cuota? | Justificación |
|---|---|---|
| `monto_capital` | ✅ Sí | Componente de capital del préstamo |
| `monto_interes` | ✅ Sí | Componente de interés del préstamo |
| `monto_aporte` | ❌ No | Aporte de capital social del socio — no es pago de crédito |
| `monto_fps` | ❌ No | Fondo de previsión social — no es pago de crédito |
| `monto_fps_extra` | ❌ No | FPS extra — no es pago de crédito |
| `monto_otros` | ❌ No | Otros conceptos — no es pago de crédito |

**Fórmula:** `monto_aplicado = monto_capital + monto_interes`

## Resultado del dry-run

| Métrica | Valor |
|---|---|
| Pagos vinculados analizados | **28** |
| Créditos afectados | **27** |
| Cuotas propuestas como PAGADAS | **0** |
| Cuotas propuestas como PARCIALES | **26** |
| Pagos no asignables | **2** |
| Propuestas con confianza ALTA | **0** |
| Propuestas con confianza MEDIA | **26** |
| Propuestas con confianza BAJA | **0** |

## Créditos afectados

| Crédito (mask) | Cuotas total | Propuestas pagadas | Propuestas parciales | Pendientes restantes | Pagos |
|---|---|---|---|---|---|
| 1138**** | 40 | 0 | 2 | 40 | 2 |
| 1158**** | 24 | 0 | 1 | 24 | 1 |
| 1151**** | 18 | 0 | 1 | 18 | 1 |
| 1156**** | 24 | 0 | 1 | 24 | 1 |
| 1137**** | 30 | 0 | 1 | 30 | 1 |
| 1134**** | 36 | 0 | 1 | 36 | 1 |
| 1153**** | 24 | 0 | 1 | 24 | 1 |
| 1157**** | 29 | 0 | 1 | 29 | 1 |
| 1150**** | 20 | 0 | 1 | 20 | 1 |
| 1159**** | 46 | 0 | 1 | 46 | 1 |
| 1152**** | 48 | 0 | 1 | 48 | 1 |
| 1136**** | 48 | 0 | 1 | 48 | 1 |
| 1148**** | 24 | 0 | 1 | 24 | 1 |
| 1139**** | 48 | 0 | 1 | 48 | 1 |
| 1142**** | 24 | 0 | 1 | 24 | 1 |
| 1155**** | 48 | 0 | 1 | 48 | 1 |
| 1146**** | 41 | 0 | 1 | 41 | 1 |
| 1160**** | 48 | 0 | 1 | 48 | 1 |
| 1141**** | 36 | 0 | 1 | 36 | 1 |
| 1135**** | 48 | 0 | 1 | 48 | 1 |
| 1144**** | 36 | 0 | 1 | 36 | 1 |
| 1132**** | 48 | 0 | 1 | 48 | 1 |
| 1131**** | 45 | 0 | 1 | 45 | 1 |
| 1133**** | 24 | 0 | 1 | 24 | 1 |
| 1143**** | 12 | 0 | 0 | 12 | 1 |
| 1147**** | 42 | 0 | 1 | 42 | 1 |

## Cuotas propuestas como PAGADAS

_Ninguna cuota propuesta como pagada._

## Cuotas propuestas como PARCIALES

| Pago (mask) | Crédito (mask) | Cuota Nro | Fecha pago | Monto aplicado | Monto cuota | Diferencia | Confianza |
|---|---|---|---|---|---|---|---|
| 411**** | 1138**** | 1 | 2026-03-04 | S/ 1896.96 | S/ 285.59 | S/ 1611.37 | media |
| 1004**** | 1138**** | 1 | 2026-03-27 | S/ 118.56 | S/ 285.59 | S/ -167.03 | media |
| 440**** | 1158**** | 1 | 2026-03-25 | S/ 213.41 | S/ 271.45 | S/ -58.04 | media |
| 571**** | 1151**** | 1 | 2026-03-25 | S/ 127.00 | S/ 170.22 | S/ -43.22 | media |
| 441**** | 1156**** | 1 | 2026-03-25 | S/ 188.80 | S/ 217.16 | S/ -28.36 | media |
| 443**** | 1137**** | 1 | 2026-03-25 | S/ 158.02 | S/ 161.37 | S/ -3.35 | media |
| 555**** | 1134**** | 1 | 2026-03-25 | S/ 316.84 | S/ 325.83 | S/ -8.99 | media |
| 508**** | 1153**** | 1 | 2026-03-25 | S/ 146.33 | S/ 217.16 | S/ -70.83 | media |
| 438**** | 1157**** | 1 | 2026-03-25 | S/ 418.98 | S/ 425.05 | S/ -6.07 | media |
| 472**** | 1150**** | 1 | 2026-03-25 | S/ 215.33 | S/ 218.93 | S/ -3.60 | media |
| 939**** | 1159**** | 1 | 2026-03-26 | S/ 309.29 | S/ 315.16 | S/ -5.87 | media |
| 755**** | 1152**** | 1 | 2026-03-26 | S/ 311.85 | S/ 324.71 | S/ -12.86 | media |
| 795**** | 1136**** | 1 | 2026-03-26 | S/ 314.95 | S/ 324.71 | S/ -9.76 | media |
| 694**** | 1148**** | 1 | 2026-03-26 | S/ 478.85 | S/ 488.60 | S/ -9.75 | media |
| 676**** | 1139**** | 1 | 2026-03-26 | S/ 159.53 | S/ 170.90 | S/ -11.37 | media |
| 708**** | 1142**** | 1 | 2026-03-26 | S/ 185.81 | S/ 352.88 | S/ -167.07 | media |
| 822**** | 1155**** | 1 | 2026-03-26 | S/ 236.96 | S/ 239.26 | S/ -2.30 | media |
| 740**** | 1146**** | 1 | 2026-03-26 | S/ 364.55 | S/ 375.02 | S/ -10.47 | media |
| 834**** | 1160**** | 1 | 2026-03-27 | S/ 336.68 | S/ 334.97 | S/ 1.71 | media |
| 1093**** | 1141**** | 1 | 2026-03-27 | S/ 381.24 | S/ 610.93 | S/ -229.69 | media |
| 1145**** | 1135**** | 1 | 2026-03-30 | S/ 373.64 | S/ 386.24 | S/ -12.60 | media |
| 1161**** | 1144**** | 1 | 2026-03-30 | S/ 318.61 | S/ 366.56 | S/ -47.95 | media |
| 1141**** | 1132**** | 1 | 2026-03-30 | S/ 255.11 | S/ 263.19 | S/ -8.08 | media |
| 1170**** | 1131**** | 1 | 2026-03-30 | S/ 349.99 | S/ 354.67 | S/ -4.68 | media |
| 1211**** | 1133**** | 1 | 2026-03-31 | S/ 403.58 | S/ 597.18 | S/ -193.60 | media |
| 1199**** | 1147**** | 1 | 2026-03-31 | S/ 289.83 | S/ 295.63 | S/ -5.80 | media |

## Pagos no asignables

| Pago (mask) | Crédito (mask) | Razón |
|---|---|---|
| 999**** | 1145**** | sin cuotas en cronograma |
| 1232**** | 1143**** | monto_capital + monto_interes = 0 |

## Riesgos

1. **Cuotas regeneradas en estado pendiente (0 pagos previos):** Las cuotas se insertaron en Fase 9C-6D 
   con capital_pagado=0 e interes_pagado=0. La simulación es consistente con este estado inicial.
2. **Solo 28 pagos vinculados:** Los 804 pagos restantes (id_credito=NULL) no se incluyen en esta fase.
   Los créditos con pagos no vinculados mostrarán más cuotas en estado pendiente de lo real.
3. **Un pago por cuota:** La lógica aplica un pago a exactamente una cuota (la más antigua pendiente).
   Si el monto es mayor al total de la cuota, el exceso no se cascadea automáticamente.
4. **3 match_medio pendientes:** No están incluidos. Si se vinculan en la siguiente fase, podrían
   afectar cuotas de los mismos créditos.
5. **Diferencias (campo "diferencia"):** Una diferencia positiva indica que el pago superó el total
   de la cuota. Una diferencia negativa indica pago parcial. En ambos casos no hay ajuste automático.

## Recomendación: ¿Apply ahora o esperar los 3 match_medio?

### Opción A — Apply ahora (sin esperar match_medio)
**Pros:** Refleja la situación real de los 28 pagos ya vinculados. El módulo de cuotas
quedaría operativo para esos créditos.
**Contras:** Los 3 créditos de match_medio podrían tener cuotas adicionales que también
deberían marcarse. Si se aplica ahora y luego se vinculan los 3 match_medio, se necesitaría
un tercer apply que aplicaría esos pagos sobre las cuotas restantes (sin conflicto).

### Opción B — Esperar revisión de los 3 match_medio (RECOMENDADA)
**Pros:** Si los 3 match_medio se vinculan antes del apply de cuotas, el apply final
incluiría los 28 + hasta 3 pagos adicionales en una sola operación, cubriendo todos los créditos.
**Contras:** Depende de que el área de Créditos complete el Excel de revisión.

**Recomendación del sistema: Opción B — esperar los 3 match_medio.**
Razón: es una única oportunidad de tener el cuadre completo de pagos→cuotas en una sola fase.
Si el cliente demora, puede aplicarse Opción A como alternativa parcial.

## Archivos generados

- `scripts/dry-run-apply-pagos-to-cuotas.mjs` — este script (SOLO LECTURA)
- `docs/ai-recovery/proposed_cuotas_payment_updates_preview.json` — propuesta completa
- `docs/ai-recovery/PAGOS_TO_CUOTAS_DRY_RUN_REPORT.md` — este reporte
- `scripts/check-pagos-to-cuotas-plan.mjs` — verificación de seguridad

## Tablas NO modificadas (confirmado)

- ✅ `cronograma_cuotas` — NO modificada
- ✅ `pagos_recibos` — NO modificada
- ✅ `creditos` — NO modificada
- ✅ `socios` — NO modificada
- ✅ `usuarios` — NO modificada
- ✅ `configuracion` — NO modificada
- ✅ `auth.users` — NO modificada