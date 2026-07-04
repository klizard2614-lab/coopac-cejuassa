# DATA_RELOAD_CHECKLIST.md
# Checklist de Recarga de Datos Reales — CEJUASSA
# Fecha: 2026-06-20

> Usar después de ejecutar el reset de datos aprobado.
> Marcar cada paso con [x] al completarlo.

---

## Paso 0 — Verificaciones previas

### ✅ Backup local completado (Fase 9C-1 — 2026-06-20)
- [x] `npm run backup:operational-data` — 1267 registros exportados en `backups/data-reset/20260620-1327/`
- [x] `npm run check:operational-backup` — 27/27 PASS, ningún dato borrado
- [x] `BACKUP_MANIFEST.md` generado en la raíz del proyecto

### ✅ Datos demo regulatorios aplicados (Fase 9C-6I-DEMO — 2026-06-23)

> ⚠️ DATOS DE DEMOSTRACIÓN — NO OFICIALES
> `socios.genero = M` (782), `socios.estado_civil = soltero` (782), `creditos.subtipo_credito_sbs = por_confirmar` (31)
> Backup: `backups/demo-data-fill/2026-06-23T02-18/`
> Revertir antes de generar BDCC/TXT SBS oficial.

- [x] `npm run demo:reg-fields:dry-run` — 782 sin genero, 782 sin estado_civil, 31 sin subtipo
- [x] `npm run check:demo-reg-fields` — 26/26 PASS
- [x] `npm run demo:reg-fields:apply` — apply con autorización `APLICAR DATOS DEMO 9C-6I`
- [x] `npm run audit:post-excel-import` — 0 críticos tras apply
- [x] `npm run verify:cejuassa` — tsc OK + build OK

### ✅ Reset ejecutado (Fase 9C-2 — 2026-06-20)
- [x] Autorización explícita del usuario recibida
- [x] Limpieza ejecutada vía Supabase MCP — todas las tablas operativas en 0
- [x] `usuarios` conservado (2 registros), `configuracion` conservado (1 registro)
- [x] `npm run plan:data-reset` → 0 registros en todas las tablas operativas
- [x] `npm run check:data-reset-plan` → 18/18 PASS
- [x] `npm run verify:cejuassa` → tsc OK + build 28/28 OK
- [x] Acceso a la app confirmado (estructura intacta)

---

## Paso 1 — Verificar Configuración

**Módulo:** `/dashboard/configuracion`

- [ ] `nombre_cooperativa` correcto
- [ ] `codigo_coopac` = `01270` (código SBS CEJUASSA)
- [ ] `ruc` correcto
- [ ] `direccion` correcta
- [ ] `telefono` correcto
- [ ] `email` correcto
- [ ] `tasa_interes_anual` configurada (valor de referencia para nuevos créditos)
- [ ] `tasa_fps` configurada
- [ ] Tasas de provisión SBS verificadas:
  - [ ] `provision_normal`
  - [ ] `provision_cpp`
  - [ ] `provision_deficiente`
  - [ ] `provision_dudoso`
  - [ ] `provision_perdida`

---

## Paso 2 — Cargar Convenios

**Módulo:** `/dashboard/convenios` o directamente en Supabase

- [ ] Cargar convenios institucionales (si aplica)
- [ ] Verificar que cada convenio tiene: nombre, RUC, contacto, teléfono, estado activo
- [ ] Anotar los IDs asignados (serán necesarios para asignar socios)

---

## Paso 3 — Cargar Socios

**Módulo:** `/dashboard/socios/nuevo` (uno a uno) o importación directa en Supabase

