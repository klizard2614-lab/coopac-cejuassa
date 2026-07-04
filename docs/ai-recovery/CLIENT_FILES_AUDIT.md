# CLIENT_FILES_AUDIT.md

> Auditoría documental — Fase 7A | Generado: 2026-06-18
> **Sensible — no compartir ni subir al repositorio.**

---

## 1. Inventario documental

| Archivo | Tipo | Hojas | Filas útiles | Módulo afectado |
|---|---|---|---|---|
| ELABORACION DE REPORTES DE CARTERA Y APORTES | Excel | 1 | 70 (texto) | Documentación proceso |
| CONVENIO MES MARZO 2026 | Excel | 4 (2 útiles) | 805 (DETALLE) | Pagos / Convenios |
| INGRESO DETALLADO MARZO 2026 | Excel | 4 (1 útil) | 39 (Hoja1) | Pagos / Caja |
| DSCTO Y DESMBOLSO DE CRDITO MA ABR-2026 | Excel | 1 | ~1248 (Hoja3) | Créditos / Desembolsos |
| 1106_03 Anexo N°6 ENERO 2026 | Excel | 3 (1 útil) | 448 (MARZO2026) | Reportes / Anexo 6 |
| 1105-05 Informe de Deudores | Excel | 1 | 128 | Reportes / Anexo 5 |
| 1105_04 Cuadre Anexo 5 con Balance | Excel | 1 | 21 | Reportes / Balance |
| WhatsApp Images (10–14, 4–5) | JPEG | — | 7 páginas | Regulatorio BDCC SBS |

---

## 2. Análisis por archivo

### A. ELABORACION DE REPORTES DE CARTERA Y APORTES

**Propósito:** Documento explicativo del flujo operativo actual vs. flujo ideal. Sin fórmulas. Sin datos numéricos.

**Flujo operativo actual:**
- **TESORERÍA** → ingresa pagos al módulo → descarga reportes: "Reporte de convenios" + "Ingreso detallado del mes"
- **CONTABILIDAD** → recibe reportes → elabora Anexo 6 (actualiza saldos, días mora, provisiones) + Reporte de aportes
- **CRÉDITOS** → valida Anexo 6 contra su módulo de créditos → devuelve validado a Contabilidad
- **CONTABILIDAD** → registra asientos contables + elabora Estados Financieros

**Flujo ideal propuesto:** La app debe permitir que el sistema genere automáticamente la mayor parte de esto.

**Tabla de provisiones confirmada (FUENTE OFICIAL DEL CLIENTE):**
| Clasificación | Días mora | Tasa SBS | Clasificador |
|---|---|---|---|
| Normal | 0–8 días | 1% | 0 |
| CPP | 9–30 días | 5% | 1 |
| Deficiente | 31–60 días | 25% | 2 |
| Dudoso | 61–120 días | 60% | 3 |
| Pérdida | >120 días | 100% | 4 |

> **Confirmado:** estas son exactamente las tasas ya implementadas en la app. ✅

**Proceso de aportes descubierto:**
- Los aportes se actualizan con pagos del mes (convenios + caja directa)
- Socios nuevos aparecen en el reporte de desembolsos (columna "Aporte descontado al desembolso")
- Retiros/renuncias/fallecidos → egresos → restar del saldo de aportes

**Módulos necesarios según el cliente:**
1. Reporte de convenios (mensual) ← ya existe parcialmente
2. Ingreso detallado del mes (mensual) ← **FALTA**
3. Anexo 6 (mensual) ← existe, incompleto
4. Reporte de aportes (mensual) ← existe en Reportes
5. Reporte de egresos (mensual) ← existe en Egresos
6. Reporte de desembolsos (mensual) ← **FALTA como reporte exportable**

---

### B. CONVENIO MES MARZO 2026

**Propósito:** Detalle de pagos realizados por convenio (planilla) — socios que pagan a través de su institución empleadora.

**Hojas:** RESUMEN (pivot por usuario/agencia), DETALLE (transacciones)

