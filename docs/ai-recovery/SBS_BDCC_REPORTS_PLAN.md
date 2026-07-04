# SBS_BDCC_REPORTS_PLAN.md

> Plan de reportes SBS/BDCC | Generado: 2026-06-18
> Basado en: Oficio SBS N°32791-2026-SBS (Lima, 28 de mayo de 2026)

---

## 1. Contexto regulatorio

La SBS requirió a CEJUASSA regularizar el envío trimestral de las Bases de Datos de Cartera Crediticia (BDCC).

**Referencia:** Oficio Múltiple N°16265-2021-SBS del 30/03/2021 (ratificado en mayo 2026)

**Fechas límite:**
- **20/07/2026** — Trimestres marzo 2026 y junio 2026
- **20/08/2026** — Backlog trimestres marzo 2024 a diciembre 2025

**Canal:** SFTP hacia la SBS + carta firmada por Gerencia General, Gerencia de Riesgos y Contabilidad

---

## 2. Archivos BDCC requeridos

Por cada mes del trimestre se generan **6 archivos TXT**:

| Código | Nombre | Contenido |
|---|---|---|
| BD01 | Base de Datos 01 | Créditos vigentes — datos por deudor (similar a Anexo 6 pero en formato TXT) |
| BD02-A | Base de Datos 02-A | Cuotas pagadas de créditos vigentes |
| BD02-B | Base de Datos 02-B | Cuotas pagadas de créditos cancelados |
| BD03A | Base de Datos 03-A | Garantías preferidas de créditos vigentes |
| BD03B | Base de Datos 03-B | Garantías preferidas de créditos cancelados |
| BD04 | Base de Datos 04 | Créditos cancelados |

**Por trimestre (3 meses × 6 archivos = 18 archivos TXT)**

---

## 3. Especificaciones técnicas (Oficio SBS — Anexo 1)

### 3.1 Formato de archivo
- **Extensión:** `.txt` (no Excel, no CSV, no otro)
- **Separador de columnas:** Tabulador (`\t`) — exactamente un tabulador entre columnas
- **Primera fila:** Encabezado con mnemónicos SBS (no números de columna)
- **Codificación:** UTF-8 o ANSI (ISO 8859-1) — ninguna otra
- **Campo vacío (null):** Ausencia de separadores — dos tabuladores consecutivos
  - NO registrar: null, "0", "0.00", "00/00/0000", "99", "N/A", guiones ni texto similar

### 3.2 Nomenclatura de archivos
```
{CódigoCoopac}_{BDCC}_{AAAAMM}.txt
```
Ejemplo para CEJUASSA (código SBS: `01270`), marzo 2026:
```
01270_BD01_202603.txt
01270_BD02A_202603.txt
01270_BD02B_202603.txt
01270_BD03A_202603.txt
01270_BD03B_202603.txt
01270_BD04_202603.txt
```
> Código COOPAC confirmado por Contabilidad (Fase 7B-1): `01270`. Ver `configuracion.codigo_coopac`.

### 3.3 Tipos de datos
- **Alfanumérico:** letras, números y símbolos especiales permitidos
- **Numérico:** solo números — 0.00 para campos vacíos numéricos con valor 0
- **Fecha:** `DD/MM/AAAA` — únicamente este formato

---

## 4. Campos BDCC críticos con reglas especiales

### BD01 — Créditos vigentes
| Mnemónico | Regla especial |
|---|---|
| DAK | Días de atraso al cierre — si es 0, reportar 0 (no vacío) |
| DAKR | Si primer cuota no vencida y cancelada anticipadamente → 0 |
| CCVI, CCRF, CCVE, CCJU, CCCO | Cuentas contables — NO pueden quedar vacíos |
| CCSIN, CCSID, CCSIS | NO pueden quedar vacíos |
| FPPK, FVEG, FVEP | NO pueden quedar vacíos |
| FCC | Crédito indirecto: campo FCC; si no aplica → 0 |
| FUK, FUINT | Si no corresponde → 00/00/0000 |
| CCSD | Solo consumo e hipotecario vivienda; otros → vacío |
| OSD | Sin información → 99 |
| TPINT | Tasa de interés nominal anual |

### BD02-A y BD02-B — Cuotas
| Mnemónico | Regla especial |
|---|---|
| FCAN / FCAN_C | Si deudor no pagó 100% de la cuota al cierre → 00/00/0000 |
| DAK, DAKC, DAK_C | Días de atraso = 0 → reportar 0, no vacío |
| SCONK, SCONINT, SCA_C | NO pueden quedar vacíos |
| IAP (BD02-A) | Interés amortizado en la cuota (nuevo campo agregado por SBS) |
| IAP_C (BD02-B) | Ídem para créditos cancelados |

