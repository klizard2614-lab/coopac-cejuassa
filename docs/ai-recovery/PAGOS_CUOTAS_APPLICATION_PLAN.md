# PAGOS_CUOTAS_APPLICATION_PLAN.md

**Fase:** 10K-0 — Diseño seguro de aplicación de pagos a cuotas
**Modo:** SOLO ANÁLISIS — NINGÚN DATO FUE MODIFICADO
**Generado:** 2026-07-02
**Referencia previa:** Fase 9C-6H.0 (dry-run anterior)

---

## 1. Estructura actual encontrada

### 1.1 Tabla `cronograma_cuotas`

| Campo | Tipo | Estado |
|-------|------|--------|
| `id` | integer PK | ✅ Existe |
| `id_credito` | integer FK→creditos.id | ✅ Existe |
| `nro_cuota` | integer | ✅ Existe |
| `fecha_vencimiento` | date | ✅ Existe |
| `capital` | numeric | ✅ Existe (monto capital de la cuota) |
| `interes` | numeric | ✅ Existe (monto interés de la cuota) |
| `cuota_total` | numeric | ✅ Existe (capital + interes) |
| `capital_pagado` | numeric | ✅ Existe (acumulado pagado de capital) |
| `interes_pagado` | numeric | ✅ Existe (acumulado pagado de interés) |
| `estado` | enum | ✅ Existe: pendiente / vencida / parcial / pagada |
| `fecha_pago` | date | ✅ Existe (solo cuando estado='pagada') |
| `monto_pagado` | — | ❌ No existe (calculable: capital_pagado + interes_pagado) |
| `saldo_pendiente` | — | ❌ No existe (calculable: cuota_total - capital_pagado - interes_pagado) |
| `id_pago` | — | ❌ No existe (no hay FK a pagos_recibos) |
| `created_at` | — | ❌ No existe en el esquema detectado |
| `updated_at` | — | ❌ No existe en el esquema detectado |

**Estados existentes:** `pendiente` · `vencida` · `parcial` · `pagada`

### 1.2 Tabla `pagos_recibos`

| Campo | Tipo | Estado |
|-------|------|--------|
| `id` | integer PK | ✅ Existe |
| `id_socio` | integer FK→socios.id | ✅ Existe |
| `id_credito` | integer FK→creditos.id | ✅ Existe (NULL para pagos no vinculados) |
| `id_convenio` | integer FK→convenios.id | ✅ Existe |
| `nro_recibo` | text | ✅ Existe |
| `fecha` | date | ✅ Existe |
| `periodo` | text (YYYY-MM) | ✅ Existe |
| `canal_pago` | text | ✅ Existe |
| `estado_flujo` | text | ✅ Existe |
| `monto_aporte` | numeric | ✅ Existe |
| `monto_capital` | numeric | ✅ Existe |
| `monto_interes` | numeric | ✅ Existe |
| `monto_fps` | numeric | ✅ Existe |
| `monto_fps_extra` | numeric | ✅ Existe |
| `monto_otros` | numeric | ✅ Existe |
| `monto_total` | numeric | ✅ Existe |
| `interes_amortizado_pagado` | numeric | ✅ Existe |
| `observacion` | text | ✅ Existe |
| `created_at` | timestamptz | ✅ Existe |

### 1.3 Tabla `creditos`

| Campo relevante | Estado |
|----------------|--------|
| `id`, `nro_pagare` | ✅ Existen |
| `id_socio` | ✅ Existe |
| `monto_aprobado`, `saldo_capital` | ✅ Existen |
| `cuota_mensual`, `tasa_interes`, `plazo_meses` | ✅ Existen |
| `estado` | ✅ Existe (vigente / cancelado) |
| `fecha_desembolso` | ✅ Existe |

---

## 2. ¿Las tablas actuales permiten aplicar pagos a cuotas?

### Respuestas directas

| Pregunta | Respuesta |
|----------|-----------|
| ¿Hay campo para monto pagado por cuota? | ✅ Sí — `capital_pagado` + `interes_pagado` (separados) |
| ¿Hay campo para saldo pendiente? | ⚠️ Calculable — `(capital - capital_pagado) + (interes - interes_pagado)` |
| ¿Hay campo para estado pagada/parcial/pendiente? | ✅ Sí — campo `estado` con enum 4 valores |
| ¿Hay campo para fecha de pago? | ✅ Sí — campo `fecha_pago` |
| ¿Hay campo para vincular cuota con su pago? | ❌ No — falta `id_pago` FK a `pagos_recibos` |
| ¿Hace falta migración? | ⚠️ Condicional — ver sección 2.1 |

