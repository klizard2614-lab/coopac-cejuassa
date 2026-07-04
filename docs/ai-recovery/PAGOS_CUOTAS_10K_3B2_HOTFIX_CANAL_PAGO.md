# PAGOS_CUOTAS_10K_3B2_HOTFIX_CANAL_PAGO.md

> Fase 10K-3B.2 — Hotfix de `registrar_pago_con_aplicacion` para corregir el
> bug crítico **R-K4** (docs/ai-recovery/RISKS_AND_BUGS.md).
>
> **Estado: ✅ APLICADA EN SUPABASE REMOTO (2026-07-04).** Autorización
> recibida: `APLICAR HOTFIX CANAL PAGO 10K-3B.2`. Aplicada vía Supabase MCP
> `apply_migration` (no `db push`), proyecto `ljdjbhsipgkxlgnprzhm`.
> Prueba controlada 10K-3C.1 repetida con éxito tras el hotfix — ver sección
> "Verificación post-apply" abajo. **`pagos/nuevo` queda apta para
> operación** (ver conclusión al final del documento).

---

## Objetivo

Corregir el bug bloqueante detectado en la prueba controlada 10K-3C.1: la
RPC `registrar_pago_con_aplicacion` no puede insertar ningún pago porque
intenta escribir `p_canal_pago` (tipo `text`) directo en
`pagos_recibos.canal_pago` (tipo enum), sin cast.

## Causa raíz confirmada

**Error exacto** (obtenido en la ejecución real de la prueba 10K-3C.1):

```
ERROR: 42804: column "canal_pago" is of type canal_pago but expression is of type text
HINT: You will need to rewrite or cast the expression.
```

**Auditoría de solo lectura ejecutada en esta fase (2026-07-04), contra
Supabase remoto, sin modificar nada:**

| Consulta | Resultado |
|---|---|
| `SELECT enumlabel FROM pg_enum WHERE enumtypid = 'public.canal_pago'::regtype` | `caja`, `convenio` |
| `information_schema.columns` para `pagos_recibos.canal_pago` | `data_type = USER-DEFINED`, `udt_name = canal_pago` (enum) |
| `information_schema.columns` para `pagos_recibos.estado_flujo` | `data_type = USER-DEFINED`, `udt_name = estado_flujo_pago` (enum, pero se inserta como literal sin tipo `'registrado'` — Postgres lo resuelve automáticamente, **no requiere corrección**) |
| `information_schema.columns` para `pagos_recibos.tipo_pago` | `data_type = text` (no es enum, **no requiere corrección**) |

**Por qué falla `canal_pago` y no `estado_flujo`:** en la función original,
`estado_flujo` se inserta como el literal `'registrado'` directo (una
constante de tipo "unknown" en tiempo de parseo), que Postgres sí resuelve
automáticamente contra el tipo real de la columna destino. En cambio,
`canal_pago` se inserta vía `COALESCE(p_canal_pago, 'caja')`, donde
`p_canal_pago` es un parámetro declarado explícitamente como `text` — el
resultado del `COALESCE` conserva el tipo `text` ya resuelto, y Postgres
**no** convierte automáticamente un valor `text` ya tipado a un enum de
usuario sin un cast explícito.

**Alcance confirmado:** `canal_pago` es la **única** columna del `INSERT
INTO pagos_recibos` con este problema. No se amplía el alcance del hotfix a
ningún otro campo.

## Impacto del bug (sin corregir)

El `INSERT INTO pagos_recibos` (Sección B de la función) se ejecuta
**incondicionalmente para todo pago**, con o sin crédito vinculado. Por lo
tanto, en su estado actual, **ningún pago nuevo puede registrarse** a
través de `registrar_pago_con_aplicacion` — ni desde la UI (`pagos/nuevo`,
integrada en 10K-3C) ni llamando la RPC directamente.

## Corrección aplicada (SQL propuesto — resumen)

Migración local (NO aplicada):
`supabase/migrations/20260704140000_10k3b2_hotfix_registrar_pago_canal_pago.sql`

