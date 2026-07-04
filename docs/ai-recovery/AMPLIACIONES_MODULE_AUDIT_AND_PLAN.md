# AMPLIACIONES_MODULE_AUDIT_AND_PLAN.md

> Auditoría completa y plan de diseño seguro para el módulo Ampliaciones.
> Fase 10D-0 — 2026-06-23
> NO modifica base de datos, créditos, cronogramas, pagos ni socios.

---

## 1. Estructura Real Encontrada en Supabase

**Tabla:** `public.ampliaciones`
**Registros actuales:** 0
**RLS:** ON (`relrowsecurity = true`)

### Columnas (11 total)

| # | Columna | Tipo | Nullable | Default | Notas |
|---|---------|------|----------|---------|-------|
| 1 | `id` | `integer` | NO | `nextval(...)` | PK serial auto-increment |
| 2 | `id_credito` | `integer` | NO | — | FK → `creditos.id` |
| 3 | `fecha` | `date` | NO | — | Fecha de la ampliación |
| 4 | `nro_pagare_anterior` | `text` | NO | — | Pagaré original del crédito |
| 5 | `nro_pagare_nuevo` | `text` | NO | — | Nuevo pagaré (**UNIQUE**) |
| 6 | `monto_nuevo` | `numeric(12,2)` | NO | — | Nuevo monto aprobado total |
| 7 | `plazo_nuevo` | `integer` | NO | — | Nuevo plazo en meses |
| 8 | `saldo_nuevo` | `numeric(12,2)` | NO | — | Nuevo saldo de capital |
| 9 | `observacion` | `text` | YES | — | Observación libre |
| 10 | `created_at` | `timestamptz` | NO | `now()` | Timestamp de creación |
| 11 | `created_by` | `uuid` | YES | — | FK → `usuarios.id` |

### Foreign Keys

| Constraint | Columna | Referencia | On Delete | On Update |
|------------|---------|------------|-----------|-----------|
| `ampliaciones_id_credito_fkey` | `id_credito` | `creditos.id` | NO ACTION | NO ACTION |
| `ampliaciones_created_by_fkey` | `created_by` | `usuarios.id` | NO ACTION | NO ACTION |

### Índices

| Índice | Columna | Tipo |
|--------|---------|------|
| `ampliaciones_pkey` | `id` | UNIQUE BTREE (PK) |
| `ampliaciones_nro_pagare_nuevo_key` | `nro_pagare_nuevo` | UNIQUE BTREE |

### Políticas RLS

| Policy | Operación | Roles | Condición |
|--------|-----------|-------|-----------|
| `ampliaciones_select` | SELECT | public (authenticated) | `auth.uid() IS NOT NULL` |
| `ampliaciones_insert` | INSERT | public | `get_user_rol() IN ('admin','creditos')` |
| `ampliaciones_update` | UPDATE | public | `get_user_rol() IN ('admin','creditos')` |
| `ampliaciones_delete` | DELETE | public | `get_user_rol() = 'admin'` |

---

## 2. Gaps Identificados en la Estructura

### Campos faltantes críticos

| Campo | Por qué hace falta | Riesgo si no se agrega |
|-------|--------------------|------------------------|
| `estado` | Sin él no hay workflow de aprobación. La ampliación se aplica sin control. | Riesgo alto: ampliar crédito sin aprobación supervisada. |
| `cuota_nueva` | El nuevo monto de cuota mensual no queda registrado. | Si no se guarda, no se puede mostrar en el cronograma nuevo. |
| `tasa_nueva` | No se sabe si la tasa cambia al ampliar. | Si no está, se asume misma tasa — puede ser incorrecto. |

### Ausencias que condicionan el diseño

- **No hay `id_socio` directo** — el socio se obtiene haciendo JOIN con `creditos`. No es un problema, solo requiere JOIN.
- **No hay `fecha_aplicacion`** — no se distingue entre fecha de registro y fecha en que se ejecutó la operación.
- **No hay `nro_expediente`** — si la cooperativa usa nro de expediente diferente al pagaré, no está contemplado.
- **No hay campo de monto adicional** — solo `monto_nuevo` total. El monto adicional = `monto_nuevo - saldo_anterior` (calculable).
- **`nro_pagare_nuevo` es UNIQUE** — esto confirma que cada ampliación genera un pagaré nuevo y diferente. No puede haber dos ampliaciones con el mismo pagaré nuevo.

---

## 3. Lectura del Esquema: ¿Qué Modelo Implica?

