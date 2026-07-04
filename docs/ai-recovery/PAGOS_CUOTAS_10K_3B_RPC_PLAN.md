# PAGOS_CUOTAS_10K_3B_RPC_PLAN.md

> Fase 10K-3B — SQL final ejecutable para la RPC transaccional
> `registrar_pago_con_aplicacion`.
> **Modo: SOLO PLAN.** El SQL de esta fase existe únicamente como migración
> **local** (`supabase/migrations/20260704120000_10k3b_registrar_pago_con_aplicacion.sql`).
> **No se aplicó en Supabase remoto.** No se modificó ningún dato, no se
> tocó la UI, no se ejecutó 10K-2B. Requiere aprobación explícita del
> usuario (`APLICAR RPC PAGOS NUEVOS 10K-3B`) antes de aplicarse.

---

## Problema actual — R-K3

`app/dashboard/pagos/nuevo/page.tsx` registra un pago en 4 pasos
secuenciales desde el cliente (sin transacción real):

1. INSERT `pagos_recibos`.
2. RPC `decrementar_saldo_capital` (con fallback a UPDATE directo).
3. Busca **1 sola cuota** (la más antigua pendiente/vencida/parcial) y le
   suma `monto_capital`/`monto_interes` **sin tope** — si el pago supera lo
   que falta de esa cuota, los campos quedan por encima del valor real de
   la cuota, y el excedente **no pasa a la siguiente cuota** (se pierde).
4. RPC `registrar_aporte_socio` si `monto_aporte > 0`.

**Nunca inserta** en `pagos_cuotas_aplicaciones` (tabla de trazabilidad
creada en Fase 10K-1, sin usar). Riesgo documentado como **R-K3** en
`docs/ai-recovery/RISKS_AND_BUGS.md`.

Diseño de la solución (sin SQL ejecutable): `docs/ai-recovery/PAGOS_CUOTAS_10K_3A_LOGICA_NUEVOS_PAGOS.md` (Fase 10K-3A).
Esta fase (10K-3B) produce el SQL final para esa solución.

---

## Flujo transaccional propuesto

Una única llamada `supabase.rpc('registrar_pago_con_aplicacion', {...})`
que reemplaza los pasos 1-3 actuales (el paso 4, aporte, se mantiene
**separado**, ver sección "Qué queda para 10K-3C/UI").

```
Cliente:
  supabase.rpc('registrar_pago_con_aplicacion', { ...datos del formulario... })
    → devuelve { id_pago, id_credito, monto_credito_aplicado,
                 cuotas_afectadas, cuotas_pagadas, cuotas_parciales,
                 excedente, aplicaciones_insertadas, advertencias }

  Si monto_aporte > 0:
    supabase.rpc('registrar_aporte_socio', {...})   ← sin cambios, llamada separada

Dentro de la RPC (todo en una sola transacción de Postgres):
  A. Validar rol del caller (admin/tesoreria), socio, fecha, periodo,
     monto > 0, crédito no cancelado, recibo no duplicado
  B. INSERT pagos_recibos
  C. Si hay crédito y monto_capital+monto_interes > 0:
       - Lock del crédito (FOR UPDATE)
       - Cascada sobre cronograma_cuotas (FOR UPDATE, fecha_vencimiento ASC)
       - UPDATE cronograma_cuotas por cada cuota tocada (con tope exacto)
       - INSERT pagos_cuotas_aplicaciones por cada cuota tocada
       - PERFORM decrementar_saldo_capital(...) — reutiliza la RPC ya
         existente y probada (R5), no se duplica su lógica
       - Si sobra monto: se reporta como excedente, nunca se inventa cuota
  F. RETURN jsonb con el resumen completo
```

---

## Firma de la RPC