`CREATE OR REPLACE FUNCTION public.registrar_pago_con_aplicacion(...)` con
**la misma firma exacta** de 10K-3B (sin cambios de parámetros, tipos ni
retorno). Único cambio de fondo:

1. **Nuevas variables locales:**
   ```sql
   v_canal_pago_raw   text;
   v_canal_pago       public.canal_pago;
   ```
2. **Normalización y validación** (agregada en la sección A de
   validaciones, antes del `INSERT`):
   ```sql
   v_canal_pago_raw := lower(trim(COALESCE(p_canal_pago, 'caja')));
   IF v_canal_pago_raw = '' THEN
     v_canal_pago_raw := 'caja';
   END IF;

   IF v_canal_pago_raw NOT IN ('caja', 'convenio') THEN
     RAISE EXCEPTION 'canal_pago_invalido: el canal de pago debe ser "caja" o "convenio", recibido: %',
       COALESCE(p_canal_pago, '(vacio)');
   END IF;

   v_canal_pago := v_canal_pago_raw::public.canal_pago;
   ```
   El cast a enum ocurre **solo después** de confirmar que el valor
   normalizado coincide exactamente con uno de los dos labels reales del
   enum — nunca un cast directo e inseguro sobre un valor no validado (que
   habría producido un error de Postgres igual de críptico si el valor no
   coincidía, solo que en el punto del cast en vez del `INSERT`).
3. **Uso en el `INSERT`:** se reemplaza
   `COALESCE(p_canal_pago, 'caja')` por `v_canal_pago` (ya validado y
   tipado).

**Todo lo demás permanece idéntico:** validaciones de rol/sesión, chequeo
de duplicado (`recibo_duplicado` + `unique_violation`), validación de
crédito cancelado, cascada contra `cronograma_cuotas` con tope exacto,
trazabilidad en `pagos_cuotas_aplicaciones`, reutilización de
`decrementar_saldo_capital`, manejo de excedente, `SECURITY DEFINER` + `SET
search_path = public`, `REVOKE`/`GRANT` de `authenticated`/`anon`.

## Tablas afectadas

| Tabla | Operación |
|---|---|
| `public.registrar_pago_con_aplicacion` (función, no tabla) | `CREATE OR REPLACE FUNCTION` |
| Ninguna tabla | Sin `ALTER TABLE`, `CREATE TABLE` ni `CREATE INDEX` — el hotfix solo reemplaza el cuerpo de una función existente |

## Riesgos

- **¿Puede fallar silenciosamente?** No — si `canal_pago` viene con un
  valor no reconocido, la función ahora lanza `canal_pago_invalido` con
  mensaje claro, en vez de un error genérico de Postgres o (peor) un
  `INSERT` silenciosamente incorrecto.
- **¿Afecta datos existentes?** No. `CREATE OR REPLACE FUNCTION` reemplaza
  solo el código de la función; no toca ninguna fila de ninguna tabla.
- **¿Es compatible con el código actual?** Sí — la firma no cambia, el
  frontend (`lib/pagos/registrarPagoConAplicacion.ts`) sigue enviando
  `p_canal_pago` como string (`'caja'`/`'convenio'`, los mismos dos valores
  del `<select>` en `pagos/nuevo/page.tsx`), que ahora sí serán aceptados
  correctamente.
- **¿Requiere downtime?** No — reemplazar una función es una operación
  instantánea en Postgres, sin bloqueo de tablas.
- **Riesgo residual:** el resto de la función (cascada, trazabilidad,
  validaciones de crédito) **todavía no tiene confirmación empírica
  completa** — la prueba controlada 10K-3C.1 abortó antes de llegar a esos
  escenarios por este mismo bug. Debe repetirse la prueba tras aplicar este
  hotfix.

## Rollback

Si algo sale mal tras aplicar este hotfix, revertir ejecutando de nuevo el
`CREATE OR REPLACE FUNCTION` de la versión anterior (10K-3B, con el bug
presente mientras se investiga una alternativa):

```sql
-- Contenido completo de la función tal como está en
-- supabase/migrations/20260704120000_10k3b_registrar_pago_con_aplicacion.sql
-- (sección "CREATE OR REPLACE FUNCTION public.registrar_pago_con_aplicacion",
-- sin repetir el Paso 0 del índice único, que este hotfix no toca).
```