El esquema existente apunta claramente al **Modelo D (modificación del crédito + nuevo pagaré)**:

- `nro_pagare_anterior` + `nro_pagare_nuevo` → registra el cambio de pagaré
- `monto_nuevo` + `saldo_nuevo` + `plazo_nuevo` → registra los nuevos valores del crédito
- `id_credito` apunta al crédito **original** (no crea registro nuevo en `creditos`)
- No hay `id_credito_nuevo` → no contempla un crédito nuevo separado

**Interpretación probable:** la ampliación actualiza el crédito existente (modifica `monto_aprobado`, `saldo_capital`, `plazo_meses`, `nro_pagare` en `creditos`) y registra el evento en `ampliaciones` como historial.

---

## 4. Modelos de Negocio Posibles

### Modelo A — Ampliación modifica el crédito existente

**Descripción:** La ampliación hace UPDATE en `creditos` (sube `monto_aprobado`, `saldo_capital`, `plazo_meses`, cambia `nro_pagare`). Se regenera el `cronograma_cuotas`.

| Aspecto | Detalle |
|---------|---------|
| **Ventajas** | Simple. Un solo crédito por socio. El historial queda en `ampliaciones`. |
| **Riesgos** | Si el cronograma se regenera mal, se pierden pagos ya registrados. Cuotas anteriores quedan desactualizadas. |
| **Datos requeridos** | `monto_nuevo`, `plazo_nuevo`, `saldo_nuevo`, `nro_pagare_nuevo`, `tasa` (igual o nueva). |
| **Impacto en reportes** | Anexo 6 muestra el monto actual (ya actualizado). BDCC BD01 refleja monto nuevo. |
| **Impacto en Anexo 6** | Cambia `monto_aprobado` → afecta columna C de Anexo 6. |
| **Impacto en cronogramas** | **Requiere regenerar el cronograma completo.** Las cuotas anteriores ya pagadas deben conservarse. |
| **Impacto en pagos** | Los pagos anteriores quedan con el `id_credito` del mismo crédito. OK. |
| **Aprobación requerida** | Sí — Créditos debe aprobar la operación antes de aplicarla. |

---

### Modelo B — Ampliación crea un crédito nuevo vinculado

**Descripción:** El crédito original se cierra/cancela. Se crea un nuevo crédito con el monto ampliado + saldo restante. El nuevo crédito tiene `id_credito_origen` apuntando al original.

| Aspecto | Detalle |
|---------|---------|
| **Ventajas** | Historial perfectamente separado. El crédito original queda intacto como referencia. |
| **Riesgos** | Duplica registros. Los pagos antiguos quedan en el crédito original. Vinculación manual requerida. La tabla `ampliaciones` no tiene `id_credito_nuevo`. |
| **Datos requeridos** | Todos los campos de `creditos` para el nuevo crédito. |
| **Impacto en reportes** | Ambos créditos pueden aparecer en Anexo 6 si no se filtra por `estado`. |
| **Impacto en Anexo 6** | El crédito original debe quedar en estado `cancelado`. Solo el nuevo aparece en el reporte activo. |
| **Impacto en cronogramas** | Se genera cronograma nuevo para el crédito nuevo. El cronograma del original queda congelado. |
| **Impacto en pagos** | Los pagos históricos siguen en el crédito original. Los nuevos en el nuevo crédito. |
| **Aprobación requerida** | Sí — Créditos aprueba la cancelación del original y la apertura del nuevo. |
| **Compatibilidad con tabla actual** | **Baja** — la tabla `ampliaciones` no tiene `id_credito_nuevo`. Requeriría migración o que el campo sea externo. |

---

### Modelo C — Ampliación registra solicitud sin tocar saldo hasta aprobación

**Descripción:** La ampliación es una solicitud en cola. Solo se registra en `ampliaciones` con estado `solicitada`. Créditos la aprueba. Recién al aprobarla se actualiza el crédito (Modelo A) o se crea uno nuevo (Modelo B).

| Aspecto | Detalle |
|---------|---------|
| **Ventajas** | Más seguro. Permite revisión antes de afectar datos financieros. |
| **Riesgos** | Requiere campo `estado` que no existe en la tabla actual. Sin él no hay flujo de aprobación. |
| **Datos requeridos** | Todos los campos actuales + `estado` (solicitada/aprobada/rechazada/anulada). |
| **Impacto en reportes** | Mientras es `solicitada`, no afecta reportes. Solo al aprobar. |
| **Impacto en Anexo 6** | Sin efecto hasta aprobación. |
| **Impacto en cronogramas** | Sin efecto hasta aprobación. |
| **Impacto en pagos** | Sin efecto hasta aprobación. |
| **Aprobación requerida** | Sí — es el flujo completo. |
| **Compatibilidad con tabla actual** | **Media** — usa todos los campos actuales, pero necesita `estado` (migración menor). |