```sql
registrar_pago_con_aplicacion(
  p_nro_recibo                  text,
  p_id_socio                    bigint,
  p_id_credito                  bigint    DEFAULT NULL,
  p_id_convenio                 bigint    DEFAULT NULL,
  p_fecha                       date      DEFAULT NULL,
  p_periodo                     text      DEFAULT NULL,
  p_canal_pago                  text      DEFAULT 'caja',
  p_tipo_pago                   text      DEFAULT NULL,
  p_monto_aporte                numeric   DEFAULT 0,
  p_monto_capital               numeric   DEFAULT 0,
  p_monto_interes               numeric   DEFAULT 0,
  p_monto_fps                   numeric   DEFAULT 0,
  p_monto_fps_extra             numeric   DEFAULT 0,
  p_monto_otros                 numeric   DEFAULT 0,
  p_interes_amortizado_pagado   numeric   DEFAULT 0,
  p_observacion                 text      DEFAULT NULL
) RETURNS jsonb
```

**Retorno (`jsonb`):**

| Campo | Tipo | Descripción |
|---|---|---|
| `id_pago` | integer | id del `pagos_recibos` recién creado |
| `id_credito` | integer\|null | crédito vinculado, si hubo |
| `monto_credito_aplicado` | numeric | suma de capital+interés efectivamente aplicado a cuotas |
| `cuotas_afectadas` | array | una entrada por cuota tocada: `{id_cuota, capital_aplicado, interes_aplicado, estado_resultante}` |
| `cuotas_pagadas` | integer | cuántas de las cuotas tocadas quedaron `pagada` |
| `cuotas_parciales` | integer | cuántas quedaron `parcial` |
| `excedente` | numeric | monto que no se pudo aplicar a ninguna cuota (nunca se pierde silenciosamente) |
| `aplicaciones_insertadas` | integer | filas insertadas en `pagos_cuotas_aplicaciones` |
| `advertencias` | array de texto | ej. excedente sin aplicar, o aporte pendiente de procesar por separado |

---

## Reglas de negocio implementadas

Idénticas a las diseñadas en 10K-3A, ahora en SQL ejecutable:

1. **Orden:** cuotas `pendiente`/`vencida`/`parcial` del crédito, ordenadas
   por `fecha_vencimiento ASC`.
2. **Monto aplicable:** solo `monto_capital + monto_interes` (excluye
   aporte/FPS/FPS extra/otros).
3. **Tope exacto por cuota:** `capital_aplicar`/`interes_aplicar` nunca
   superan lo que falta de esa cuota específica (`capital - capital_pagado`,
   `interes - interes_pagado`) — corrige el bug central de R-K3.
4. **Split proporcional** cuando el pago no alcanza a cubrir la cuota
   completa, según el ratio `capital/(capital+interes)` del monto
   disponible.
5. **Cascada:** si el pago cubre una cuota y sobra, el excedente se aplica
   automáticamente a la siguiente cuota pendiente del mismo crédito (el
   `LOOP` continúa mientras `v_monto_disponible > 0.005`).
6. **Excedente final:** si sobra monto tras cubrir todas las cuotas
   disponibles, se retorna explícitamente en `excedente` con una advertencia
   en `advertencias` — nunca se inventa una cuota ni se aplica a otro
   crédito.
7. **Crédito cancelado:** si `creditos.estado = 'cancelado'` y el pago trae
   `monto_capital`/`monto_interes` > 0, la función **rechaza** con
   `credito_cancelado_no_admite_pagos` (regla explícita solicitada por el
   usuario: "validar que no esté cancelado, salvo regla explícita" — se
   interpretó como rechazo por defecto, ya que un crédito cancelado no
   debería recibir pagos nuevos de capital/interés).
8. **Sin crédito:** si `monto_capital`/`monto_interes` > 0 pero no se pasó
   `id_credito`, la función rechaza con `monto_credito_sin_credito` (no
   tiene sentido aplicar capital sin saber a qué crédito).
9. **Pago sin componente de crédito:** si `id_credito` es `NULL` (o viene
   pero el monto capital+interés es 0), la sección C completa se omite —
   comportamiento idéntico al actual para pagos de solo aporte/FPS.
10. **Trazabilidad:** una fila en `pagos_cuotas_aplicaciones` por cada cuota
    tocada, con `created_by = auth.uid()` del usuario que ejecuta el pago.
