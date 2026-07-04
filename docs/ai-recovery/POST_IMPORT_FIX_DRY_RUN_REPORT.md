# POST_IMPORT_FIX_DRY_RUN_REPORT.md
# Reporte Dry-Run de Correcciones Post-Importación — CEJUASSA
# Generado: 2026-06-21 17:09:07

> Fase 9C-6A — Solo lectura. Nada fue modificado.

---

## Conteos actuales

| Tabla | Registros |
|---|---|
| socios | 782 |
| creditos | 31 |
| pagos_recibos | 832 |
| cronograma_cuotas | 0 |

---

## Grupo A — Correcciones automáticas

| Campo | Estado actual | Acción | Resultado |
|---|---|---|---|
| `tipo_credito_sbs` | 'consumo_no_revolvente' (texto, no código) | ❌ NO aplicar | Código '004' no documentado en proyecto |
| `subtipo_credito_sbs` | NULL en 31 créditos | ❌ NO aplicar | Código no documentado |
| `cuenta_contable_bd01` | '1411050604' en todos | ✅ Ya correcta | No requiere acción |
| `tipo_pago` | Poblado en 832 pagos | ✅ Ya correcta | No requiere acción |

**Verificación de documentación:**
- Código '004' documentado: NO — no aplicar automáticamente
- Cuenta '1411050604' documentada: SÍ

---

## Grupo B — Requieren datos del cliente

| Campo | Registros afectados | Fuente requerida | Método |
|---|---|---|---|
| `genero` | 782 socios | Lista de socios del cliente | Script bulk O app |
| `estado_civil` | 782 socios | Lista de socios del cliente | Script bulk O app |
| `tasa_interes` | 31 créditos | Documentos físicos (pagarés) | App (editar crédito) |
| `tipo_credito_sbs` (código) | 31 créditos | Oficio SBS catálogo C19 | Script bulk |
| `subtipo_credito_sbs` | 31 créditos | Oficio SBS catálogo C20 | Script bulk |
| DNI placeholder | 1 socio | DNI real del socio | App |
| Beneficiarios FPS | 782 socios | Fichas FPS | App O script |

**Crítico para BDCC (deadline 20/07/2026):**
- genero + estado_civil → bloquean BD01 completamente
- tasa_interes → TPINT en BD01 = 0 (dato inválido para SBS)
- tipo_credito_sbs código numérico → TIPCRED en BD01

---

## Grupo C — Decisión de negocio

### Cronograma de cuotas

| Condición | Créditos |
|---|---|
| Vigentes total | 26 |
| Listos para cronograma (tasa > 0) | 0 |
| Bloqueados (tasa = 0) | 26 |
| Cronograma actual en DB | 0 |

**Conclusión:** ❌ Ningún crédito puede generar cronograma — todos tienen tasa_interes = 0. Completar tasa primero.

### Asociación pagos ↔ créditos

| Situación | Pagos |
|---|---|
| Ya asociados (id_credito no NULL) | 0 |
| Asociables automáticamente (socio con 1 crédito) | 0 |
| Ambiguos (socio con >1 crédito) | 0 |
| Sin crédito en DB para su socio | 832 |

**Recomendación:** La asociación automática es posible para 0 pagos.
Decidir si se necesita antes de BDCC BD02-A.

### Pagos tipo K

- 46 pagos con tipo_pago = 'K'
- Confirmar con SBS si 'K' es un valor válido para TIPPAG en BD02-A

---

## Resumen — Qué se puede corregir ahora vs. qué necesita esperar

### Corregible ahora (sin datos externos)
- ✅ cuenta_contable_bd01: ya correcta en todos los créditos
- ✅ tipo_pago: ya poblado en todos los pagos

### Necesita datos del cliente
- ⏳ genero/estado_civil: 782 socios — requiere lista del cliente
- ⏳ tasa_interes: 31 créditos — requiere documentos físicos
- ⏳ tipo_credito_sbs código SBS: código no confirmado en proyecto — requiere Oficio SBS
- ⏳ subtipo_credito_sbs: 31 créditos — requiere catálogo SBS
- ⏳ DNI placeholder: 1 socio — requiere DNI real

### Necesita decisión de negocio
- 💼 cronograma_cuotas: 26 vigentes bloqueados por tasa = 0 — regenerar tras completar tasa_interes
- 💼 pagos.id_credito: 0 asociables auto (0 ambiguos) — decidir si se asocia
- 💼 pagos tipo K: 46 — confirmar código correcto con SBS

---

## Confirmaciones de cumplimiento

- ✅ NO se insertó ningún dato
- ✅ NO se actualizó ningún dato
- ✅ NO se borró ningún dato
- ✅ NO se tocaron tablas de sistema (usuarios / configuracion)
- ✅ NO se modificaron archivos en _client_files/
- ✅ NO se crearon migraciones

---

*Generado por scripts/fix-post-import-dry-run.mjs — 2026-06-21 17:09:07*
