# CRONOGRAMA_REGENERATION_DRY_RUN_REPORT.md
# Reporte Dry-Run — Regeneración cronograma_cuotas
# Generado: 2026-06-22 — Fase 9C-6D.0 (re-run con tasa corregida)

> SOLO LECTURA — No se insertó ningún dato.
> Apply ejecutado en Fase 9C-6D (2026-06-22). Ver `CRONOGRAMA_REGENERATION_APPLY_REPORT.md`.

> ⚠️ **Nota:** El dry-run anterior (Fase 9C-6C) fue ejecutado con `tasa_interes = 0.2682` (decimal incorrecto).
> Este reporte usa `tasa_interes = 26.82` (porcentaje correcto, tras Fase 9C-6C.2).
> Las cuotas simuladas aquí son las correctas para el apply.

## Estadísticas globales

| Indicador | Valor |
|---|---|
| Tasa usada | 26.82% TEA |
| Total monto aprobado | **S/ 196,100.00** |
| Total cuotas a insertar | **911** |
| Créditos elegibles | **26 / 26** |
| ΣCapital = Monto en todos | ✅ 26/26 (desfase < S/0.05) |
| Créditos con saldo < monto | 26/26 (pagos previos sin cronograma) |

---

## Conteos actuales

| Tabla | Registros |
|---|---|
| `creditos` totales | 31 |
| `creditos` vigentes | 26 |
| `creditos` cancelados | 5 |
| `cronograma_cuotas` | 0 |

## Clasificación de créditos vigentes

| Categoría | Cantidad |
|---|---|
| Elegibles para cronograma | **26** |
| No elegibles | **0** |
| Total cuotas esperadas | **911** |

## Simulación por crédito elegible

| ID (parcial) | Monto | Saldo | Tasa% | Plazo | Cuotas | ΣCapital | ΔMonto | ΔSaldo | 1ª Venc. | Última Venc. |
|---|---|---|---|---|---|---|---|---|---|---|
| ✅ 1131**** | S/10000.00 | S/7192.81 | 26.82% | 45m | 45 | S/10000.00 | S/0.00 | S/2807.19 | 2026-04-02 | 2029-12-02 |
| ✅ 1132**** | S/7700.00 | S/6003.93 | 26.82% | 48m | 48 | S/7700.00 | S/0.00 | S/1696.07 | 2026-04-02 | 2030-03-02 |
| ✅ 1133**** | S/11000.00 | S/4682.49 | 26.82% | 24m | 24 | S/11000.00 | S/0.00 | S/6317.51 | 2026-04-02 | 2028-03-02 |
| ✅ 1134**** | S/8000.00 | S/6142.83 | 26.82% | 36m | 36 | S/8000.00 | S/0.00 | S/1857.17 | 2026-04-03 | 2029-03-03 |
| ✅ 1135**** | S/11300.00 | S/8844.53 | 26.82% | 48m | 48 | S/11300.00 | S/0.00 | S/2455.47 | 2026-04-03 | 2030-03-03 |
| ✅ 1136**** | S/9500.00 | S/7718.51 | 26.82% | 48m | 48 | S/9500.00 | S/0.00 | S/1781.49 | 2026-04-03 | 2030-03-03 |
| ✅ 1137**** | S/3500.00 | S/1642.34 | 26.82% | 30m | 30 | S/3500.00 | S/0.00 | S/1857.66 | 2026-04-04 | 2028-09-04 |
| ✅ 1138**** | S/7500.00 | S/711.96 | 26.82% | 40m | 40 | S/7500.00 | S/0.00 | S/6788.04 | 2026-04-04 | 2029-07-04 |
| ✅ 1139**** | S/5000.00 | S/2992.34 | 26.82% | 48m | 48 | S/5000.00 | S/0.00 | S/2007.66 | 2026-04-04 | 2030-03-04 |
| ✅ 1141**** | S/15000.00 | S/8794.61 | 26.82% | 36m | 36 | S/15000.00 | S/0.00 | S/6205.39 | 2026-04-04 | 2029-03-04 |
| ✅ 1142**** | S/6500.00 | S/2109.16 | 26.82% | 24m | 24 | S/6500.00 | S/0.00 | S/4390.84 | 2026-04-04 | 2028-03-04 |
| ✅ 1143**** | S/1800.00 | S/135.43 | 26.82% | 12m | 12 | S/1800.00 | S/0.00 | S/1664.57 | 2026-04-04 | 2027-03-04 |
| ✅ 1144**** | S/9000.00 | S/5892.13 | 26.82% | 36m | 36 | S/9000.00 | S/0.00 | S/3107.87 | 2026-04-05 | 2029-03-05 |
| ✅ 1146**** | S/10000.00 | S/7324.81 | 26.82% | 41m | 41 | S/10000.00 | S/0.00 | S/2675.19 | 2026-04-06 | 2029-08-06 |
| ✅ 1147**** | S/8000.00 | S/6219.78 | 26.82% | 42m | 42 | S/8000.00 | S/0.00 | S/1780.22 | 2026-04-06 | 2029-09-06 |
| ✅ 1148**** | S/9000.00 | S/6454.74 | 26.82% | 24m | 24 | S/9000.00 | S/0.00 | S/2545.26 | 2026-04-06 | 2028-03-06 |
| ✅ 1150**** | S/3500.00 | S/1560.14 | 26.82% | 20m | 20 | S/3500.00 | S/0.00 | S/1939.86 | 2026-04-16 | 2027-11-16 |
| ✅ 1151**** | S/2500.00 | S/713.92 | 26.82% | 18m | 18 | S/2500.00 | S/0.00 | S/1786.08 | 2026-04-16 | 2027-09-16 |
| ✅ 1152**** | S/9500.00 | S/7552.88 | 26.82% | 48m | 48 | S/9500.00 | S/0.00 | S/1947.12 | 2026-04-16 | 2030-03-16 |
| ✅ 1153**** | S/4000.00 | S/724.72 | 26.82% | 24m | 24 | S/4000.00 | S/0.00 | S/3275.28 | 2026-04-17 | 2028-03-17 |
| ✅ 1155**** | S/7000.00 | S/4161.98 | 26.82% | 48m | 48 | S/7000.00 | S/0.00 | S/2838.02 | 2026-04-19 | 2030-03-19 |
| ✅ 1156**** | S/4000.00 | S/2677.32 | 26.82% | 24m | 24 | S/4000.00 | S/0.00 | S/1322.68 | 2026-04-25 | 2028-03-25 |
| ✅ 1157**** | S/9000.00 | S/6295.13 | 26.82% | 29m | 29 | S/9000.00 | S/0.00 | S/2704.87 | 2026-04-25 | 2028-08-25 |
| ✅ 1158**** | S/5000.00 | S/2317.72 | 26.82% | 24m | 24 | S/5000.00 | S/0.00 | S/2682.28 | 2026-04-25 | 2028-03-25 |
| ✅ 1159**** | S/9000.00 | S/7204.12 | 26.82% | 46m | 46 | S/9000.00 | S/0.00 | S/1795.88 | 2026-04-26 | 2030-01-26 |
| ✅ 1160**** | S/9800.00 | S/6767.76 | 26.82% | 48m | 48 | S/9800.00 | S/0.00 | S/3032.24 | 2026-04-27 | 2030-03-27 |