11. **Saldo del crédito:** se actualiza llamando a la RPC ya existente
    `decrementar_saldo_capital` (no se reimplementa su lógica — cumple la
    instrucción de "actualizar saldo del crédito sin duplicar lógica
    vieja").
12. **Cuota ya pagada:** nunca se selecciona (filtro por `estado` la
    excluye).

---

## Cómo se evita la doble aplicación — Auditoría de duplicados (Fase 10K-3B.1, 2026-07-04)

Antes de decidir la estrategia final contra recibos duplicados (y por lo
tanto contra la doble aplicación de un mismo pago), se auditó
en **solo lectura** el estado real de `pagos_recibos.nro_recibo` en
Supabase remoto (832 filas, sin modificar nada):

| Métrica | Resultado |
|---|---|
| Total `pagos_recibos` | 832 |
| `nro_recibo` NULL | 0 |
| `nro_recibo` vacío (`trim() = ''`) | 0 |
| Duplicados **exactos** (`nro_recibo` idéntico) | **0** |
| Duplicados **normalizados** (`lower(trim(nro_recibo))`) | **0** |

**Conclusión: el terreno está limpio.** Ningún dato existente violaría un
índice único normalizado sobre `nro_recibo`.

## Estrategia elegida — Opción A: índice único parcial normalizado

Con 0 duplicados confirmados, se eligió la **Opción A** (índice único) en
vez de la Opción B (advisory lock sin garantía de schema):

```sql
CREATE UNIQUE INDEX IF NOT EXISTS pagos_recibos_nro_recibo_unique_idx
  ON public.pagos_recibos (lower(trim(nro_recibo)))
  WHERE nro_recibo IS NOT NULL AND trim(nro_recibo) <> '';
```

Este índice se agregó como **Paso 0** de la misma migración local
`20260704120000_10k3b_registrar_pago_con_aplicacion.sql` (no se aplicó,
sigue solo local).

**Por qué es segura:**
- **Parcial** (`WHERE nro_recibo IS NOT NULL AND trim(nro_recibo) <> ''`):
  no afecta ningún caso donde `nro_recibo` pudiera venir vacío en el
  futuro (aunque hoy no hay ninguno).
- **Normalizada** (`lower(trim(...))`): evita que `"R-000123"` y
  `"r-000123 "` cuenten como registros distintos — cierra también el caso
  de variaciones de mayúsculas/espacios que un `UNIQUE` simple no
  detectaría.
- **`CREATE UNIQUE INDEX IF NOT EXISTS`** (no `CONCURRENTLY`): con 832 filas
  el lock breve es aceptable y permite que el índice viva en la misma
  transacción de migración — no se requiere una segunda migración ni
  downtime real.
- **Confirmado con 0 violaciones** antes de proponerlo — si hubiera
  existido aunque sea 1 duplicado, este índice habría fallado al aplicarse
  y se habría optado por la Opción B en su lugar.

**Cambio en la RPC:** la verificación previa de duplicados (paso A.3) ahora
compara `lower(trim(nro_recibo))` (coherente con el índice), y el `INSERT`
del paso B quedó envuelto en un bloque `BEGIN...EXCEPTION WHEN
unique_violation` que traduce cualquier violación del índice (ej. una
carrera real entre dos llamadas simultáneas) al mismo mensaje de negocio
`recibo_duplicado`, en vez de dejar escapar el error crudo de Postgres:

```sql
BEGIN
  INSERT INTO public.pagos_recibos (...) VALUES (...) RETURNING id INTO v_id_pago;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'recibo_duplicado: ya existe un pago registrado con nro_recibo % (detectado por índice único)', trim(p_nro_recibo);
END;
```

**Riesgo residual:** ninguno de fondo — la combinación de verificación
previa (mensaje claro en el caso normal) + índice único real (garantía de
base de datos, cierra la ventana de carrera) + captura de
`unique_violation` (mensaje de negocio incluso en la carrera) cubre los 3
niveles. El único caso no cubierto es que en el futuro legítimamente se
necesite reutilizar un mismo `nro_recibo` para dos pagos distintos (ej. dos
convenios con numeración independiente que coincide) — si eso ocurriera, el
índice lo rechazaría y habría que revisar la regla de negocio real antes de
ajustar el índice. No se detectó ningún caso así en los 832 registros
actuales.

---

## Validaciones implementadas

| # | Validación | Resultado si falla |
|---|---|---|
| 1 | Sesión activa (`auth.uid()` no nulo) | `sin_sesion` |
| 2 | Rol del caller es `admin` o `tesoreria` | `rol_no_autorizado` |
| 3 | `nro_recibo` no vacío | `nro_recibo_requerido` |
| 4 | `id_socio` existe en `socios` | `socio_no_encontrado` |
| 5 | `fecha` no nula | `fecha_requerida` |
| 6 | `periodo` formato `YYYY-MM` | `periodo_invalido` |
| 7 | Monto total (suma de todos los componentes) > 0 | `monto_invalido` |
| 8 | `nro_recibo` no duplicado | `recibo_duplicado` |
| 9 | Si `monto_capital`/`monto_interes` > 0, debe haber `id_credito` | `monto_credito_sin_credito` |
| 10 | `id_credito` (si viene) existe en `creditos` | `credito_no_encontrado` |
| 11 | Crédito no cancelado si trae monto de capital/interés | `credito_cancelado_no_admite_pagos` |

Todas las excepciones son `RAISE EXCEPTION` con mensaje descriptivo —
Postgres hace rollback automático de toda la transacción (incluido el
INSERT de `pagos_recibos`) si cualquiera falla después del punto B.

---

## Por qué `SECURITY DEFINER`

`cronograma_cuotas` y `creditos` tienen policies RLS que solo permiten
`UPDATE` directo a los roles `admin`/`creditos` (ver
`docs/ai-recovery/RLS_AUDIT_RESULT.md`). El usuario que registra un pago
normalmente es de rol **`tesoreria`**, que no está en esa lista. Por eso
esta función necesita `SECURITY DEFINER` — el mismo mecanismo ya usado por
`decrementar_saldo_capital` y `aplicar_ampliacion_credito` para el mismo
problema.

**Consecuencia de seguridad:** al ser `SECURITY DEFINER`, la función
**bypasea RLS por completo** en todas las tablas que toca. Por eso la
sección de validaciones (A.1/A.2) revalida manualmente el rol del caller
contra `usuarios` — exactamente el mismo patrón que `registrar_auditoria`
(SEC-4B) usa para no depender de RLS dentro de una función que ya la
bypasea. `SET search_path = public` fija el schema para evitar ataques de
shadowing de funciones (mismo patrón que SEC-4B).

---

## Riesgos

1. **`SECURITY DEFINER` bypasea RLS en todas las tablas tocadas** —
   mitigado por la revalidación manual de rol (admin/tesoreria) al inicio
   de la función. Si en el futuro se agregan más roles con permiso de
   registrar pagos, hay que actualizar esta whitelist aquí (no solo en el
   frontend).
2. ~~Ausencia de constraint `UNIQUE` en `nro_recibo`~~ — **RESUELTO en Fase
   10K-3B.1** (2026-07-04): se auditó en solo lectura (0 duplicados
   confirmados) y se agregó `pagos_recibos_nro_recibo_unique_idx` (índice
   único parcial normalizado) al Paso 0 de la misma migración local, más
   captura de `unique_violation` en el `INSERT`. Ver sección "Auditoría de
   duplicados" y "Estrategia elegida" más arriba.
3. **Rechazo estricto de crédito cancelado** — si en el futuro aparece un
   caso legítimo de pago sobre crédito cancelado (ej. pago tardío que debe
   registrarse igual), la función lo rechazará. Es una decisión de diseño
   conservadora — se puede relajar más adelante si el usuario confirma la
   regla exacta.
4. **Aporte queda fuera de esta transacción** — un pago mixto
   (crédito + aporte) sigue requiriendo 2 llamadas desde el cliente
   (`registrar_pago_con_aplicacion` + `registrar_aporte_socio`), por lo que
   **no es 100% atómico entre ambos componentes** todavía. Si la primera
   tiene éxito y la segunda falla, el pago y las cuotas quedan aplicados
   pero el aporte no — mismo riesgo residual que existe hoy. Documentado
   explícitamente como pendiente para 10K-3C/10K-3D.
5. **Reemplazo de flujo en producción** — cuando se implemente en la UI
   (10K-3C, no en esta fase), el comportamiento visible cambiará: pagos que
   hoy solo tocan 1 cuota pasarán a tocar varias en cascada. Requiere
   comunicarlo a Tesorería antes de desplegar.
6. **Migración no reversible sin perder trazabilidad futura** — si se hace
   rollback (`DROP FUNCTION`) después de que ya se hayan registrado pagos
   reales con esta RPC, esos pagos y sus filas en
   `pagos_cuotas_aplicaciones` **permanecen** (el rollback solo elimina la
   función, no los datos). Ver sección Rollback.

## Rollback

```sql
DROP FUNCTION IF EXISTS public.registrar_pago_con_aplicacion(
  text, bigint, bigint, bigint, date, text, text, text,
  numeric, numeric, numeric, numeric, numeric, numeric, numeric, text
);
DROP INDEX IF EXISTS public.pagos_recibos_nro_recibo_unique_idx;
```

- **No implica pérdida de datos.** Los pagos ya registrados con esta RPC
  (`pagos_recibos`, `cronograma_cuotas` actualizado, filas en
  `pagos_cuotas_aplicaciones`) permanecen intactos — tanto el `DROP
  FUNCTION` como el `DROP INDEX` solo impiden que se registren *nuevos*
  pagos por esta vía o que se siga protegiendo contra duplicados; no borran
  ninguna fila existente.
- Tras el rollback, el frontend debería volver a usar el flujo actual de 4
  pasos (sin cambios, porque en esta fase **no se modificó**
  `pagos/nuevo/page.tsx`).
- Si solo se quiere revertir el índice (manteniendo la función), es posible
  ejecutar únicamente el `DROP INDEX` — la función seguiría funcionando
  igual, solo perdería la garantía de base de datos y quedaría dependiendo
  exclusivamente de la verificación previa (`SELECT` de A.3).

---

## Escenarios de prueba (para 10K-3D, tras aplicar)

| # | Escenario | Verificación esperada |
|---|---|---|
| 1 | Pago exacto de una cuota | 1 fila en `cuotas_afectadas`, `cuotas_pagadas=1`, `excedente=0`, 1 fila en `pagos_cuotas_aplicaciones` |
| 2 | Pago parcial | `cuotas_parciales=1`, `capital_pagado`/`interes_pagado` incrementados sin superar `capital`/`interes`, `fecha_pago` sigue NULL |
| 3 | Pago que cubre varias cuotas | Cascada: N cuotas en `cuotas_afectadas`, la última puede quedar parcial |
| 4 | Pago con sobrante | Todas las cuotas del crédito quedan pagadas, `excedente > 0`, advertencia presente |
| 5 | Pago sin crédito | La sección C se omite completamente; `cuotas_afectadas=[]`; `pagos_cuotas_aplicaciones` sin filas nuevas |
| 6 | Pago a crédito cancelado con monto de capital | La función lanza `credito_cancelado_no_admite_pagos`; `pagos_recibos` no llega a insertarse (rollback de toda la transacción) |
| 7 | Monto de capital sin `id_credito` | La función lanza `monto_credito_sin_credito` antes de insertar nada |
| 8 | `nro_recibo` duplicado (verificación previa) | La función lanza `recibo_duplicado`; no se crea un segundo pago |
| 8b | `nro_recibo` duplicado con variación de mayúsculas/espacios (ej. `"R-1"` vs `" r-1 "`) | El índice normalizado lo detecta igual; `recibo_duplicado` |
| 8c | Carrera simulada: dos llamadas casi simultáneas con el mismo `nro_recibo` | La segunda es rechazada por el índice único (`unique_violation` capturado) con el mismo mensaje `recibo_duplicado` |
| 9 | Usuario con rol no autorizado (ej. `contabilidad`) llama la RPC directamente | `rol_no_autorizado` |
| 10 | Cuota ya pagada en el cronograma | Se omite automáticamente de la cascada (filtro por `estado`) |

Estas pruebas se ejecutarán en **10K-3D** (prueba controlada apply+revert,
mismo patrón usado en Fase 10J-1 para ampliaciones) — **no en esta fase**.

---

## Qué queda para 10K-3C (UI)

- Refactor de `app/dashboard/pagos/nuevo/page.tsx` para llamar
  `registrar_pago_con_aplicacion` en vez de los pasos 2/3 actuales.
- Mostrar `excedente` y `advertencias` como alerta visible si vienen no
  vacíos.
- Mostrar el resumen de `cuotas_afectadas` (cuántas quedaron pagadas/
  parciales) tras registrar el pago.
- Decidir la UX para el caso `credito_cancelado_no_admite_pagos` (mensaje
  claro al usuario, no un error genérico).
- **No se modifica nada de esto en la fase actual (10K-3B).**

## Qué queda para 10K-3D (o posterior)

- Integrar `monto_aporte` dentro de la misma transacción (evaluar si
  `registrar_aporte_socio` puede llamarse de forma segura desde dentro de
  `registrar_pago_con_aplicacion`, dado que al ejecutarse dentro de una
  función `SECURITY DEFINER` ya bypasea RLS igualmente).
- Prueba controlada apply+revert en un pago de prueba real (incluye probar
  el nuevo índice único con un `nro_recibo` duplicado deliberado).

## Qué NO se toca en esta fase (10K-3B)

- **NO** se aplicó la migración en Supabase remoto — solo existe como
  archivo local en `supabase/migrations/`.
- **NO** se modificó `app/dashboard/pagos/nuevo/page.tsx` ni ningún otro
  componente de UI.
- **NO** se modificó ningún dato real en `pagos_recibos`,
  `cronograma_cuotas`, `creditos`, `pagos_cuotas_aplicaciones`, `socios`,
  `aportes` ni `egresos`.
- **NO** se ejecutó la Fase 10K-2B (apply de los 832 pagos históricos) —
  sigue diferida.
- **NO** se tocó Anexo 6 (`reportes/anexo6/page.tsx`).
- **NO** se tocó seguridad existente (RLS, policies, `auditoria`,
  `usuarios`) — la nueva función respeta el modelo de roles ya vigente, no
  lo modifica.
- **NO** se integró con SEC-4C (audit log) — queda para el final, según lo
  indicado por el usuario.

---

## Archivos de esta fase

- Migración local (NO aplicada): `supabase/migrations/20260704120000_10k3b_registrar_pago_con_aplicacion.sql`
- Este documento: `docs/ai-recovery/PAGOS_CUOTAS_10K_3B_RPC_PLAN.md`
- Matriz: `exports/pagos-cuotas-dryrun/10k_3b_rpc_plan.xlsx`
- Script de verificación: `scripts/check-pagos-cuotas-10k3b-rpc-plan.mjs`
  (`npm run check:pagos-cuotas-10k3b`)

## Acción requerida del usuario

Este plan queda listo para revisión. **No se aplicará nada en Supabase**
hasta recibir la autorización exacta:

```
APLICAR RPC PAGOS NUEVOS 10K-3B
```

Decisiones ya confirmadas por el usuario (no requieren nueva aprobación):
- Créditos cancelados se **rechazan** para pagos nuevos de capital/interés
  (regla 7, sin cambios).
- El aporte **queda fuera** de esta RPC por ahora (Opción D diferida a
  10K-3C/10K-3D, sin cambios).
- La brecha de `nro_recibo` sin protección fuerte quedó **resuelta** en
  esta fase (10K-3B.1) con el índice único — ver secciones "Auditoría de
  duplicados" y "Estrategia elegida" arriba. No queda ninguna pregunta
  abierta pendiente de este punto.