**Columnas DETALLE (15 cols):**
```
IdSocio | Socio | Fecha | N°Recibo | Ap | Ptmo | IntC | FPS | FPSEx | OtrosP | TotalRec | Usuario | Tipo | DNI | IdPers
```

**Mnemónicos SBS (confirmados):**
- `Ap` = Aporte mensual
- `Ptmo` = Cuota capital préstamo
- `IntC` = Interés compensatorio
- `FPS` = Fondo de Protección Social
- `FPSEx` = FPS extraordinario
- `OtrosP` = Otros pagos
- `TotalRec` = Total recibo
- `Tipo`: A = pago normal, K = cancelación/prepago
- `IdPers` = ID persona interno del sistema fuente (≠ IdSocio)
- `Usuario` = caja/agencia que registró: BELEN, CHEPEN, DIRES, LAFORA, IREN, IRO, REGION, UTES, OTUZCO, SCHUCO

**Relación con la app:** El archivo replica exactamente la tabla `pagos_recibos`. Las columnas son equivalentes:
- `IdSocio` → `id_socio`
- `N°Recibo` → `nro_recibo`
- `Ap` → `monto_aporte`
- `Ptmo` → `monto_capital`
- `IntC` → `monto_interes`
- `FPS` → `monto_fps`
- `FPSEx` → `monto_fps_extra`
- `OtrosP` → `monto_otros`
- `TotalRec` → `monto_total`
- `Usuario` → (no mapeado — sería `created_by` o un campo nuevo `canal_agencia`)
- `Tipo` → (no mapeado — campo nuevo `tipo_pago: A|K`)
- `IdPers` → no mapeado (ID del sistema externo — no necesario para la app)

**Campos FALTANTES en `pagos_recibos`:**
- `tipo_pago` (A = normal, K = cancelación) — actualmente la app no distingue
- `canal_agencia` (BELEN, CHEPEN, etc.) — actualmente solo `canal_pago` genérico

**Importable:** Sí, pero requiere decisión: ¿se importa histórico o solo sirve como referencia?

---

### C. INGRESO DETALLADO MARZO 2026

**Propósito:** Pagos por caja directa (no convenios). Mismo formato que el archivo de convenios.

**Columnas:** Idénticas a CONVENIO (15 cols). **Usuario:** USUCAJ (caja central).

**Diferencia clave vs. CONVENIO:**
- CONVENIO = pagos vía planilla institucional (descuentos por convenio)
- INGRESO DETALLADO = pagos directos en caja cooperativa
- Ambos tienen el mismo formato de columnas

**Tamaño:** Solo 39 filas en marzo 2026 — bajo volumen vs. convenios (805 filas).

**Campos con valores distintos:**
- `Tipo = K` en varios registros → cancelaciones/prepagos anticipados
- `FPS = 0` en muchas filas → socios que no tributan FPS por pago en caja

---

### D. DSCTO Y DESEMBOLSO DE CRÉDITO MAR-ABR 2026

**Propósito:** Detalle de descuentos aplicados al momento del desembolso de cada crédito nuevo.

**Columnas (20 cols, Hoja3 "Hoja3"):**
```
Item | Exped. | Fecha | IdSocio | Socio | Convenio | Monto | Saldo Capital | Interes | Aporte | FPS | Tram. | AutoSeg. | Monto Girado | Descuento | Plazo | CuoProp | Desc. Calculado | Mes | Año
```

**Fórmula verificada (32 filas, 2 descuadres de S/2.00 — aceptable):**
```
Descuento = Saldo Capital + Interés + Aporte + FPS + Tram. + AutoSeg.
Monto Girado = Monto - Descuento
```

**Ejemplos de valores reales:**
- Trámite: S/2.00 (fijo)
- AutoSeg: 2% del monto (ej: S/11,000 → S/220)
- Aporte descontado: usualmente S/0 (pero puede aplicar)
- FPS descontado: usualmente S/0 (pero puede aplicar)
- Saldo Capital: deuda del crédito anterior cancelado (para refinanciaciones)

