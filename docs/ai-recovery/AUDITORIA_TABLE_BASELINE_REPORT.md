# AUDITORIA_TABLE_BASELINE_REPORT.md

> **Fase SEC-3E — Baseline real de tabla `auditoria` en Supabase remoto**
> Fecha consulta: 2026-07-03
> Proyecto: `ljdjbhsipgkxlgnprzhm`
> Modo: SOLO LECTURA — ningún dato modificado, ninguna migración aplicada
> Registros actuales: **0**

---

## Resumen

La tabla `auditoria` existe en Supabase desde una fase anterior, creada directamente
desde el Dashboard (sin migración local). Este documento registra su estructura real
para poder crear la migración local de sincronización (SEC-3E) y planificar la
ampliación futura (SEC-4B).

---

## Columnas

| # | Nombre | Tipo | NOT NULL | Default | FK |
|---|--------|------|----------|---------|-----|
| 1 | `id` | bigint (bigserial) | ✅ YES | `nextval('auditoria_id_seq')` | PK |
| 2 | `id_usuario` | uuid | ❌ NO | — | → `public.usuarios.id` |
| 3 | `modulo` | text | ✅ YES | — | — |
| 4 | `accion` | text | ✅ YES | — | — |
| 5 | `descripcion` | text | ❌ NO | — | — |
| 6 | `registro_id` | text | ❌ NO | — | — |
| 7 | `ip` | text | ❌ NO | — | — |
| 8 | `fecha_hora` | timestamptz | ✅ YES | `now()` | — |

**Total columnas actuales: 8**

---

## Constraints

| Tipo | Nombre | Columna | Detalle |
|------|--------|---------|---------|
| PRIMARY KEY | `auditoria_pkey` | `id` | Autoincremental bigserial |
| FOREIGN KEY | `auditoria_id_usuario_fkey` | `id_usuario` | → `public.usuarios.id` |

**Nota:** Sin especificar ON DELETE en FK → comportamiento por defecto (NO ACTION).
La FK es nullable (`id_usuario` puede ser NULL), lo que permite registros sin usuario asociado.

---

## Índices

| Nombre | Columna | Tipo |
|--------|---------|------|
| `auditoria_pkey` | `id` | UNIQUE BTREE |
| `idx_auditoria_usuario` | `id_usuario` | BTREE |
| `idx_auditoria_fecha` | `fecha_hora` | BTREE |

---

## Row Level Security

| Parámetro | Valor |
|-----------|-------|
| RLS habilitado | ✅ YES (`relrowsecurity = true`) |
| Policy UPDATE | ❌ AUSENTE — inmutabilidad garantizada por omisión |
| Policy DELETE | ❌ AUSENTE — inmutabilidad garantizada por omisión |

### Policies activas

| Nombre | Operación | Roles | USING | WITH CHECK |
|--------|-----------|-------|-------|-----------|
| `auditoria_select` | SELECT | public | `auth.uid() IS NOT NULL` | — |
| `auditoria_insert` | INSERT | public | — | `auth.uid() IS NOT NULL` |

**Riesgo conocido:** INSERT abierto a cualquier usuario autenticado sin distinción de rol.
Será corregido en SEC-4B mediante RPC `registrar_auditoria` SECURITY DEFINER +
revocación del INSERT directo.

---

## Triggers

**Ninguno.** No hay triggers asociados a la tabla `auditoria`.

---

## Datos actuales

| Métrica | Valor |
|---------|-------|
| Filas en la tabla | **0** |
| En uso activo desde la app | ❌ No — ningún componente inserta actualmente |

---

## Diferencias vs diseño propuesto en SEC-4A

El `AUDIT_LOG_DESIGN_PLAN.md` propone 13 campos para el modelo ampliado.
La tabla actual tiene 8. Campos faltantes que se agregarán en SEC-4B:

| Campo faltante | Tipo propuesto | Motivo |
|----------------|----------------|--------|
| `actor_email` | text | Desnormalizado para trazabilidad sin JOIN |
| `actor_rol` | text | Rol del actor en el momento de la acción |
| `tabla_afectada` | text | Tabla Supabase afectada |
| `metadata` | jsonb | Datos adicionales sin PII |
| `ip_hash` | text | SHA-256 de la IP (reemplaza `ip` en texto claro) |

**Nota:** El campo actual `ip` guarda la IP en texto claro — SEC-4B debe migrar a `ip_hash` (SHA-256).
El campo actual `id_usuario` corresponde a `actor_user_id` del diseño propuesto.

---

## Migración local de sincronización

**Archivo:** `supabase/migrations/20260703120000_sec3e_auditoria_baseline.sql`

**Estado:** CREADA LOCAL — NO APLICADA EN REMOTO
(ya existe en Supabase; esta migración es solo para sincronizar el historial local)

---

## Pendientes de autorización

| Acción | Estado |
|--------|--------|
| `APLICAR BASELINE AUDITORIA SEC-3E` | ⏳ Pendiente de autorización |
| `APLICAR AUDIT LOG SEC-4B` | ⏳ Pendiente de autorización |
