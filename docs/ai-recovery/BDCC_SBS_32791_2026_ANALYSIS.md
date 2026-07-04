# BDCC_SBS_32791_2026_ANALYSIS.md

> Fase 10I-0 — Análisis documental del Oficio SBS N°32791-2026-SBS
> Generado: 2026-06-24 | Estado: SOLO ANÁLISIS — NO IMPLEMENTAR AÚN

---

## 1. Resumen del oficio

**Documento:** Oficio N° 32791-2026-SBS  
**Fecha:** Lima, 28 de mayo de 2026  
**Firmante:** Ursula Paola Galdos Franco — Intendente de Supervisión de Cooperativas A  
**Referencia:** Oficio Múltiple N° 16265-2021-SBS del 30/03/2021  
**Contacto SBS:** bdcc_sacoop_2a@sbs.gob.pe  

**Situación:** La SBS verificó que CEJUASSA presenta **incumplimientos** en el envío de las Bases de Datos de Cartera Crediticia (BDCC). El oficio comunica precisiones técnicas (Anexo N°1) y nuevos campos (Anexo N°2) que deben aplicarse al regularizar el envío.

**Copias a:** Consejo de Administración y Consejo de Vigilancia.

---

## 2. Plazos exigidos

| Fecha límite | Trimestres a regularizar | Meses involucrados | N° archivos |
|---|---|---|---|
| **20/07/2026** | Marzo 2026 y Junio 2026 | Ene-Feb-Mar 2026 + Abr-May-Jun 2026 | 36 archivos |
| **20/08/2026** | Marzo–Diciembre 2024 y 2025 | 24 meses históricos | 144 archivos |

