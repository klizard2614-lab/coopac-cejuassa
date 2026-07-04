# PAGOS_CREDITOS_LINK_APPLY_REPORT.md

**Fase:** 9C-6F — Apply controlado link pagos → créditos
**Modo:** APPLY EJECUTADO
**Generado:** 2026-06-22T19:53:17.527Z

## Resultado

| Métrica | Valor |
|---|---|
| Pagos actualizados exitosamente | 28 |
| Pagos con error | 0 |
| Pagos con id_credito = NULL post-apply | 804 |

## Confirmaciones

- ✅ Solo se actualizó `pagos_recibos.id_credito`
- ✅ Solo se aplicaron registros con categoría `match_alto`
- ✅ `cronograma_cuotas` NO fue modificada
- ✅ `creditos` NO fue modificada
- ✅ `socios` NO fue modificada
- ✅ `usuarios` NO fue modificada
- ✅ `configuracion` NO fue modificada
- ✅ `auth.users` NO fue modificada
- ✅ No se insertaron ni eliminaron datos

## Detalle de filas aplicadas (enmascarado)

| pago_masked | credito_masked | ok | error |
|---|---|---|---|
| 411**** | 1138**** | ✅ |  |
| 438**** | 1157**** | ✅ |  |
| 440**** | 1158**** | ✅ |  |
| 441**** | 1156**** | ✅ |  |
| 443**** | 1137**** | ✅ |  |
| 472**** | 1150**** | ✅ |  |
| 508**** | 1153**** | ✅ |  |
| 555**** | 1134**** | ✅ |  |
| 571**** | 1151**** | ✅ |  |
| 676**** | 1139**** | ✅ |  |
| 694**** | 1148**** | ✅ |  |
| 708**** | 1142**** | ✅ |  |
| 740**** | 1146**** | ✅ |  |
| 755**** | 1152**** | ✅ |  |
| 795**** | 1136**** | ✅ |  |
| 822**** | 1155**** | ✅ |  |
| 834**** | 1160**** | ✅ |  |
| 939**** | 1159**** | ✅ |  |
| 999**** | 1145**** | ✅ |  |
| 1004**** | 1138**** | ✅ |  |
| 1093**** | 1141**** | ✅ |  |
| 1141**** | 1132**** | ✅ |  |
| 1145**** | 1135**** | ✅ |  |
| 1161**** | 1144**** | ✅ |  |
| 1170**** | 1131**** | ✅ |  |
| 1199**** | 1147**** | ✅ |  |
| 1211**** | 1133**** | ✅ |  |
| 1232**** | 1143**** | ✅ |  |

## Categorías NO aplicadas (confirmado)

- `match_medio`: 3 registros — requieren revisión manual
- `ambiguo`: 0 registros — requieren revisión manual
- `no_aplica_credito`: 417 registros — sin componente de crédito
- `sin_match`: 384 registros — sin datos suficientes

## Riesgos restantes

- 3 match_medio pendientes de revisión manual.
- 0 ambiguos pendientes de revisión manual.
- Saldos, cuotas y estados no han sido recalculados (fase posterior).
- Hay 804 pagos con id_credito = NULL restantes.

## Próxima fase recomendada

Revisar manualmente los 3 match_medio con el área de Créditos.
Luego evaluar vinculación de cuotas (cronograma_cuotas) en una fase separada.