### BD03A y BD03B — Garantías
| Mnemónico | Regla especial |
|---|---|
| TGR, FCONS, POL, FVEPOL, VCONS, FUVAL, REPEV, VCOM, VREA, CC, VBC, VANX, IGRC | NO pueden quedar vacíos |
| Si CEJUASSA NO tiene garantías preferidas | Enviar BD03A y BD03B con SOLO la fila de encabezado (mnemónicos) — sin datos |

### BD04 — Créditos cancelados
| Mnemónico | Regla especial |
|---|---|
| NCPR_C, NCPA_C, TPR_C | NO pueden quedar vacíos |
| NCAD_C | Si no hay cuotas adelantadas → 0 |
| MCI_C | Tipo numérico |
| SIM_C, SCOM, SIC_DIF, SIC_DEV, SIM_DIF, SIM_DEV, SCOM_DIF, SCOM_DEV | En caso de no corresponder → 0.00 |

---

## 5. Estado actual de la app vs. datos necesarios

### BD01 — Créditos vigentes (similar a Anexo 6)

| Campo BD01 | Fuente actual | Estado |
|---|---|---|
| Código socio | `socios.nro_socio` | ✅ |
| DNI | `socios.dni` | ✅ |
| Nombres/Apellidos | `socios.nombres/apellidos` | ✅ |
| Fecha nacimiento | `socios.fecha_nacimiento` | ✅ |
| Género | `socios.genero` | ❌ falta en tabla |
| Convenio (sigla) | `convenios.nombre` | ✅ |
| Clasificación deudor | Calculado (días mora) | ✅ |
| Fecha desembolso | `creditos.fecha_desembolso` | ✅ |
| Monto desembolso | `creditos.monto_aprobado` | ✅ |
| Tasa de interés | `creditos.tasa_interes` | ✅ |
| Saldo colocaciones | `creditos.saldo_capital` | ✅ |
| Capital vigente/vencido | Calculado | ✅ |
| Días mora | Calculado desde `cronograma_cuotas` | ✅ |
| Provisiones Requeridas | Calculado | ✅ |
| **Provisiones Constituidas** | ❌ B3 — hardcoded = Requeridas | **BLOQUEANTE** |
| N° cuotas programadas/pagadas | `cronograma_cuotas` | ✅ |
| Fecha vencimiento | `cronograma_cuotas` | ✅ |
| Cuenta contable | Hardcoded '1411030604' | ⚠ confirmar si es correcta |
| Tipo de crédito | Hardcoded '' | ❌ falta código SBS |

### BD02-A — Cuotas pagadas (vigentes)
| Campo | Fuente actual | Estado |
|---|---|---|
| Nro recibo | `pagos_recibos.nro_recibo` | ✅ |
| Fecha pago | `cronograma_cuotas.fecha_pago` | ✅ |
| Capital pagado cuota | `cronograma_cuotas.capital_pagado` | ✅ |
| Interés pagado cuota | `cronograma_cuotas.interes_pagado` | ✅ |
| **IAP** (interés amortizado) | `pagos_recibos.interes_amortizado_pagado` | ✅ campo existe |
| Días atraso al pago | No calculado | ❌ falta |
| Fecha de la cuota | `cronograma_cuotas.fecha_vencimiento` | ✅ |
| Tipo de pago (A/K) | `pagos_recibos.tipo_pago` | ❌ campo falta |

### BD02-B — Cuotas pagadas (créditos cancelados)
| Estado | Sin módulo de créditos cancelados | ❌ |

### BD03A / BD03B — Garantías
| Estado | CEJUASSA no tiene garantías preferidas → solo enviar encabezado | ✅ simple |

### BD04 — Créditos cancelados
| Estado | Sin módulo de créditos cancelados | ❌ |

---

## 6. Qué implementar para la primera entrega (20/07/2026)

### Prioridad 1 — INDISPENSABLE (sin esto no hay entrega)
1. **B3 definitivo:** Resolver Provisiones Constituidas — campo por mes en DB
2. **Módulo de generación TXT BDCC** en `/dashboard/reportes/` con:
   - Selector de mes/año
   - Botones: Generar BD01 TXT, Generar BD02-A TXT
   - Validaciones automáticas (campos no nulos obligatorios)
3. **Módulo de créditos cancelados** (mínimo: tabla o estado 'cancelado' en `creditos`) para BD02-B y BD04

### Prioridad 2 — RECOMENDADO
4. Agregar `genero` a `socios` (actualmente hardcoded 'M')
5. Agregar `tipo_pago` (A/K) a `pagos_recibos`
6. Agregar `tipo_credito_sbs` a `creditos` (código SBS para C19)