Por cada socio:
- [ ] `nro_socio` — número correlativo o interno
- [ ] `dni` — documento de identidad
- [ ] `apellidos` — ambos apellidos
- [ ] `nombres` — nombre(s)
- [ ] `fecha_nacimiento` — para cálculos SBS
- [ ] `telefono`
- [ ] `email`
- [ ] `direccion`
- [ ] `id_convenio` — asignar convenio si aplica
- [ ] `fecha_ingreso` — fecha de afiliación a la cooperativa
- [ ] `estado` — activo / retirado / suspendido / fallecido
- [ ] `genero` — M / F (requerido para BDCC BD01)
- [ ] `estado_civil` — soltero / casado / conviviente / divorciado / viudo (requerido BDCC)
- [ ] `beneficiario_nombre` — nombre del beneficiario FPS
- [ ] `beneficiario_dni` — DNI del beneficiario FPS
- [ ] `beneficiario_parentesco` — relación (Cónyuge, Hijo/a, etc.)

**Validación:**
- [ ] Total de socios cargados coincide con padrón físico
- [ ] Ningún socio duplicado (mismo DNI o nro_socio)
- [ ] Todos los socios activos tienen género y estado civil

---

## Paso 4 — Cargar Créditos Vigentes

**Módulo:** `/dashboard/creditos/nuevo` (uno a uno)

Por cada crédito vigente:
- [ ] Socio seleccionado correctamente
- [ ] `nro_pagare` — número del pagaré físico
- [ ] `fecha_desembolso` — fecha real del desembolso
- [ ] `monto_aprobado` — monto total aprobado
- [ ] `tasa_interes` — tasa anual en %
- [ ] `plazo_meses` — plazo en meses
- [ ] `tipo_credito` — consumo / microempresa / hipotecario / otro
- [ ] `descuento_fps` — monto descontado al FPS
- [ ] `descuento_seguro` — monto de seguro descontado
- [ ] `descuento_otros` — otros descuentos
- [ ] `aporte_descontado` — si es socio nuevo con aporte al desembolso
- [ ] `tramite` — costo de trámite si aplica
- [ ] `nro_expediente` — para BD01 BDCC
- [ ] `tipo_credito_sbs` — clasificación SBS (consumo no revolvente, etc.)
- [ ] `subtipo_credito_sbs` — subtipo según catálogo SBS
- [ ] `cuenta_contable_bd01` — cuenta contable (candidata: 1411050604)

**Importante:**
- El cronograma de cuotas se genera **automáticamente** al guardar el crédito.
- Verificar que el cronograma generado coincide con el cronograma físico en monto y fechas.

**Validación:**
- [ ] Total de créditos vigentes cargados
- [ ] Cada crédito tiene su cronograma de cuotas generado
- [ ] Los saldos de capital iniciales son correctos (= monto_aprobado al inicio)

---

## Paso 5 — Ajustar Saldos de Capital (si hay pagos históricos)

Si los créditos tienen pagos anteriores a la fecha de carga:

- [ ] Por cada pago histórico: registrar en `/dashboard/pagos/nuevo`
  - Esto actualiza automáticamente: saldo_capital, cuotas pagadas, aportes
- [ ] Alternativa: actualizar `saldo_capital` directamente en Supabase Dashboard si los pagos históricos son muchos
  - ⚠️ En este caso, también actualizar manualmente el estado de las cuotas en `cronograma_cuotas`

---

## Paso 6 — Cargar Pagos Históricos (si aplica)

**Módulo:** `/dashboard/pagos/nuevo`

Si se van a cargar pagos históricos desde el inicio:
- [ ] Cargar en orden cronológico (del más antiguo al más reciente)
- [ ] Verificar que el saldo de capital se reduce correctamente en cada pago
- [ ] Verificar que las cuotas se marcan como pagadas en el cronograma

---

## Paso 7 — Cargar Aportes Históricos (si aplica)

Los aportes se crean automáticamente al registrar pagos con `monto_aporte > 0`.
Si hay aportes anteriores al sistema:

- [ ] Cargar aporte inicial de cada socio (si aplica)
- [ ] Verificar que el saldo de aportes es correcto por socio

---

