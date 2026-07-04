# CREDIT_FIELDS_SOURCE_VERIFICATION.md
# Verificación de Fuentes — tasa_interes · tipo_credito_sbs · subtipo_credito_sbs
# Generado: 2026-06-21 17:33:19 — Fase 9C-6A.1
# SOLO LECTURA — ningún dato fue modificado

---

## Resumen ejecutivo

| Campo | En DB | Faltantes | Recuperable desde Excel |
|---|---|---|---|
| `tasa_interes` | 0 de 31 | **31** | Ver sección 4 |
| `tipo_credito_sbs` (código SBS) | 0 de 31 | **31** | Ver sección 4 |
| `subtipo_credito_sbs` | 0 de 31 | **31** | Ver sección 4 |

---

## 1. Archivos revisados

| # | Archivo | Existe | Hojas | Filas datos | Col tasa | Col tipo | Col subtipo |
|---|---|---|---|---|---|---|---|
| 1 | DSCTO Y DESMBOLSO DE CRDITO MA ABR-2026 (1).xlsx | ✅ | Hoja3 | 1248 | ✅ `[Hoja3] Interes` | ❌ | ❌ |
| 2 | 1106_03 Anexo Nø6-Reporte de Deudores ENERO 2026 (1).xlsx | ✅ | MARZO2026 sin CEROS, Hoja6, NA | 449 | ✅ `[MARZO2026 sin CEROS] Tasa de Interés Anual`, `[MARZO2026 sin CEROS] Intereses en Suspenso`, `[NA] Intereses en Suspenso` | ✅ `[MARZO2026 sin CEROS] Clasificación del Deudor`, `[MARZO2026 sin CEROS] Clasificación del Deudor con Alineamiento Interno`, `[MARZO2026 sin CEROS] Tipo de Crédito`, `[MARZO2026 sin CEROS] Sub Tipo de Crédito`, `[NA] Clasificación del Deudor`, `[NA] Clasificación del Deudor con Alineamiento Interno` | ✅ `[MARZO2026 sin CEROS] Sub Tipo de Crédito` |
| 3 | INGRESO DETALLADO MARZO 2026 (1).xlsx | ✅ | RESUMEN, Hoja1 | 36 | ❌ | ❌ | ❌ |
| 4 | CONVENIO MES MARZO 2026 (1).xlsx | ✅ | RESUMEN, DETALLE | 809 | ❌ | ❌ | ❌ |
| 5 | 1105-05 informe de deudores (1).xlsx | ✅ | Sheet1 | 120 | ❌ | ❌ | ❌ |
| 6 | 1105_04_Cuadre del Anexo 5... (1).xlsx | ✅ | Sheet1 | 13 | ✅ `[Sheet1] Exposición equivalente a riesgo crediticio` | ❌ | ❌ |
| 7 | ELABORACION DE REPORTES DE CARTERA Y APORTES (1).xlsx | ✅ | ANEXO6 Y APORTES  | 69 | ❌ | ❌ | ❌ |

---

## 2. Estado actual de créditos en Supabase

| Campo | Con valor real | Sin valor / default | Total |
|---|---|---|---|
| `tasa_interes` | 0 | 31 | 31 |
| `tipo_credito_sbs` (texto/consumo_no_revolvente) | 31 | 31 | 31 |
| `tipo_credito_sbs` (código SBS numérico) | 0 | 31 | 31 |
| `subtipo_credito_sbs` | 0 | 31 | 31 |

> **Nota:** El valor actual de `tipo_credito_sbs` es el texto `'consumo_no_revolvente'` —
> no es un código SBS numérico del catálogo C19 (ej: '004'). Se cuenta como faltante para efectos BDCC.

---

## 3. Columnas encontradas por archivo

### DSCTO Y DESMBOLSO DE CRDITO
- **Hojas revisadas:** Hoja3
- **Columna "Interes":** ⚠️ PRESENTE — pero corresponde a `interes_acumulado` (interés corriente vencido), NO a `tasa_interes` (TEA/TEN)
- **Columnas detectadas como tasa:** [Hoja3] Interes
- **Muestras de valores:** 14.39, 12.01, 18.58, 20.31, 23.59, 30.87, 6.57, 0
- **Tipo crédito SBS:** ❌ No encontrado
- **Subtipo crédito SBS:** ❌ No encontrado

### Anexo 6 — Reporte de Deudores ENERO 2026

**Hoja `MARZO2026 sin CEROS`** (67 col, 441 filas datos):
- Tasa: `Tasa de Interés Anual`, `Intereses en Suspenso`
  - Muestras: `0`, `0`, `0`, `0`, `0`, `0`, `0`, `0`
- Tipo: `Clasificación del Deudor`, `Clasificación del Deudor con Alineamiento Interno`, `Tipo de Crédito`, `Sub Tipo de Crédito`
  - Muestras: (vacío)
- Subtipo: `Sub Tipo de Crédito`

**Hoja `Hoja6`** (7 col, 7 filas datos):
- Tasa: ❌ no encontrado
- Tipo: ❌ no encontrado
- Subtipo: ❌ no encontrado

**Hoja `NA`** (36 col, 1 filas datos):
- Tasa: `Intereses en Suspenso`
  - Muestras: `0`
- Tipo: `Clasificación del Deudor`, `Clasificación del Deudor con Alineamiento Interno`
  - Muestras: `4`
- Subtipo: ❌ no encontrado

### Otros archivos (Ingreso Detallado, Convenio, Informe Deudores, Cuadre Anexo 5, Cartera)

