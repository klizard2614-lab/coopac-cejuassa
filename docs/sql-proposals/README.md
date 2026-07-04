# SQL Proposals — RPC Atómicas

> **ESTADO: PROPUESTAS. NINGUNA HA SIDO APLICADA EN SUPABASE.**
>
> Estos archivos son documentación local generada en la Fase 4A/4B-0.
> Para aplicar cualquiera de estas RPC, el usuario debe copiar el SQL
> en Supabase Dashboard → SQL Editor y ejecutarlo manualmente.

---

## Propósito

Resolver los riesgos de atomicidad financiera activos:

| Riesgo | Descripción | RPC |
|--------|-------------|-----|
| R5 | Race condition en `saldo_capital` al registrar un pago | `decrementar_saldo_capital` |
| R6 | Race condition en `saldo_nuevo` de aportes | `registrar_aporte_socio` |
| R8 | Crédito sin cronograma si el bulk insert falla (sin transacción) | `crear_credito_con_cronograma` |

---

## Archivos

| Archivo | RPC | Prioridad | Estado |
|---------|-----|-----------|--------|
| `02_decrementar_saldo_capital.sql` | `decrementar_saldo_capital` | **Alta** — ya llamada desde el frontend | NO APLICADA |
| `01_registrar_aporte_socio.sql` | `registrar_aporte_socio` | **Alta** — R6 activo | NO APLICADA |
| `03_crear_credito_con_cronograma.sql` | `crear_credito_con_cronograma` | **Media** — R8, requiere refactor del frontend | NO APLICADA |

---

## Orden recomendado de aplicación

### Paso previo obligatorio (antes de RPC A)
Antes de aplicar `02_decrementar_saldo_capital.sql`, el frontend debe ser modificado
para que el fallback en `pagos/nuevo/page.tsx` distinga errores de negocio (código `P0001`)
de "función no encontrada" (código `42883`).

Ver sección de riesgo crítico en `TEST_PLAN_RPC.md`.

### Orden de implementación
1. **Fase 4B-1**: Corregir el fallback en `pagos/nuevo/page.tsx` (cambio de código, requiere `/cejuassa-safe-change`)
2. **Fase 4B-2**: Aplicar `02_decrementar_saldo_capital.sql` → resuelve R5
3. **Fase 4B-3**: Aplicar `01_registrar_aporte_socio.sql` → resuelve R6 (requiere también ajuste del frontend para llamar via RPC en vez de insert directo)
4. **Fase 4B-4**: Aplicar `03_crear_credito_con_cronograma.sql` → resuelve R8 (requiere refactor de `creditos/nuevo/page.tsx`)

---

## Convenciones de los archivos SQL

- Cada RPC usa `CREATE OR REPLACE FUNCTION`.
- `LANGUAGE plpgsql` con `BEGIN ... END`.
- `SECURITY INVOKER` (por defecto) — Opus recomienda validar RLS antes de usar `SECURITY DEFINER`.
- Toda excepción hace rollback automático de la transacción implícita.
- Los errores de negocio se lanzan con `RAISE EXCEPTION` — código `P0001` en Supabase.