## Paso 8 — Cargar Egresos Históricos (si aplica)

**Módulo:** `/dashboard/egresos`

- [ ] Cargar egresos del período actual
- [ ] Verificar tipos: retiro_socio / fondo_mortuorio / otro
- [ ] Verificar totales de caja

---

## Paso 9 — Verificaciones Finales

### Dashboard
- [ ] Totales de socios, créditos vigentes, pagos del mes son correctos
- [ ] Gráficos de aportes e ingresos vs egresos muestran datos reales

### Cartera
- [ ] Clasificación SBS correcta (Normal / CPP / Deficiente / Dudoso / Pérdida)
- [ ] Días de mora calculados correctamente
- [ ] Provisiones calculadas con tasas de configuración

### Anexo 6
- [ ] Generar Anexo 6 para el período actual
- [ ] Verificar columnas: Deudor, Saldo Capital, Días Mora, Clasificación, Provisiones Requeridas = Constituidas
- [ ] Exportar a Excel y revisar fila por fila

### BDCC
- [ ] Generar BD01 para el período actual
- [ ] Verificar que campos SEXO y ESTCIV están completos (no vacíos)
- [ ] Verificar TIPCRED y TPINT con Créditos antes de enviar a SBS
- [ ] Generar BD02-A para pagos del período

### Scripts de validación
- [ ] `npm run verify:cejuassa` — tsc + build OK
- [ ] `npm run check:monday-readiness` — 37/37 PASS
- [ ] `npm run smoke:bdcc` — PASS
- [ ] `npm run check:provision:constituida` — PASS

---

## Recordatorios Post-Recarga

- [ ] Confirmar con Créditos: TPINT (¿tasa nominal anual o TEA?)
- [ ] Confirmar con Créditos: códigos TIPCRED y SUBTIPCRED exactos según Oficio SBS
- [ ] Confirmar con Contabilidad: cuentas CCVE y CCJU para BD02-B y BD04
- [ ] Fecha límite BDCC SBS: **20/07/2026** (BD01 + BD02-A de trimestres marzo y junio 2026)

---

---

## Fase 9C-3 — Preparación de recarga (✅ Completada 2026-06-20)

- [x] `DATA_RELOAD_SOURCE_MAP.md` creado — fuentes mapeadas (backup JSON + Excel cliente)
- [x] `scripts/reload/dry-run-reload-data.mjs` creado — validación sin insertar
- [x] `npm run reload:dry-run` → 0 issues, 2 warnings (género/estado civil vacíos en backup)
- [x] `npm run check:data-reload-prep` → 13/13 PASS
- [x] NO se insertó ningún dato

**Decisión pendiente del usuario:**
- ¿Recargar desde el **backup JSON** (434 socios, 431 créditos — datos históricos completos)?
- ¿Recargar desde los **Excel del cliente** (solo marzo 2026, ~32 créditos — requiere transformación)?
- ¿Cómo manejar el **cronograma de cuotas** (estaba vacío en el backup)?

*Checklist creado 2026-06-20. Fase 9C-3 completada 2026-06-20.*

---

## Fase 9C-4A — Auditoría de fuentes Excel (✅ Completada 2026-06-20)

- [x] 7 archivos Excel localizados en `_client_files/raw/extracted/Archvos app/`
- [x] `EXCEL_IMPORT_SOURCE_AUDIT.md` — auditoría completa con clasificación por tipo
- [x] `EXCEL_IMPORT_MAPPING_PLAN.md` — mapping columnas→campos DB + transformaciones
- [x] `scripts/import-excel/dry-run-excel-import.mjs` — dry-run solo lectura
- [x] `npm run import:excel:dry-run` → 6 issues (1 fila vacía por Excel) + 9 warnings — ninguno bloqueante
- [x] `npm run check:excel-import-prep` → **35/35 PASS**
- [x] NO se insertó ningún dato
- [x] `_client_files/` no modificado