### 2.1 ¿Es necesaria una migración?

**Para aplicar pagos (actualizar capital_pagado, interes_pagado, estado, fecha_pago):** NO hace falta migración. La estructura actual es suficiente.

**Para trazabilidad completa (saber qué pago pagó qué cuota):** SÍ haría falta agregar `id_pago` como FK nullable a `pagos_recibos`. Esta migración es recomendable pero NO bloqueante para el apply.

**Migración propuesta (NO crear todavía):**
```sql
-- PROPUESTA — NO APLICAR SIN APROBACIÓN DEL USUARIO
-- Solo ejecutar después de aprobar Fase 10K-1
ALTER TABLE public.cronograma_cuotas
  ADD COLUMN IF NOT EXISTS id_pago integer REFERENCES pagos_recibos(id) ON DELETE SET NULL;
```

---

## 3. Qué monto del pago debe aplicarse a cuotas

### Regla de exclusión

| Campo en `pagos_recibos` | ¿Se aplica a cuotas? | Justificación |
|--------------------------|---------------------|---------------|
| `monto_capital` | ✅ Sí | Componente de capital del préstamo |
| `monto_interes` | ✅ Sí | Componente de interés del préstamo |
| `monto_aporte` | ❌ No | Aporte de capital social — cuenta separada (tabla `aportes`) |
| `monto_fps` | ❌ No | Fondo de Previsión Social — no es pago de crédito |
| `monto_fps_extra` | ❌ No | FPS adicional — no es pago de crédito |
| `monto_otros` | ❌ No | Conceptos varios — no es pago de crédito |
| `interes_amortizado_pagado` | ❌ No | Interés ya contabilizado — no es pago de cuota corriente |
| `monto_total` | ❌ No usar directamente | Es suma de todos los componentes — incluye aporte/FPS |

**Fórmula aceptada:**
```
monto_aplicable = monto_capital + monto_interes
```

### Detección de pagos mixtos (riesgo)

Un pago es "mixto" si tiene componentes de crédito Y otros conceptos (aporte, FPS):
- `monto_aplicable > 0` Y (`monto_aporte > 0` OR `monto_fps > 0` OR `monto_otros > 0`)

Los pagos mixtos son válidos — el split ya está en los campos. No deben marcarse como "no aplicables", pero deben identificarse como merecedores de revisión contable.

Un pago es "NO aplicable" a cuotas si:
- `id_credito IS NULL` (no vinculado a crédito)
- `monto_capital + monto_interes = 0` (todo aporte/FPS/otros)
- El crédito no tiene cuotas en `cronograma_cuotas`
- El crédito está cancelado y no tiene cronograma

---

## 4. Algoritmo de aplicación propuesto

Este algoritmo es idéntico al implementado en `pagos/nuevo/page.tsx` (Fase 3B / R7).

### 4.1 Pseudocódigo

```
Para cada crédito con pagos vinculados:
  1. Cargar pagos del crédito, ordenados por fecha ASC
  2. Cargar cuotas del crédito, ordenadas por nro_cuota ASC
  3. Inicializar estado local de cada cuota (en memoria)

  Para cada pago (en orden cronológico):
    montoDisponible = monto_capital + monto_interes
    
    Si montoDisponible == 0:
      → Pago no aplicable (solo aporte/FPS/otros)
      Continuar con siguiente pago
    
    Mientras montoDisponible > 0 y queden cuotas pendiente/vencida/parcial:
      cuota = cuota más antigua con estado pendiente/vencida/parcial
      
      saldoCuota = (capital - capital_pagado) + (interes - interes_pagado)
      
      Si montoDisponible >= saldoCuota:
        → cuota queda PAGADA
        → capital_pagado_nuevo = capital  (cubierto)
        → interes_pagado_nuevo = interes  (cubierto)
        → fecha_pago = fecha del pago
        → montoDisponible -= saldoCuota
        → continuar con siguiente cuota (cascada)
        
      Si montoDisponible < saldoCuota:
        → cuota queda PARCIAL
        → capital_pagado_nuevo += parte proporcional de montoDisponible*
        → interes_pagado_nuevo += parte proporcional restante*
        → montoDisponible = 0
        → terminar asignación de este pago
    
    Si montoDisponible > 0 después del while:
      → Excedente no asignado (todas las cuotas del crédito ya propuestas como pagadas)
      → Reportar excedente

* Distribución del pago parcial: primero capital hasta cubrir cuota.capital,
  luego interes hasta cubrir cuota.interes. Si sobra después de cubrir uno,
  pasa al otro. Esta lógica es consistente con el frontend.
```

