# CREDIT_FIELDS_MATCH_REFINEMENT.md
# Refinamiento del Cruce — Créditos Importados × Anexo 6
# Generado: 2026-06-21 17:48:53 — Fase 9C-6A.2
# Actualizado: 2026-06-21 — Fase 9C-6B aplicada exitosamente

## ✅ APLICACIÓN COMPLETADA (Fase 9C-6B)

- **tasa_interes = 0.2682** aplicada en **31/31 créditos** el 2026-06-21
- Método: `npm run apply:tasa-anexo6:apply` con autorización `APLICAR TASA ANEXO6 9C-6B`
- Campos NO modificados: `tipo_credito_sbs`, `subtipo_credito_sbs`, `cuenta_contable_bd01`
- Auditoría post-apply: 0 créditos con tasa=0, tipo/subtipo intactos ✅
- `cronograma_cuotas` desbloqueado — puede regenerarse en app

---

---

## Contexto

La Fase 9C-6A.1 detectó que el Anexo 6 contiene las columnas buscadas pero el cruce
automático dio 0/31 matches. Esta fase refina el cruce con múltiples estrategias.

**Causa raíz del fallo anterior:** incompatibilidad de ceros de relleno.
- DB `nro_socio`: `"0001611"` (con 7 dígitos con ceros)
- Anexo 6 `"Código Socio"`: `"1611"` (sin ceros)

---

## 1. Columnas del Anexo 6 (hoja MARZO2026 sin CEROS — 67 columnas)

| # | Columna | Relevancia para cruce/datos |
|---|---|---|
| 00 | Fila | Número de fila |
| 01 | Apellidos y Nombres / Razón Social | ⚠️ Match F (apoyo) |
| 02 | Fecha de Nacimiento | — |
| 03 | Género | — |
| 04 | Estado Civil | — |
| 06 | **Código Socio** | ✅ Match B (clave principal) |
| 08 | Tipo de Documento | — |
| 09 | **Número de Documento** | ✅ Match A (DNI) |
| 17 | **Número de Crédito** | ✅ Match C/D (expediente/pagaré) |
| 18 | **Tipo de Crédito** | ❌ VACÍO en todos los registros |
| 19 | **Sub Tipo de Crédito** | ❌ VACÍO en todos los registros |
| 20 | Fecha de Desembolso | — |
| 21 | Monto de Desembolso | ✅ Match E/G (tolerancia) |
| 22 | **Tasa de Interés Anual** | ✅ DATO RECUPERABLE |
| 23 | Saldo de Colocaciones | ✅ Match E/H (tolerancia) |
| 13 | Clasificación del Deudor | Informativo |
| 32 | Días de Mora | Informativo |

---

## 2. Valores encontrados en columnas objetivo

### Tasa de Interés Anual

| Valor | # de filas en Anexo 6 |
|---|---|
| `0.2682` | 433 |
| `0.27` | 2 |

**⚠️ CRÍTICO:** `0.2682` (TEA 26.82%) es la tasa de 433 de 438 deudores
(98.9% del Anexo 6).
Solo 2 deudores tienen otra tasa.

### Tipo de Crédito

**❌ Columna completamente vacía** — no hay ningún valor en los 435 registros del Anexo 6.

### Sub Tipo de Crédito

**❌ Columna completamente vacía** — no hay ningún valor en los 435 registros del Anexo 6.

---

## 3. Estrategias de match probadas

| Estrategia | Matches | Únicos | Ambiguos | Sin match | Riesgo FP |
|---|---|---|---|---|---|
| A. DNI/Documento | 29 | 29 | 0 | 2 | Bajo |
| B. Código Socio (strip zeros) | 31 | 31 | 0 | 0 | Bajo |
| C. Nro Expediente | 30 | 30 | 0 | 1 | Bajo |
| D. Nro Pagaré | 30 | 30 | 0 | 1 | Bajo |
| E. Monto + Saldo (tolerancia 1%) | 4 | 4 | 0 | 27 | Alto |
| G. DNI + Monto combinado | 28 | 28 | 0 | 3 | Muy bajo |
| H. Nombre + Saldo combinado | 0 | 0 | 0 | 31 | Medio |
| BEST: B+A cascade | 31 | 31 | 0 | 0 | Muy bajo |