**Excels importables:**

| Excel | Tabla destino | Registros candidatos |
|---|---|---|
| DSCTO Y DESEMBOLSO ABR-2026 | `creditos` | 27 vigentes + 5 cancelados (solo mar-2026) |
| INGRESO DETALLADO MAR-2026 | `pagos_recibos` | 34 pagos de caja |
| CONVENIO MES MAR-2026 | `pagos_recibos` | 800 pagos de convenio |

**Alerta:** No hay Excel de padrón de socios → cargar socios desde **backup JSON** (`backups/data-reset/20260620-1327/socios.json`).

**Convenios detectados (8):** BELEN, CHEPEN, DIRES, IREN, IRO, LAFORA, REGION, UTES

## Fase 9C-4B — Importación Excel real (✅ Completada 2026-06-21)

- [x] Autorización recibida: `EJECUTAR IMPORTACION EXCEL 9C-4B`
- [x] `scripts/import-excel/import-excel-mvp.mjs` creado con modos dry-run + apply
- [x] `docs/ai-recovery/EXCEL_IMPORT_EXECUTION_PLAN.md` creado
- [x] `npm run check:excel-import-mvp` → **31/31 PASS**
- [x] Apply ejecutado exitosamente
- [x] `usuarios` conservado (2) · `configuracion` conservado (1)
- [x] `npm run verify:cejuassa` → tsc OK + build OK

**Datos importados desde Excel (fuente principal: `_client_files/`):**

| Tabla | Registros |
|---|---|
| `convenios` | 8 |
| `socios` | 782 |
| `creditos` | 31 (26 vigentes + 5 cancelados) |
| `pagos_recibos` | 832 |
| `aportes` | 785 |
| `cronograma_cuotas` | 0 — regenerar manualmente |

**Pendientes de completar en la app:**
- `socios.genero` y `socios.estado_civil` (requeridos para BDCC) — todos NULL
- ~~`creditos.tasa_interes` — todos en 0~~ → ✅ RESUELTO Fase 9C-6C.2: `26.82` en 31/31
- `creditos.tipo_credito_sbs` — todos NULL (valor típico: '004')
- `pagos_recibos.id_credito` — todos NULL
- 1 socio con DNI placeholder `SINDNI{nro_socio}` — actualizar DNI real

## Fase 9C-5 — Auditoría post-importación (✅ Completada 2026-06-21)

- [x] `scripts/audit-post-excel-import.mjs` creado — auditoría solo lectura
- [x] `scripts/check-post-excel-import-audit.mjs` creado → **32/32 PASS**
- [x] `docs/ai-recovery/POST_EXCEL_IMPORT_AUDIT.md` generado
- [x] `npm run plan:data-reset` → 2438 registros en 5 tablas (esperado)
- [x] `npm run verify:cejuassa` → build OK
- [x] NO se modificó ningún dato

**Resultado de auditoría:**

| Severidad | Cantidad | Detalle |
|---|---|---|
| 🔴 Críticos | 4 | genero NULL · estado_civil NULL · cronograma vacío · tasa=0 |
| 🟡 Medios | 1 | 1 DNI placeholder SINDNI |
| 🟢 Advertencias | 4 | 782 sin beneficiario · 832 id_credito NULL · 1 aporte dup · 46 tipo K |

**Módulos operativos:** Socios, Pagos, Aportes, Caja, Créditos, Cartera, Anexo 6 (parcial)
**Módulos bloqueados:** BDCC BD01/BD02-A (género/estado_civil NULL)

## Fase 9C-6A — Plan y dry-run de correcciones (✅ Completada 2026-06-21)