## Resumen de coherencia

| Indicador | Valor |
|---|---|
| ΣCapital ≈ Monto (desfase < S/0.05) | 26 / 26 |
| ΣCapital ≠ Monto (desfase ≥ S/0.05) | 0 / 26 |
| Saldo capital < Monto (posibles pagos sin cronograma) | 26 / 26 |

## Riesgos identificados

1. **R1 — pagos sin id_credito:** 832 pagos tienen `id_credito = NULL`. El cronograma regenerado marcará todas las cuotas como `pendiente`. Las cuotas realmente pagadas no quedarán reflejadas hasta que se vincule `id_credito` en pagos (Fase futura).
2. **R2 — saldo_capital < monto_aprobado:** Si el saldo fue reducido por pagos previos, el cronograma regenerado no coincide con el estado real del crédito.
3. **R3 — cuotas con fecha pasada:** Cuotas con `fecha_vencimiento < hoy` quedan como `pendiente`; la app las detecta como vencidas por lógica de fecha.
4. **R4 — doble apply:** Si el script de apply se ejecuta dos veces, habrá cuotas duplicadas. Debe verificarse que `cronograma_cuotas` esté vacío para el crédito antes de insertar.

## Conclusión

- **26** créditos vigentes están listos para regenerar cronograma.
- **0** créditos no son elegibles.
- **911** cuotas se insertarían en el apply.
- La fórmula produce cronogramas coherentes (ΣCapital ≈ Monto en 26/26 créditos).

## ~~Próxima fase~~ → COMPLETADA (Fase 9C-6D, 2026-06-22)

**Apply ejecutado exitosamente.** 911 cuotas insertadas para 26 créditos vigentes.
Ver `CRONOGRAMA_REGENERATION_APPLY_REPORT.md` para el reporte completo del apply.

**Siguiente fase:** 9C-6E — Vincular `pagos_recibos.id_credito` (832 pagos con NULL).