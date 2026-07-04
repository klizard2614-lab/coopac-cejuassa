# PAGOS_CREDITOS_LINK_DRY_RUN_REPORT.md

> Fase 9C-6E — Dry-run: clasificación de 832 pagos_recibos con id_credito = NULL
> Fecha de generación: 2026-06-22
> MODO: SOLO LECTURA — ningún dato fue modificado

---

## Objetivo

Analizar los 832 registros de `pagos_recibos` con `id_credito = NULL` e identificar cuáles pueden
vincularse de forma segura a créditos existentes en la tabla `creditos`.

Esta fase **NO modifica ningún dato**. El apply requiere autorización explícita separada.

---

## Metodología

### Columnas usadas de `pagos_recibos`

| Columna | Uso |
|---|---|
| `id` | Identificador del pago (enmascarado en reportes) |
| `id_socio` | Clave principal de match con `creditos.id_socio` |
| `id_credito` | NULL en todos los 832 analizados |
| `id_convenio` | Información contextual de convenio |
| `fecha` | Fecha del pago — usada para validar rango del crédito |
| `periodo` | Período YYYY-MM declarado |
| `tipo_pago` | Detecta pagos tipo K |
| `monto_capital` | Componente capital del pago |
| `monto_interes` | Componente interés del pago |
| `monto_aporte` | Componente aporte del pago |
| `monto_fps` / `monto_fps_extra` | FPS regular y extra |
| `monto_otros` | Otros conceptos |
| `observacion` | Texto libre — detecta referencias a tipo K |

### Columnas usadas de `creditos`

| Columna | Uso |
|---|---|
| `id` | Candidato a asignar en `pagos_recibos.id_credito` |
| `id_socio` | Join con pago para identificar el socio |
| `fecha_desembolso` | Inicio del rango de fecha válido |
| `plazo_meses` | Fin del rango = desembolso + plazo |
| `cuota_mensual` | Match por monto (tolerancia ±S/5) |
| `estado` | Vigente / cancelado — afecta prioridad de match |

---

## Clasificación de pagos en grupos

Los 832 pagos con `id_credito = NULL` se clasifican en 6 grupos según sus componentes monetarios:

| Grupo | Descripción | Criterio |
|---|---|---|
| **A** | Componente capital/interés claro | `monto_capital > 0 OR monto_interes > 0` |
| **B** | Solo aporte | `monto_aporte > 0 AND monto_capital = 0 AND monto_interes = 0` |
| **C** | Solo FPS / otros / trámite / seguro | `(monto_fps > 0 OR monto_otros > 0) AND sin capital/interes/aporte` |
| **D** | Mixto (múltiples componentes) | Capital/interés + aporte u otros simultáneamente |
| **E** | Tipo K | `tipo_pago = 'K'` o `observacion` contiene "TIPO K" / "CUOTA K" |
| **F** | Sin información suficiente | Todos los montos en cero o NULL |

> Los grupos B y C no necesitan vinculación a `id_credito` — sus pagos no tienen componente de deuda.

---

## Estrategias de match (solo para grupos A, D, E)

Se aplican en orden de prioridad:

1. **Match por socio + rango de fecha** — el pago cae dentro del período `[fecha_desembolso, fecha_desembolso + plazo_meses]` de un único crédito → `match_alto`
2. **Match por monto de cuota** — si hay múltiples créditos en rango, afinar por `cuota_mensual ≈ monto_capital + monto_interes` (tolerancia ±S/5) → `match_alto`
3. **Único crédito del socio fuera de rango** — el socio tiene un solo crédito aunque la fecha no coincida exactamente → `match_medio`
4. **Único crédito vigente** — entre múltiples créditos, solo uno tiene estado `vigente` → `match_medio`
5. **Múltiples candidatos sin desempate** → `ambiguo`
6. **Sin crédito para el socio** → `sin_match`

> Los nombres **nunca se usan como criterio de match**.
> El campo `id_socio` es el único vínculo confiable entre pagos y créditos.

---

## Conteos por categoría

> Los valores exactos se generan al ejecutar: `npm run pagos:link-creditos:dry-run`
> El archivo `docs/ai-recovery/proposed_pago_credito_links_preview.json` contiene el detalle completo con IDs enmascarados.