**Campos FALTANTES en tabla `creditos`:**
| Campo | Descripción | Necesario para |
|---|---|---|
| `saldo_capital_anterior` | Deuda previa cancelada al desembolsar | Desembolso neto correcto |
| `interes_anterior` | Interés del crédito anterior | Desembolso neto correcto |
| `aporte_descontado` | Aporte rebajado al desembolso | Registro financiero |
| `fps_descontado` | FPS rebajado al desembolso | Registro financiero |
| `tramite` | Gastos de trámite (típico S/2.00) | Desembolso neto |
| `autoseguro` | Seguro de desgravamen (2% del monto) | Desembolso neto |
| `nro_expediente` | Número de expediente del crédito | Trazabilidad |

**Campos actuales que cubren parte:**
- `monto_aprobado` → Monto ✅
- `monto_girado_neto` → Monto Girado ✅ (ya existe en tabla)
- `descuento_fps` → FPS descontado ✅ (parcial)
- `descuento_seguro` → AutoSeg ✅ (parcial)
- `descuento_otros` → Tram. + otros ✅ (agrupado)

**Recomendación:** No crear tabla nueva. Ampliar `creditos` con los campos faltantes individualmente. Decisión pendiente.

**Archivos: 1252 filas (incluye encabezados y posibles filas vacías) → ~32 desembolsos en marzo.**

---

### E. 1106_03 ANEXO N°6 — Reporte de Deudores ENERO/MARZO 2026

**Propósito:** Reporte SBS oficial enviado trimestralmente. Formato exacto requerido por SBS.

**Hoja activa:** `MARZO2026 sin CEROS` | 448 filas | **67 columnas**

**Columnas oficiales (C1–C67):**

| # | Columna | Estado en app |
|---|---|---|
| C1 | Fila | ✅ |
| C2 | Apellidos y Nombres / Razón Social | ✅ |
| C3 | Fecha de Nacimiento (AAAAMMDD) | ✅ |
| C4 | Género | ✅ hardcoded 'M' — **falta en socios** |
| C5 | Estado Civil | ✅ hardcoded 'S' — **falta en socios** |
| C6 | Sigla de la Empresa (Convenio) | ✅ |
| C7 | Código Socio | ✅ |
| C8 | Partida Registral | ✅ hardcoded '' |
| C9 | Tipo de Documento | ✅ hardcoded 1 (DNI) |
| C10 | Número de Documento (DNI) | ✅ |
| C11 | Tipo de Persona | ✅ hardcoded 1 (natural) |
| C12 | Domicilio | ✅ |
| C13 | Relación Laboral con Cooperativa | ✅ hardcoded 0 |
| C14 | Clasificación del Deudor | ✅ |
| C15 | Clasificación con Alineamiento Interno | ✅ (= C14) |
| C16 | Código de Agencia | ✅ hardcoded '001' |
| C17 | Moneda del crédito | ✅ hardcoded '01' (soles) |
| C18 | Número de Crédito (nro_pagare) | ✅ |
| C19 | Tipo de Crédito | ⚠ hardcoded '' — **falta código SBS** |
| C20 | Sub Tipo de Crédito | ⚠ hardcoded '' — **falta código SBS** |
| C21 | Fecha de Desembolso (AAAAMMDD) | ✅ |
| C22 | Monto de Desembolso | ✅ |
| C23 | Tasa de Interés Anual | ✅ |
| C24 | Saldo de Colocaciones | ✅ |
| C25 | Cuenta Contable | ✅ hardcoded '1411030604' |
| C26 | Capital Vigente | ✅ |
| C27 | Capital Reestructurado | ✅ hardcoded 0 |
| C28 | Capital Refinanciado | ✅ hardcoded 0 |
| C29 | Capital Vencido | ✅ |
| C30 | Capital en Cobranza Judicial | ✅ |
| C31 | Capital Contingente | ✅ hardcoded 0 |
| C32 | Cuenta Contable Capital Contingente | ✅ hardcoded '' |
| C33 | Días de Mora | ✅ |
| C34 | Saldos de Garantías Preferidas | ✅ hardcoded 0 |
| C35 | Saldos de Garantías Autoliquidables | ✅ hardcoded 0 |
| C36 | **Provisiones Requeridas** | ✅ calculado |
| C37 | **Provisiones Constituidas** | ⚠ **B3 — hardcoded = Prov. Requerida** |
| C38 | Saldo de Créditos Castigados | ✅ hardcoded 0 |
| C39 | Cuenta Contable Créd. Castigado | ✅ hardcoded '' |
| C40 | Rendimiento Devengado | ✅ hardcoded 0 |
| C41 | Intereses en Suspenso | ✅ hardcoded 0 |
| C42 | Ingresos Diferidos | ✅ hardcoded 0 |
| C43 | Tipo de Producto | ✅ hardcoded '18' (consumo no revolvente) |
| C44 | Número de Cuotas Programadas | ✅ |
| C45 | Número de Cuotas Pagadas | ✅ |
| C46 | Periodicidad de la Cuota | ✅ hardcoded 30 (mensual) |
| C47 | Periodo de Gracia | ✅ hardcoded '' |
| C48 | Fecha de Vencimiento Original | ✅ |
| C49 | Fecha de Vencimiento Actual | ✅ (= C48) |
| C50–C67 | Saldos COVID/IMPULSO MYPERU/otros | ✅ hardcoded 0 |