### 4.2 Distribución del monto parcial

Cuando `montoDisponible < saldoCuota`:

```
capitalFaltante = cuota.capital - cuota.capital_pagado
interesFaltante = cuota.interes - cuota.interes_pagado

Si montoDisponible <= capitalFaltante:
  capitalAplicar = montoDisponible
  interesAplicar = 0
Sino:
  capitalAplicar = capitalFaltante
  interesAplicar = montoDisponible - capitalFaltante
  (interesAplicar está limitado por interesFaltante si sobra)
```

---

## 5. Casos especiales y cómo se manejan

| Caso | Comportamiento |
|------|---------------|
| Crédito sin cronograma | Reportar como "sin cuotas" — pago no asignable |
| Crédito cancelado | Si no tiene cronograma: pago no asignable. Si tiene cronograma: aplicar normalmente |
| Pago sin `id_credito` | Excluir del análisis — 804 pagos en esta situación, no aplicables |
| Pago con monto_capital+interes=0 | No asignable — solo aporte/FPS/otros |
| Pago con aporte/FPS/otros + crédito | Marcado como MIXTO — aplicar solo monto_capital+interes, excluir resto |
| Pago duplicado | Detectado por nro_recibo repetido — reportar como riesgo |
| Pago mayor al saldo total de cuotas | Excedente reportado — no se pierde en el algoritmo |
| Pago anterior a primera cuota | Se aplica igual — a la cuota nro_cuota=1 |
| Pago posterior con cuotas vencidas | Se aplica a todas las vencidas en orden cronológico |
| Pagos múltiples sobre misma cuota | Acumulativos — cada pago suma al capital_pagado/interes_pagado anterior |

---

## 6. Datos actuales en Supabase (Fase 9C-6H.0)

| Métrica | Valor | Fuente |
|---------|-------|--------|
| Total pagos_recibos | 832 | Importación Excel |
| Pagos con id_credito IS NOT NULL | 28 | Fase 9C-6F apply |
| Pagos con id_credito NULL | 804 | 417 solo-aporte/FPS + 384 sin-match |
| Match_medio pendientes | 3 | Pendiente revisión área Créditos |
| Créditos vigentes | 26 | Con cronograma generado |
| Créditos cancelados | 5 | Sin cronograma (no crítico) |
| Cuotas en cronograma | 911 | Fase 9C-6D |
| Cuotas propuestas como PARCIALES (dry-run) | 26 | Fase 9C-6H.0 |
| Cuotas propuestas como PAGADAS (dry-run) | 0 | Todos son pagos parciales de cuota |
| Pagos no asignables (dry-run) | 2 | 1 crédito cancelado sin cronograma + 1 monto=0 |

### Interpretación del resultado

Que ninguna cuota quede PAGADA con los 28 pagos actuales indica que los socios pagan en múltiples abonos mensuales, y solo se importó el historial de marzo 2026 (un mes). Esto es normal — los créditos tienen entre 12 y 48 cuotas.

---

## 7. Riesgos identificados

| ID | Riesgo | Severidad | Mitigación |
|----|--------|-----------|-----------|
| R-K1 | 804 pagos no vinculados: cuotas quedan en "pendiente" aunque fueron pagadas fuera del sistema | Alta | Vincular manualmente (o por Excel) los 804 pagos antes del apply completo |
| R-K2 | 3 match_medio pendientes: si se vinculan después del apply, se necesita un segundo apply | Media | Decidir los 3 casos antes del apply |
| R-K3 | Sin `id_pago` en cronograma_cuotas: no hay trazabilidad de qué pago cubrió qué cuota | Media | Agregar migración de `id_pago` antes del apply (Fase 10K-1) |
| R-K4 | Pagos mixtos (aporte + crédito): si el split en campos es incorrecto, la cuota queda mal aplicada | Media | Revisión manual de pagos mixtos con Contabilidad antes del apply |
| R-K5 | Cronograma regenerado en Fase 9C-6D: las cuotas tienen capital_pagado=0, no reflejan historial previo a la importación | Alta | El apply solo cubre marzo 2026 — historial anterior está fuera del alcance |
| R-K6 | Pago 411**** (crédito 1138****) tiene monto S/1,896.96 para cuota de S/285.59 — diferencia +S/1,611.37 | Alta | Verificar con Tesorería si es prepago o error. Con el algoritmo de cascada cubriría varias cuotas |
| R-K7 | Sin campo `updated_at` en cronograma_cuotas: si se aplica y hay error, no hay registro de cuándo cambió | Baja | Documentar el apply con reporte JSON detallado |

