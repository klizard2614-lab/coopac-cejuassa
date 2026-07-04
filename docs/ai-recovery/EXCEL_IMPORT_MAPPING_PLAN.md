# EXCEL_IMPORT_MAPPING_PLAN.md
# Plan de Mapping Excel → Tablas Supabase — CEJUASSA
# Fecha: 2026-06-20

> Fase 9C-4A — Plan de transformación. NO ejecutar sin autorización explícita.
> Ver también: EXCEL_IMPORT_SOURCE_AUDIT.md

---

## Orden de carga obligatorio

```
1. convenios       ← inferir de campo Usuario en Excel CONVENIO
2. socios          ← backup JSON (no disponible en Excel)
3. creditos        ← Excel DSCTO Y DESEMBOLSO
4. cronograma_cuotas ← generado automáticamente por RPC crear_credito_con_cronograma
5. pagos_recibos   ← Excel INGRESO DETALLADO + CONVENIO DETALLE
6. aportes         ← generados automáticamente por RPC registrar_aporte_socio al procesar pagos
```

**⚠️ Violar el orden causará errores FK** (crédito sin socio, pago sin crédito, etc.)

---

## 1. Tabla: `convenios`

**Fuente:** Campo `Usuario` en CONVENIO MES MARZO 2026 — Hoja DETALLE

**Valores observados en campo Usuario:**
```
USUCAJ → Caja directa (no es convenio)
BELEN  → Convenio BELEN
CHEPEN → Convenio CHEPEN
DIRES  → Convenio DIRES
LAFORA → Convenio LA FORA
IREN   → Convenio IREN
IRO    → Convenio IRO
REGION → Convenio REGIONAL
UTES   → Convenio UTES
OTUZCO → Convenio OTUZCO
SCHUCO → Convenio SCHUCO
```

**Mapping:**

| Columna Excel | Campo DB | Transformación |
|---|---|---|
| Usuario (único) | `nombre` | Trim + normalizar nombre completo |
| — | `ruc` | No disponible — dejar vacío o ingresar manualmente |
| — | `contacto` | No disponible |
| — | `telefono` | No disponible |
| — | `activo` | `true` por default |

**Transformaciones:**
- Extraer valores únicos de columna `Usuario` (excluyendo USUCAJ=caja)
- Mapear abreviatura → nombre completo (requiere validación manual con Tesorería)
- Insertar convenios ANTES de cargar socios (para asignar `id_convenio` a socios)

**Validaciones:**
- Sin duplicados por nombre
- Al menos 10 convenios esperados

**Errores esperados:**
- Nombres incompletos (solo abreviaturas disponibles)
- Campos ruc/contacto/telefono vacíos

**Dependencias:** Ninguna

**Riesgos:** Bajo. Tabla simple. Nombres pueden requerir verificación manual.

---

## 2. Tabla: `socios`

**Fuente:** ❌ No disponible desde Excel. Usar backup JSON.

**Fuente alternativa:** `backups/data-reset/20260620-1327/socios.json` (434 registros)

**Campos del backup JSON → tabla `socios`:**

| Campo backup | Campo DB | Transformación |
|---|---|---|
| `nro_socio` | `nro_socio` | Directo |
| `dni` | `dni` | Directo |
| `apellidos` | `apellidos` | Directo |
| `nombres` | `nombres` | Directo |
| `estado` | `estado` | Directo (activo/retirado/suspendido/fallecido) |
| `id_convenio` | `id_convenio` | ⚠️ UUIDs del sistema anterior — requieren re-mapeo si convenios se reinsertan |
| `fecha_nacimiento` | `fecha_nacimiento` | Directo (YYYY-MM-DD) |
| `direccion` | `direccion` | Directo |
| `created_at` | `created_at` | Directo o resetear a fecha de carga |
| `genero` | `genero` | ⚠️ Estaba vacío en backup (2 warnings en dry-run Fase 9C-3) |
| `estado_civil` | `estado_civil` | ⚠️ Estaba vacío en backup |

**Extracción parcial desde Excel (solo socios activos en marzo 2026):**

