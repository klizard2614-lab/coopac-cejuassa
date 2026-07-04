# CRONOGRAMA_REGENERATION_PLAN.md
# Plan de Regeneración — cronograma_cuotas
# Fase 9C-6C — 2026-06-22

> Fase preparatoria: SOLO LECTURA y simulación.
> El apply real requiere autorización explícita del usuario.
> NO insertar / NO actualizar / NO borrar / NO crear migraciones.

---

## Objetivo

Regenerar `cronograma_cuotas` para los 26 créditos vigentes importados desde Excel.
`tasa_interes = 0.2682` ya está aplicada en 31/31 créditos (Fase 9C-6B). Los cronogramas
están vacíos porque los créditos fueron importados directamente sin pasar por el formulario
de creación que llama a la RPC `crear_credito_con_cronograma`.

---

## Campos requeridos para generar un cronograma

| Campo | Rol |
|---|---|
| `id` | Clave para insert en `cronograma_cuotas.id_credito` |
| `monto_aprobado` | Capital base para calcular cuotas (P en la fórmula) |
| `tasa_interes` | Tasa anual usada en la fórmula (r = tasa/100/12) |
| `plazo_meses` | Número de cuotas (n) |
| `fecha_desembolso` | Base para calcular `fecha_vencimiento` de cada cuota |
| `estado` | Filtrar solo `vigente`; excluir `cancelado` |

---

## Campos disponibles en la tabla `creditos`

Detectados del código fuente (`creditos/nuevo/page.tsx`, `DATABASE_AND_AUTH.md`):

| Campo | Estado |
|---|---|
| `id` | ✅ Disponible |
| `id_socio` | ✅ Disponible |
| `nro_pagare` | ✅ Disponible |
| `monto_aprobado` | ✅ Disponible |
| `monto_girado_neto` | ✅ Disponible |
| `saldo_capital` | ✅ Disponible |
| `cuota_mensual` | ✅ Disponible (calculada al crear) |
| `tasa_interes` | ✅ **0.2682 en 31/31 créditos** (Fase 9C-6B) |
| `plazo_meses` | ✅ Disponible (importado desde Excel) |
| `fecha_desembolso` | ✅ Disponible (importado desde Excel) |
| `estado` | ✅ Disponible — 26 vigentes, 5 cancelados |
| `tipo_credito` | ✅ Disponible |
| `interes_acumulado` | ✅ Disponible |
| `frecuencia_pago` | ❌ No existe en la tabla — frecuencia implícita: mensual |

---

## Análisis de créditos

### Total: 31 créditos
- **Vigentes:** 26 → candidatos a regenerar
- **Cancelados:** 5 → excluir

### Criterios de elegibilidad

Un crédito vigente es elegible si cumple TODOS:
1. `estado = 'vigente'`
2. `monto_aprobado > 0`
3. `plazo_meses > 0` (y no NULL)
4. `fecha_desembolso` no es NULL
5. `tasa_interes > 0` (garantizado por Fase 9C-6B)

### Causas de no elegibilidad
- `estado = 'cancelado'` → 5 créditos (excluidos por política)
- `plazo_meses = 0` o NULL → determinar en dry-run
- `fecha_desembolso = NULL` → determinar en dry-run
- `monto_aprobado = 0` → determinar en dry-run

El reporte del dry-run (`CRONOGRAMA_REGENERATION_DRY_RUN_REPORT.md`) documenta los conteos exactos.

---

## Fórmula de cálculo

Sistema francés (cuota fija) — idéntico al formulario de creación de crédito:

```
r = tasa_interes / 100 / 12

cuota_mensual = monto_aprobado * r * (1+r)^plazo_meses
                ─────────────────────────────────────────
                       (1+r)^plazo_meses - 1

Para cuota i (i = 1..plazo_meses):
  interes_i    = round2(saldo * r)
  capital_i    = round2(cuota_mensual - interes_i)   [última: round2(saldo)]
  cuota_total_i = cuota_mensual                       [última: round2(capital + interes)]
  fecha_vencimiento_i = fecha_desembolso + i meses

  saldo = round2(saldo - capital_i)
```

La última cuota absorbe el desfase de redondeo (`capital = saldo_restante`).
Fuente: `app/dashboard/creditos/nuevo/page.tsx`, líneas 137–166.

---

## Opción recomendada de apply

### Análisis de opciones