**Canal de envío:** SFTP — Mesa de Partes Virtual de la SBS (https://servicios.sbs.gob.pe/mpv)  
**Acompañamiento:** Carta firmada por Gerencia General, Gerencia de Riesgos y área de Contabilidad  
**Cuadros de conciliación:** Deben adjuntarse (Anexos 2A y 2B del oficio múltiple de referencia)

> ⚠ Los 144 archivos históricos (2024–2025) son un subproyecto separado — NO implementar en fase actual.

---

## 3. Reglas generales (aplican a TODOS los archivos BDCC)

### 3.1 Codificación
- **UTF-8** (8-bit Unicode Transformation Format) o **ANSI** (8-bit, ISO 8859-1 standard)
- No se admitirán codificaciones distintas
- **Código actual:** `Blob([content], { type: 'text/plain;charset=utf-8' })` → ✅ UTF-8 correcto

### 3.2 Formato y separador
- Extensión obligatoria: **`.txt`**
- Columnas separadas por **exactamente un tabulador (`\t`)**
- No agregar tabuladores adicionales al inicio, entre columnas ni al final
- **Código actual:** `buildTxt` en `lib/bdcc/format.ts` usa `r.join('\t')` → ✅ correcto

### 3.3 Primera fila (encabezado)
- Primera fila contiene **solo los mnemónicos** correspondientes
- **No agregar columna alguna** adicional, incluso si corresponden a campos vacíos o sirven para enumerar filas/columnas
- La cantidad de columnas del encabezado debe ser exactamente igual a la cantidad de columnas de datos
- Ejemplo válido de BD03B con 2 garantías preferidas:
  ```
  CODGR\tCIS\tCCR\tMGU\tCGR
  XYZ\t111\tCRED1\t100\t4
  ABC\t123\tCRED2\t200\t4
  ```
- **Código actual:** BD01_HDR y BD02A_HDR se incluyen como primera fila → ✅ correcto en concepto, pero **faltan mnemónicos** (ver sección 4)

### 3.4 Periodicidad y estructura de archivos
- Las BDCC se presentan **trimestralmente**
- Cada envío contiene **la información del cierre de CADA MES** que compone el trimestre
- Por cada mes del trimestre: **6 archivos TXT**
- Por trimestre completo: **18 archivos TXT** (3 meses × 6 archivos)
- Ejemplo para el trimestre diciembre 2025:
  ```
  01270_BD01_202510.txt   01270_BD01_202511.txt   01270_BD01_202512.txt
  01270_BD02A_202510.txt  01270_BD02A_202511.txt  01270_BD02A_202512.txt
  01270_BD02B_202510.txt  01270_BD02B_202511.txt  01270_BD02B_202512.txt
  01270_BD03A_202510.txt  01270_BD03A_202511.txt  01270_BD03A_202512.txt
  01270_BD03B_202510.txt  01270_BD03B_202511.txt  01270_BD03B_202512.txt
  01270_BD04_202510.txt   01270_BD04_202511.txt   01270_BD04_202512.txt
  ```
- **Código actual:** selector de mes individual → permite generar 1 mes a la vez (correcto), pero falta botón "Generar trimestre completo" (mejora de UX)

### 3.5 Nomenclatura de archivos
```
{CódigoCoopac}_{NombreBDCC}_{AAAAMM}.txt
```
Donde:
- `CódigoCoopac` = código de la COOPAC en el SBS
- `NombreBDCC` = BD01, BD02A, BD02B, BD03A, BD03B, BD04
- `AAAAMM` = año y mes del período de reporte

CEJUASSA (código 01270), ejemplo para marzo 2026:
```
01270_BD01_202603.txt
01270_BD02A_202603.txt
01270_BD02B_202603.txt
01270_BD03A_202603.txt
01270_BD03B_202603.txt
01270_BD04_202603.txt
```
- **Código actual:** `${COOPAC}_BD01_${yyyymm}.txt` con `COOPAC = '01270'` → ✅ correcto

### 3.6 Tipos de datos
- **Alfanumérico:** letras del abecedario, números y símbolos especiales (en caso correspondan)
- **Numérico:** solo números
- **Fecha:** formato **DD/MM/AAAA** — única representación válida
- **Código actual:** `fmtFechaBdcc` devuelve DD/MM/YYYY → ✅ correcto

### 3.7 Campo vacío (valor nulo — null)
- Campo vacío = campo en el que **no se consigna ningún carácter**
- En archivos TXT con tabuladores: **ausencia de información entre separadores** = dos tabuladores consecutivos cuando el campo vacío se ubica entre dos campos con datos
- **PROHIBIDO** consignar: `"null"`, `"0"`, `"0.00"`, `"00/00/0000"`, `"99"`, `"N/A"`, guiones, ni texto similar para representar vacío
- **Código actual:** usa `''` (string vacío) para campos que no aplican → ✅ correcto para el separador, pero hay campos que según el oficio NO pueden quedar vacíos (ver sección 5)

---

## 4. Reglas por archivo BDCC

### 4.1 BD01 — Créditos vigentes
**Estado actual:** Generador MVP implementado. Presenta campos faltantes según oficio.

Campos con reglas especiales confirmadas del oficio:
| Campo | Regla exacta | Valor si no corresponde | ¿Puede ir vacío? |
|---|---|---|---|
| DAKR | Si a fecha de reporte la primera cuota programada no ha vencido, O el crédito fue cancelado anticipadamente → reportar 0 | 0 | NO |
| DAK | Días de atraso al cierre del mes. Si = 0 → reportar 0 (no vacío) | 0 | NO |
| CCVI | Cuenta contable capital vigente | — | NO |
| CCRF | Cuenta contable capital reestructurado | — | NO — RIESGO: código actual pone `''` |
| CCVE | Cuenta contable capital vencido | — | NO |
| CCJU | Cuenta contable capital judicial | — | NO |
| CCCO | Cuenta contable crédito contingente | — | NO — RIESGO: código actual pone `''` |
| CCSIN | Cuenta contable (interés sin pagar vigente) | — | NO — FALTA en BD01_HDR |
| CCSID | Cuenta contable (interés sin pagar diferido) | — | NO — FALTA en BD01_HDR |
| CCSIS | Cuenta contable (interés sin pagar suspendido) | — | NO — FALTA en BD01_HDR |
| FPPK | Fecha primer pago de capital | — | NO — FALTA en BD01_HDR |
| FVEG | Fecha vencimiento cuota vigente | — | NO |
| FVEP | Fecha vencimiento última cuota del crédito | — | NO |
| TPINT | Tasa de interés — si no corresponde → 0.00 | 0.00 | NO |
| FCC | Si no es crédito indirecto → consignar 0 | 0 | — FALTA en BD01_HDR |
| FUK | Si no corresponde → 00/00/0000 | 00/00/0000 | — FALTA en BD01_HDR |
| FUINT | Si no corresponde → 00/00/0000 | 00/00/0000 | — FALTA en BD01_HDR |
| CCSD | Solo para consumo e hipotecario para vivienda; otros → campo vacío | vacío | Sí (para otros tipos) — FALTA en BD01_HDR |
| OSD | Sin información → 99 | 99 | — FALTA en BD01_HDR |

**Mnemónicos faltantes en BD01_HDR actual:**
`DAKR`, `CCSIN`, `CCSID`, `CCSIS`, `FPPK`, `FCC`, `FUK`, `FUINT`, `CCSD`, `OSD`

### 4.2 BD02-A — Cuotas pagadas (créditos vigentes)
**Estado actual:** Generador MVP implementado. Presenta campos faltantes.

| Campo | Regla exacta | Valor si no corresponde | ¿Puede ir vacío? |
|---|---|---|---|
| FCAN | Si deudor no ha completado 100% de la cuota (capital e interés) al cierre del mes → 00/00/0000 | 00/00/0000 | — (código ya maneja esto ✅) |
| DAKC | Días de atraso al momento del pago. Si = 0 → reportar 0 (no vacío) | 0 | NO (código usa String(dakc) ✅) |
| SCONK | Saldo de capital pendiente de la cuota | — | NO ✅ |
| SCONINT | Saldo de interés pendiente de la cuota | — | NO ✅ |
| IAP | Interés amortizado en la cuota. Si hay prepago que cancela la cuota → ese saldo de intereses | — | — NUEVO CAMPO (Anexo N°2) |
| SCOM | Si no corresponde → 0.00 | 0.00 | — FALTA en BD02A_HDR |
| SIM | Si no corresponde → 0.00 | 0.00 | — FALTA en BD02A_HDR |
| SCA | Si no corresponde → 0.00 | 0.00 | — FALTA en BD02A_HDR |

**Mnemónicos faltantes en BD02A_HDR actual:** `SCOM`, `SIM`, `SCA`

> IAP ya está implementado en el código. ✅

### 4.3 BD02-B — Cuotas pagadas (créditos cancelados)
**Estado actual:** No implementado. Requiere módulo de créditos cancelados.

Campos con reglas especiales confirmadas:
| Campo | Regla exacta | Valor si no corresponde |
|---|---|---|
| FCAN_C | Mismo criterio que FCAN de BD02-A | 00/00/0000 |
| DAKC_C | Días de atraso al pago. Si = 0 → reportar 0 | 0 |
| SCA_C | No puede estar vacío | — |
| SCOM_C | Si no corresponde → 0.00 | 0.00 |
| SEGS_C | Si no corresponde → 0.00 | 0.00 |
| SIM_C | Si no corresponde → 0.00 | 0.00 |
| SCONK_C | Si no corresponde → 0.00 | 0.00 |
| SCONINT_C | Si no corresponde → 0.00 | 0.00 |
| IAP_C | Interés amortizado en cuota de crédito cancelado (nuevo campo, Anexo N°2) | — |

### 4.4 BD03A — Garantías preferidas (créditos vigentes)
**Estado actual:** Solo encabezado — confirmado con contabilidad (CEJUASSA no tiene garantías preferidas).

Regla del oficio: *"Si la COOPAC no tiene garantías preferidas constituidas a su favor, deberá remitir cada una de las BD03 únicamente con datos en la primera fila (encabezado), que corresponden a los mnemónicos."* ✅ Implementado correctamente.

Campos que NO pueden estar vacíos (solo aplican si hubiera datos):
`TGR`, `FCONS`, `POL`, `FVEPOL`, `VCONS`, `FUVAL`, `REPEV`, `VCOM`, `VREA`, `CC`, `VBC`, `VANX`, `IGRC`

Campo especial: `RGPRF` — si no es garantía compartida → campo vacío

### 4.5 BD03B — Garantías preferidas (créditos cancelados)
**Estado actual:** Solo encabezado — mismo criterio que BD03A. ✅

### 4.6 BD04 — Créditos cancelados
**Estado actual:** No implementado. Requiere módulo de créditos cancelados.

Campos con reglas especiales confirmadas:
| Campo | Regla exacta | Valor si no corresponde |
|---|---|---|
| NCPR_C | No puede estar vacío | — |
| NCPA_C | No puede estar vacío | — |
| TPR_C | No puede estar vacío | — |
| NCAD_C | Si no hay cuotas adelantadas pagadas → 0 | 0 |
| MCI_C | Tipo de dato: numérico | — |
| DAK_C | Días de atraso. Si = 0 → reportar 0 | 0 |
| SIM_C | Si no corresponde → 0.00 | 0.00 |
| SCOM | Si no corresponde → 0.00 | 0.00 |
| SIC_DIF | Si no corresponde → 0.00 | 0.00 |
| SIC_DEV | Si no corresponde → 0.00 | 0.00 |
| SIM_DIF | Si no corresponde → 0.00 | 0.00 |
| SIM_DEV | Si no corresponde → 0.00 | 0.00 |
| SCOM_DIF | Si no corresponde → 0.00 | 0.00 |
| SCOM_DEV | Si no corresponde → 0.00 | 0.00 |

---

## 5. Tabla completa de campos mencionados en el oficio

| Mnemónico | Base(s) | Regla exacta del oficio | Valor si no corresponde | ¿Puede ir vacío? | Requiere confirmar |
|---|---|---|---|---|---|
| DAKR | BD01 | Si primera cuota no vencida al cierre O cancelación anticipada → 0 | 0 | NO | No |
| FCAN | BD02-A | Si deudor no pagó 100% cuota al cierre → 00/00/0000 | 00/00/0000 | — | No |
| FCAN_C | BD02-B | Mismo criterio que FCAN | 00/00/0000 | — | No |
| DAK | BD01, BD02-A | Si días atraso = 0 → reportar 0 (no vacío) | 0 | NO | No |
| DAK_C | BD04 | Mismo criterio que DAK | 0 | NO | No |
| DAKC | BD02-A | Días de atraso al momento del pago. Si = 0 → 0 | 0 | NO | No |
| DAKC_C | BD02-B | Mismo criterio que DAKC | 0 | NO | No |
| CCVI | BD01 | Cuenta contable capital vigente | — | NO | SÍ — confirmar con Contabilidad |
| CCRF | BD01 | Cuenta contable capital reestructurado | — | NO | SÍ — ¿qué va cuando no hay reestructurado? |
| CCVE | BD01 | Cuenta contable capital vencido | — | NO | SÍ — confirmar con Contabilidad |
| CCJU | BD01 | Cuenta contable capital judicial | — | NO | SÍ — confirmar con Contabilidad |
| CCCO | BD01 | Cuenta contable contingente | — | NO | SÍ — ¿qué va cuando no hay contingente? |
| CCSIN | BD01 | Cuenta contable interés sin pagar vigente | — | NO | SÍ — campo faltante en HDR |
| CCSID | BD01 | Cuenta contable interés diferido | — | NO | SÍ — campo faltante en HDR |
| CCSIS | BD01 | Cuenta contable interés suspendido | — | NO | SÍ — campo faltante en HDR |
| FPPK | BD01 | Fecha primer pago de capital | — | NO | SÍ — campo faltante en HDR |
| FVEG | BD01 | Fecha vencimiento cuota vigente | — | NO | No — ya en HDR |
| FVEP | BD01 | Fecha vencimiento última cuota | — | NO | No — ya en HDR |
| SCONK | BD02-A | Saldo capital pendiente cuota | — | NO | No — ya en HDR |
| SCONINT | BD02-A | Saldo interés pendiente cuota | — | NO | No — ya en HDR |
| SCA_C | BD02-B | Saldo por cobrar (cancelado) | — | NO | SÍ |
| TGR | BD03A | Tipo garantía real | — | NO (si hay datos) | No aplica — solo encabezado |
| FCONS | BD03A | Fecha constitución garantía | — | NO (si hay datos) | No aplica |
| POL | BD03A | Póliza garantía | — | NO (si hay datos) | No aplica |
| FVEPOL | BD03A | Fecha vencimiento póliza | — | NO (si hay datos) | No aplica |
| SCONK_C | BD02-B | Si no corresponde → 0.00 | 0.00 | NO | SÍ |
| SCONINT_C | BD02-B | Si no corresponde → 0.00 | 0.00 | NO | SÍ |
| SCA | BD02-A | Si no corresponde → 0.00 | 0.00 | — | SÍ — campo faltante en HDR |
| TGR | BD03A | No puede estar vacío | — | NO | No aplica — solo encabezado |
| FCONS | BD03A | No puede estar vacío | — | NO | No aplica |
| POL | BD03A | No puede estar vacío | — | NO | No aplica |
| FVEPOL | BD03A | No puede estar vacío | — | NO | No aplica |
| VCONS | BD03A | No puede estar vacío | — | NO | No aplica |
| FUVAL | BD03A | No puede estar vacío | — | NO | No aplica |
| REPEV | BD03A | No puede estar vacío | — | NO | No aplica |
| VCOM | BD03A | No puede estar vacío | — | NO | No aplica |
| VREA | BD03A | No puede estar vacío | — | NO | No aplica |
| CC | BD03A | No puede estar vacío | — | NO | No aplica |
| VBC | BD03A | No puede estar vacío | — | NO | No aplica |
| VANX | BD03A | No puede estar vacío | — | NO | No aplica |
| IGRC | BD03A | No puede estar vacío | — | NO | No aplica |
| NCPR_C | BD04 | No puede estar vacío | — | NO | SÍ |
| NCPA_C | BD04 | No puede estar vacío | — | NO | SÍ |
| TPR_C | BD04 | No puede estar vacío | — | NO | SÍ |
| TPINT | BD01 | Tasa interés; si no corresponde → 0.00 | 0.00 | NO | SÍ — ¿nominal o TEA? pendiente |
| SCOM | BD02-A, BD04 | Si no corresponde → 0.00 | 0.00 | — | SÍ — falta en BD02A_HDR |
| SIM | BD02-A | Si no corresponde → 0.00 | 0.00 | — | SÍ — falta en BD02A_HDR |
| SIM_C | BD02-B, BD04 | Si no corresponde → 0.00 | 0.00 | — | SÍ |
| SCOM_C | BD02-B | Si no corresponde → 0.00 | 0.00 | — | SÍ |
| SEGS_C | BD02-B | Si no corresponde → 0.00 | 0.00 | — | SÍ |
| SCONK_C | BD02-B | Si no corresponde → 0.00 | 0.00 | — | SÍ |
| SCONINT_C | BD02-B | Si no corresponde → 0.00 | 0.00 | — | SÍ |
| SIM_DIF | BD04 | Si no corresponde → 0.00 | 0.00 | — | SÍ |
| SIC_DIF | BD04 | Si no corresponde → 0.00 | 0.00 | — | SÍ |
| SIC_DEV | BD04 | Si no corresponde → 0.00 | 0.00 | — | SÍ |
| SIM_DEV | BD04 | Si no corresponde → 0.00 | 0.00 | — | SÍ |
| SCOM_DIF | BD04 | Si no corresponde → 0.00 | 0.00 | — | SÍ |
| SCOM_DEV | BD04 | Si no corresponde → 0.00 | 0.00 | — | SÍ |
| FCC | BD01 | Si no crédito indirecto → 0 | 0 | — | SÍ — campo faltante en HDR |
| FUK | BD01 | Si no corresponde → 00/00/0000 | 00/00/0000 | — | SÍ — campo faltante en HDR |
| FUINT | BD01 | Si no corresponde → 00/00/0000 | 00/00/0000 | — | SÍ — campo faltante en HDR |
| CCSD | BD01 | Solo consumo/hipotecario vivienda; otros → campo vacío | vacío | Sí (para otros tipos) | SÍ — campo faltante en HDR |
| OSD | BD01 | Sin información → 99 | 99 | — | SÍ — campo faltante en HDR |
| RGPRF | BD03-A | Si no es garantía compartida → campo vacío | vacío | Sí | No aplica — solo encabezado |
| NCAD_C | BD04 | Si no hay cuotas adelantadas → 0 | 0 | — | SÍ |
| MCI_C | BD04 | Tipo de dato numérico | — | — | SÍ |
| IAP | BD02-A | Interés amortizado en cuota; en prepago → saldo de intereses | — | — | SÍ — ya implementado ✅ |
| IAP_C | BD02-B | Ídem para créditos cancelados | — | — | SÍ |

---

## 6. Hallazgos críticos vs. código actual

### 6.1 Campos FALTANTES en BD01_HDR (10 campos)

El array `BD01_HDR` en `app/dashboard/reportes/bdcc/page.tsx:22` debe incluir estos campos adicionales:

| Campo | Ubicación sugerida en HDR | Valor para CEJUASSA |
|---|---|---|
| DAKR | Después de DAK | Si primera cuota no vencida al cierre → `0` |
| CCSIN | Después de CCCO | Cuenta contable interés — CONFIRMAR CON CONTABILIDAD |
| CCSID | Después de CCSIN | Cuenta contable interés diferido — CONFIRMAR |
| CCSIS | Después de CCSID | Cuenta contable interés suspendido — CONFIRMAR |
| FPPK | Antes de FVEG | Fecha primer pago de capital — calcular desde cronograma |
| FCC | Después de PRCON | Si no crédito indirecto → `0` |
| FUK | Después de FCC | Si no corresponde → `00/00/0000` |
| FUINT | Después de FUK | Si no corresponde → `00/00/0000` |
| CCSD | Después de FUINT | Solo consumo/hipotecario → cuenta contable; otros → vacío |
| OSD | Después de CCSD | Sin información → `99` |

### 6.2 Campos que NO pueden estar vacíos pero el código pone `''`

| Campo | Archivo | Código actual | Problema | Acción requerida |
|---|---|---|---|---|
| CCRF | BD01 | `''` (línea ~258 de bdcc/page.tsx) | No puede estar vacío según oficio | Confirmar con Contabilidad: ¿qué valor para créditos no reestructurados? |
| CCCO | BD01 | `''` (línea ~261 de bdcc/page.tsx) | No puede estar vacío según oficio | Confirmar con Contabilidad: ¿qué valor para créditos no contingentes? |

> RIESGO REGULATORIO: Si SBS valida que CCRF y CCCO no pueden estar vacíos, los archivos actuales serían rechazados.

### 6.3 Campos FALTANTES en BD02A_HDR (3 campos)

El array `BD02A_HDR` en `page.tsx:34` debe incluir:

| Campo | Valor para CEJUASSA |
|---|---|
| SCOM | `0.00` (si no corresponde) |
| SIM | `0.00` (si no corresponde) |
| SCA | `0.00` (si no corresponde) |

### 6.4 Nuevo campo Anexo N°2 (IAP e IAP_C)

**BD02-A:** Campo `IAP` (Interés amortizado en la cuota) → posición N° 18 según el Anexo N°2
- **Ya implementado** en `BD02A_HDR` y en la generación. ✅
- Confirmar que esté en la posición correcta (N° 18 del archivo)

**BD02-B:** Campo `IAP_C` → N° 18 del archivo de cancelados
- No implementado (BD02-B pendiente). Anotado para cuando se implemente BD02-B.

---

## 7. Reglas implementables ya (sin confirmar con contadora)

Estas reglas pueden aplicarse con certeza porque no requieren datos externos ni confirmación contable:

1. **DAKR en BD01:** valor `0` cuando la primera cuota no ha vencido al cierre del mes — calculable desde `cronograma_cuotas`
2. **FCC en BD01:** valor `0` para todos los créditos de CEJUASSA (CEJUASSA no tiene créditos indirectos — confirmar que es así)
3. **FUK y FUINT en BD01:** `00/00/0000` para todos — confirmar que CEJUASSA no tiene créditos de ese tipo
4. **CCSD en BD01:** vacío para todos si el tipo de crédito no es consumo ni hipotecario para vivienda. Si es consumo → colocar la cuenta contable.
5. **OSD en BD01:** `99` en todos (sin información específica)
6. **SCOM, SIM, SCA en BD02-A:** `0.00` en todos — confirmar que CEJUASSA no tiene esos saldos
7. **Formato IAP en BD02-A:** ya implementado ✅

---

## 8. Reglas pendientes de confirmar (con contadora antes de implementar)

| Pendiente | Campo(s) | Pregunta a la contadora | Área responsable |
|---|---|---|---|
| P1 | CCRF | ¿Qué valor consignar en CCRF cuando el crédito no está reestructurado? ¿La misma cuenta del estado activo, vacío (aunque no puede), o un código específico? | Contabilidad |
| P2 | CCCO | ¿Qué valor consignar en CCCO cuando el crédito no es contingente? | Contabilidad |
| P3 | CCSIN, CCSID, CCSIS | ¿Cuáles son las cuentas contables de intereses sin pagar vigente, diferido y suspendido? | Contabilidad |
| P4 | FPPK | ¿La fecha del primer pago de capital es la fecha de vencimiento de la primera cuota, o la fecha real en que se pagó? | Créditos |
| P5 | TPINT | ¿La tasa que va en BD01 es tasa nominal anual o TEA? (tasa actual en DB: 26.82%) | Créditos |
| P6 | CCSD | Confirmar: ¿todos los créditos de CEJUASSA son de consumo? Si es así, ¿cuál es la cuenta contable para CCSD? | Contabilidad |
| P7 | SCOM, SIM, SCA | Confirmar que CEJUASSA no registra Seguros de Desgravamen en el sistema — si lo registra, especificar cómo | Contabilidad |
| P8 | IAP (BD02-A) | ¿El campo `interes_amortizado_pagado` de `pagos_recibos` refleja exactamente lo que pide la SBS en IAP? | Contabilidad |

---

## 9. Checklist técnico para implementación posterior

### Para cuando se proceda a corregir BD01 y BD02-A:

- [ ] Agregar 10 campos a `BD01_HDR`: DAKR, CCSIN, CCSID, CCSIS, FPPK, FCC, FUK, FUINT, CCSD, OSD
- [ ] Agregar lógica de cálculo de DAKR (primera cuota del cronograma del crédito)
- [ ] Agregar lógica de cálculo de FPPK (fecha primer pago de capital)
- [ ] Resolver CCRF y CCCO: confirmar valor con Contabilidad
- [ ] Agregar CCSIN, CCSID, CCSIS con cuentas contables confirmadas
- [ ] Agregar FCC = `0` (créditos no indirectos)
- [ ] Agregar FUK = `00/00/0000`, FUINT = `00/00/0000`
- [ ] Agregar CCSD (cuenta contable para consumo; vacío para otros)
- [ ] Agregar OSD = `99`
- [ ] Agregar 3 campos a `BD02A_HDR`: SCOM, SIM, SCA con valor `0.00`
- [ ] Verificar posición de IAP en BD02-A (debe ser campo N° 18 según Anexo N°2)
- [ ] Verificar que BD03A y BD03B generan exactamente 1 fila (encabezado) sin separadores adicionales

### Para exportación por trimestre:
- [ ] Agregar botón "Generar trimestre completo" que ejecute los 3 meses de una vez y los descargue como ZIP
- [ ] Validar que el nombre de cada archivo siga el patrón exacto `01270_{BDCC}_{AAAAMM}.txt`

### Validaciones a agregar antes de enviar a SBS:
- [ ] Verificar que ninguno de los 10 campos obligatorios en BD01 esté vacío
- [ ] Verificar que ninguno de los 3 campos obligatorios en BD02-A esté vacío
- [ ] Verificar que la fecha FCAN en BD02-A sea `00/00/0000` cuando cuota no pagada al 100%
- [ ] Verificar que DAK y DAKC devuelvan `0` (string) y no vacío cuando = 0
- [ ] Verificar que DAKR devuelva `0` cuando primera cuota no ha vencido

---

## 10. Riesgos identificados

| ID | Riesgo | Probabilidad | Impacto |
|---|---|---|---|
| R-BDCC-1 | CCRF y CCCO quedan vacíos (código actual) pero el oficio dice NO pueden quedar vacíos → archivo rechazado por SBS | ALTA | CRÍTICO — archivo inválido |
| R-BDCC-2 | Faltan 10 campos en BD01_HDR → estructura de archivo incompleta vs. estructura oficial SBS | ALTA | CRÍTICO — estructura incorrecta |
| R-BDCC-3 | Faltan 3 campos en BD02A_HDR (SCOM, SIM, SCA) | ALTA | CRÍTICO — estructura incorrecta |
| R-BDCC-4 | TPINT: no confirmado si es nominal o TEA. Si se envía con el valor incorrecto → dato inválido en SBS | MEDIA | ALTO |
| R-BDCC-5 | FPPK (fecha primer pago capital) no está en HDR ni en el generador → campo obligatorio omitido | ALTA | CRÍTICO |
| R-BDCC-6 | CCSIN, CCSID, CCSIS (cuentas de intereses) no están en HDR → 3 campos obligatorios omitidos | ALTA | CRÍTICO |
| R-BDCC-7 | Para el plazo 20/07/2026 se requieren 36 archivos (2 trimestres × 3 meses × 6 archivos). El generador actual solo genera 1 mes a la vez — operativamente manejable pero tedioso. | BAJA | MEDIO |
| R-BDCC-8 | BD02-B y BD04 no implementados. Si hay créditos cancelados en el período, faltarían 2 de 6 archivos por mes. | MEDIA | ALTO |

---

## 11. Recomendación de implementación por fases

### Fase 10I-1 — Confirmar con contadora (ACCIÓN DEL EQUIPO, no código)
Antes de corregir código, responder las preguntas P1–P8 de la sección 8.

### Fase 10I-2 — Corregir BD01 y BD02-A (una vez confirmadas las preguntas)
- Agregar campos faltantes a BD01_HDR y BD02A_HDR
- Corregir CCRF y CCCO con los valores correctos
- Agregar campos FPPK, CCSIN, CCSID, CCSIS con la lógica confirmada
- Agregar SCOM, SIM, SCA a BD02-A (valor 0.00)
- Agregar FCC, FUK, FUINT, CCSD, OSD a BD01

### Fase 10I-3 — Validaciones y exportación por trimestre
- Agregar validaciones de campos obligatorios antes de descargar
- Agregar botón "Generar trimestre completo" (3 meses + ZIP)

### Fase 10I-4 — BD02-B y BD04 (si hay créditos cancelados en el período)
- Confirmar con Créditos el listado de cancelados en los períodos a reportar
- Implementar generadores de BD02-B y BD04

### Fase 10I-5 — Validación final (antes del 20/07/2026)
- Generar archivos piloto para un mes
- Revisión fila por fila con contadora
- Envío al SBS por SFTP

---

## 12. Campos NO LEGIBLES / REQUIEREN CONFIRMACIÓN

El documento fue legible en su totalidad. No hay secciones ilegibles.

Las únicas incertidumbres son de interpretación regulatoria (no de lectura del documento):
- Exactamente qué cuenta contable va en CCRF/CCCO cuando el crédito no está en ese estado
- El significado exacto de CCSIN, CCSID, CCSIS (requiere consultar el Oficio Múltiple N°16265-2021-SBS para ver la definición completa del campo)

---

*Documento generado por análisis de Fase 10I-0 | NO implementar sin completar las confirmaciones de las secciones 7 y 8.*
