# POST_IMPORT_FIX_PLAN.md
# Plan de Correcciones Post-Importación Excel — CEJUASSA
# Generado: 2026-06-21 — Fase 9C-6A

> Separación de correcciones según su fuente de datos y riesgo.
> NINGUNA corrección se aplica en esta fase — solo planificación y dry-run.

---

## Estado de la DB tras importación Excel (Fase 9C-4B)

| Campo | Tablas | Estado real en DB |
|---|---|---|
| `genero` | socios (782) | NULL en todos |
| `estado_civil` | socios (782) | NULL en todos |
| `tasa_interes` | creditos (31) | 0 en todos |
| `tipo_credito_sbs` | creditos (31) | 'consumo_no_revolvente' (texto, no código SBS) |
| `subtipo_credito_sbs` | creditos (31) | NULL en todos |
| `cuenta_contable_bd01` | creditos (31) | '1411050604' en todos ✅ |
| `cronograma_cuotas` | — | 0 registros (tabla vacía) |
| `id_credito` en pagos | pagos_recibos (832) | NULL en todos |
| `tipo_pago` | pagos_recibos (832) | Poblado desde Excel ✅ |
| DNI placeholder | socios (1) | 'SINDNI...' |
| `beneficiario_*` | socios (782) | NULL en todos |

---

## Grupo A — Correcciones automáticas seguras

Estas pueden aplicarse con un script sin datos externos.

### A1 — `tipo_credito_sbs`: normalizar a código SBS numérico
- **Estado actual:** 'consumo_no_revolvente' (texto descriptivo, formato interno)
- **Valor requerido por BDCC BD01:** código numérico según catálogo SBS C19
- **Estado en el proyecto:** ⚠️ **NO DOCUMENTADO como código numérico**
  - El proyecto conoce que son "consumo no revolvente" pero el código '004' no está confirmado
  - El checklist dice: *"Confirmar con Créditos: códigos TIPCRED y SUBTIPCRED exactos según Oficio SBS"*
  - La app BD01 simplemente usa `tipo_credito_sbs ?? ''` — no tiene fallback numérico
- **Decisión:** ❌ **NO aplicar automáticamente** hasta recibir el código SBS confirmado

### A2 — `cuenta_contable_bd01`
- **Estado actual:** '1411050604' en todos los 31 créditos ✅
- **Decisión:** ✅ **Ya correcta — no requiere acción**
- **Nota:** La app usa `c.cuenta_contable_bd01 ?? '1411050604'` como fallback, valor ya en DB

### A3 — `tipo_pago` en pagos
- **Estado actual:** Poblado desde Excel en los 832 pagos ✅
- **Decisión:** ✅ **Ya correcta — no requiere acción**

### A4 — `subtipo_credito_sbs`
- **Estado actual:** NULL en los 31 créditos
- **Estado en el proyecto:** ⚠️ **NO documentado** — código subtipo SBS exacto no confirmado
- **Decisión:** ❌ **NO aplicar automáticamente** — requiere Oficio SBS

### Resumen Grupo A

| Corrección | Segura para aplicar | Razón |
|---|---|---|
| `tipo_credito_sbs → código SBS` | ❌ NO | Código '004' no confirmado en proyecto |
| `cuenta_contable_bd01` | ✅ Ya correcta | '1411050604' ya en DB |
| `tipo_pago` | ✅ Ya correcta | Poblado desde Excel |
| `subtipo_credito_sbs` | ❌ NO | Código subtipo no documentado |

**Conclusión: no hay correcciones automáticas pendientes para Grupo A.**

---

## Grupo B — Correcciones que requieren datos reales del cliente

Estas NO pueden aplicarse hasta recibir la información del cliente.

### B1 — `genero` y `estado_civil` de socios (782 registros)

- **Impacto:** BDCC BD01 completamente bloqueado — campos SEXO y ESTCIV obligatorios por SBS
- **Fuente requerida:** Padrón físico / ficha de socios / lista de afiliados con género y estado civil
- **Método de corrección:**
  - **Opción 1 (recomendada si hay lista):** script bulk-update con CSV de socios
  - **Opción 2:** editar uno a uno en módulo Socios de la app
  - **Opción 3:** importar un Excel adicional que contenga nro_socio + genero + estado_civil
- **Bloqueante para:** BDCC BD01, BDCC BD02-A, reporte regulatorio SBS (deadline 20/07/2026)

### B2 — `tasa_interes` de créditos (31 registros)

