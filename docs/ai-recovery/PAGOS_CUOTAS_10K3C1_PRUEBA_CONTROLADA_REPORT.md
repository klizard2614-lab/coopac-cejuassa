# PAGOS_CUOTAS_10K3C1_PRUEBA_CONTROLADA_REPORT.md

> Fase 10K-3C.1 — Prueba controlada de `registrar_pago_con_aplicacion` desde
> el flujo nuevo de `pagos/nuevo`.
>
> **ESTADO: EJECUTADA — HALLAZGO CRÍTICO BLOQUEANTE ENCONTRADO.**
>
> Autorización recibida: `EJECUTAR PRUEBA CONTROLADA PAGOS 10K-3C.1`
> (2026-07-04). Ejecutada vía Supabase MCP `execute_sql` contra el proyecto
> `ljdjbhsipgkxlgnprzhm`, en un solo statement autocontenido (ver "Método
> usado") para garantizar que el rollback ocurriera en la misma sesión/
> transacción, sin depender de que dos llamadas separadas compartieran
> conexión.
>
> **Resultado: la prueba encontró un bug real y bloqueante en la RPC
> `registrar_pago_con_aplicacion` (aplicada en Fase 10K-3B) que impide
> registrar CUALQUIER pago nuevo — con o sin crédito — a través del flujo
> integrado en 10K-3C.** El bug fue capturado sin dejar ningún dato
> persistente (Postgres abortó la transacción automáticamente al
> encontrarlo). Ver sección "Hallazgo crítico" abajo.
>
> **✅ ACTUALIZACIÓN (2026-07-04) — CORREGIDO Y RE-VALIDADO.** Fase
> **10K-3B.2** aplicó el hotfix (autorización `APLICAR HOTFIX CANAL PAGO
> 10K-3B.2`) y esta misma prueba controlada se repitió con éxito: los 5
> escenarios mínimos (pago exacto, pago parcial, rechazo de recibo
> duplicado, trazabilidad, rollback) se completaron correctamente, sin
> dejar ningún dato persistente. Detalle completo de la re-ejecución en
> `docs/ai-recovery/PAGOS_CUOTAS_10K_3B2_HOTFIX_CANAL_PAGO.md`, sección
> "Prueba controlada 10K-3C.1 repetida". **`pagos/nuevo` queda apta para
> operación.** El resto de este documento describe la ejecución original
> (con el bug presente) y se conserva como registro histórico.

---

## Objetivo

Validar, dentro de una transacción con rollback garantizado (cero datos
persistentes), que `registrar_pago_con_aplicacion` cubre los escenarios
mínimos requeridos por la autorización recibida (pago exacto, pago parcial,
rechazo de recibo duplicado, trazabilidad, rollback sin persistencia) antes
de considerar `pagos/nuevo` apta para operación supervisada.

## Método usado

**Un solo statement SQL** (bloque `DO $$ ... $$`) que:

1. Busca un usuario real `admin`/`tesoreria` activo (solo lectura, sin UUID
   inventado) y aborta con `RAISE EXCEPTION` si no existe ninguno.
2. Simula `auth.uid()` para ese usuario con
   `set_config('request.jwt.claims', ..., true)` (scope de transacción).
3. Ejecuta los escenarios en secuencia, capturando cada resultado en
   variables `jsonb` locales (nunca en una tabla persistente).
4. Al final, **siempre** ejecuta `RAISE EXCEPTION` con el log completo como
   texto del mensaje — esto garantiza estructuralmente que Postgres aborte
   y revierta todo lo hecho por el bloque, sin posibilidad de `COMMIT`
   (la garantía no depende de recordar ejecutar `ROLLBACK` en un paso
   separado; es la semántica de una sentencia SQL simple que termina en
   error sin transacción explícita: se revierte sola).

**Por qué se eligió esto en vez de `BEGIN; ...; ROLLBACK;` en varios pasos:**
el `execute_sql` de Supabase MCP no garantiza que dos llamadas separadas
compartan la misma conexión/sesión de Postgres. Si el `BEGIN` y el
`ROLLBACK` se hubieran enviado en llamadas distintas, no había forma de
verificar que realmente pertenecían a la misma transacción — habría sido
posible que el `ROLLBACK` no revirtiera nada real. Empaquetar todo en un
único bloque `DO` elimina ese riesgo por completo: es una sola sentencia,
una sola conexión, un solo resultado atómico garantizado por Postgres.

## Usuario de prueba usado (enmascarado)

Encontrado por lectura (`SELECT id, rol FROM usuarios WHERE rol IN
('admin','tesoreria') AND activo = true LIMIT 1`), **sin UUID inventado**:

- UUID (prefijo únicamente): `55f7e60f...`
- Rol: `admin`
- Activo: `true`

## Conteos ANTES (confirmados por lectura, inmediatamente antes de ejecutar)

| Métrica | Valor |
|---|---|
| `pagos_recibos` | **832** |
| `pagos_cuotas_aplicaciones` | **0** |
| Crédito `id=1134` — `saldo_capital` | **6142.83** |
| Cuota `id=133` | estado `pendiente`, `capital_pagado=0`, `interes_pagado=0` |
| Cuota `id=134` | estado `pendiente`, `capital_pagado=0`, `interes_pagado=0` |

## Hallazgo crítico — bug bloqueante en `registrar_pago_con_aplicacion`

Al ejecutar el **Escenario 1 (pago exacto de la cuota 133)**, Postgres
rechazó el `INSERT INTO pagos_recibos` interno de la RPC con:

```
ERROR: 42804: column "canal_pago" is of type canal_pago but expression is of type text
HINT: You will need to rewrite or cast the expression.
```

**Causa raíz confirmada** (verificada con `information_schema.columns`):
`pagos_recibos.canal_pago` es un **tipo enum de Postgres** (`udt_name =
canal_pago`, `data_type = USER-DEFINED`), no `text`. La función
`registrar_pago_con_aplicacion` declara su parámetro como
`p_canal_pago text DEFAULT 'caja'` y lo inserta con
`COALESCE(p_canal_pago, 'caja')` — el resultado sigue siendo tipo `text`,
sin ningún `::canal_pago` explícito. Postgres no castea automáticamente un
valor `text` (con tipo ya resuelto, no un literal "unknown") a un enum de
usuario.

**Por qué esto afecta a TODOS los pagos, no solo a los de crédito:** el
`INSERT INTO pagos_recibos` (Sección B de la función) se ejecuta
**incondicionalmente** para cualquier pago — con o sin `id_credito`, con o
sin componente de crédito. El error ocurre ahí, antes de llegar a la
Sección C (aplicación contra cuotas). Esto significa que, en su estado
actual, **ningún pago nuevo puede registrarse exitosamente a través de
`registrar_pago_con_aplicacion`** — ni los que solo tienen aporte/FPS, ni
los que tienen capital/interés.

**Por qué no se detectó antes:** los checks de las Fases 10K-3B y 10K-3C
(`check:pagos-cuotas-10k3b`, `check:pagos-cuotas-10k3c`) son verificaciones
estáticas — comparan el texto del SQL/TypeScript contra patrones esperados,
pero **nunca ejecutan la función contra la base de datos real**. Esta es la
primera vez que se invocó la RPC contra Supabase desde que se aplicó en
10K-3B. El propósito de esta fase (10K-3C.1) era exactamente detectar este
tipo de defecto antes de que afectara operación real — cumplió su
objetivo.

**Impacto en el diseño original de la prueba:** al abortar en el Escenario
1, los escenarios 2 (pago parcial) y 4 (rechazo de recibo duplicado) **no
llegaron a ejecutarse** — la sentencia completa terminó en el primer error
real que encontró Postgres. Los escenarios de multi-cuota y crédito
cancelado tampoco se ejecutaron (estaban fuera del alcance mínimo de esta
autorización). Ver sección "Escenarios ejecutados" abajo.

## Escenarios ejecutados

| # | Escenario | Resultado |
|---|---|---|
| 1 | Pago exacto de una cuota | ❌ **No completado** — abortado por el bug `canal_pago` antes de insertar el recibo |
| 2 | Pago parcial | **No ejecutado** — la transacción ya había abortado en el escenario 1 |
| 3 | Pago multi-cuota | **No ejecutado** — fuera del alcance mínimo de esta autorización, y de todas formas habría fallado por el mismo bug |
| 4 | Rechazo de recibo duplicado | **No ejecutado** — la transacción ya había abortado en el escenario 1 |
| 5 | Rechazo de crédito cancelado | **No ejecutado** — fuera del alcance mínimo de esta autorización |
| 6 | Verificación de trazabilidad | **No aplica** — no se llegó a insertar ningún pago, por lo tanto no hay trazabilidad que verificar |
| 7 | Rollback sin datos persistentes | ✅ **Confirmado** — ver sección siguiente |

## Conteos DESPUÉS (confirmados por lectura, inmediatamente después)

| Métrica | Antes | Después | ¿Coincide? |
|---|---|---|---|
| `pagos_recibos` | 832 | **832** | ✅ Sí |
| `pagos_cuotas_aplicaciones` | 0 | **0** | ✅ Sí |
| Crédito `id=1134` — `saldo_capital` | 6142.83 | **6142.83** | ✅ Sí |
| Cuota `id=133` | pendiente, 0/0 | **pendiente, 0/0** | ✅ Sí |
| Cuota `id=134` | pendiente, 0/0 | **pendiente, 0/0** | ✅ Sí |
| Recibos con `nro_recibo LIKE 'TEST_10K3C1_%'` | — | **0** | ✅ Ninguno quedó |

## Confirmación explícita de rollback

**Rollback confirmado, garantizado estructuralmente por Postgres** — no por
un `ROLLBACK;` manual en un paso separado, sino porque toda la prueba se
ejecutó como una única sentencia (`DO $$ ... $$`) sin `BEGIN` explícito:
cualquier error dentro de esa sentencia (el error real de tipo `canal_pago`
que ocurrió, o el `RAISE EXCEPTION` final que se habría disparado si todo
hubiera funcionado) hace que Postgres revierta automáticamente **todo** lo
que la sentencia haya hecho hasta ese punto, como parte de su
comportamiento estándar para sentencias fuera de una transacción explícita.
No hubo, ni pudo haber, ningún `COMMIT`.

## No quedó ningún dato de prueba

Confirmado por los conteos "después" (idénticos a "antes") y por la
consulta explícita `SELECT count(*) FROM pagos_recibos WHERE nro_recibo
LIKE 'TEST_10K3C1_%'` → **0 filas**.

## Errores encontrados

1. **CRÍTICO / BLOQUEANTE:** `registrar_pago_con_aplicacion` no puede
   insertar en `pagos_recibos` porque `p_canal_pago` (tipo `text`) no se
   castea a `canal_pago` (enum) antes del `INSERT`. Afecta el 100% de los
   pagos nuevos, con o sin crédito. Ver "Hallazgo crítico" arriba para el
   detalle técnico completo.
2. Ningún otro error — los escenarios 2, 3, 4, 5 y 6 no llegaron a
   ejecutarse por la razón anterior, no por fallas propias.

## Riesgos

- El bug es puramente de tipos (`text` vs `canal_pago`), no de lógica de
  negocio — el resto de la función (cascada, tope, trazabilidad,
  validaciones) nunca llegó a ejecutarse en esta prueba y **sigue sin
  verificación empírica** hasta que se corrija este bloqueo y se repita la
  prueba.
- **La pantalla `pagos/nuevo` en producción está actualmente rota para
  cualquier pago nuevo** — cualquier usuario que intente registrar un pago
  real recibirá un error de la RPC. Esto es más grave que "apta para
  operación supervisada": es **no apta para operación en absoluto** hasta
  corregir el bug.

## ¿La pantalla queda apta para operación supervisada?

**No.** Con este hallazgo, `pagos/nuevo` **no debe usarse en producción**
hasta que se corrija el bug de tipo `canal_pago` en
`registrar_pago_con_aplicacion` y se repita esta prueba controlada con
éxito. Se recomienda una fase de corrección urgente (ej. **Fase
10K-3B.2 — hotfix de tipo `canal_pago`**) que:

1. Agregue un cast explícito (`p_canal_pago::canal_pago` o
   `COALESCE(p_canal_pago, 'caja')::canal_pago`) en el `INSERT` de la RPC.
2. Se documente con el formato completo del skill `cejuassa-db-plan`
   (objetivo, tablas afectadas, SQL propuesto, riesgos, rollback, casos de
   prueba) — requiere su propia autorización explícita antes de aplicarse.
3. Se repita esta misma prueba controlada (10K-3C.1) tras el hotfix, para
   confirmar que los 5 escenarios mínimos ahora sí se ejecutan
   correctamente de punta a punta.

## Qué NO se tocó en esta fase

- **Pagos históricos:** ninguno de los 832 `pagos_recibos` existentes fue
  modificado — confirmado por los conteos antes/después idénticos. La Fase
  10K-2B (apply de los 832 pagos históricos) **sigue diferida, no se
  ejecutó ni se tocó** en esta fase.
- **Anexo 6** (`reportes/anexo6/page.tsx`) — sin cambios.
- **Seguridad existente** (RLS, policies, `auditoria`, `registrar_auditoria`)
  — sin cambios. `AUDIT_ENABLED` sigue en `false`, SEC-4C no se integró.
- **Ninguna migración, función, tabla, índice o policy** fue creada,
  modificada ni aplicada — el bug se detectó, no se corrigió. La corrección
  queda para una fase futura con su propia autorización.
- **`db push` no se usó** — la única interacción con Supabase remoto fue
  vía `execute_sql` (SELECTs de solo lectura + el bloque de prueba
  autocontenido que se revirtió solo).