**No implica pérdida de datos** — un `CREATE OR REPLACE FUNCTION` nunca
borra filas; solo cambia el comportamiento futuro de la función.

## Plan de prueba (con rollback estructural, tras aplicar)

Repetir la prueba controlada de 10K-3C.1 (mismo patrón: un único statement
`DO $$...$$` que siempre termina en `RAISE EXCEPTION`, garantizando que
Postgres revierta todo automáticamente sin depender de `BEGIN`/`ROLLBACK`
en llamadas separadas):

1. Confirmar conteos antes (`pagos_recibos`, `pagos_cuotas_aplicaciones`,
   saldo y cuotas del crédito candidato).
2. Escenario 1 — pago exacto de una cuota: debe completarse sin error de
   tipo, insertar en `pagos_recibos` y `pagos_cuotas_aplicaciones`.
3. Escenario 2 — pago parcial: debe completarse, cuota queda `parcial`.
4. Escenario 4 — recibo duplicado: debe rechazar con `recibo_duplicado`
   (capturado en un bloque `EXCEPTION WHEN OTHERS` para no abortar el resto
   de la prueba).
5. Verificar trazabilidad: contar filas insertadas en
   `pagos_cuotas_aplicaciones` para los recibos de prueba, dentro de la
   misma transacción.
6. Forzar el `RAISE EXCEPTION` final con el log completo — Postgres revierte
   todo automáticamente.
7. Verificar (en una consulta de solo lectura posterior) que los conteos
   quedaron exactamente iguales a los de "antes".

**Módulo de la app a verificar tras aplicar (opcional, sin datos reales):**
abrir `pagos/nuevo`, confirmar que la pantalla carga sin errores de consola
(ya verificado en 10K-3C) — no se debe registrar un pago real de prueba sin
autorización adicional.

## Qué NO se toca en esta fase

- **UI:** `app/dashboard/pagos/nuevo/page.tsx` y
  `lib/pagos/registrarPagoConAplicacion.ts` — sin cambios, la firma de la
  RPC es idéntica.
- **Anexo 6** (`reportes/anexo6/page.tsx`) — sin cambios.
- **Seguridad existente** (RLS, policies, `auditoria`,
  `registrar_auditoria`) — sin cambios. `AUDIT_ENABLED` sigue en `false`,
  SEC-4C no se integra.
- **Pagos históricos:** ninguno de los 832 `pagos_recibos` se modifica —
  este hotfix solo reemplaza el cuerpo de una función. La Fase 10K-2B sigue
  diferida, no se ejecuta.
- **Ninguna tabla, índice ni policy** — la migración solo contiene
  `CREATE OR REPLACE FUNCTION` + `REVOKE`/`GRANT` sobre esa misma función.
- **`db push` general** — si se autoriza, se aplica **solo** esta migración
  puntual (vía Supabase MCP `apply_migration`, mismo patrón que 10K-3B/
  SEC-3E/SEC-4B), no un `db push` que arrastre otras migraciones locales no
  autorizadas.

## Acción requerida del usuario

~~Antes de aplicar este hotfix en Supabase remoto, se requiere la
autorización exacta: `APLICAR HOTFIX CANAL PAGO 10K-3B.2`~~ — **recibida y
aplicada (2026-07-04).**

---

## Verificación post-apply (2026-07-04)

**Aplicado vía Supabase MCP `apply_migration`** (nombre:
`10k3b2_hotfix_registrar_pago_canal_pago`), no `db push`.

**Función:**
- Existe: `public.registrar_pago_con_aplicacion` ✅
- Firma sin cambios: 16 parámetros, mismos tipos y orden ✅
- `SECURITY DEFINER = true` ✅
- Roles con `EXECUTE`: solo `{authenticated}` — **`anon` sin EXECUTE** ✅
  (confirmado con `has_function_privilege`)