- **Impacto:** cronograma de cuotas no puede generarse · Anexo 6 con interés = 0 · BDCC TPINT = 0
- **Fuente requerida:** documentos físicos de cada crédito (pagarés, tabla de amortización original)
- **Método de corrección:** editar cada crédito en módulo Créditos (tasa anual real)
- **Bloqueante para:** `cronograma_cuotas`, TPINT en BD01, cálculo de mora con interés

### B3 — Códigos SBS: `tipo_credito_sbs` y `subtipo_credito_sbs`

- **Impacto:** campos TIPCRED y SUBTIPCRED en BD01 vacíos o con texto no válido
- **Fuente requerida:** Oficio SBS con catálogo C19 (TIPCRED) y C20 (SUBTIPCRED) vigente
- **Método de corrección:** editar cada crédito O script bulk si todos usan el mismo código
- **Bloqueante para:** BD01 válido para SBS

### B4 — DNI del socio con placeholder (1 registro)

- **Impacto:** bajo (solo 1 socio) pero DNI inválido puede causar problemas en BDCC
- **Fuente requerida:** documento de identidad real del socio
- **Método:** buscar en app por nro_socio que comienza con 'SINDNI' → editar DNI

### B5 — Beneficiarios FPS (782 registros)

- **Impacto:** bajo (no bloquea operación básica) · Requerido para seguro de desgravamen FPS
- **Fuente requerida:** ficha FPS por socio
- **Método:** editar socios en la app o script bulk con lista

---

## Grupo C — Correcciones que requieren decisión de negocio

### C1 — `cronograma_cuotas` (0 registros — tabla vacía)

- **Bloqueante:** tasa_interes = 0 en todos → cronograma generaría cuotas con interés 0
- **Decisión requerida:** ¿regenerar ahora con tasa 0 (visible como placeholder) o esperar tasa real?
- **Recomendación:** **ESPERAR** hasta que `tasa_interes` esté completo (Grupo B2)
- **Método cuando sea viable:** abrir cada crédito vigente (26) en app → guardar → se genera automáticamente

### C2 — `pagos_recibos.id_credito = NULL` (832 registros)

- **Contexto:** el import no pudo asociar pagos a créditos por falta de link en Excel
- **Decisión requerida:** ¿asociar pagos a créditos? ¿Para qué operación es necesario?
- **Nota:** no es bloqueante para caja, aportes ni Anexo 6 actual
- **Método posible si se decide:** script semi-automático (por socio, si tiene un solo crédito vigente)
- **Riesgo:** socios con más de un crédito requieren asignación manual

### C3 — 46 pagos tipo `K`

- **Contexto:** `tipo_pago = 'K'` importado directamente del Excel · Significado: pago de convenio especial
- **Decisión requerida:** ¿es correcto tipo K para estos pagos? ¿debe cambiarse a otro valor?
- **Impacto en BDCC BD02-A:** campo TIPPAG, 'K' puede ser válido según SBS

### C4 — Créditos cancelados (5 registros)

- **Estado:** `estado = 'cancelado'`, `saldo_capital = 0` — parece correcto
- **Decisión requerida:** ¿deben aparecer en reportes históricos? ¿en Anexo 6?
- **No requiere corrección de datos** — es una decisión de presentación

### C5 — `egresos` y `ampliaciones` (0 registros)

- **Sin fuente disponible en Excel actual**
- **Decisión:** cargar manualmente en la app conforme se necesite

---

## Orden de ejecución recomendado

```
[AHORA — no requieren datos externos]
1. Confirmar con SBS/Créditos: código TIPCRED y SUBTIPCRED → actualizar en app

[CUANDO EL CLIENTE ENTREGUE DATOS]
2. Importar genero + estado_civil de socios (prioritario — deadline BDCC 20/07/2026)
3. Ingresar tasa_interes por crédito (uno a uno en app)
4. Regenerar cronograma_cuotas (tras paso 3 — solo vigentes)
5. Corregir DNI placeholder (1 socio)

[DECIDIR CON EL CLIENTE]
6. ¿Asociar id_credito en pagos?
7. ¿Verificar pagos tipo K?
8. Cargar egresos y ampliaciones

[CUANDO TODO LO ANTERIOR ESTÉ COMPLETO]
9. Generar BDCC BD01 / BD02-A (deadline: 20/07/2026)
```

---

## Confirmaciones de cumplimiento (Fase 9C-6A)

- ✅ NO se insertó ningún dato
- ✅ NO se actualizó ningún dato
- ✅ NO se borró ningún dato
- ✅ NO se tocaron tablas de sistema (usuarios / configuracion)
- ✅ NO se modificaron archivos en _client_files/
- ✅ NO se crearon migraciones

---

*Generado por Fase 9C-6A — 2026-06-21*