- [x] `docs/ai-recovery/POST_IMPORT_FIX_PLAN.md` creado — separación de correcciones por grupo
- [x] `scripts/fix-post-import-dry-run.mjs` creado — solo lectura, clasifica correcciones
- [x] `scripts/check-post-import-fix-plan.mjs` → **31/31 PASS**
- [x] `docs/ai-recovery/POST_IMPORT_FIX_DRY_RUN_REPORT.md` generado
- [x] NO se modificó ningún dato

**Hallazgos:**
- `tipo_credito_sbs` actual = 'consumo_no_revolvente' (texto) → código SBS '004' NO documentado
- `cuenta_contable_bd01` ya correcta ('1411050604') · `tipo_pago` ya correcto ✅
- 0 créditos listos para cronograma (todos tasa = 0) — BLOQUEADO
- 782 socios sin genero/estado_civil — requieren datos del cliente (deadline BDCC 20/07/2026)

## Fase 9C-6B — Aplicar tasa_interes desde Anexo 6 (✅ Completada 2026-06-21)

- [x] `tasa_interes = 0.2682` aplicada en 31/31 créditos
- [x] `npm run check:apply-tasa-anexo6` → PASS
- [x] `npm run audit:post-excel-import` → cronograma desbloqueado (tasa > 0)

## Fase 9C-6C.1 — Auditoría unidad tasa_interes (✅ Completada 2026-06-22)

- [x] `docs/ai-recovery/INTEREST_RATE_UNIT_AUDIT.md` creado
- [x] `scripts/audit-interest-rate-unit.mjs` creado
- [x] Confirmado: app espera porcentaje (`26.82`), DB tenía decimal (`0.2682`) — BUG DETECTADO
- [x] `npm run audit:interest-rate-unit` → ❌ 31 decimales / 0 porcentaje (pre-fix)

## Fase 9C-6C.2 — Convertir tasa_interes decimal → porcentaje (✅ Completada 2026-06-22)

- [x] `scripts/convert-tasa-interes-to-percent.mjs` creado (dry-run + apply)
- [x] `scripts/check-tasa-interes-conversion.mjs` creado → **25/25 PASS**
- [x] Dry-run confirmó 31 créditos, tasa única `0.2682 → 26.82`
- [x] Apply ejecutado con autorización: `CONVERTIR TASA A PORCENTAJE 9C-6C.2`
- [x] 31/31 actualizados sin errores
- [x] `npm run audit:interest-rate-unit` → ✅ 0 decimales / 31 porcentaje
- [x] `npm run verify:cejuassa` → TSC OK + BUILD 28/28

## Fase 9C-6C — Dry-run regeneración cronograma_cuotas (✅ Completada 2026-06-22)

- [x] `docs/ai-recovery/CRONOGRAMA_REGENERATION_PLAN.md` creado
- [x] `scripts/dry-run-regenerate-cronogramas.mjs` creado — SOLO LECTURA
- [x] `scripts/check-cronograma-regeneration-plan.mjs` → **22/22 PASS**
- [x] `docs/ai-recovery/CRONOGRAMA_REGENERATION_DRY_RUN_REPORT.md` generado
- [x] `npm run verify:cejuassa` → build OK
- [x] NO se insertó ningún dato
- ⚠️ NOTA: ejecutado con tasa decimal incorrecta (0.2682) — supersedido por Fase 9C-6D.0

## Fase 9C-6D.0 — Re-dry-run cronogramas con tasa corregida (✅ Completada 2026-06-22)

- [x] `audit:interest-rate-unit` → ✅ 0 decimales / 31 porcentaje
- [x] `cronogramas:dry-run` con `tasa_interes = 26.82` → **26/26 elegibles · 911 cuotas · ΔMonto = S/0.00**
- [x] `check:cronogramas:plan` → **22/22 PASS**
- [x] `verify:cejuassa` → TSC OK + BUILD 28/28
- [x] Reporte actualizado: `CRONOGRAMA_REGENERATION_DRY_RUN_REPORT.md` (Fase 9C-6D.0)
- [x] Total monto aprobado: S/ 196,100.00 · Tasa: 26.82% TEA · Cuotas: 911
- [x] NO se insertó ningún dato