**CRÍTICO: Campo C37 Provisiones Constituidas ≠ Provisiones Requeridas en el archivo real.**
La cooperativa tiene provisiones genéricas y específicas registradas contablemente (ver Cuadre del Balance).

**Comparación con la hoja NA (formato simplificado de 36 cols):**
La hoja `NA` tiene solo 36 columnas — versión resumida para referencia interna. El reporte oficial es la hoja `MARZO2026` con 67 columnas.

---

### F. 1105-05 INFORME DE DEUDORES (Anexo 5)

**Propósito:** Reporte SBS de clasificación de deudores y provisiones — resumen agregado (no por deudor).

**Formato:** Sección/Fila | Detalle | Normal(10) | CPP(20) | Deficiente(30) | Dudoso(40) | Pérdida(50) | Total(60)

**Secciones:**
- A. Monto de créditos directos (por tipo: consumo, hipotecario, empresas, etc.)
- B. Número de deudores
- C/C'. Equivalente a riesgo crediticio (antes/después sustitución garantías)
- D–H. Garantías (preferidas, autoliquidables, hipotecarias, etc.)
- **I. Provisiones Constituidas** ← dato real registrado por Contabilidad
- **J. Provisiones Requeridas** ← calculado SBS
- **K. Superávit/Déficit = I – J**

**Datos reales MARZO 2026 (Consumo no revolvente — único tipo activo):**
| Clasificación | Monto cartera | Deudores |
|---|---|---|
| Normal | S/1,680,083.43 | 324 |
| CPP | S/55,401.50 | 8 |
| Deficiente | S/74,675.06 | 13 |
| Dudoso | S/50,082.18 | 11 |
| Pérdida | S/243,683.66 | 57 |
| **TOTAL** | **S/2,103,925.83** | **413** |

**Provisiones Constituidas (sección I, fila 10300):**
- Normal: S/16,800.91
- CPP: S/2,770.08
- Deficiente: S/18,668.79
- Dudoso: S/30,049.31
- Pérdida: S/243,683.66
- **TOTAL: S/311,972.75**

**Provisiones Requeridas (sección J):** Vacío en este archivo — **no llenado por el cliente**.

**Hallazgo crítico:** La columna J (Provisiones Requeridas) está en blanco → el cliente no la calcula manualmente en este documento. Esto implica que la app debe calcularla y el cliente completará J con el valor de la app.

---

### G. 1105_04 CUADRE DEL ANEXO 5 CON CIFRAS DEL BALANCE

**Propósito:** Conciliar el Anexo 5 contra el balance contable. Valida que las provisiones en libros cuadren con el Anexo 5.