- `get_advisors(security)`: única advertencia sobre esta función es
  "Signed-In Users Can Execute" (esperada, `authenticated` puede llamarla
  por diseño) — **sin** advertencia de `anon` (confirma el `REVOKE`
  correcto, mismo patrón que 10K-3B/SEC-4B)

**Datos (antes de repetir la prueba):**
- `pagos_recibos`: **832** (sin cambios)
- `pagos_cuotas_aplicaciones`: **0** (sin cambios)
- Crédito `1134` `saldo_capital`: **6142.83** (sin cambios)
- Cuotas 133/134: `pendiente`, `0`/`0` (sin cambios)

## Prueba controlada 10K-3C.1 repetida (con el hotfix aplicado)

Mismo método que la ejecución original (un único bloque `DO $$...$$` que
siempre termina en `RAISE EXCEPTION`, forzando a Postgres a revertir todo
automáticamente). Usuario de prueba: mismo `55f7e60f...` (rol `admin`).

| # | Escenario | Resultado |
|---|---|---|
| 1 | Pago exacto de una cuota | ✅ **Éxito** — cuota 133 → `pagada`, `capital_aplicado=147.03`, `interes_aplicado=178.80`, `cuotas_pagadas=1`, `excedente=0` |
| 2 | Pago parcial | ✅ **Éxito** — cuota 134 → `parcial`, `capital_aplicado=50.00`, `interes_aplicado=50.00`, `cuotas_parciales=1` |
| 4 | Rechazo de recibo duplicado | ✅ **Éxito** — rechazado con `recibo_duplicado`, capturado sin abortar el resto de la prueba |
| Extra | Canal de pago inválido (`'bitcoin'`) | ✅ **Éxito** — rechazado con `canal_pago_invalido: el canal de pago debe ser "caja" o "convenio"` — confirma que el hotfix valida correctamente |
| 6 | Trazabilidad | ✅ **Éxito** — 2 filas insertadas en `pagos_cuotas_aplicaciones` dentro de la transacción (una por cada pago de prueba exitoso) |
| 7 | Rollback sin datos persistentes | ✅ **Confirmado** — ver conteos después |

**Conteos "durante" la transacción** (antes del rollback, para referencia):
`pagos_recibos=834` (832+2 pagos de prueba), `pagos_cuotas_aplicaciones=2`,
`saldo_1134=5945.80` (6142.83 − 197.03 de capital aplicado en los 2
escenarios), cuota 133 `pagada`, cuota 134 `parcial`.

**Conteos DESPUÉS del rollback (confirmados por lectura independiente):**

| Métrica | Antes | Después | ¿Coincide? |
|---|---|---|---|
| `pagos_recibos` | 832 | **832** | ✅ Sí |
| `pagos_cuotas_aplicaciones` | 0 | **0** | ✅ Sí |
| Crédito `1134` `saldo_capital` | 6142.83 | **6142.83** | ✅ Sí |
| Cuota `133` | pendiente, 0/0 | **pendiente, 0/0** | ✅ Sí |
| Cuota `134` | pendiente, 0/0 | **pendiente, 0/0** | ✅ Sí |
| Recibos `TEST_10K3C1B_%` | — | **0** | ✅ Ninguno quedó |

**Rollback confirmado, garantizado estructuralmente** — el `RAISE
EXCEPTION` final del bloque `DO` fuerza a Postgres a revertir todo,
sin posibilidad de `COMMIT`.

Escenarios 3 (multi-cuota) y 5 (crédito cancelado) siguen sin ejecutarse —
quedaron fuera del alcance mínimo de esta ronda de pruebas (igual que en la
ejecución original de 10K-3C.1); no bloquean la conclusión porque los 5
escenarios mínimos requeridos sí se completaron con éxito.

## Conclusión

**El hotfix corrige R-K4 por completo.** Los 5 escenarios mínimos (pago
exacto, pago parcial, rechazo de recibo duplicado, trazabilidad, rollback)
se ejecutaron con éxito tras aplicar la migración, sin dejar ningún dato
persistente. `pagos/nuevo` **queda apta para operación** — ver actualización
de estado en `docs/ai-recovery/RISKS_AND_BUGS.md` (R-K4 ahora resuelto).