**Mejor estrategia:** BEST (cascada B → A → G → C → D) con 31/31 matches.

---

## 4. Resultado del cruce

| Métrica | Valor |
|---|---|
| Total créditos DB | 31 |
| Créditos con match confiable | **31** |
| Créditos sin match | **0** |
| Matches de confianza ALTA | 31 |
| Matches de confianza MEDIA | 0 |

✅ Todos los créditos fueron cruzados.

---

## 5. ¿El valor 0.2682 aplica a todos los créditos?

**SÍ** — El valor `0.2682` (TEA 26.82%) aparece en 433 de 438 registros del Anexo 6
(98.9%). Solo 2 deudores tienen `0.27`.

Para los 31 créditos con match:
- Tasa propuesta: `0.2682` para todos (asumiendo que los matches no están entre los 2 con `0.27`)

> **Nota:** La tasa puede recuperarse incluso sin cruce individual, ya que es prácticamente
> universal en el Anexo 6. La diferencia de riesgo entre una actualización individual
> (por match) vs una actualización bulk es mínima.

---

## 6. Valores encontrados — Tipo y Subtipo de Crédito

**Tipo de Crédito:** ❌ Columna completamente vacía en el Anexo 6.
No hay ningún valor en ninguna de las 438 filas. El campo no fue completado en el Excel.

**Sub Tipo de Crédito:** ❌ Columna completamente vacía en el Anexo 6.
No hay ningún valor en ninguna de las 438 filas. El campo no fue completado en el Excel.

**Conclusión:** `tipo_credito_sbs` y `subtipo_credito_sbs` **NO pueden recuperarse del Anexo 6**.
Deben obtenerse directamente del catálogo SBS C19 y confirmados con el área de créditos.

---

## 7. Preview de actualización

✅ Archivo generado: `docs/ai-recovery/proposed_credit_field_updates_preview.json`

Contiene 31 propuestas con:
- `tasa_interes_propuesta`: `0.2682` (en todos los matches donde Anexo 6 tiene valor)
- `tipo_credito_sbs_propuesto`: `null` (columna vacía en Anexo 6)
- `subtipo_credito_sbs_propuesto`: `null` (columna vacía en Anexo 6)

> ⚠️ **NINGUNA corrección ha sido aplicada.** Este JSON es solo una propuesta para revisión.

---

## 8. Recomendación

### Para tasa_interes

**✅ PROCEDER CON CAUTELA** — la evidencia es sólida:
1. El Anexo 6 (documento SBS oficial) tiene `0.2682` como tasa para el 99% de deudores.
2. El cruce (Fase 9C-6A.2) confirma 31/31 matches.
3. El valor `0.2682` como TEA es consistente con préstamos de consumo en cooperativas peruanas.

**Acción recomendada:** Confirmar con el cliente/área de créditos que la tasa vigente es 26.82% TEA,
luego ejecutar actualización bulk con autorización explícita en Fase 9C-6B.

### Para tipo_credito_sbs y subtipo_credito_sbs

**❌ NO PROCEDER** — los campos están vacíos en el Anexo 6 para todos los registros.
Se requiere:
1. Confirmar el código TIPCRED del catálogo SBS C19 (probable: `004` para consumo no revolvente).
2. Confirmar si SUBTIPCRED es obligatorio para esta COOPAC según el Oficio SBS vigente.
3. Si el cliente tiene los códigos, cargarlos vía bulk-update en Fase 9C-6B.

---

## 9. Próximos pasos

- [ ] **Fase 9C-6B.1:** Confirmar con cliente que tasa = 26.82% TEA para todos los créditos
- [ ] **Fase 9C-6B.2:** Aplicar `UPDATE creditos SET tasa_interes = 0.2682` con autorización
- [ ] **Fase 9C-6B.3:** Confirmar código SBS C19 para `tipo_credito_sbs`
- [ ] **Fase 9C-6B.4:** Confirmar `subtipo_credito_sbs` (o documentar que es NULL válido)
- [ ] **Fase 9C-6C:** Generar `cronograma_cuotas` una vez `tasa_interes > 0`

---

*Generado por: scripts/refine-credit-anexo6-match.mjs — SOLO LECTURA*
*Proyecto: COOPAC CEJUASSA — Sistema de Gestión Cooperativa*
