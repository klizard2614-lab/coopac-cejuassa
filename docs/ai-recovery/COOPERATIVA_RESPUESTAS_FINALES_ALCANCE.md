# COOPERATIVA_RESPUESTAS_FINALES_ALCANCE.md

> Decisiones finales de la cooperativa/contadora sobre el alcance del sistema.
> Fuente: Hoja de preguntas BDCC CEJUASSA (respuestas recibidas, Fase 10J-2, 2026-07-02).
> **Este documento define el alcance real del proyecto desde esta fecha.**

---

## Decisiones finales confirmadas

| # | Pregunta | Respuesta confirmada |
|---|---|---|
| 1 | ¿Se captura género de socios? | No es necesario de forma automatizada — ingreso manual si se requiere |
| 2 | ¿Se captura estado civil? | No es necesario de forma automatizada — ingreso manual si se requiere |
| 3 | ¿Cuál es el tipo de tasa de interés? | **TEA** (Tasa Efectiva Anual) |
| 4 | ¿Qué tipo de crédito son? | **Consumo** |
| 5 | ¿Cuál es el subtipo/tipo interno? | **Convenio** |
| 6 | ¿Se deben generar archivos TXT/BDCC? | **Fuera del alcance actual** |
| 7 | ¿Qué reporte regulatorio se mantiene? | Solo **Anexo N°6** |
| 8 | ¿Qué cambia en una ampliación? | **Cuota, plazo y tasa — editables manualmente** |

---

## Qué queda DENTRO del alcance

| Módulo/Feature | Estado |
|---|---|
| Gestión de socios (CRUD) | ✅ En alcance |
| Gestión de créditos (CRUD) | ✅ En alcance |
| Pagos y aportes | ✅ En alcance |
| Egresos y convenios | ✅ En alcance |
| Cartera y mora | ✅ En alcance |
| **Anexo N°6** (único reporte regulatorio) | ✅ En alcance — reporte principal |
| Reportes operativos (Aportes, Caja) | ✅ En alcance |
| Ampliaciones — monto, pagaré | ✅ Ya implementado (10J-1) |
| **Ampliaciones — cuota, plazo, tasa (manual)** | 🔶 En alcance — Fase 10J-2 (pendiente) |
| Labels de tasa como "% TEA" | 🔶 En alcance — cambio visual pendiente |
| Tipo crédito = consumo | ✅ Ya configurado por defecto |

---

## Qué queda FUERA del alcance (actual)

| Feature | Decisión | Qué hacer |
|---|---|---|
| BDCC SBS (archivos TXT BD01, BD02-A, BD03A, BD03B) | **Fuera de alcance** | Mantener código sin borrar. Marcar en UI con banner o despriorizar. |
| Envío SFTP a SBS (20/07/2026) | **Fuera de alcance actual** | Documentar como proyecto futuro separado |
| BD02-B y BD04 (créditos cancelados) | **Fuera de alcance** | Igual que BDCC general |
| Género y estado civil automatizados | **No necesario** | Ingreso manual por Tesorería si se requiere para otros fines |
| Subtipo SBS exacto (catálogo C19/C20) | **Fuera de alcance actual** | Sin cambios en código de subtipo |
| Histórico BDCC 2024/2025 | **Fuera de alcance** | Ya decidido desde Fase 7B-0 |
| Recálculo automático de cronograma en ampliaciones | **Fuera de alcance actual** | Solo edición manual de cuota/plazo/tasa |

---

## Impacto por módulo

### Módulo `reportes`

- **Anexo N°6**: Reporte regulatorio principal. Mantener y no tocar.
- **BDCC SBS**: Fuera de alcance. Opciones:
  - **A)** Ocultar del sidebar y de la tarjeta en `reportes/page.tsx`
  - **B)** Mantener ruta pero con banner prominente "Fuera de alcance actual — Solo referencia interna"
  - **C)** Dejar solo documentación archivada
  - **Recomendación: Opción B** — es la más segura porque preserva el código sin eliminarlo, evita romper scripts de auditoría existentes (`smoke:bdcc`, `check:bdcc:*`), y deja señal clara al usuario.
- **Aportes y Caja**: Reportes operativos internos. Mantener sin cambio.

### Módulo `creditos`

- **Tasa de interés**: Cambiar label visual de "Tasa de Interés Anual (%)" a "Tasa de interés (% TEA)".
  - Archivos afectados: `creditos/nuevo/page.tsx:260`, `creditos/[id]/editar/page.tsx:188`, `creditos/[id]/page.tsx:211`
  - **No cambiar fórmula** (ya usa `r = tasa/100/12` — compatible con TEA sobre sistema francés).
  - **No cambiar datos** en DB.
