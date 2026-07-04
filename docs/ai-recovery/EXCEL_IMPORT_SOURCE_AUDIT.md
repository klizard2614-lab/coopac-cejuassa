# EXCEL_IMPORT_SOURCE_AUDIT.md
# Auditoría de Fuentes Excel para Importación — CEJUASSA
# Fecha: 2026-06-20

> Fase 9C-4A — Solo lectura. NO se modificaron los archivos fuente.
> Ruta base: `_client_files/raw/extracted/Archvos app/`

---

## Resumen ejecutivo

| Archivo | Tipo | Tabla destino | Registros aprox. | Importable |
|---|---|---|---|---|
| DSCTO Y DESMBOLSO DE CRDITO MA ABR-2026 (1).xlsx | B — Créditos | `creditos` | ~1248 | ⚠️ Con limpieza |
| INGRESO DETALLADO MARZO 2026 (1).xlsx | C — Pagos (caja) | `pagos_recibos` | ~35 | ⚠️ Requiere socios previos |
| CONVENIO MES MARZO 2026 (1).xlsx | C/D — Pagos convenio | `pagos_recibos` | ~801 | ⚠️ Requiere socios + convenios previos |
| 1106_03 Anexo Nø6... ENERO 2026 (1).xlsx | G — Referencia | — | 449 | ❌ Solo referencia |
| 1105-05 informe de deudores (1).xlsx | G — Referencia | — | 129 | ❌ Solo referencia |
| 1105_04_Cuadre del Anexo 5... (1).xlsx | G — Referencia | — | 21 | ❌ Solo referencia |
| ELABORACION DE REPORTES DE CARTERA Y APORTES (1).xlsx | G — Referencia | — | 71 | ❌ Solo referencia |

**ALERTA CRÍTICA:** No existe ningún Excel con tabla de socios (padrón). Los socios aparecen referenciados por `IdSocio`/`DNI` en los demás Excels, pero no hay un archivo maestro de socios que permita cargar la tabla `socios` directamente.

---

## Detalle por archivo

---

### 1. DSCTO Y DESMBOLSO DE CRDITO MA ABR-2026 (1).xlsx

**Tipo:** B — Créditos/Desembolsos

**Hoja activa:** `Hoja3` (única hoja)

**Encabezado** (fila 4, tras 3 filas de título):
```
Item | Exped. | Fecha | IdSocio | Socio | Convenio | Monto | Saldo Capital |
Interes | Aporte | FPS | Tram. | AutoSeg. | Monto Girado | Descuento | Plazo | CuoProp |
Desc. Calculado | Mes | Año
```

**Dimensiones:** 1252 filas × 20 columnas. Datos: ~1248 registros.

**Muestra de datos:**
```
Item=1, Exped=2018828, Fecha=46083 (=01/03/2026), IdSocio=0001611,
Socio=SISNIEGAS YGNACIO JOSE ARTURO, Convenio=CHEPEN,
Monto=10000, Saldo Capital=7192.81, Interes=14.39,
Aporte=0, FPS=0, Tram.=2, AutoSeg.=200,
Monto Girado=2590.80, Descuento=7409.20, Plazo=45, CuoProp=347.72
```

**Tabla destino probable:** `creditos`

**Mapping de campos:**

| Columna Excel | Campo DB | Observación |
|---|---|---|
| Exped. | `nro_pagare` o `nro_expediente` | Número de expediente del crédito |
| Fecha | `fecha_desembolso` | Número serial Excel → DATE (46083=01/03/2026) |
| IdSocio | `id_socio` (FK lookup) | Código socio de 7 dígitos → lookup en `socios.nro_socio` |
| Monto | `monto_aprobado` | Monto total aprobado |
| Saldo Capital | `saldo_capital` | Saldo actual (puede ser 0 si está cancelado) |
| Interes | `interes_acumulado` | Interés acumulado actual |
| Aporte | Parte de pago previo | No campo directo en `creditos` |
| FPS | `descuento_fps` | Monto FPS descontado |
| Tram. | `tramite` | Costo de trámite |
| AutoSeg. | `descuento_seguro` | Seguro de desgravamen |
| Monto Girado | `monto_girado_neto` | Neto entregado al socio |
| Descuento | `descuento_otros` | Total descontado (= Monto - Monto Girado) |
| Plazo | `plazo_meses` | Número de cuotas |
| CuoProp | `cuota_mensual` | Cuota propuesta mensual |

**Campos faltantes en Excel (requeridos por DB):**
- `tasa_interes` — No aparece directamente (puede inferirse de cuota y plazo)
- `tipo_credito` — No aparece
- `estado` — No aparece (inferible: activo si saldo>0, cancelado si saldo=0)
- `tipo_credito_sbs` / `subtipo_credito_sbs` — No aparece
- `cuenta_contable_bd01` — No aparece

**Registros con saldo 0** (~estimado): pueden ser créditos cancelados. Recomendación: cargar con `estado='cancelado'`.

