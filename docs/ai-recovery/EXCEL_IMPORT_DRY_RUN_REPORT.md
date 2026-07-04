# EXCEL_IMPORT_DRY_RUN_REPORT.md
# Reporte Dry-Run de Importación Excel — CEJUASSA
# Generado: 2026-06-20 23:45:06

> Fase 9C-4A — Solo lectura. NO se insertó ningún dato.

---

## Estado general

| Indicador | Valor |
|---|---|
| Archivos Excel procesados | 3 (solo lectura) |
| Issues críticos | 6 |
| Warnings | 9 |
| Datos insertados | **0 — Ninguno** |
| Archivos modificados | **0 — Ninguno** |

---

## Resultados por fuente

### Créditos — DSCTO Y DESEMBOLSO ABR-2026


| Métrica | Valor |
|---|---|
| Total registros | 32 |
| Vigentes (saldo > 0) | 27 |
| Cancelados (saldo = 0) | 5 |
| Socios únicos referenciados | 31 |
| Expedientes únicos | 31 |
| Expedientes duplicados | 0 |

**Issues:**
- ❌ 1 créditos sin IdSocio
- ❌ 1 créditos sin Fecha

**Warnings:**
- ⚠️ 1 créditos sin Plazo definido
- ⚠️ Tasa de interés NO disponible en Excel — debe calcularse o asignarse manualmente
- ⚠️ Tipo de crédito NO disponible en Excel — default: 'consumo'
- ⚠️ Campos SBS (tipo_credito_sbs, subtipo_credito_sbs) ausentes — completar manualmente


---

### Pagos Caja — INGRESO DETALLADO MARZO 2026


| Métrica | Valor |
|---|---|
| Total registros | 34 |
| Socios únicos | 28 |
| Pagos con aporte | 17 |
| Pagos con capital | 23 |
| Pagos con interés | 23 |
| Recibos duplicados | 0 |
| Discrepancias de monto | 0 |

**Issues:**
- ❌ 1 pagos sin IdSocio
- ❌ 1 pagos sin N°Recibo

**Warnings:**
- ⚠️ id_credito NO disponible en Excel — se inferirá por socio activo al cargar
- ⚠️ 0 convenios únicos detectados — necesitan existir en tabla convenios


---

### Pagos Convenio — CONVENIO MES MARZO 2026


| Métrica | Valor |
|---|---|
| Total registros | 800 |
| Socios únicos | 769 |
| Convenios únicos detectados | 8 |
| Pagos con aporte | 769 |
| Pagos con capital | 348 |
| Pagos con interés | 354 |
| Recibos duplicados | 0 |

**Convenios detectados (campo Usuario):**
- `BELEN`
- `CHEPEN`
- `DIRES`
- `IREN`
- `IRO`
- `LAFORA`
- `REGION`
- `UTES`

**Issues:**
- ❌ 1 pagos sin IdSocio
- ❌ 1 pagos sin N°Recibo

**Warnings:**
- ⚠️ 1 pagos con discrepancia en monto total
- ⚠️ id_credito NO disponible en Excel — se inferirá por socio activo al cargar
- ⚠️ 8 convenios únicos detectados — necesitan existir en tabla convenios


---

## Relaciones cruzadas


| Verificación | Resultado |
|---|---|
| Socios con crédito en Excel (DSCTO) | 31 |
| Socios con pago en caja | 28 |
| Socios con pago en convenio | 769 |
| Pagos caja sin crédito en Excel | 25 |
| Pagos convenio sin crédito en Excel | 739 |

**Nota caja:** 25 socios con pago de caja no tienen crédito en el Excel de desembolsos (pueden ser pagos solo de aporte o créditos históricos no en el Excel)
**Nota convenio:** 739 socios con pago de convenio no tienen crédito en el Excel de desembolsos (misma razón)


---

## Tablas sin fuente Excel disponible

| Tabla | Estado | Alternativa |
|---|---|---|
| `socios` | ❌ Sin Excel | Backup JSON (backups/data-reset/20260620-1327/socios.json — 434 socios) |
| `egresos` | ❌ Sin Excel | Ingresar manualmente |
| `cronograma_cuotas` | N/A | Generado automáticamente por RPC C al crear créditos |
| `aportes` | N/A | Generados automáticamente por RPC B al registrar pagos |

---

## Totales candidatos a importar

| Tabla | Registros candidatos | Condición |
|---|---|---|
| `convenios` | ~10 | Inferir de campo Usuario en CONVENIO |
| `socios` | 434 | Desde backup JSON (no desde Excel) |
| `creditos` vigentes | 27 | saldo_capital > 0 |
| `creditos` cancelados | 5 | saldo_capital = 0 |
| `pagos_recibos` | 834 | 34 caja + 800 convenios |

---

## Campos que DEBEN completarse manualmente post-carga

- `socios.genero` — No disponible en ningún Excel
- `socios.estado_civil` — No disponible en ningún Excel
- `socios.beneficiario_nombre/dni/parentesco` — No disponible en ningún Excel
- `creditos.tasa_interes` — No disponible en Excel (calcular o asignar)
- `creditos.tipo_credito` — No disponible en Excel
- `creditos.tipo_credito_sbs` — No disponible en Excel
- `creditos.cuenta_contable_bd01` — No disponible en Excel
- `convenios.ruc`, `convenios.contacto`, `convenios.telefono` — No disponible en Excel

---

## Confirmaciones de cumplimiento

- ✅ **NO se insertó ningún dato en Supabase**
- ✅ **NO se modificaron archivos en _client_files/**
- ✅ **NO se imprimieron datos personales completos**
- ✅ **NO se usó backup JSON como fuente principal** (mencionado solo como alternativa)
- ✅ **NO se tocaron tablas de sistema (usuarios/configuracion)**
- ✅ **NO se crearon migraciones**
- ✅ **NO se borró ningún dato**

---

*Reporte generado por scripts/import-excel/dry-run-excel-import.mjs — 2026-06-20 23:45:06*