Si se prefiere no usar backup, los socios mencionados en los Excel (INGRESO + CONVENIO) pueden ser parcialmente reconstruidos:
- `IdSocio` → `nro_socio`
- `Socio` → `apellidos` + `nombres` (concatenados en un solo campo — necesita separación)
- `DNI` → `dni`
- `IdPers` → campo interno del sistema anterior (no mapear)
- Sin fecha_nacimiento, sin direccion, sin id_convenio

**Limitación:** Solo cubre socios con movimiento en marzo 2026 (~500-600 socios únicos estimados). No cubre socios sin actividad en ese período.

**Validaciones:**
- Sin `dni` duplicado
- Sin `nro_socio` duplicado
- Total esperado: ~434 socios (per backup)

**Dependencias:** `convenios` (para `id_convenio`)

**Riesgos:** ALTO — sin socios no se puede cargar nada más. Backup JSON es la fuente más completa.

---

## 3. Tabla: `creditos`

**Fuente:** `DSCTO Y DESMBOLSO DE CRDITO MA ABR-2026 (1).xlsx` — Hoja3

**Encabezados fuente:** Item | Exped. | Fecha | IdSocio | Socio | Convenio | Monto | Saldo Capital | Interes | Aporte | FPS | Tram. | AutoSeg. | Monto Girado | Descuento | Plazo | CuoProp | Desc. Calculado | Mes | Año

**Mapping completo:**

| Columna Excel | Campo DB | Transformación | Requerido |
|---|---|---|---|
| Exped. | `nro_expediente` | String directo | No |
| Exped. | `nro_pagare` | Mismo valor (usar como nro_pagare) | Sí |
| Fecha | `fecha_desembolso` | Serial Excel → DATE (`XLSX.SSF.format`) o `new Date(25567 + serial)` | Sí |
| IdSocio | `id_socio` | Lookup en `socios` WHERE `nro_socio = IdSocio` → UUID | Sí |
| Monto | `monto_aprobado` | Número directo | Sí |
| Saldo Capital | `saldo_capital` | Número directo | Sí |
| Interes | `interes_acumulado` | Número directo | No |
| FPS | `descuento_fps` | Número directo | No |
| Tram. | `tramite` | Número directo | No |
| AutoSeg. | `descuento_seguro` | Número directo | No |
| Descuento | `descuento_otros` | Número directo (= Monto - Monto Girado) | No |
| Monto Girado | `monto_girado_neto` | Número directo | No |
| Plazo | `plazo_meses` | Entero | Sí |
| CuoProp | `cuota_mensual` | Número directo | No |
| — | `tasa_interes` | ❌ No disponible. Calcular: `r = (cuota*(1-(1+r)^-n)/capital)` o usar tasa_default de configuracion | Sí |
| — | `tipo_credito` | ❌ No disponible. Default: `'consumo'` (confirmar con Créditos) | Sí |
| — | `estado` | Inferir: `saldo_capital > 0` → `'vigente'`, `saldo_capital = 0` → `'cancelado'` | Sí |
| — | `tipo_credito_sbs` | ❌ No disponible. Default: `'consumo_no_revolvente'` | No |
| — | `subtipo_credito_sbs` | ❌ No disponible | No |
| — | `cuenta_contable_bd01` | ❌ No disponible. Default: `'1411050604'` | No |

**Transformaciones clave:**

1. **Fecha serial Excel → DATE:**
   ```js
   // Excel usa 1900-01-01 como día 1. Fórmula:
   function excelDateToJS(serial) {
     return new Date(Math.round((serial - 25569) * 86400 * 1000));
   }
   // Ejemplo: 46083 → 2026-03-01
   ```

2. **IdSocio → UUID de Supabase:**
   ```js
   // Requiere tabla de socios ya cargada en Supabase
   // SELECT id FROM socios WHERE nro_socio = '0001611'
   ```

3. **Tasa de interés (inferida):**
   ```js
   // Si cuota_mensual y monto_aprobado y plazo son conocidos,
   // se puede aproximar la tasa mensual resolviendo:
   // M = P·r·(1+r)^n / [(1+r)^n - 1]
   // Esto requiere iteración (Newton-Raphson). Alternativa: usar tasa de configuracion.
   ```