### Prioridad 3 — NO IMPLEMENTAR TODAVÍA
- BD03A/BD03B: CEJUASSA no tiene garantías → solo encabezado, trivial
- Campos COVID/IMPULSO MYPERU (todos = 0 para CEJUASSA)

### FUERA DE ALCANCE ACTUAL — Proyecto futuro separado
- **BDCC histórico 2024/2025 (Fase 7H):** el backlog solicitado en el oficio SBS (marzo 2024 a diciembre 2025, fecha límite 20/08/2026) se trabajará como un proyecto aparte. Requiere importación masiva de datos históricos, limpieza y validación que excede el alcance de esta fase.
- **No implementar 7H en esta fase.**

---

## 7. Validaciones automáticas que debe tener la app

Al generar cualquier archivo BDCC, la app debe:
1. Verificar que todos los campos NOT NULL estén rellenos
2. Validar formato de fechas (DD/MM/AAAA)
3. Validar que separadores sean tabuladores (no comas ni puntos y coma)
4. Verificar codificación UTF-8
5. Mostrar conteo de filas antes de descargar
6. Mostrar advertencia si Provisiones Constituidas = Provisiones Requeridas (B3 no resuelto)
7. Verificar que el código COOPAC esté configurado en `configuracion.codigo_coopac`

---

## 8. Estructura sugerida del módulo BDCC

```
app/dashboard/reportes/bdcc/page.tsx
  └── Selector: Trimestre (mar/jun/sep/dic) + Año
  └── Sección: Estado de datos (semáforo por BD)
  └── Botones por archivo:
       BD01 ← generable ya con fix B3
       BD02-A ← generable con datos actuales (parcial)
       BD02-B ← bloqueado hasta módulo cancelados
       BD03A ← enviar solo encabezado (trivial)
       BD03B ← enviar solo encabezado (trivial)
       BD04 ← bloqueado hasta módulo cancelados
  └── Validador antes de descargar (check de campos obligatorios)
  └── Descarga ZIP con los 6 archivos del mes seleccionado
```

---

## 9. Estado de decisiones contables — actualizado 2026-06-20

> Respuestas recibidas de Contabilidad (Fase 7B-1). Ver detalle completo en `docs/ai-recovery/ACCOUNTING_QUESTIONS_BDCC_B3.md`.

### Confirmadas ✅

| Decisión | Valor confirmado | Impacto |
|---|---|---|
| Código COOPAC SBS | `01270` | Nomenclatura de archivos: `01270_BD01_202603.txt` |
| Provisiones Constituidas = Provisiones Requeridas | Calculadas por clasificación con tasas SBS | C37 = C36 por deudor — B3 resuelto para alcance actual |
| Sin garantías preferidas | No tiene | BD03A y BD03B: solo fila de encabezado |
| Aporte descontado en desembolso | Aplica para socios nuevos | Campo `aporte_descontado` necesario |

### Parcialmente confirmadas ⚠

| Decisión | Valor candidato | Qué falta confirmar |
|---|---|---|
| Tipo de crédito | Consumo no revolvente | Código SBS exacto C19/C20 (el `1411030604` mencionado parece cuenta contable) |
| Cuenta contable BD01 | `1411050604` | Confirmar si aplica a todos los estados (vigente, vencido, judicial, coactiva) o varía |

### Pendientes ⏳ — consultar a Créditos y Tesorería

| Decisión | Área responsable | Bloquea |
|---|---|---|
| Género y estado civil de socios | Tesorería | Campo SEXO/ESTCIV en BD01 |
| Tipo de pago K (cancelación) | Créditos | BD02-A tipo de pago, BD02-B |
| Datos de créditos cancelados | Créditos | BD02-B y BD04 completos |
| Tasa 0.2682 en Anexo 6 (¿TEA o nominal?) | Créditos | Campo TPINT en BD01 |

**Actualización Fase 8B-1 (2026-06-20):** Exportadores MVP implementados. BD01, BD02-A, BD03A, BD03B generables desde `app/dashboard/reportes/bdcc/page.tsx`. Archivos son borradores revisables — confirmar mnemónicos y cuentas contables antes de enviar a SBS.

---

## 10. Riesgo regulatorio

**El incumplimiento del Oficio N°32791-2026-SBS es sancionable** bajo el Reglamento de Infracciones y Sanciones (Resolución SBS N°2755-2018 y modificatorias) — literal d: "No proporcionar, dentro de los plazos establecidos, información requerida en el desarrollo de supervisión y control."

**Prioridad:** Resolver B3 + implementar BD01 generador antes de 20/07/2026.