---

## 8. Plan por fases

| Fase | Descripción | Estado |
|------|-------------|--------|
| 10K-0 | Auditoría, diseño, dry-run, documentación | ✅ Esta fase |
| 10K-1 | Decisión: ¿agregar `id_pago` a `cronograma_cuotas`? Propuesta de migración | Pendiente |
| 10K-2 | Apply controlado de pagos a cuotas (solo los 28 vinculados) | Bloqueado — esperar 10K-1 |
| 10K-3 | Revisión de los 3 match_medio + apply adicional si se vinculan | Pendiente decisión Créditos |
| 10K-4 | Revisión del pago 411**** con monto excesivo | Pendiente Tesorería |

---

## 9. Qué NO debe hacerse todavía

- ❌ NO hacer `UPDATE` en `cronograma_cuotas`
- ❌ NO hacer `UPDATE` en `pagos_recibos`
- ❌ NO modificar `creditos`, `socios`, `aportes`, `egresos`
- ❌ NO crear la migración de `id_pago` sin aprobación del usuario
- ❌ NO hacer apply de los 3 match_medio (pendiente decisión del área de Créditos)
- ❌ NO aplicar el pago 411**** sin confirmar con Tesorería
- ❌ NO recalcular saldos de créditos
- ❌ NO cambiar mora/cartera en DB

---

## 10. Preguntas pendientes para Contabilidad / Tesorería

| ID | Pregunta | Para quién |
|----|----------|-----------|
| P-K1 | El pago 411**** tiene un monto de S/1,896.96 para una cuota de S/285.59. ¿Es un prepago? ¿O error de importación? | Tesorería |
| P-K2 | ¿Es requerida la trazabilidad de qué pago cubrió qué cuota (campo `id_pago`)? | Contabilidad |
| P-K3 | Para los 3 match_medio: ¿se vinculan al crédito propuesto, se rechazan, o hay un crédito diferente? | Créditos |
| P-K4 | Los 804 pagos con id_credito=NULL: ¿hay plan de vincularlos manualmente o quedan fuera del historial? | Créditos / Tesorería |
| P-K5 | ¿La aplicación de pagos a cuotas importados representa el historial completo o solo marzo 2026? | Contabilidad |

---

## 11. Recomendación final

**Las tablas actuales son SUFICIENTES para aplicar pagos a cuotas** sin migración previa.

**Antes del apply (Fase 10K-2), resolver:**
1. Decisión sobre `id_pago` (trazabilidad) — si se quiere, agregar la migración primero
2. Los 3 match_medio (área de Créditos)
3. El pago 411**** con monto excesivo (Tesorería)

**Pendiente absoluto:** El apply de cuotas solo cubrirá los 28 pagos vinculados. Los 804 restantes quedan fuera. Esto significa que las cuotas del cronograma reflejarán solo el historial de marzo 2026, no el historial completo del crédito.

**Próxima acción recomendada:** Ejecutar `npm run plan:pagos-cuotas` para confirmar los resultados del dry-run con el algoritmo de cascada completo.

---

## 12. Scripts y archivos relacionados

| Archivo | Descripción |
|---------|-------------|
| `scripts/plan-pagos-cuotas.mjs` | Dry-run con algoritmo de cascada completo |
| `scripts/check-pagos-cuotas-plan.mjs` | Verificación de seguridad |
| `scripts/dry-run-apply-pagos-to-cuotas.mjs` | Dry-run anterior (Fase 9C-6H.0) |
| `scripts/check-pagos-to-cuotas-plan.mjs` | Check anterior |
| `docs/ai-recovery/PAGOS_TO_CUOTAS_DRY_RUN_REPORT.md` | Reporte anterior |
| `docs/ai-recovery/proposed_cuotas_payment_updates_preview.json` | Preview JSON anterior |