| Opción | Descripción | Viabilidad |
|---|---|---|
| A — Llamar RPC existente | `crear_credito_con_cronograma` también inserta el crédito — no aplica a créditos ya existentes | ❌ No aplica |
| B — Script con insert directo | Script que calcule cuotas y las inserte en `cronograma_cuotas` vía `supabase.from('cronograma_cuotas').insert(...)` | ✅ Recomendado |
| C — Nueva RPC SQL | `regenerar_cronograma_credito(p_id_credito)` — permite atomicidad y es invocable desde script o app | ✅ Alternativa |
| D — No regenerar | Solo si faltan datos mínimos en algún crédito | Contingencia |

### Recomendación: Opción B (script con insert directo)

**Justificación:**
- No requiere nueva migración SQL
- El cálculo de cuotas en JS es idéntico al que ya usa el formulario de creación
- El script puede verificar elegibilidad, calcular y reportar antes de insertar
- La regeneración es idempotente si se verifica que `cronograma_cuotas` está vacío para ese `id_credito`

**Base del cronograma:** `monto_aprobado` (no `saldo_capital`)
- Razón: los pagos ya registrados en `pagos_recibos` no tienen `id_credito` asignado (832 pagos con `id_credito = NULL`), por lo que no es posible determinar qué cuotas fueron pagadas. Regenerar desde `monto_aprobado` produce el cronograma original completo.
- Las cuotas con `fecha_vencimiento < hoy` se marcan como `vencida` automáticamente por la lógica de mora en la app.

---

## Estructura de `cronograma_cuotas` a insertar

```json
{
  "id_credito":        "<UUID del crédito>",
  "nro_cuota":         1,
  "fecha_vencimiento": "YYYY-MM-DD",
  "capital":           150.00,
  "interes":           56.30,
  "cuota_total":       206.30,
  "capital_pagado":    0,
  "interes_pagado":    0,
  "estado":            "pendiente"
}
```

---

## Riesgos

| # | Riesgo | Severidad | Mitigación |
|---|---|---|---|
| R1 | `pagos_recibos.id_credito = NULL` — no se puede saber qué cuotas están pagadas | Alto | El cronograma se genera como "original completo"; las cuotas pagadas quedarán como `pendiente` hasta que se vincule `id_credito` en pagos |
| R2 | `saldo_capital` puede ser menor que `monto_aprobado` si la app actualizó el saldo al registrar pagos | Medio | El dry-run reporta la diferencia `monto_aprobado - saldo_capital` por crédito |
| R3 | Cuotas con fechas en el pasado (`fecha_vencimiento < 2026-06-22`) quedarán como `pendiente` hasta que la app las evalúe | Bajo | La lógica de mora en la app detecta vencidas por fecha, sin necesidad de que `estado = 'vencida'` en DB |
| R4 | Si se ejecuta el apply dos veces, habrá cuotas duplicadas | Alto | El script de apply debe verificar `count(cronograma_cuotas) WHERE id_credito = X` antes de insertar |
| R5 | `plazo_meses = NULL` en algún crédito importado | Bajo | El dry-run reporta créditos sin plazo |
| R6 | `fecha_desembolso = NULL` en algún crédito importado | Bajo | El dry-run reporta créditos sin fecha |

---

## Rollback

El rollback del apply (si se ejecuta) es:

```sql
DELETE FROM cronograma_cuotas
WHERE id_credito IN (
  SELECT id FROM creditos WHERE estado = 'vigente'
);
```

Nota: este rollback solo aplica si no existían cuotas previas. El dry-run confirma que `cronograma_cuotas` tiene 0 registros.

---

## Casos de prueba post-apply

1. `SELECT COUNT(*) FROM cronograma_cuotas` → debe ser ≥ 26 × plazo_mínimo
2. Para un crédito muestra: `SELECT SUM(capital) FROM cronograma_cuotas WHERE id_credito = X` debe ≈ `monto_aprobado`
3. Módulo Créditos → ver detalle de un crédito vigente → cronograma debe renderizar
4. Módulo Mora → créditos con cuotas con `fecha_vencimiento < hoy` deben aparecer en mora

---

## Fase 9C-6D — COMPLETADA (2026-06-22)

**Apply ejecutado exitosamente con autorización: `INSERTAR CRONOGRAMA 9C-6D`**

- `scripts/apply-regenerate-cronogramas.mjs` ✅ ejecutado
- `scripts/check-cronograma-apply.mjs` → 18/18 PASS (post-apply)
- `npm run cronogramas:apply` → **26/26 · 911 cuotas insertadas · 0 errores**
- `cronograma_cuotas` en Supabase: **911 registros**
- `creditos`, `pagos_recibos`, `socios`, `usuarios`, `configuracion` — NO modificados

**Siguiente fase:** 9C-6E — Vincular `pagos_recibos.id_credito` (832 pagos con NULL)