**Estructura:** Fila | Detalle | Saldo | Equiv. riesgo crediticio | Provisiones Genéricas | Provisiones Específicas

**Datos reales MARZO 2026:**
| Rubro | Saldo | Prov. Genéricas | Prov. Específicas |
|---|---|---|---|
| Créditos Directos | S/2,103,925.83 | S/311,972.75 | S/0.00 |
| Provisiones Genéricas constituidas (fila 1100) | S/16,800.91 | — | — |
| Provisiones Específicas constituidas (fila 1200) | S/295,171.84 | — | — |

**Total provisiones = S/16,800.91 + S/295,171.84 = S/311,972.75** ✅ (cuadra con Anexo 5 I)

**Hallazgo clave para B3:**
- Las Provisiones Constituidas NO son un solo número: se descomponen en **Genéricas + Específicas**
- Genéricas: créditos normales/CPP → S/16,800.91 (≈ Normal S/16,800.91 a 1%)
- Específicas: créditos en mora → S/295,171.84 (CPP + Deficiente + Dudoso + Pérdida)
- La app solo necesita guardar el **total de Provisiones Constituidas** para el Anexo 6 (C37)
- El desglose Genéricas/Específicas es para el Cuadre del Balance (documento separado)
- **El cliente las registra manualmente en Contabilidad cada mes** — NO son calculables automáticamente desde los datos del sistema sin una fuente contable

---

## 3. Datos faltantes en la app

### Tabla `socios`
| Campo faltante | Motivo | Prioridad |
|---|---|---|
| `genero` | Anexo 6 C4 — actualmente hardcoded 'M' | Media |
| `estado_civil` | Anexo 6 C5 — actualmente hardcoded 'S' | Media |
| `tipo_persona` | Anexo 6 C11 — actualmente hardcoded 1 | Baja |
| `relacion_laboral_coop` | Anexo 6 C13 — actualmente hardcoded 0 | Baja |

### Tabla `creditos`
| Campo faltante | Motivo | Prioridad |
|---|---|---|
| `nro_expediente` | Trazabilidad desembolsos | Alta |
| `saldo_capital_anterior` | Desembolso neto — refinanciaciones | Alta |
| `interes_anterior` | Desembolso neto — refinanciaciones | Alta |
| `aporte_descontado` | Descuento al desembolsar | Media |
| `fps_descontado_desembolso` | Descuento al desembolsar | Media |
| `tramite` | Gasto fijo S/2.00 | Baja |
| `tipo_credito_sbs` | Código SBS C19 (actualmente hardcoded '') | Media |
| `subtipo_credito_sbs` | Código SBS C20 (actualmente hardcoded '') | Baja |

### Tabla `pagos_recibos`
| Campo faltante | Motivo | Prioridad |
|---|---|---|
| `tipo_pago` (A/K) | K = cancelación anticipada (importante para análisis) | Alta |
| `canal_agencia` | Trazabilidad por convenio/agencia | Media |

### Tabla nueva `provisiones_mensuales` (o columna en `configuracion`)
| Campo faltante | Motivo | Prioridad |
|---|---|---|
| `provision_constituida_total` o desglose genérica/específica | Fuente real para Anexo 6 C37 — actualmente hardcoded = Requerida | **Alta — B3 definitivo** |
| `periodo` (AAAA-MM) | Para guardar por mes | Alta |

---

## 4. Hallazgos y riesgos

### R-DOC-1: Provisiones Constituidas ≠ Provisiones Requeridas (B3 definitivo)
- **Confirmado:** En el Cuadre del Balance real, Provisiones Constituidas = S/311,972.75 ≠ Provisiones Requeridas (calculada por la app)
- **Causa:** La cooperativa registra contablemente provisiones que pueden diferir del cálculo SBS puro
- **Impacto regulatorio alto:** Reporte incorrecto en SBS
- **Solución:** Campo `provision_constituida_total` por mes en tabla nueva o en `configuracion`

### R-DOC-2: Reporte de desembolsos no existe en la app
- El flujo operativo del cliente requiere un reporte mensual de desembolsos (exportable)
- Actualmente la app no tiene este módulo
- Impacto: Contabilidad no puede cuadrar desde la app