**Validaciones:**
- `id_socio` debe existir en `socios`
- `monto_aprobado > 0`
- `plazo_meses > 0 AND plazo_meses <= 120`
- `fecha_desembolso` en rango razonable (2015-2026)
- Sin `nro_expediente` duplicado

**Errores esperados:**
- Socios en Excel no encontrados en `socios` (crédito sin socio)
- Fechas en formato serial no convertido correctamente
- `tasa_interes` ausente → usar fallback o calcular

**Dependencias:** `socios` debe estar cargada

**Riesgos:** ALTO — muchos campos opcionales SBS que deben ingresarse manualmente después de la carga.

**Nota:** El cronograma de cuotas (`cronograma_cuotas`) se generará automáticamente via RPC `crear_credito_con_cronograma`. **NO insertar cronograma manualmente.**

---

## 4. Tabla: `cronograma_cuotas`

**Fuente:** Generada automáticamente por RPC `crear_credito_con_cronograma`

**NO cargar desde Excel.** El cronograma se genera al insertar cada crédito con la RPC.

**⚠️ Limitación:** Si los créditos tienen pagos históricos previos a la carga, el cronograma generado mostrará todas las cuotas como pendientes. Habrá que marcar cuotas pagadas por separado (o cargar los pagos en orden cronológico para que las RPCs lo hagan automáticamente).

---

## 5. Tabla: `pagos_recibos`

**Fuente A:** `INGRESO DETALLADO MARZO 2026 (1).xlsx` — Hoja1 (~35 registros, caja)
**Fuente B:** `CONVENIO MES MARZO 2026 (1).xlsx` — Hoja DETALLE (~801 registros, convenios)

**Encabezados fuente (idénticos en ambos):**
`IdSocio | Socio | Fecha | N°Recibo | Ap | Ptmo | IntC | FPS | FPSEx | OtrosP | TotalRec | Usuario | Tipo | DNI | IdPers`

**Mapping completo:**

| Columna Excel | Campo DB | Transformación | Requerido |
|---|---|---|---|
| IdSocio | `id_socio` | Lookup en `socios` WHERE `nro_socio = IdSocio` → UUID | Sí |
| N°Recibo | `nro_recibo` | String o Integer | Sí |
| Fecha | `fecha` | DD/M/YYYY o DD/MM/YYYY → DATE | Sí |
| Ap | `monto_aporte` | Número. 0 si vacío | Sí |
| Ptmo | `monto_capital` | Número. 0 si vacío | Sí |
| IntC | `monto_interes` | Número. 0 si vacío | Sí |
| FPS | `monto_fps` | Número. 0 si vacío | Sí |
| FPSEx | `monto_fps_extra` | Número. 0 si vacío | Sí |
| OtrosP | `monto_otros` | Número. 0 si vacío | Sí |
| TotalRec | `monto_total` | Número | Sí |
| — | `periodo` | Inferir de Fecha: `YYYY-MM` format | Sí |
| Usuario | `id_convenio` | Lookup en `convenios` WHERE abrev. → UUID. USUCAJ → NULL | No |
| — | `canal_pago` | Default: `'caja'` si USUCAJ, `'convenio'` si otro Usuario | No |
| — | `estado_flujo` | Default: `'completado'` | No |
| — | `id_credito` | ⚠️ NO disponible directamente. Lookup: socio activo más reciente | No |
| — | `interes_amortizado_pagado` | Default: `IntC` (asumir todo el interés fue amortizado) | No |

**Transformaciones clave:**

1. **Fecha DD/M/YYYY → DATE:**
   ```js
   // "2/3/2026" → "2026-03-02"
   // "25/3/2026" → "2026-03-25"
   function parseExcelDate(str) {
     const [d, m, y] = str.split('/');
     return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
   }
   ```

2. **IdSocio → UUID:**
   ```js
   // Lookup en tabla socios ya cargada
   ```

3. **Asociar id_credito:**
   - Si `monto_capital > 0`: buscar el crédito vigente más reciente del socio
   - Si `monto_aporte > 0` y `monto_capital = 0`: pago solo de aporte → `id_credito = NULL`
   - Riesgo: socio con múltiples créditos vigentes → necesita selección manual