| Categoría | Descripción | Cantidad | % |
|---|---|---|---|
| `match_alto` | Un único crédito claro | *(ver preview)* | — |
| `match_medio` | Probable, requiere revisión | *(ver preview)* | — |
| `ambiguo` | Más de un crédito posible | *(ver preview)* | — |
| `no_aplica_credito` | Sin componente de crédito (grupos B/C) | *(ver preview)* | — |
| `sin_match` | Sin datos suficientes | *(ver preview)* | — |
| **TOTAL** | | **832** | 100% |

---

## Riesgos

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Pagos ambiguos vinculados al crédito incorrecto | ALTA | Solo aplicar `match_alto`; revisar manualmente `match_medio` y `ambiguo` |
| Pagos tipo K con semántica especial (SBS) | MEDIA | No vincular tipo K sin confirmación de área Créditos/SBS |
| Socio con múltiples créditos en el mismo período | MEDIA | El script los marca como `ambiguo` — no se vinculan sin revisión |
| Fecha del pago fuera del rango del crédito | BAJA | Los matches fuera de rango se degradan a `match_medio` |
| Pagos de convenio sin componente de crédito | BAJA | El grupo B los clasifica como `no_aplica_credito` — no se vinculan |
| Pago aporte+capital del mismo recibo | BAJA | Grupo D — el match se evalúa por componente capital/interés |

---

## Reglas del apply (fase posterior)

El apply de esta fase **SOLO** actualizará `pagos_recibos.id_credito`.

**No se modificará:**
- `cronograma_cuotas` — la vinculación de pagos a cuotas específicas es una fase separada
- `creditos` (saldo_capital, estado, etc.)
- `socios`
- `aportes`
- `usuarios`, `configuracion`, `auth.users`

---

## Recomendación de apply

- **Apply seguro:** registros con categoría `match_alto` — vinculación inequívoca.
- **Revisión manual recomendada:** registros con `match_medio` y `ambiguo` — presentar al cliente para confirmación.
- **No vincular:** registros `no_aplica_credito` (grupos B y C), `sin_match`, y tipo K sin confirmar.
- **Tipo K:** consultar con área Créditos/SBS antes de vincular.

---

## Qué requiere revisión del cliente

Antes de aplicar los matches medios y ambiguos, el cliente debe confirmar:

1. Para pagos `ambiguo`: ¿a cuál de los créditos del socio corresponde cada pago?
2. Para pagos `match_medio` con fecha fuera de rango: ¿el pago corresponde a ese crédito aunque sea tardío o anticipado?
3. Para pagos tipo K: ¿son pagos de capital con formato especial que deben vincularse al crédito activo?
4. Para pagos `sin_match` con `monto_capital > 0`: ¿el socio tenía un crédito no registrado en el sistema?

---

## Archivos generados

| Archivo | Descripción |
|---|---|
| `scripts/dry-run-link-pagos-creditos.mjs` | Script principal — solo lectura |
| `scripts/check-pagos-creditos-link-plan.mjs` | Verificador de seguridad del plan |
| `docs/ai-recovery/PAGOS_CREDITOS_LINK_DRY_RUN_REPORT.md` | Este documento |
| `docs/ai-recovery/proposed_pago_credito_links_preview.json` | Preview con IDs enmascarados (generado al ejecutar el dry-run) |

---

## Comandos disponibles

```bash
npm run pagos:link-creditos:dry-run   # Ejecutar clasificación y propuesta (solo lectura)
npm run check:pagos-link-creditos     # Verificar que el plan es seguro
npm run audit:post-excel-import       # Auditoría general post-import
npm run verify:cejuassa               # tsc + build
```

---

---

## Fase 9C-6F — APPLY EJECUTADO (2026-06-22)

**Autorización:** `VINCULAR 28 PAGOS 9C-6F` — recibida y aplicada.

| Métrica | Valor |
|---|---|
| Pagos actualizados (match_alto) | **28** |
| Errores | 0 |
| Pagos con id_credito = NULL post-apply | **804** |
| Categorías NO aplicadas | match_medio (3), no_aplica (417), sin_match (384) |

Solo se actualizó `pagos_recibos.id_credito`. `cronograma_cuotas`, `creditos`, `socios` no fueron modificados.

Reportes del apply: `PAGOS_CREDITOS_LINK_APPLY_DRY_RUN.md` · `PAGOS_CREDITOS_LINK_APPLY_REPORT.md`
