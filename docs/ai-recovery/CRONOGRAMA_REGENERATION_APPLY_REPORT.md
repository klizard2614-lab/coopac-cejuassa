# CRONOGRAMA_REGENERATION_APPLY_REPORT.md
# Reporte Apply — Fase 9C-6D
# Generado: 2026-06-22 — Modo: APPLY

> **APPLY EJECUTADO** — Cuotas insertadas en cronograma_cuotas.

## Estadísticas globales

| Indicador | Valor |
|---|---|
| Modo | **APPLY** |
| Créditos vigentes | 26 |
| Créditos cancelados | 5 |
| Créditos elegibles | 26 |
| Cuotas simuladas / esperadas | 911 / 911 |
| Cuotas insertadas | 911 |
| cronograma_cuotas inicial | 0 |
| cronograma_cuotas final | 911 |

## Créditos procesados

| ID (parcial) | Monto | Plazo | Tasa% | Cuotas | ΣCapital | Estado |
|---|---|---|---|---|---|---|
| 1131**** | S/10000.00 | 45m | 26.82% | 45 | S/10000.00 | ✅ insertado |
| 1132**** | S/7700.00 | 48m | 26.82% | 48 | S/7700.00 | ✅ insertado |
| 1133**** | S/11000.00 | 24m | 26.82% | 24 | S/11000.00 | ✅ insertado |
| 1134**** | S/8000.00 | 36m | 26.82% | 36 | S/8000.00 | ✅ insertado |
| 1135**** | S/11300.00 | 48m | 26.82% | 48 | S/11300.00 | ✅ insertado |
| 1136**** | S/9500.00 | 48m | 26.82% | 48 | S/9500.00 | ✅ insertado |
| 1137**** | S/3500.00 | 30m | 26.82% | 30 | S/3500.00 | ✅ insertado |
| 1138**** | S/7500.00 | 40m | 26.82% | 40 | S/7500.00 | ✅ insertado |
| 1139**** | S/5000.00 | 48m | 26.82% | 48 | S/5000.00 | ✅ insertado |
| 1141**** | S/15000.00 | 36m | 26.82% | 36 | S/15000.00 | ✅ insertado |
| 1142**** | S/6500.00 | 24m | 26.82% | 24 | S/6500.00 | ✅ insertado |
| 1143**** | S/1800.00 | 12m | 26.82% | 12 | S/1800.00 | ✅ insertado |
| 1144**** | S/9000.00 | 36m | 26.82% | 36 | S/9000.00 | ✅ insertado |
| 1146**** | S/10000.00 | 41m | 26.82% | 41 | S/10000.00 | ✅ insertado |
| 1147**** | S/8000.00 | 42m | 26.82% | 42 | S/8000.00 | ✅ insertado |
| 1148**** | S/9000.00 | 24m | 26.82% | 24 | S/9000.00 | ✅ insertado |
| 1150**** | S/3500.00 | 20m | 26.82% | 20 | S/3500.00 | ✅ insertado |
| 1151**** | S/2500.00 | 18m | 26.82% | 18 | S/2500.00 | ✅ insertado |
| 1152**** | S/9500.00 | 48m | 26.82% | 48 | S/9500.00 | ✅ insertado |
| 1153**** | S/4000.00 | 24m | 26.82% | 24 | S/4000.00 | ✅ insertado |
| 1155**** | S/7000.00 | 48m | 26.82% | 48 | S/7000.00 | ✅ insertado |
| 1156**** | S/4000.00 | 24m | 26.82% | 24 | S/4000.00 | ✅ insertado |
| 1157**** | S/9000.00 | 29m | 26.82% | 29 | S/9000.00 | ✅ insertado |
| 1158**** | S/5000.00 | 24m | 26.82% | 24 | S/5000.00 | ✅ insertado |
| 1159**** | S/9000.00 | 46m | 26.82% | 46 | S/9000.00 | ✅ insertado |
| 1160**** | S/9800.00 | 48m | 26.82% | 48 | S/9800.00 | ✅ insertado |

## Validación post-insert

| Verificación | Resultado |
|---|---|
| cronograma_cuotas final = cuotas esperadas | ✅ 911 |
| creditos NO modificados | ✅ confirmado (script no toca tabla creditos) |
| pagos_recibos NO modificados | ✅ confirmado (script no toca tabla pagos_recibos) |
| socios NO modificados | ✅ confirmado |
| usuarios NO modificados | ✅ confirmado |

## Créditos omitidos

5 crédito(s) cancelados fueron ignorados (correcto).

## Riesgos restantes

1. **R1 — pagos sin id_credito:** 832 pagos tienen `id_credito = NULL`. Todas las cuotas quedaron como `pendiente`. La vinculación de pagos a cuotas es la **siguiente fase**.
2. **R2 — saldo_capital < monto_aprobado:** Los saldos reducidos por pagos previos no coinciden con el cronograma regenerado. Se resolverá al vincular pagos.
3. **R3 — cuotas con fecha pasada:** Cuotas con `fecha_vencimiento < hoy` aparecen como `pendiente`. La app las detecta como vencidas por lógica de fecha.

## Próxima fase recomendada

**Fase 9C-6E — Vincular pagos_recibos a créditos:** Resolver los 832 pagos con `id_credito = NULL`, asociarlos al crédito correcto, y marcar las cuotas correspondientes como pagadas.