**Campos obligatorios presentes:** IdSocio ✅, Monto ✅, Fecha ✅, Plazo ✅, Monto Girado ✅

**Riesgos:**
- Fecha en formato serial Excel (número entero) → requiere conversión
- `IdSocio` es el nro_socio, no el UUID de Supabase → requiere lookup previo de socios
- No hay campo de tasa de interés → debe calcularse o asumirse un valor default
- No hay `tipo_credito` → debe asignarse manualmente o por default

**¿Importable automáticamente?** ⚠️ Requiere limpieza manual para campos SBS + carga de socios primero

---

### 2. INGRESO DETALLADO MARZO 2026 (1).xlsx

**Tipo:** C — Pagos/Ingresos (caja directa)

**Hojas:** RESUMEN (tabla pivot), Hoja1 (datos detallados), Hoja2 (vacía), Hoja3 (vacía)

**Hoja activa:** `Hoja1`

**Encabezado** (fila 5):
```
IdSocio | Socio | Fecha | N°Recibo | Ap | Ptmo | IntC | FPS | FPSEx | OtrosP | TotalRec | Usuario | Tipo | DNI | IdPers
```

**Dimensiones:** 39 filas × 15 columnas. Datos: ~35 registros.

**Muestra de datos:**
```
IdSocio=0001528, Socio=CALLIRGOSBARUA HERNAN MARIANO, Fecha=2/3/2026, N°Recibo=189242,
Ap=10, Ptmo=0, IntC=0, FPS=10, FPSEx=5, OtrosP=0, TotalRec=25, Usuario=USUCAJ, Tipo=K, DNI=18037479
```

**Tabla destino probable:** `pagos_recibos`

**Mapping de campos:**

| Columna Excel | Campo DB | Observación |
|---|---|---|
| IdSocio | `id_socio` (FK lookup) | Lookup en `socios.nro_socio` |
| N°Recibo | `nro_recibo` | Número de recibo del sistema anterior |
| Fecha | `fecha` | Formato DD/M/YYYY → DATE |
| Ap | `monto_aporte` | Monto de aporte en el pago |
| Ptmo | `monto_capital` | Amortización de capital |
| IntC | `monto_interes` | Interés cobrado |
| FPS | `monto_fps` | FPS regular |
| FPSEx | `monto_fps_extra` | FPS extra |
| OtrosP | `monto_otros` | Otros pagos |
| TotalRec | `monto_total` | Total del recibo |
| Tipo | — | Tipo de operación (A=aporte, K=otro). No hay campo directo en DB |
| DNI | — | Solo referencia para validación |

**Campos faltantes en Excel (requeridos por DB):**
- `id_credito` — No aparece en Excel (requiere lookup por socio)
- `id_convenio` — No aparece (estos son pagos de caja directa → NULL o convenio=USUCAJ)
- `periodo` — No aparece explícitamente (deducible de fecha: 2026-03)
- `canal_pago` — No aparece (default: 'caja')
- `estado_flujo` — No aparece (default: 'completado')

**Registros:** ~35 pagos de caja en marzo 2026

**Riesgos:**
- Solo pagos de caja (un usuario: USUCAJ)
- Requiere socios cargados primero
- Requiere créditos cargados para asociar `id_credito` (si hay pagos de capital)
- `Tipo=K` parece ser tipo especial (¿convenio K = cancelación?)

**¿Importable automáticamente?** ⚠️ Requiere socios + créditos cargados primero

---

### 3. CONVENIO MES MARZO 2026 (1).xlsx

**Tipo:** C/D — Pagos por convenio (todos los convenios)

**Hojas:** RESUMEN (tabla pivot por convenio), DETALLE (datos completos), Hoja2, Hoja3

**Hoja activa:** `DETALLE`

**Encabezado** (fila 5, idéntico a INGRESO DETALLADO):
```
IdSocio | Socio | Fecha | N°Recibo | Ap | Ptmo | IntC | FPS | FPSEx | OtrosP | TotalRec | Usuario | Tipo | DNI | IdPers
```

**Dimensiones:** 805 filas × 15 columnas. Datos: ~801 registros.

**Muestra de datos:**
```
IdSocio=0001576, Socio=LECCAALBILDRO ROSA ESMERITA, Fecha=25/3/2026, N°Recibo=189283,
Ap=10, Ptmo=304.74, IntC=114.24, FPS=10, FPSEx=5, OtrosP=0, TotalRec=443.98, Usuario=LAFORA, Tipo=A
```

**Usuarios (convenios):** BELEN, CHEPEN, DIRES, LAFORA, IREN, IRO, REGION, UTES, OTUZCO, SCHUCO

**Tabla destino probable:** `pagos_recibos`

**Mapping:** Idéntico a INGRESO DETALLADO. Campo `Usuario` permite inferir `id_convenio`.

**Campos faltantes:** Mismos que INGRESO DETALLADO + `id_convenio` inferible del campo `Usuario`.