---

### Modelo D — Ampliación solo cambia pagaré y monto, sin tocar cronograma todavía

**Descripción:** Se registra la ampliación como historial. El operador actualiza manualmente el crédito en la UI (`creditos/editar`). El cronograma se regenera manualmente desde la misma UI.

| Aspecto | Detalle |
|---------|---------|
| **Ventajas** | **Compatible con la tabla actual sin migración.** Mínimo riesgo de datos. |
| **Riesgos** | Desincronización posible si el operador olvida actualizar el crédito. No hay trazabilidad automática. |
| **Datos requeridos** | Los campos actuales son suficientes. |
| **Impacto en reportes** | Solo afecta reportes cuando el operador actualiza el crédito manualmente. |
| **Impacto en Anexo 6** | Igual que Modelo A pero diferido a acción manual. |
| **Impacto en cronogramas** | El operador regenera el cronograma vía edición del crédito. |
| **Impacto en pagos** | Sin cambio automático. |
| **Aprobación requerida** | Opcional — depende del proceso interno. |
| **Compatibilidad con tabla actual** | **Alta** — usa exactamente los campos que existen. |

---

## 5. Propuesta MVP Seguro

### Descripción

Implementar el módulo de ampliaciones como **registro y consulta** usando la tabla actual tal como está (Modelo D extendido con Modelo C conceptual). No se toca el crédito ni el cronograma automáticamente.

### Comportamiento

1. El área de Créditos registra una ampliación con los campos actuales.
2. La ampliación queda guardada como historial del crédito.
3. Se puede listar las ampliaciones de un crédito.
4. El crédito **NO se actualiza automáticamente** — el operador debe actualizar el crédito por separado en el módulo de Editar Crédito.
5. El cronograma **NO se regenera automáticamente**.

### Pantallas del MVP

| Pantalla | Ruta sugerida | Descripción |
|---------|--------------|-------------|
| Lista de ampliaciones del crédito | Tab en `creditos/[id]/page.tsx` | Tabla con historial de ampliaciones |
| Nueva ampliación | `creditos/[id]/ampliar/page.tsx` o modal | Formulario de registro |
| (Futuro) Aplicar ampliación | Botón condicional | Solo cuando `estado = 'aprobada'` |

### Campos del formulario MVP (usando tabla actual)

| Campo | Columna DB | Requerido | Notas |
|-------|-----------|-----------|-------|
| Fecha | `fecha` | Sí | DatePicker |
| Pagaré anterior | `nro_pagare_anterior` | Sí | Autocompletado desde `creditos.nro_pagare` |
| Pagaré nuevo | `nro_pagare_nuevo` | Sí | Input libre — UNIQUE |
| Monto nuevo | `monto_nuevo` | Sí | Nuevo monto total aprobado |
| Plazo nuevo | `plazo_nuevo` | Sí | En meses |
| Saldo nuevo | `saldo_nuevo` | Sí | Saldo de capital tras ampliación |
| Observación | `observacion` | No | Texto libre |

### Permisos UI

| Acción | Roles |
|--------|-------|
| Ver lista de ampliaciones | Todos los autenticados |
| Registrar nueva ampliación | admin, creditos |
| Editar ampliación | admin, creditos |
| Eliminar ampliación | admin |

---

## 6. Qué NO Debe Hacerse Todavía

- ❌ **NO actualizar `creditos.monto_aprobado`, `saldo_capital`, `plazo_meses`, `nro_pagare`** automáticamente al registrar una ampliación.
- ❌ **NO regenerar `cronograma_cuotas`** automáticamente desde el módulo de ampliaciones.
- ❌ **NO cancelar pagos anteriores** ni cambiar `estado` del crédito original automáticamente.
- ❌ **NO crear un crédito nuevo** en `creditos` al ampliar (Modelo B) sin que Créditos confirme que así opera.
- ❌ **NO crear migraciones todavía** para agregar `estado` u otros campos — primero confirmar con Créditos/Contabilidad el modelo definitivo.
- ❌ **NO asumir que `saldo_nuevo = saldo_capital_actual + monto_adicional`** — puede ser que incluya capitalización de intereses u otros factores.

---

## 7. Preguntas Exactas para Créditos y Contabilidad