### R-DOC-3: Tipo_pago K (cancelación) no capturado
- El archivo INGRESO DETALLADO tiene filas con Tipo=K (cancelaciones anticipadas)
- La app no distingue cancelaciones de pagos normales
- Impacto: métricas de cancelaciones anticipadas inexactas

### R-DOC-4: Género/Estado Civil hardcoded en Anexo 6
- El archivo real tiene género 'F' para la mayoría de socias
- La app hardcodea 'M' (masculino) para todos
- Impacto: reporte incorrecto para SBS

### R-DOC-5: BDCC SBS — Oficio N°32791-2026 (URGENTE - fecha límite 20/07/2026)
- La SBS requirió a CEJUASSA enviar 6 bases de datos de cartera crediticia (BD01, BD02-A, BD02-B, BD03A, BD03B, BD04)
- Formato: archivos .txt separados por tabuladores, UTF-8 o ANSI
- Periodicidad: trimestral (marzo, junio, septiembre, diciembre)
- **Primera entrega: 20/07/2026** — trimestres marzo y junio 2026
- **Segunda entrega: 20/08/2026** — backlog 2024 y 2025
- **La app NO tiene ningún módulo para generar estos archivos TXT**
- Impacto regulatorio muy alto — incumplimiento sancionable

---

## 5. Decisiones pendientes

| ID | Decisión | Urgencia | Impacto |
|---|---|---|---|
| D1 | **B3 definitivo**: ¿Tabla nueva `provisiones_mensuales` o columna en `configuracion`? | Alta | Anexo 6 C37 correcto |
| D2 | ¿Desglosar Provisiones Constituidas en Genéricas + Específicas o solo total? | Alta | Cuadre del Balance |
| D3 | ¿Agregar `tipo_pago` (A/K) a `pagos_recibos`? | Media | Análisis cancelaciones |
| D4 | ¿Agregar `genero`/`estado_civil` a `socios`? | Media | Anexo 6 exacto |
| D5 | ¿Agregar campos de descuento al desembolso a `creditos`? | Media | Reporte desembolsos |
| D6 | **BDCC**: ¿Implementar generación de TXT para BD01-BD04 como módulo de Reportes? | **Muy alta** | Cumplimiento regulatorio SBS |
| D7 | ¿Importar historial de archivos del cliente (2024-2025) a Supabase? | Alta | Backlog BDCC |

---

## 6. Archivos no leídos / no accesibles
Ninguno. Todos los 14 archivos fueron leídos exitosamente.

---

## 7. Actualización Fase 7B-1 — Respuestas de Contabilidad (2026-06-20)

**R-DOC-1 (B3) — RESUELTO conceptualmente:**
Contabilidad confirmó: Provisiones Constituidas = calculadas del saldo de cada deudor por clasificación con las tasas SBS. C37 = C36 por deudor. No requiere tabla `provisiones_mensuales` para el alcance actual.

**R-DOC-3 (Tipo K) — SIGUE PENDIENTE:**
Contabilidad indicó: "No tengo ese dato." → Consultar a Créditos.

**R-DOC-4 (Género/Estado Civil) — SIGUE PENDIENTE:**
Contabilidad indicó: "Solicitar a Tesorería." → La app debe permitir captura/edición. No hardcodear.

**Nuevo hallazgo — Tasa 0.2682 en Anexo 6:**
Contabilidad indicó: "Consultar a Créditos ya que en reporte Anexo 6 figura 0.2682."
El valor 0.2682 podría ser TEA (≈26.82%). La app guarda tasa nominal en `creditos.tasa_interes`. Pendiente confirmar si el campo TPINT en BD01 debe ser nominal o efectiva.

**Nuevo hallazgo — Aporte descontado para socio nuevo:**
Contabilidad confirmó: "También se le descuenta aportes cuando es socio nuevo." → El campo `aporte_descontado` en desembolso es necesario (ya identificado en sección 3 de este documento).
