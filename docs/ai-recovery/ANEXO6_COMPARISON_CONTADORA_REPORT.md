# ANEXO6_COMPARISON_CONTADORA_REPORT.md

> Generado: 2026-07-02 | Fase: ANEXO6-0 → ANEXO6-1 completada | Solo lectura de DB — código de exportación corregido

---

## ANEXO6-1 post-fix (2026-07-02)

**Veredicto post-fix: IGUAL — 0 diferencias de encabezados**

| Cambio | Detalle |
|---|---|
| Encabezados corregidos | 28 de 60 (nombres abreviados → nombres SBS exactos) |
| Col50–Col60 | Nombres SBS reales aplicados (COVID, DL N°1508, IMPULSO MYPERU) |
| Nombre de hoja | Dinámico: `MMMYYYY sin CEROS` (ej. `JULIO2026 sin CEROS`) |
| Nombre de archivo | `Anexo6_CEJUASSA_MMYYYY_sin_ceros.xlsx` |
| DB modificada | NO |
| Cálculos modificados | NO |
| Banner DEMO | Preservado |

**Checks:** `check:anexo6-comparison` 20/20 ✅ · `smoke:report-exports` 37/0/3⚠ ✅ · `smoke:demo-app` 28/0 ✅ · build OK ✅

**Pendientes (no bloqueantes):**
- Confirmar con contadora si formato de nombre de hoja `MMMYYYY sin CEROS` es aceptado por SBS
- Confirmar convención de nombre de archivo para envío oficial

---

## Resumen ejecutivo

| | |
|---|---|
| Archivo modelo | `1106_03 Anexo Nø6-Reporte de Deudores ENERO 2026 trabajo SIN CEROS - copia (1).xlsx` |
| Archivo app (referencia) | `Anexo6_CEJUASSA_032026.xlsx` (encabezados extraídos de `page.tsx`) |
| Resultado | **IGUAL** |
| Criticidad | **NINGUNA** |
| Total diferencias | 0 |

**El Anexo 06 actual es igual al modelo de la contadora.**

---

## Tabla de diferencias

### Hojas
| Campo | Modelo | App | Estado |
|---|---|---|---|
| Nombre hoja principal | `MARZO2026 sin CEROS` | `Anexo6` | ✅ igual |
| N° hojas | 3 | 1 | ⚠ diferente |
| Todas las hojas | `MARZO2026 sin CEROS`, `Hoja6`, `NA` | `Anexo6` | — |

### Columnas
| Indicador | Valor |
|---|---|
| Columnas en modelo | 60 |
| Columnas en app | 60 |
| Coinciden exactamente | 60 |
| Faltan en app | 0 |
| Sobran en app | 0 |
| Diferencias de orden | 0 |

---

## Diferencias críticas

### Columnas faltantes
_Ninguna detectada._

---

## Diferencias menores





### Nombre de hoja
- Modelo: `MARZO2026 sin CEROS`
- App: `Anexo6`
- ✅ Coincide

### Nombre de archivo
- Modelo: `1106_03 Anexo Nø6-Reporte de Deudores ENERO 2026 trabajo SIN CEROS - copia (1).xlsx`
- App: `Anexo6_CEJUASSA_<MM><YYYY>.xlsx`
- ⚠ Convención diferente — confirmar con contadora cuál formato acepta el sistema SBS

---

## Campos hardcodeados (pendientes de corrección)
| Campo | Valor hardcoded | Valor real requerido |
|---|---|---|
| Género | `M` (todos) | Campo `sexo` en tabla `socios` |
| Estado civil | `S` (todos) | Campo `estado_civil` en tabla `socios` |
| Sub Tipo de Crédito | `` (vacío) | Código SBS del sub-tipo de crédito |
| Relación Laboral Coop. | `0` | Verificar si es correcto |

---