- **Tipo crédito**: Ya es "consumo" por defecto en el formulario — correcto.
- **Subtipo interno "convenio"**: Los créditos son de tipo convenio porque los socios pertenecen a convenios. Este concepto ya está modelado via `socios.id_convenio`. No requiere campo nuevo en `creditos`.

### Módulo `ampliaciones`

**Estado actual (Fase 10J-1):** La RPC `aplicar_ampliacion_credito` actualiza:
- `creditos.nro_pagare` ✅
- `creditos.monto_aprobado` ✅
- `creditos.saldo_capital` ✅

**Lo que NO actualiza actualmente** (Fase 10J-2 — pendiente):
- `creditos.plazo_meses` ❌
- `creditos.tasa_interes` ❌
- `creditos.cuota_mensual` ❌

**Campos faltantes en tabla `ampliaciones`:**
- `tasa_nueva` (numeric) — actualmente no existe
- `cuota_nueva` (numeric) — actualmente no existe

---

## Pendientes reales (post 10J-2)

| Pendiente | Área responsable | Prioridad |
|---|---|---|
| Cambio de labels "Tasa TEA" en UI | Desarrollo | Alta |
| Fase 10J-2: UI manual cuota/plazo/tasa en ampliaciones | Desarrollo | Alta |
| Migración `ampliaciones`: agregar `tasa_nueva`, `cuota_nueva` | Desarrollo (con autorización) | Alta |
| RPC actualizada: incluir tasa y cuota en UPDATE a creditos | Desarrollo (con autorización) | Alta |
| Decisión usuario sobre BDCC: Opción A, B o C | Usuario | Media |
| Banner BDCC "Fuera de alcance" en UI (si Opción B) | Desarrollo | Media |
| Género y estado civil reales de socios | Tesorería (operativo) | Baja |
| 3 pagos match_medio pendientes | Créditos (operativo) | Baja |
| 1 socio con DNI SINDNI | Tesorería (operativo) | Baja |

---

## Riesgos conocidos

| Riesgo | Severidad | Mitigación |
|---|---|---|
| La RPC `aplicar_ampliacion_credito` no actualiza tasa/cuota actualmente | Alto | No aplicar hasta tener Fase 10J-2 lista |
| Tabla `ampliaciones` falta columnas `tasa_nueva` y `cuota_nueva` | Alto | Requiere migración antes de Fase 10J-2 |
| BDCC en UI con `activo: true` puede confundir — usuarios podrían intentar generar y enviar | Medio | Agregar banner o despriorizar (Opción B) |
| Labels "Tasa de Interés Anual" sin mención de TEA podrían inducir error al ingresar datos | Medio | Cambio visual seguro en Fase 10J-2 |
| Género y estado civil en `socios` = datos demo ('M'/'soltero') — NO oficiales | Bajo | Ya documentado; no bloquea operación interna |

---

## Siguiente fase recomendada: Fase 10J-2

**Objetivo:** Completar ampliaciones con edición manual de cuota, plazo y tasa TEA.

### Pasos en orden:

1. **Aprobación del usuario**: confirmar Opción A/B/C para BDCC.
2. **Migración segura** (solo con autorización):
   ```sql
   ALTER TABLE public.ampliaciones
     ADD COLUMN IF NOT EXISTS tasa_nueva numeric(8,4),
     ADD COLUMN IF NOT EXISTS cuota_nueva numeric(12,2);
   ```
3. **RPC actualizada** (solo con autorización): extender `aplicar_ampliacion_credito` para aceptar `p_tasa_nueva` y `p_cuota_nueva` y aplicarlos en el UPDATE a `creditos`.
4. **UI**: Agregar campos "Tasa nueva TEA (%)" y "Cuota nueva (S/)" en formulario de ampliación. Actualizar vista previa antes/después.
5. **Label TEA**: Cambiar "Tasa de Interés Anual (%)" → "Tasa de interés (% TEA)" en 3 archivos.
6. **BDCC banner** (si Opción B): agregar banner "Fuera de alcance actual" en `reportes/bdcc/page.tsx`.
7. **Scripts**: `plan:alcance-final-contadora` y `check:alcance-final-contadora`.
8. **Verificación**: `verify:cejuassa` + `smoke:demo-app` + `check:alcance-final-contadora`.

---

## Restricciones absolutas para esta fase

- NO tocar `cronograma_cuotas`
- NO tocar `pagos_recibos`
- NO recalcular cuotas automáticamente
- NO tocar datos de socios masivamente
- NO crear migraciones sin autorización explícita del usuario
- SÍ actualizar documentación y labels visuales
- SÍ preparar plan técnico y scripts de auditoría