**Resultado del dry-run:**
- 26/26 créditos vigentes elegibles · 0 no elegibles
- 911 cuotas totales simuladas
- 26/26 ΣCapital = Monto exacto (desfase = S/0.00 en todos)
- 26/26 saldo_capital < monto_aprobado (diferencia esperada — pagos anteriores sin cronograma)
- Fórmula: sistema francés · r = 0.2682/100/12

## ~~Fase 9C-6D — Apply: insertar cuotas regeneradas~~ ✅ COMPLETADA (2026-06-22)

- [x] `scripts/apply-regenerate-cronogramas.mjs` creado — soporta --dry-run y --apply
- [x] `scripts/check-cronograma-apply.mjs` creado → **18/18 PASS**
- [x] `npm run cronogramas:apply:dry-run` → **26/26 elegibles · 911 cuotas · 0 errores**
- [x] `npm run check:cronogramas:apply` → **18/18 PASS**
- [x] `npm run verify:cejuassa` → tsc OK + build OK
- [x] `docs/ai-recovery/CRONOGRAMA_REGENERATION_APPLY_REPORT.md` generado (dry-run)
- [x] **Autorización exacta recibida:** `INSERTAR CRONOGRAMA 9C-6D`
- [x] `npm run cronogramas:apply` → **26/26 · 911 cuotas · 0 errores** ✅
- [x] `npm run check:cronogramas:apply` → **18/18 PASS** post-apply ✅
- [x] `npm run audit:post-excel-import` → cronograma_cuotas = 911 ✅
- [x] `npm run verify:cejuassa` → tsc OK + build OK ✅

## Fase 9C-6E — Dry-run vinculación pagos_recibos.id_credito (✅ Completada 2026-06-22)

- [x] `scripts/dry-run-link-pagos-creditos.mjs` creado — SOLO LECTURA
- [x] `scripts/check-pagos-creditos-link-plan.mjs` creado → **25/25 PASS**
- [x] `docs/ai-recovery/PAGOS_CREDITOS_LINK_DRY_RUN_REPORT.md` generado
- [x] `docs/ai-recovery/proposed_pago_credito_links_preview.json` generado (IDs enmascarados)
- [x] `npm run pagos:link-creditos:dry-run` ejecutado — 832 pagos clasificados
- [x] `npm run check:pagos-link-creditos` → **25/25 PASS**
- [x] `npm run audit:post-excel-import` → OK (cronograma_cuotas = 911)
- [x] `npm run verify:cejuassa` → tsc OK + build OK
- [x] NO se modificó ningún dato

**Resultado:**

| Categoría | Cantidad |
|---|---|
| `match_alto` | 28 |
| `match_medio` | 3 |
| `ambiguo` | 0 |
| `no_aplica_credito` | 417 |
| `sin_match` | 384 |

**Hallazgo:** 417 pagos son solo aporte/FPS (no vinculables). 384 son de socios sin crédito en DB (convenio puro). Solo 31 pagos tienen componente de crédito. Apply recomendado para los 28 match_alto.

**Siguiente paso:** ~~Fase 9C-6F — Apply vinculación~~ → ✅ COMPLETADO (ver abajo).

## Fase 9C-6F — Apply vinculación pagos_recibos.id_credito (✅ Completada 2026-06-22)