### Para el Área de Créditos

1. **¿Una ampliación cancela el crédito original y crea uno nuevo, o modifica el crédito existente?**
   - Opción A: Modifica el mismo crédito (mismo ID en el sistema)
   - Opción B: Cierra el crédito original y abre uno nuevo vinculado

2. **¿El cronograma de cuotas se regenera desde cero al ampliar?**
   - ¿O se agregan cuotas al final del cronograma actual?
   - ¿Qué pasa con las cuotas ya pagadas?

3. **¿El número de pagaré siempre cambia al ampliar?** ¿O puede quedarse igual con una adenda?

4. **¿Qué define `saldo_nuevo`?** ¿Es el saldo de capital anterior + monto adicional? ¿O incluye intereses capitalizados?

5. **¿La tasa de interés cambia al ampliar, o siempre es la misma del crédito original?**

6. **¿Hay un proceso de aprobación antes de ejecutar la ampliación?** ¿Quién aprueba: el Gerente, el Comité, o el área de Créditos directamente?

7. **¿Puede un crédito tener más de una ampliación?** ¿Cuántas como máximo?

8. **¿Los créditos cancelados pueden ser ampliados?** ¿Solo los vigentes?

9. **¿El número de expediente (`nro_expediente`) cambia al ampliar?** ¿O solo el pagaré?

### Para Contabilidad

10. **¿Una ampliación genera un nuevo desembolso contable?** ¿O solo una reclasificación?

11. **¿El monto adicional de la ampliación afecta el cálculo de provisiones en el Anexo 6?** ¿Desde qué fecha?

12. **¿Una ampliación debe aparecer en el BDCC BD01 como un crédito con `monto_aprobado` actualizado o como un crédito nuevo?**

13. **¿Las cuotas ya pagadas del crédito original se mantienen en el historial de pagos (BD02-A) aunque el crédito haya sido ampliado?**

---

## 8. Siguiente Fase Recomendada

### Fase 10D-1 — Confirmar modelo de negocio (Sin código)

**Acción:** Presentar las preguntas de la sección 7 al área de Créditos y Contabilidad.

**Entregable:** Respuestas documentadas en `docs/ai-recovery/AMPLIACIONES_BUSINESS_RULES.md`.

### Fase 10D-2 — Migración mínima (Solo si Créditos confirma flujo con aprobación)

Si el modelo requiere workflow (aprobación antes de aplicar), agregar solo:
```sql
ALTER TABLE public.ampliaciones
  ADD COLUMN estado TEXT NOT NULL DEFAULT 'registrada'
    CHECK (estado IN ('registrada', 'aprobada', 'rechazada', 'anulada'));
```

**No aplicar hasta tener respuestas del área de Créditos.**

### Fase 10D-3 — UI MVP (Solo lectura + registro)

Implementar:
1. Tab "Ampliaciones" en `creditos/[id]/page.tsx` — lista de ampliaciones del crédito.
2. Formulario `creditos/[id]/ampliar/page.tsx` — registro de ampliación (sin tocar el crédito automáticamente).
3. Roles: admin + creditos pueden registrar; todos pueden ver.

### Fase 10D-4 — Flujo completo (Después de confirmar reglas)

Solo cuando las reglas de negocio estén confirmadas:
- Si Modelo A: botón "Aplicar ampliación" que actualiza `creditos` + regenera cronograma.
- Si Modelo B: botón "Aplicar ampliación" que cierra crédito original + crea crédito nuevo.
- Ambos casos requieren RPC en Supabase para atomicidad.

---

## Resumen de Compatibilidad MVP

| Requisito | Tabla actual soporta | Migración necesaria |
|-----------|---------------------|---------------------|
| Registrar ampliación | ✅ Sí | No |
| Listar ampliaciones por crédito | ✅ Sí (join con creditos) | No |
| Pagaré anterior / nuevo | ✅ Sí | No |
| Monto, plazo, saldo nuevos | ✅ Sí | No |
| Workflow de aprobación | ❌ No (falta `estado`) | Sí — campo `estado` |
| Tasa nueva | ❌ No | Sí — campo `tasa_nueva` |
| Cuota nueva | ❌ No | Sí — campo `cuota_nueva` |
| Actualización automática de crédito | ❌ No (diseño) | No aplica (es lógica) |
| Regeneración automática de cronograma | ❌ No (diseño) | No aplica (es lógica) |

---

*Generado por Fase 10D-0 — 2026-06-23 — Solo auditoría, sin modificar DB.*