4. **Monto total verificación:**
   ```js
   const calculado = Ap + Ptmo + IntC + FPS + FPSEx + OtrosP;
   if (Math.abs(calculado - TotalRec) > 0.01) { flagear error }
   ```

**Validaciones:**
- `id_socio` existe en `socios`
- `monto_total > 0`
- Suma de componentes ≈ `monto_total` (tolerancia: S/0.01)
- Sin `nro_recibo` duplicado
- `fecha` en rango 2026-03-01 a 2026-03-31

**Errores esperados:**
- Socios en Excel no encontrados en DB
- Pagos con `monto_capital > 0` donde socio tiene 0 créditos (Tipo=K?)
- Diferencias de redondeo en monto_total

**Dependencias:** `socios`, `convenios`, `creditos` (para id_credito)

**Riesgos:** MEDIO. El mayor riesgo es la asignación de `id_credito` cuando el socio tiene múltiples créditos.

---

## 6. Tabla: `aportes`

**Fuente:** Generados automáticamente por RPC `registrar_aporte_socio` al procesar pagos con `monto_aporte > 0`

**NO cargar directamente.** Se crean via RPC al insertar `pagos_recibos`.

**⚠️ Aportes históricos anteriores a marzo 2026 NO están en los Excels disponibles.**
Si se requiere el historial completo de aportes, se debe usar el backup JSON o ingresar saldo inicial manualmente.

---

## 7. Tabla: `egresos`

**Fuente:** ❌ No disponible desde Excel.

Sin datos disponibles para cargar desde los archivos Excel del cliente.

---

## Resumen de dependencias y orden de carga

```
PASO 1: convenios (fuente: Excel CONVENIO, campo Usuario)
   ↓
PASO 2: socios (fuente: backup JSON)
   ↓
PASO 3: creditos (fuente: Excel DSCTO Y DESEMBOLSO)
   → cronograma_cuotas se genera automáticamente (RPC crear_credito_con_cronograma)
   ↓
PASO 4: pagos_recibos (fuente: Excel INGRESO + CONVENIO)
   → aportes se generan automáticamente (RPC registrar_aporte_socio)
   ↓
PASO 5: validación final (comparar totales con Excels de referencia)
```

---

## Tabla resumen de importabilidad

| Tabla | Importable | Fuente | Condición |
|---|---|---|---|
| `convenios` | ✅ Sí | Excel CONVENIO (campo Usuario) | Manual — mapeo de nombres |
| `socios` | ⚠️ Parcial | Backup JSON (434 registros) | Requiere re-mapeo id_convenio |
| `creditos` | ✅ Sí | Excel DSCTO Y DESEMBOLSO | Requiere socios primero + tasa interés manual |
| `cronograma_cuotas` | ✅ Auto | Generado por RPC C | Solo con creditos correctos |
| `pagos_recibos` | ✅ Sí | Excel INGRESO + CONVENIO | Requiere socios + convenios + creditos |
| `aportes` | ✅ Auto | Generado por RPC B | Solo con pagos con Ap>0 |
| `egresos` | ❌ No | Sin fuente Excel | Ingresar manualmente |

---

## Campos que DEBEN completarse manualmente post-carga

| Tabla | Campo | Motivo |
|---|---|---|
| `socios` | `genero` | No en Excel ni en backup |
| `socios` | `estado_civil` | No en Excel ni en backup |
| `socios` | `beneficiario_nombre/dni/parentesco` | No en Excel |
| `creditos` | `tasa_interes` | No en Excel (calcular o estimar) |
| `creditos` | `tipo_credito` | No en Excel |
| `creditos` | `tipo_credito_sbs` | No en Excel |
| `creditos` | `subtipo_credito_sbs` | No en Excel |
| `creditos` | `cuenta_contable_bd01` | No en Excel |
| `convenios` | `ruc`, `contacto`, `telefono` | No en Excel |
| `pagos_recibos` | `id_credito` | Inferencia automática puede requerir revisión |