**Riesgos:**
- Múltiples convenios — necesitan existir en tabla `convenios` antes de cargar
- `Usuario` ≠ nombre de convenio (puede ser abreviatura: LAFORA=La Fora, IREN=Iren, etc.)
- Requiere tabla de mapeo Usuario → id_convenio

**¿Importable automáticamente?** ⚠️ Requiere socios + convenios + créditos cargados primero

---

### 4. 1106_03 Anexo Nø6-Reporte de Deudores ENERO 2026 (1).xlsx

**Tipo:** G — Solo referencia

**Hojas:** `MARZO2026 sin CEROS` (449 filas × 67 col), `Hoja6` (10 filas × 7 col — pivot), `NA` (2 filas — muestra estructura)

**Hoja NA** — Columnas relevantes:
```
Fila | Apellidos y Nombres | Código Socio | Clasificación del Deudor |
Fecha de Desembolso | Monto de Desembolso | Saldo de Colocaciones |
Cuenta Contable | Capital Vigente | Capital Vencido | ... (36 columnas)
```

**Uso:** Referencia para validar clasificación de cartera y saldos al importar.

**¿Importable?** ❌ Solo referencia — no cargar a DB directamente. Usar para validar Anexo 6 después de cargar créditos.

---

### 5. 1105-05 informe de deudores (1).xlsx

**Tipo:** G — Solo referencia

**Hojas:** `Sheet1` (129 filas × 12 columnas)

**Fila 1:** "Superintendencia de Banca, Seguros y AFP / COOPAC CEJUASSA - LL"

**Uso:** Informe oficial SBS de deudores. Referencia para validar totales post-carga.

**¿Importable?** ❌ Solo referencia.

---

### 6. 1105_04_Cuadre del Anexo 5 con las Cifras del Balance (1).xlsx

**Tipo:** G — Solo referencia

**Hojas:** `Sheet1` (21 filas × 6 columnas)

**Uso:** Cuadre contable Anexo 5 vs Balance. Referencia para auditoría contable.

**¿Importable?** ❌ Solo referencia.

---

### 7. ELABORACION DE REPORTES DE CARTERA Y APORTES (1).xlsx

**Tipo:** G — Solo referencia

**Hojas:** `ANEXO6 Y APORTES` (71 filas × 19 columnas)

**Título:** "PROCESO ACTUAL DEL MANEJO DE LA CARTERA DE CREDITOS" / "PROCESO QUE DEBERIA SER"

**Uso:** Documento de proceso/flujo de trabajo para manejo de cartera. No contiene datos transaccionales.

**¿Importable?** ❌ Solo referencia de proceso.

---

## Clasificación por tipo

| Tipo | Archivos |
|---|---|
| A — Socios | ❌ **Ninguno disponible** |
| B — Créditos | DSCTO Y DESMBOLSO (1248 registros) |
| C — Pagos | INGRESO DETALLADO (35 reg.) + CONVENIO (801 reg.) |
| D — Convenios | ⚠️ Inferible del campo Usuario en CONVENIO |
| E — Aportes | ⚠️ Incluido en columna Ap de pagos |
| F — Egresos | ❌ Ninguno disponible |
| G — Referencia | Anexo6, Informe deudores, Cuadre Anexo5, Proceso cartera |

---

## Tablas que SÍ se pueden cargar desde Excel

| Tabla | Fuente | Restricción |
|---|---|---|
| `convenios` | Inferir de campo Usuario en CONVENIO | Manual — requiere catálogo de nombres completos |
| `creditos` | DSCTO Y DESMBOLSO | Requiere socios primero + limpieza manual de campos SBS |
| `pagos_recibos` | INGRESO + CONVENIO | Requiere socios + convenios + créditos primero |
| `aportes` | Derivado de pagos (columna Ap) | Creados automáticamente al registrar pagos vía RPC |

## Tablas que NO se pueden cargar desde Excel

| Tabla | Razón |
|---|---|
| `socios` | ❌ No hay archivo Excel de padrón de socios |
| `cronograma_cuotas` | ❌ Se regenera automáticamente al crear créditos vía RPC |
| `egresos` | ❌ No hay archivo Excel de egresos |
| `usuarios` | 🚫 No tocar — 2 registros conservados |
| `configuracion` | 🚫 No tocar — 1 registro conservado |

---

## Conclusión

**La recarga desde Excel es parcial.** El bloqueo principal es que **no existe un Excel con padrón de socios**. Sin socios, no se pueden cargar créditos ni pagos (requieren `id_socio`).

**Opciones:**
1. **Opción A:** Cargar socios primero desde el **backup JSON** (`backups/data-reset/20260620-1327/socios.json` — 434 socios), luego complementar con Excel para créditos y pagos.
2. **Opción B:** Cargar socios manualmente desde el sistema anterior (padrón físico o acceso al sistema viejo).
3. **Opción C:** Extraer socios del campo Socio/DNI/IdSocio de los Excel disponibles (solo da los socios activos en marzo 2026 — incompleto).

**Recomendación: Opción A** — backup JSON para socios, Excel para créditos y pagos de marzo 2026.