- [x] `scripts/apply-link-pagos-creditos.mjs` creado — soporta --dry-run y --apply
- [x] `scripts/check-pagos-creditos-link-apply.mjs` creado → **39/39 PASS**
- [x] `npm run pagos:link-creditos:apply:dry-run` → Preflight 6/6 OK — 28 pagos en plan, 0 datos modificados
- [x] `npm run check:pagos-link-creditos-apply` → **39/39 PASS**
- [x] `npm run verify:cejuassa` → tsc OK + build OK
- [x] **Autorización exacta recibida:** `VINCULAR 28 PAGOS 9C-6F`
- [x] `npm run pagos:link-creditos:apply` → **28/28 exitosos · 0 errores** ✅
- [x] `npm run check:pagos-link-creditos-apply` → **39/39 PASS** post-apply ✅
- [x] `npm run pagos:link-creditos:dry-run` → re-clasificación confirma match_alto=0 (ya aplicados)
- [x] `npm run audit:post-excel-import` → 804 pagos con id_credito NULL (era 832 → bajó 28) ✅
- [x] `npm run verify:cejuassa` → tsc OK + build OK ✅

**Solo se actualizó `pagos_recibos.id_credito`.** `cronograma_cuotas`, `creditos`, `socios` no modificados.

| Métrica | Valor |
|---|---|
| Pagos vinculados (match_alto) | **28** |
| Pagos con id_credito = NULL restantes | **804** |
| match_medio pendientes revisión manual | 3 |
| no_aplica_credito (aporte/FPS puro) | 417 |
| sin_match (convenio sin crédito en DB) | 384 |

**Reportes:** `PAGOS_CREDITOS_LINK_APPLY_DRY_RUN.md` · `PAGOS_CREDITOS_LINK_APPLY_REPORT.md`

**Siguiente paso recomendado:** ~~Fase 9C-6G~~ ✅ Completada — ~~Fase 9C-6H.0~~ ✅ Completada — ver Fase 9C-6H.1.

## Fase 9C-6G — Preparar revisión de 3 match_medio (✅ Completada 2026-06-22)

- [x] `exports/data-corrections/revision_pagos_match_medio.xlsx` generado (3 filas, IDs enmascarados)
- [x] `docs/ai-recovery/PAGOS_MATCH_MEDIO_REVIEW.md` generado
- [x] `scripts/check-pagos-match-medio-review.mjs` creado → **15/15 PASS**
- [x] `npm run check:pagos-match-medio-review` disponible
- [x] `npm run verify:cejuassa` → tsc OK + build OK
- [x] DB NO modificada
- [ ] **PENDIENTE DEL CLIENTE:** área de Créditos debe completar `decision_creditos` en el Excel

## Fase 9C-6H.0 — Dry-run pagos → cuotas (✅ Completada 2026-06-22)

- [x] `scripts/dry-run-apply-pagos-to-cuotas.mjs` creado — SOLO LECTURA
- [x] `scripts/check-pagos-to-cuotas-plan.mjs` creado → **37/37 PASS**
- [x] `docs/ai-recovery/proposed_cuotas_payment_updates_preview.json` generado (IDs enmascarados)
- [x] `docs/ai-recovery/PAGOS_TO_CUOTAS_DRY_RUN_REPORT.md` generado
- [x] `npm run pagos:to-cuotas:dry-run` ejecutado — 28 pagos analizados, 26 cuotas parciales
- [x] `npm run check:pagos-to-cuotas-plan` → **37/37 PASS**
- [x] `npm run audit:post-excel-import` → OK (cronograma_cuotas = 911)
- [x] `npm run verify:cejuassa` → tsc OK + build 34/34 OK
- [x] DB NO modificada

**Resultado:**
| Métrica | Valor |
|---|---|
| Pagos vinculados analizados | **28** |
| Créditos afectados | **27** |
| Cuotas propuestas como PAGADAS | **0** |
| Cuotas propuestas como PARCIALES | **26** |
| Pagos no asignables | **2** |

**Hallazgos:**
- 0 cuotas pagadas completas: los pagos importados son pagos parciales de la cuota mensual
- Crédito 1145****: sin cronograma (es cancelado — esperado)
- Pago 1232****: monto_capital + monto_interes = 0 — solo aporte/FPS
- **Recomendación: esperar los 3 match_medio antes del apply (Fase 9C-6H.1)**