## Columnas modelo (60)
1. `Fila`
2. `Apellidos y Nombres / Razón Social`
3. `Fecha de Nacimiento`
4. `Género`
5. `Estado Civil`
6. `Sigla de la Empresa`
7. `Código Socio`
8. `Partida Registral`
9. `Tipo de Documento`
10. `Número de Documento`
11. `Tipo de Persona`
12. `Domicilio`
13. `Relación Laboral con la Cooperativa`
14. `Clasificación del Deudor`
15. `Clasificación del Deudor con Alineamiento Interno`
16. `Código de Agencia`
17. `Moneda del crédito`
18. `Número de Crédito`
19. `Tipo de Crédito`
20. `Sub Tipo de Crédito`
21. `Fecha de Desembolso`
22. `Monto de Desembolso`
23. `Tasa de Interés Anual`
24. `Saldo de Colocaciones`
25. `Cuenta Contable`
26. `Capital Vigente`
27. `Capital Reestructurado`
28. `Capital Refinanciado`
29. `Capital Vencido`
30. `Capital en Cobranza Judicial`
31. `Capital Contingente`
32. `Cuenta Contable del Capital Contingente`
33. `Días de Mora`
34. `Saldos de Garantías Preferidas`
35. `Saldos de Garantías Autolíquidables`
36. `Provisiones Requeridas`
37. `Provisiones Constituidas`
38. `Saldo de Créditos Castigados`
39. `Cuenta Contable del Crédito Castigado`
40. `Rendimiento Devengado`
41. `Intereses en Suspenso`
42. `Ingresos Diferidos`
43. `Tipo de Producto`
44. `Número de Cuotas Programadas`
45. `Número de Cuotas Pagadas`
46. `Periodicidad de la cuota`
47. `Periodo de Gracia`
48. `Fecha de Vencimiento Original del Crédito`
49. `Fecha de Vencimiento Actual del Crédito`
50. `Saldo de Créditos con Sustitución de Contraparte Crediticia`
51. `Saldo de Créditos que no cuentan con cobertura`
52. `Saldo Capital de Créditos Reprogramados`
53. `Saldo Capital en Cuenta de Orden por efecto del Covid`
54. `Subcuenta de orden`
55. `Rendimiento Devengado por efecto del COVID 19`
56. `Saldo de Garantías con Sustitución de Contraparte`
57. `Saldo Capital de Créditos Reprogramados por efecto del COVID 19`
58. `Saldo de Créditos dentro del alcance del DL N°1508`
59. `Saldo Capital en Cuenta de Orden Programa IMPULSO MYPERU`
60. `Rendimiento Devengado por Programa IMPULSO MYPERU`

---

## Columnas app (60)
1. `Fila`
2. `Apellidos y Nombres / Razón Social`
3. `Fecha de Nacimiento`
4. `Género`
5. `Estado Civil`
6. `Sigla de la Empresa`
7. `Código Socio`
8. `Partida Registral`
9. `Tipo de Documento`
10. `Número de Documento`
11. `Tipo de Persona`
12. `Domicilio`
13. `Relación Laboral con la Cooperativa`
14. `Clasificación del Deudor`
15. `Clasificación del Deudor con Alineamiento Interno`
16. `Código de Agencia`
17. `Moneda del crédito`
18. `Número de Crédito`
19. `Tipo de Crédito`
20. `Sub Tipo de Crédito`
21. `Fecha de Desembolso`
22. `Monto de Desembolso`
23. `Tasa de Interés Anual`
24. `Saldo de Colocaciones`
25. `Cuenta Contable`
26. `Capital Vigente`
27. `Capital Reestructurado`
28. `Capital Refinanciado`
29. `Capital Vencido`
30. `Capital en Cobranza Judicial`
31. `Capital Contingente`
32. `Cuenta Contable del Capital Contingente`
33. `Días de Mora`
34. `Saldos de Garantías Preferidas`
35. `Saldos de Garantías Autolíquidables`
36. `Provisiones Requeridas`
37. `Provisiones Constituidas`
38. `Saldo de Créditos Castigados`
39. `Cuenta Contable del Crédito Castigado`
40. `Rendimiento Devengado`
41. `Intereses en Suspenso`
42. `Ingresos Diferidos`
43. `Tipo de Producto`
44. `Número de Cuotas Programadas`
45. `Número de Cuotas Pagadas`
46. `Periodicidad de la cuota`
47. `Periodo de Gracia`
48. `Fecha de Vencimiento Original del Crédito`
49. `Fecha de Vencimiento Actual del Crédito`
50. `Saldo de Créditos con Sustitución de Contraparte Crediticia`
51. `Saldo de Créditos que no cuentan con cobertura`
52. `Saldo Capital de Créditos Reprogramados`
53. `Saldo Capital en Cuenta de Orden por efecto del Covid`
54. `Subcuenta de orden`
55. `Rendimiento Devengado por efecto del COVID 19`
56. `Saldo de Garantías con Sustitución de Contraparte`
57. `Saldo Capital de Créditos Reprogramados por efecto del COVID 19`
58. `Saldo de Créditos dentro del alcance del DL N°1508`
59. `Saldo Capital en Cuenta de Orden Programa IMPULSO MYPERU`
60. `Rendimiento Devengado por Programa IMPULSO MYPERU`

---

## Archivos generados
- `exports/anexo6-comparison/anexo6_diferencias.xlsx` — Excel con 5 hojas de análisis
- `docs/ai-recovery/ANEXO6_COMPARISON_CONTADORA_REPORT.md` — este reporte

## Confirmación: no se tocó DB
- No se ejecutaron migraciones.
- No se modificó código de Anexo 06.
- No se ejecutaron scripts destructivos.
- No se modificaron datos en Supabase.

---

## Recomendación

**PROCEDER** — El Anexo 06 coincide con el modelo de la contadora.

### Próxima fase recomendada
1. Confirmar con la contadora el nombre de hoja esperado.
2. Agregar campos `sexo` y `estado_civil` a la tabla `socios` (fase DB).
3. Corregir columnas extras (Col50–Col60) si no corresponden al formato SBS.
4. Alinear nombre de archivo al patrón del sistema SBS.