**INGRESO DETALLADO MARZO 2026 (1).xlsx:**
- Tasa: ❌ no encontrado
- Tipo crédito: ❌ no encontrado
- Subtipo: ❌ no encontrado

**CONVENIO MES MARZO 2026 (1).xlsx:**
- Tasa: ❌ no encontrado
- Tipo crédito: ❌ no encontrado
- Subtipo: ❌ no encontrado

**1105-05 informe de deudores (1).xlsx:**
- Tasa: ❌ no encontrado
- Tipo crédito: ❌ no encontrado
- Subtipo: ❌ no encontrado

**1105_04_Cuadre del Anexo 5... (1).xlsx:**
- Tasa: ✅ [Sheet1] Exposición equivalente a riesgo crediticio | Muestras: 20, 0, 2103925.83, 2103925.83, 0
- Tipo crédito: ❌ no encontrado
- Subtipo: ❌ no encontrado

**ELABORACION DE REPORTES DE CARTERA Y APORTES (1).xlsx:**
- Tasa: ❌ no encontrado
- Tipo crédito: ❌ no encontrado
- Subtipo: ❌ no encontrado

---

## 4. Cruce de 31 créditos contra Anexo 6

| Métrica | Valor |
|---|---|
| Créditos en DB | 31 |
| Matches en Anexo 6 (por expediente) | 0 |
| Matches en Anexo 6 (por nro_socio) | 0 |
| Matches en Anexo 6 (por DNI) | 0 |
| **Total créditos con match en Anexo 6** | **0** |
| De esos, con `tasa` en Anexo 6 | 0 |
| De esos, con `tipo` en Anexo 6 | 0 |
| De esos, con `subtipo` en Anexo 6 | 0 |

**Valores de tasa encontrados en Anexo 6 (para créditos con match):**
- (ninguno — columna tasa no encontrada o vacía)

**Valores de tipo encontrados en Anexo 6 (para créditos con match):**
- (ninguno — columna tipo no encontrada o vacía)

**Valores de subtipo encontrados en Anexo 6 (para créditos con match):**
- (ninguno — columna subtipo no encontrada o vacía)

---

## 5. ¿Aparece el valor 0.2682?

✅ Valor `0.2682` (TEA ~26.82%) detectado en:
- 1106_03 Anexo Nø6-Reporte de Deudores ENERO 2026 (1).xlsx

---

## 6. ¿Aparece código SBS oficial de tipo crédito?

✅ Se encontraron posibles códigos numéricos SBS en columnas de tipo crédito del Anexo 6. Revisar muestras en sección 3.

---

## 7. ¿Aparece subtipo crédito SBS?

❌ **El subtipo crédito SBS NO aparece** en ningún archivo Excel disponible.

No hay fuente de datos para poblar `subtipo_credito_sbs` de los 31 créditos.

---

## 8. Conteo exacto de faltantes

| Campo | Faltantes en DB | Recuperable desde Excel | Fuente |
|---|---|---|---|
| `tasa_interes` | **31 de 31** | ❌ No recuperable desde Excel disponible | Confirmación requerida área créditos |
| `tipo_credito_sbs` (código numérico) | **31 de 31** | ❌ No recuperable desde Excel | Catálogo SBS C19 + Oficio SBS |
| `subtipo_credito_sbs` | **31 de 31** | ❌ No recuperable desde Excel | Catálogo SBS + Oficio SBS |

---

## 9. Recomendación de corrección

### tasa_interes

**Estado:** Los 31 créditos tienen `tasa_interes = 0`. Los archivos Excel no contienen una columna de TEA/TEN directamente utilizable.

**Opciones:**
1. **Si todos los créditos son consumo no revolvente a la misma tasa:** aplicar un valor único confirmado por el área de créditos (script bulk-update con autorización explícita).
2. **Si hay créditos con tasas distintas:** requiere tabla de tasas por expediente provista por el área de créditos.
3. **No usar 0.2682 sin confirmación** — ese valor no aparece en los Excel y no tiene respaldo documental.

**Bloqueante para:** generación de `cronograma_cuotas` (la RPC de cronograma requiere `tasa_interes > 0`).

### tipo_credito_sbs (código SBS)

**Estado:** Todos los 31 créditos tienen el texto `'consumo_no_revolvente'` pero **no** el código numérico del catálogo SBS C19.

**Acción requerida:** Confirmar con el área de créditos o SBS:
- Código TIPCRED según catálogo C19 (probable: `'004'` para consumo no revolvente)
- Oficio SBS que define los códigos para esta COOPAC

**Bloqueante para:** exportación BDCC BD01 correcta.

### subtipo_credito_sbs

**Estado:** NULL en los 31 créditos. **No aparece en ningún Excel**.

**Acción requerida:** Confirmar con SBS/área de créditos el código SUBTIPCRED correspondiente.

**Nota:** Si los créditos son todos "consumo no revolvente directo", puede no haber subtipo requerido — consultar si el campo es opcional en el Oficio SBS vigente.

---

## 10. Próximos pasos recomendados

- [ ] **Fase 9C-6A.2:** Solicitar al cliente: lista de tasas por expediente O tasa única aplicada
- [ ] **Fase 9C-6A.3:** Confirmar código SBS C19 para tipo crédito (TIPCRED)
- [ ] **Fase 9C-6A.4:** Confirmar si subtipo_credito_sbs es obligatorio o puede ser NULL en BDCC
- [ ] **Fase 9C-6B:** Aplicar correcciones (requiere autorización explícita)

---

*Generado por: scripts/verify-credit-fields-sources.mjs — SOLO LECTURA*
*Proyecto: COOPAC CEJUASSA — Sistema de Gestión Cooperativa*
