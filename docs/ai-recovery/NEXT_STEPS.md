# NEXT_STEPS.md

> Próximos pasos recomendados según el estado del proyecto.

## ~~Fase 10K-3B.2 — Hotfix canal_pago (R-K4)~~ ✅ APLICADA Y VALIDADA (2026-07-04)

**Autorización recibida:** `APLICAR HOTFIX CANAL PAGO 10K-3B.2`

**Qué se corrigió:** R-K4 (bug bloqueante que impedía registrar cualquier
pago nuevo) — `registrar_pago_con_aplicacion` ahora normaliza/valida
`p_canal_pago` contra el enum real `canal_pago` (`caja`/`convenio`) y solo
entonces lo castea, en vez de insertar texto plano sin cast (causa de
`42804`).

**Aplicado vía Supabase MCP `apply_migration`** (no `db push`), misma firma
exacta de 10K-3B, mismo `SECURITY DEFINER`/`search_path`/`REVOKE`/`GRANT`.
Migración: `supabase/migrations/20260704140000_10k3b2_hotfix_registrar_pago_canal_pago.sql`.

**Verificado post-apply:** función existe, firma sin cambios, `anon` sin
`EXECUTE`, datos sin cambios (`pagos_recibos`=832, `pagos_cuotas_aplicaciones`=0).

**Prueba controlada 10K-3C.1 repetida con éxito:** pago exacto ✅, pago
parcial ✅, rechazo de recibo duplicado ✅, rechazo de `canal_pago` inválido
✅ (confirma el fix), trazabilidad ✅, rollback ✅ (conteos después
idénticos a antes, 0 datos de prueba persistentes).

**Checks:** `check:pagos-cuotas-10k3b2` 34/34 ✅ · `check:pagos-cuotas-10k3c1`
23/23 ✅ · `check:pagos-cuotas-10k3c` 38/38 ✅ · `check:pagos-cuotas-10k3b`
67/67 ✅ · `smoke:demo-app` 28/28 ✅ · `verify:cejuassa` BUILD OK ✅.

**Docs:** `docs/ai-recovery/PAGOS_CUOTAS_10K_3B2_HOTFIX_CANAL_PAGO.md`
(causa raíz, SQL corregido, verificación post-apply, re-prueba completa).

**No se tocó:** UI, Anexo 6, seguridad existente, `AUDIT_ENABLED`, ninguna
tabla, pagos históricos, 10K-2B (sigue diferida).

**✅ `pagos/nuevo` queda apta para operación.** R-K4 resuelto. Próximo paso
opcional: Fase 10K-3D (integrar aporte en la misma transacción, prueba
controlada de escenarios multi-cuota/crédito cancelado con datos seguros).

---

## ~~🚨 Fase 10K-3C.1 — Prueba controlada EJECUTADA — bug bloqueante en producción~~ ✅ CORREGIDO (ver Fase 10K-3B.2 arriba, 2026-07-04)

**Corregido y re-validado.** El bug bloqueante descrito abajo (hallazgo
original de esta fase) fue corregido en la Fase 10K-3B.2 (hotfix
`canal_pago`, aplicada y validada arriba). Esta sección se conserva como
registro histórico de la ejecución original.

**Qué se hizo:** con autorización explícita `EJECUTAR PRUEBA CONTROLADA
PAGOS 10K-3C.1`, se ejecutó la prueba controlada de
`registrar_pago_con_aplicacion` contra Supabase remoto, como un único
statement SQL autocontenido (`DO $$...$$` que siempre termina en
`RAISE EXCEPTION`, garantizando rollback automático por Postgres sin
depender de que `BEGIN`/`ROLLBACK` en llamadas separadas compartieran
sesión). Usuario de prueba real (no inventado): `55f7e60f...` (rol
`admin`).

**Hallazgo crítico:** el Escenario 1 (pago exacto) falló con
`42804: column "canal_pago" is of type canal_pago but expression is of
type text`. `pagos_recibos.canal_pago` es un enum de Postgres; la RPC
inserta `COALESCE(p_canal_pago, 'caja')` (texto plano) sin castear. Esta
sección se ejecuta para **todo** pago (con o sin crédito) —
**actualmente ningún pago nuevo puede registrarse** a través de la RPC
aplicada en 10K-3B / integrada en 10K-3C.

**Rollback confirmado:** conteos antes/después idénticos
(`pagos_recibos`=832, `pagos_cuotas_aplicaciones`=0, crédito `1134`
saldo=6142.83 sin cambios, cuotas 133/134 sin cambios), 0 recibos de
prueba persistentes.

**Escenarios:** 1 (exacto) abortó por el bug antes de completarse; 2
(parcial) y 4 (rechazo duplicado) no llegaron a ejecutarse (la transacción
ya había abortado); 3 (multi-cuota) y 5 (crédito cancelado) quedaron fuera
del alcance mínimo autorizado.

**Checks:** `check:pagos-cuotas-10k3c1` 23/23 ✅ · `check:pagos-cuotas-10k3c`
38/38 ✅ · `check:pagos-cuotas-10k3b` 67/67 ✅ · `smoke:demo-app` 28/28 ✅ ·
`verify:cejuassa` BUILD OK ✅ (estos son checks estáticos — no ejecutan la
RPC, por eso siguen pasando pese al bug; no lo contradicen).

**Docs:** `docs/ai-recovery/PAGOS_CUOTAS_10K3C1_PRUEBA_CONTROLADA_REPORT.md`
(actualizado con resultados reales, causa raíz completa y plan de hotfix
sugerido).

**No se tocó:** ningún dato real (rollback automático), Anexo 6, seguridad
existente, `AUDIT_ENABLED` (sigue `false`), los 832 pagos históricos, 10K-2B
(sigue diferida). No se usó `db push`, no se aplicó ninguna migración.

**Próxima acción urgente — Fase 10K-3C.2 (o 10K-3B.2):** hotfix de tipo
`canal_pago` en `registrar_pago_con_aplicacion` (agregar
`::canal_pago` explícito al valor insertado). Requiere:
1. Plan completo con el skill `cejuassa-db-plan` (SQL propuesto, riesgos,
   rollback, casos de prueba).
2. Autorización explícita del usuario para aplicar el hotfix.
3. Repetir esta misma prueba controlada (10K-3C.1) tras el hotfix, para
   confirmar los 5 escenarios completos de punta a punta antes de declarar
   `pagos/nuevo` apta para producción.

---

## ~~Fase 10K-3C — UI de pagos nuevos integrada con la RPC~~ ✅ COMPLETADA (2026-07-04)

**Objetivo:** Refactorizar `app/dashboard/pagos/nuevo/page.tsx` para que llame
`registrar_pago_con_aplicacion` (aplicada en Supabase en 10K-3B) en vez del
flujo viejo de 3 pasos no atómicos. Solo código de aplicación — sin
migraciones, sin tocar datos históricos.

**Qué se eliminó del frontend:** insert directo en `pagos_recibos`, llamada
a `decrementar_saldo_capital`, búsqueda/actualización manual de **1 sola
cuota** sin tope ni trazabilidad.

**Qué se agregó:**
- `lib/pagos/registrarPagoConAplicacion.ts` — helper tipado que llama la RPC,
  parsea errores de negocio (`recibo_duplicado`,
  `credito_cancelado_no_admite_pagos`, `credito_no_encontrado`,
  `monto_credito_sin_credito`, etc.) y los traduce a mensajes en español.
- Pantalla de resumen post-registro en `pagos/nuevo/page.tsx`: cuotas
  afectadas/pagadas/parciales, monto aplicado al crédito, alerta de
  excedente (no bloqueante) y advertencias — con botones "Registrar otro
  pago" / "Ver pagos".
- El aporte (`monto_aporte`) sigue llamando `registrar_aporte_socio` por
  separado, **después** de que la RPC de pago tenga éxito — sin cambios de
  comportamiento, sigue siendo una segunda operación no atómica (deuda
  diferida a 10K-3D).

**Checks:** `check:pagos-cuotas-10k3c` 38/38 ✅ · `check:pagos-cuotas-10k3b`
67/67 ✅ · `check:pagos-cuotas-10k3a` 48/48 ✅ · `check:security-master`
49/49 ✅ · `smoke:demo-app` 28/28 ✅ · `verify:cejuassa` BUILD OK ✅ (tsc
limpio; los 8 errores de lint `set-state-in-effect` son preexistentes en 8
archivos no tocados por esta fase).

**No se tocó:** Anexo 6, seguridad existente, `AUDIT_ENABLED` (sigue
`false`), ninguna migración nueva, los 832 pagos históricos (10K-2B, sigue
diferida). No se registraron pagos reales de prueba contra Supabase remoto
— se verificó con `tsc`, `next build`, los checks automatizados y una
verificación visual del route guard (redirección a `/login` sin sesión, sin
errores de consola).

**Docs:** `docs/ai-recovery/PAGOS_CUOTAS_10K_3C_UI_INTEGRATION_REPORT.md`

**Próxima fase recomendada: 10K-3D** (opcional) — prueba controlada
apply+revert con un pago de prueba real contra Supabase (mismo patrón usado
en 10J-1 para ampliaciones), y evaluar si integrar `registrar_aporte_socio`
dentro de la misma transacción de `registrar_pago_con_aplicacion`. Los pagos
nuevos ya pueden registrarse desde la UI con cascada/tope/trazabilidad
completa — 10K-3D no bloquea el uso operativo del flujo nuevo.

---

## ~~Fase 10K-3B — RPC registrar_pago_con_aplicacion~~ ✅ APLICADA EN REMOTO (2026-07-04)

**Autorización recibida:** `APLICAR RPC PAGOS NUEVOS 10K-3B`

**Qué se aplicó** (vía Supabase MCP `apply_migration`, no `db push` — mismo
patrón que SEC-3E/SEC-4B):
- `pagos_recibos_nro_recibo_unique_idx` — índice único parcial normalizado
  sobre `lower(trim(nro_recibo))` (Fase 10K-3B.1).
- Función `registrar_pago_con_aplicacion(...)` — `SECURITY DEFINER`,
  `SET search_path = public`. Registra el pago, valida rol/duplicados/
  crédito cancelado, aplica en cascada contra `cronograma_cuotas` con tope
  exacto por cuota, inserta trazabilidad en `pagos_cuotas_aplicaciones`,
  reutiliza `decrementar_saldo_capital`. NO procesa `monto_aporte` (queda
  para 10K-3C/10K-3D).
- `REVOKE EXECUTE ... FROM anon` explícito (mismo hallazgo de SEC-4B:
  Supabase concede EXECUTE a `anon` por defecto en funciones nuevas).

**Verificación post-apply (solo lectura):**
- Función y índice existen en Supabase (`pg_proc`/`pg_indexes` confirmados).
- `pagos_recibos`: sigue en **832 filas** — sin cambios.
- `pagos_cuotas_aplicaciones`: sigue en **0 filas** — ningún pago se aplicó
  todavía (la función existe pero nadie la ha invocado; la UI sigue usando
  el flujo antiguo hasta 10K-3C).
- `get_advisors` (security): la única advertencia nueva es
  "Signed-In Users Can Execute" (esperado — es el comportamiento
  intencional, solo `authenticated` puede llamarla); **no aparece** el
  hallazgo de `anon` que sí afecta a otras funciones legacy del proyecto —
  confirma que el `REVOKE FROM anon` funcionó.
- Historial de migraciones reconciliado: `supabase migration repair
  --status applied 20260704120000` (la migración se aplicó en remoto bajo
  el timestamp `20260704024854`, igual que el patrón ya documentado en
  SEC-3E para migraciones aplicadas vía MCP en vez de `db push`).

**Checks post-apply:** `check:pagos-cuotas-10k3b` 67/67 ✅ · `check:pagos-cuotas-10k3a` 48/48 ✅ · `check:security-master` 49/49 ✅ · `smoke:demo-app` 28/28 ✅ · `verify:cejuassa` BUILD OK ✅

**Qué sigue sin cambiar:** `app/dashboard/pagos/nuevo/page.tsx` sigue usando
el flujo de 4 pasos de siempre — la nueva RPC existe en la base de datos
pero **todavía no la llama nadie**. Anexo 6, seguridad existente y los 832
pagos históricos (10K-2B, diferida) no fueron tocados.

**Próxima fase: 10K-3C** — refactor de `pagos/nuevo/page.tsx` para llamar
`registrar_pago_con_aplicacion` en vez de los pasos actuales, mostrar
`excedente`/`advertencias`, y decidir la UX para `credito_cancelado_no_admite_pagos`. Requiere su propia autorización.

---

## Fase 10K-3B.1 — Cierre de brecha de duplicados de nro_recibo ✅ COMPLETADA (2026-07-04)

**Objetivo:** Cerrar la brecha detectada en 10K-3B (recibo duplicado
validado solo a nivel de aplicación, sin garantía real de schema) antes de
autorizar el apply de la RPC `registrar_pago_con_aplicacion`.

**Auditoría de solo lectura sobre los 832 `pagos_recibos` existentes:**
0 `nro_recibo` NULL/vacíos, **0 duplicados exactos**, **0 duplicados
normalizados** (`lower(trim(...))`). El terreno está limpio.

**Estrategia elegida: Opción A — índice único parcial normalizado**
(no se necesitó advisory lock, Opción B, porque no había duplicados que
lo justificaran):

```sql
CREATE UNIQUE INDEX IF NOT EXISTS pagos_recibos_nro_recibo_unique_idx
  ON public.pagos_recibos (lower(trim(nro_recibo)))
  WHERE nro_recibo IS NOT NULL AND trim(nro_recibo) <> '';
```

Agregado como Paso 0 de la misma migración local de 10K-3B. La RPC ahora
además captura `unique_violation` del `INSERT` y lo traduce al mismo
mensaje de negocio `recibo_duplicado`, cerrando la ventana de carrera entre
la verificación previa y el `INSERT`.

**Sin cambios en:** rechazo de créditos cancelados (regla 7, se mantiene) ·
aporte diferido a 10K-3C/10K-3D (se mantiene) · nada aplicado en remoto ·
nada tocado en la UI (`pagos/nuevo/page.tsx` sin cambios) · Anexo 6 ·
seguridad existente.

**Artefactos actualizados:**
- Migración local (aún NO aplicada): `supabase/migrations/20260704120000_10k3b_registrar_pago_con_aplicacion.sql`
- `docs/ai-recovery/PAGOS_CUOTAS_10K_3B_RPC_PLAN.md` — secciones "Auditoría de duplicados" y "Estrategia elegida" agregadas
- `exports/pagos-cuotas-dryrun/10k_3b_rpc_plan.xlsx` — hojas actualizadas
- `scripts/check-pagos-cuotas-10k3b-rpc-plan.mjs` → `npm run check:pagos-cuotas-10k3b` — **67/67 PASS**

**Checks finales:** `check:pagos-cuotas-10k3b` 67/67 ✅ · `check:pagos-cuotas-10k3a` 48/48 ✅ · `check:security-master` 49/49 ✅ · `smoke:demo-app` 28/28 ✅ · `verify:cejuassa` BUILD OK ✅

**No se aplicó nada en Supabase remoto.** Con esta brecha cerrada, el plan
10K-3B ya no tiene preguntas abiertas pendientes de bloqueo técnico — queda
lista la solicitud de autorización `APLICAR RPC PAGOS NUEVOS 10K-3B` (sigue
siendo decisión del usuario, no se aplicó automáticamente).

---

## Fase 10K-2A — Revisión final y dry-run de pagos contra cuotas ✅ COMPLETADA (2026-07-04)

**Objetivo:** Generar una propuesta revisable de aplicación de pagos contra cuotas antes
de cualquier apply real. Solo lectura — NINGÚN DATO MODIFICADO.

**Resultado:** Confirma exactamente los mismos números de la Fase 10K-0 (34 propuestas:
8 cuotas PAGADAS + 26 PARCIALES sobre los 28 pagos vinculados a crédito). Se auditaron
además los 832 pagos_recibos totales (28 con `id_credito`, 804 sin) y se confirmó que
`pagos_cuotas_aplicaciones` sigue en 0 filas.

**Casos ambiguos identificados (2, ambos ya documentados):**
1. Pago 411**** (crédito 1138****) — monto S/1,896.96 vs cuota S/285.59 (**R-K2**, pendiente verificación Tesorería).
2. Pago sobre crédito cancelado 1145**** sin cronograma de cuotas.

**Artefactos:**
- `docs/ai-recovery/PAGOS_CUOTAS_10K_2A_DRY_RUN_REPORT.md` — reporte completo
- `exports/pagos-cuotas-dryrun/10k_2a_propuesta_aplicacion_pagos_cuotas.xlsx` — 7 hojas
- `docs/ai-recovery/pagos_cuotas_10k2a_dryrun_preview.json`
- `scripts/dry-run-pagos-cuotas-10k2a.mjs` → `npm run pagos-cuotas-10k2a:dry-run`
- `scripts/check-pagos-cuotas-10k2a-dryrun.mjs` → `npm run check:pagos-cuotas-10k2a` — **43/43 PASS**

**Checks finales:** `check:pagos-cuotas-10k2a` 43/43 ✅ · `check:security-master` 49/49 ✅ · `smoke:demo-app` 28/28 ✅ · `verify:cejuassa` BUILD OK ✅

**No se aplicó nada.** Recomendación: resolver el pago 411**** con Tesorería y los 3
`match_medio` con Créditos antes de solicitar autorización `APLICAR PAGOS A CUOTAS 10K-2`
y diseñar el script real de apply (Fase 10K-2B).

---

## Fase 10K-3B — SQL final (local, NO aplicado) para RPC de pagos nuevos ✅ COMPLETADA (2026-07-04)

**Objetivo:** Producir el SQL final ejecutable de la RPC transaccional
diseñada en 10K-3A, como migración **solo local** — sin aplicarla en
Supabase remoto, sin tocar la UI, sin ejecutar 10K-2B.

**RPC diseñada:** `registrar_pago_con_aplicacion` — hace en una sola
transacción: valida entrada + rol del caller, inserta `pagos_recibos`,
aplica en cascada contra `cronograma_cuotas` (tope exacto por cuota,
`fecha_vencimiento ASC`), inserta trazabilidad en
`pagos_cuotas_aplicaciones`, reutiliza `decrementar_saldo_capital` para el
saldo. El componente de **aporte queda diferido** a 10K-3C/10K-3D (no se
integra en esta RPC para no aumentar el riesgo).

**Por qué `SECURITY DEFINER`:** `cronograma_cuotas`/`creditos` solo
permiten `UPDATE` directo a admin/creditos vía RLS; el rol que registra
pagos es `tesoreria`. Mismo mecanismo que ya usan
`decrementar_saldo_capital` y `aplicar_ampliacion_credito`. Como
`SECURITY DEFINER` bypasea RLS, la función revalida manualmente el rol del
caller (admin/tesoreria) — mismo patrón que `registrar_auditoria` (SEC-4B).

**Evita doble aplicación:** valida que `nro_recibo` no exista ya en
`pagos_recibos` antes de insertar (gap detectado: no existe constraint
`UNIQUE` en el schema actual sobre `nro_recibo` — no se inventó, se dejó
documentado como pregunta abierta para el usuario).

**Artefactos:**
- Migración local (NO aplicada): `supabase/migrations/20260704120000_10k3b_registrar_pago_con_aplicacion.sql`
- `docs/ai-recovery/PAGOS_CUOTAS_10K_3B_RPC_PLAN.md` — plan completo (firma, reglas, validaciones, riesgos, rollback, escenarios de prueba)
- `exports/pagos-cuotas-dryrun/10k_3b_rpc_plan.xlsx` — 6 hojas
- `scripts/generate-pagos-cuotas-10k3b-rpc-plan-excel.mjs` → `npm run pagos-cuotas-10k3b:plan:gen`
- `scripts/check-pagos-cuotas-10k3b-rpc-plan.mjs` → `npm run check:pagos-cuotas-10k3b` — **57/57 PASS**

**Checks finales:** `check:pagos-cuotas-10k3b` 57/57 ✅ · `check:pagos-cuotas-10k3a` 48/48 ✅ · `check:pagos-cuotas-10k2a` 43/43 ✅ · `check:security-master` 49/49 ✅ · `smoke:demo-app` 28/28 ✅ · `verify:cejuassa` BUILD OK ✅

**NO se aplicó nada en Supabase remoto. NO se modificó la UI. NO se ejecutó
10K-2B.** Preguntas abiertas antes de autorizar (ver documento): ¿rechazo
estricto de crédito cancelado es correcto? ¿se necesita `UNIQUE` en
`nro_recibo`? ¿se aprueba diferir el aporte a una fase posterior?

**Autorización pendiente para continuar:** `APLICAR RPC PAGOS NUEVOS 10K-3B`
(solo aplica la RPC en Supabase; la integración con la UI queda para
10K-3C, con su propia autorización).

---

## Fase 10K-3A — Diseño de lógica para pagos nuevos contra cuotas ✅ COMPLETADA (2026-07-04)

**Objetivo:** El usuario decidió que los datos históricos/importados no son
prioridad (se cargarán datos nuevos). Esta fase **difiere 10K-2B** (apply de
los 832 pagos históricos, sin cancelarlo) y diseña, solo a nivel de plan
(sin aplicar SQL), la lógica correcta para que **los pagos nuevos** que se
registren de ahora en adelante se apliquen bien contra las cuotas.

**Auditoría del flujo actual (`app/dashboard/pagos/nuevo/page.tsx`):**
confirma que hoy el sistema **sí intenta** aplicar el pago a una cuota, pero
de forma incompleta: solo actualiza **1 sola cuota** (sin cascada a varias),
**sin tope** por cuota (puede sobre-aplicar capital_pagado/interes_pagado si
el monto supera lo que falta), **sin insertar trazabilidad** en
`pagos_cuotas_aplicaciones` (tabla creada en 10K-1 pero nunca usada por este
flujo), y en **2 escrituras no atómicas** separadas (saldo_capital y cuota).

**Arquitectura recomendada:** RPC transaccional `aplicar_pago_a_cuotas`
(Opción C), consistente con el patrón ya usado por
`decrementar_saldo_capital`, `registrar_aporte_socio` y
`crear_credito_con_cronograma`. Se descartaron aplicación desde frontend
(Opción A, sin atomicidad) y desde API route (Opción B, tampoco atómica
frente a Postgres sin una dependencia nueva de transacciones manuales).

**Reglas de negocio definidas:** cascada por `fecha_vencimiento ASC`,
proporción capital/interés cuando el pago no alcanza, excedente siempre
reportado explícitamente (nunca se pierde ni se inventa una cuota), crédito
sin cuotas pendientes retorna excedente con motivo, trazabilidad 1:1 por
cuota tocada en `pagos_cuotas_aplicaciones`.

**8 escenarios de prueba diseñados:** pago exacto, parcial, varias cuotas,
sobrante, sin crédito, crédito cancelado, mixto crédito+aporte, cuota ya
pagada.

**Artefactos:**
- `docs/ai-recovery/PAGOS_CUOTAS_10K_3A_LOGICA_NUEVOS_PAGOS.md` — diseño completo (flujo actual/propuesto, reglas, arquitectura, SQL boceto, riesgos, rollback, plan por fases)
- `exports/pagos-cuotas-dryrun/10k_3a_matriz_logica_pagos_nuevos.xlsx` — 6 hojas
- `scripts/generate-pagos-cuotas-10k3a-matriz-excel.mjs` → `npm run pagos-cuotas-10k3a:matriz:gen`
- `scripts/check-pagos-cuotas-10k3a-logica.mjs` → `npm run check:pagos-cuotas-10k3a` — **48/48 PASS**

**Checks finales:** `check:pagos-cuotas-10k3a` 48/48 ✅ · `check:pagos-cuotas-10k2a` 43/43 ✅ (sin cambios, no se re-ejecutó el dry-run histórico) · `check:security-master` 49/49 ✅ · `smoke:demo-app` 28/28 ✅ · `verify:cejuassa` BUILD OK ✅

**No se aplicó ningún SQL ni migración.** El SQL de `aplicar_pago_a_cuotas` en
el documento es solo un boceto de diseño. Próxima fase: **10K-3B** — producir
el SQL final ejecutable con el formato completo del skill `cejuassa-db-plan`
(riesgos, rollback exacto, casos de prueba) y **esperar aprobación explícita
del usuario antes de aplicar nada en Supabase.** 10K-2B sigue diferida, no
cancelada — se retomará cuando el usuario lo priorice.

---

## Fase 10K-2A.1 — Paquete de revisión manual para Tesorería/Créditos ✅ COMPLETADA (2026-07-04)

**Objetivo:** Traducir los casos ambiguos de 10K-2A a un documento y Excel
simples para que Tesorería/Créditos puedan decidir sin leer código ni SQL.
Solo documentación — NINGÚN DATO MODIFICADO.

**3 casos documentados con recomendación y preguntas exactas:**
1. Pago 411**** (crédito 1138****) — monto excesivo S/1,896.96 vs cuota S/285.59 (**R-K2**).
2. 3 pagos `match_medio` (412****, 413****, 422****) — crédito propuesto no confirmado.
3. Pago sobre crédito cancelado 1145**** — sin cronograma de cuotas generado.

**Artefactos:**
- `docs/ai-recovery/PAGOS_CUOTAS_10K_2A_REVISION_MANUAL.md` — documento en lenguaje simple
- `exports/pagos-cuotas-dryrun/10k_2a_casos_para_revision_manual.xlsx` — 5 hojas (`resumen_para_tesoreria`, `caso_pago_411`, `match_medio_pendientes`, `credito_cancelado_1145`, `decisiones_requeridas`)
- `scripts/generate-pagos-cuotas-10k2a-revision-manual-excel.mjs` → `npm run pagos-cuotas-10k2a:revision-manual:gen`
- `scripts/check-pagos-cuotas-10k2a-revision-manual.mjs` → `npm run check:pagos-cuotas-10k2a-revision` — **46/46 PASS**

**Checks finales:** `check:pagos-cuotas-10k2a-revision` 46/46 ✅ · `check:pagos-cuotas-10k2a` 43/43 ✅ · `verify:cejuassa` BUILD OK ✅

**No se aplicó nada.** Próximo paso: entregar el Excel a Tesorería/Créditos, esperar
la hoja `decisiones_requeridas` completa, y solo después solicitar la autorización
`APLICAR PAGOS A CUOTAS 10K-2` para diseñar el apply real (Fase 10K-2B).
**10K-2B sigue bloqueada.**

---

## ~~Fase SEC-4B — Aplicar implementación de audit log~~ ✅ APLICADA EN REMOTO (2026-07-03)

**Autorización recibida:** `APLICAR AUDIT LOG SEC-4B`

**Qué se aplicó** (vía Supabase MCP `apply_migration`, no `db push`):
- 5 columnas nuevas en `public.auditoria`: `actor_email`, `actor_rol`, `tabla_afectada`, `metadata`, `ip_hash`
- `auditoria_insert` (INSERT directo) eliminada — solo queda `auditoria_select` (SELECT admin+contabilidad)
- RPC `registrar_auditoria` SECURITY DEFINER creada, con los 7 controles técnicos
  reales descritos en `AUDIT_LOG_IMPLEMENTATION_PLAN.md` (whitelist de acciones/módulos,
  límites de longitud, validación de metadata, rechazo de claves sensibles)

**Hallazgo durante el apply — corregido en el momento:** Supabase configura
`ALTER DEFAULT PRIVILEGES` para conceder `EXECUTE` a `anon`/`authenticated`/`service_role`
automáticamente en funciones nuevas del schema `public`. Esto significa que el
`REVOKE ALL ... FROM PUBLIC` de la migración **no** revocaba el privilegio explícito
de `anon` (no es la pseudo-role `PUBLIC`). Se ejecutó `REVOKE EXECUTE ... FROM anon`
adicional para que solo `authenticated` (y `service_role`, que ya bypassa RLS) puedan
ejecutar la RPC — coincide con el diseño original. Este `REVOKE` se agregó también al
archivo de migración local para que futuros despliegues lo repliquen automáticamente.
Nota: aunque `anon` tenía `EXECUTE`, el control técnico A de la RPC (`auth.uid() IS NULL → RETURN`)
ya impedía cualquier inserción real sin sesión — el hallazgo era una brecha de
permisos, no una vulnerabilidad explotable.

**Verificación post-apply:**
- Tabla `auditoria`: 13 columnas (8 originales + 5 nuevas) — sin pérdida de datos
- Policies: solo `auditoria_select` (admin+contabilidad) — INSERT directo eliminado
- RPC `registrar_auditoria`: `SECURITY DEFINER = true`, ACL final `{postgres, authenticated, service_role}` (sin `anon`)
- `row_count = 0` — cero datos tocados
- `check:audit-log-implementation-plan` → 63/63 PASS
- `check:rls-sec3c` → 41/41 PASS (confirmando que SEC-3C sigue intacto)
- `check:security-master` → 49/49 PASS
- `verify:cejuassa` → BUILD OK

**Estado real de la infraestructura de audit log:**
- ✅ RPC existe en producción y tiene controles técnicos reales
- ❌ `AUDIT_ENABLED` sigue en `false` en `lib/audit/auditClient.ts` — nadie llama a la RPC todavía
- ❌ Ningún módulo integra `registrarAudit()` — eso es SEC-4C, no iniciado

**Sin autorizaciones pendientes de esta sesión.** Próximo paso (opcional, no urgente):
integrar `registrarAudit()` en los módulos definidos en `AUDIT_LOG_IMPLEMENTATION_PLAN.md`
(empezar por `usuarios` o `pagos`), y luego activar `AUDIT_ENABLED = true`.

---

## ~~Fase SEC-4B-ALIGN — Alinear lib/audit/types.ts con whitelist SQL~~ ✅ COMPLETADA (2026-07-03)

**Objetivo:** Antes de autorizar SEC-4B, cerrar la brecha detectada en la revisión
anterior — `types.ts` permitía acciones (`EXPORTAR_BDCC`, `ACTIVAR_USUARIO`,
`DESACTIVAR_USUARIO`) que la RPC endurecida rechazaría en silencio.

**Cambio (solo local, nada remoto tocado):**
- `lib/audit/types.ts` — `AuditAccion`: eliminado `EXPORTAR_BDCC`, reemplazado
  `ACTIVAR_USUARIO`/`DESACTIVAR_USUARIO` por `CAMBIAR_ESTADO_USUARIO`, agregado
  `EDITAR_BENEFICIARIOS`. `AuditModulo`: agregados `beneficiarios` y `ampliaciones`.
  Ahora coincide exactamente (14 acciones / 10 módulos) con la whitelist de la RPC.
- `scripts/check-audit-log-implementation-plan.mjs` — 6 checks nuevos que parsean
  `types.ts` y comparan automáticamente contra la whitelist SQL (detecta futuras
  desincronizaciones sin revisión manual).
- Docs actualizados: `AUDIT_LOG_IMPLEMENTATION_PLAN.md`, `SECURITY_MASTER_STATUS_REPORT.md`.

**Archivo no consumido en ningún otro lugar del código** (`grep` confirmó cero
referencias fuera de `lib/audit/`), por lo que el cambio no afecta ninguna pantalla
ni requiere verificación en navegador.

**Checks:**
- `check:audit-log-implementation-plan` → **62/62 PASS**
- `check:security-master` → **49/49 PASS**
- `verify:cejuassa` → **BUILD OK** (tsc limpio, sin cambios de comportamiento en runtime)

**No se aplicó SEC-4B.** Autorización `APLICAR AUDIT LOG SEC-4B` sigue pendiente —
ahora sobre una RPC endurecida y tipos TypeScript alineados.

---

## ~~Fase SEC-4B-HARDEN — Endurecimiento pre-apply de RPC registrar_auditoria~~ ✅ COMPLETADA (2026-07-03)

**Objetivo:** Antes de autorizar SEC-4B, corregir que la RPC `registrar_auditoria`
afirmaba "sanitizar metadata" solo en un comentario, sin control técnico real.

**Cambios (solo local, nada aplicado en remoto):**
- `supabase/migrations/20260703130000_sec4b_audit_log_implementation.sql` — la RPC ahora
  valida: whitelist de 14 acciones, whitelist de 10 módulos, límites de longitud
  (truncado seguro), metadata debe ser objeto JSON o null, tamaño máximo 4000
  caracteres, y rechaza metadata si alguna clave de primer nivel coincide con
  términos sensibles (dni, password, token, email, telefono, cuenta, etc.)
- `scripts/check-audit-log-implementation-plan.mjs` — 17 checks nuevos que verifican
  los controles técnicos reales de la RPC (no solo su existencia)
- `docs/ai-recovery/AUDIT_LOG_IMPLEMENTATION_PLAN.md` — documenta cada control con su
  implementación exacta y una limitación conocida (el rechazo de claves sensibles
  solo inspecciona el primer nivel del objeto, no objetos anidados)

**Inconsistencia detectada (documentada, no corregida — fuera de alcance):**
`lib/audit/types.ts` incluye `EXPORTAR_BDCC`, `ACTIVAR_USUARIO`, `DESACTIVAR_USUARIO`
que NO están en la whitelist de la RPC — si se llaman, la RPC los rechaza en silencio.
Corregir `types.ts` antes de integrar SEC-4C.

**Checks:** `check:audit-log-implementation-plan`, `check:security-master`,
`check:auditoria-baseline-sec3e`, `verify:cejuassa` — ver resultados abajo en esta sesión.

**No se aplicó SEC-4B.** Autorización `APLICAR AUDIT LOG SEC-4B` sigue pendiente,
ahora sobre una versión endurecida de la RPC.

---

## ~~Fase SECURITY-MASTER-CLEANUP — Verificación del falso fallo smoke:demo-app~~ ✅ COMPLETADA (2026-07-03)

**Objetivo:** Confirmar si `smoke:demo-app` tenía un fallo real (`MODULE_NOT_FOUND`) antes de autorizar SEC-3E.

**Causa raíz:** No era un bug del proyecto. Durante SECURITY-MASTER se invocó por error
`node scripts/smoke-demo-app.mjs` (archivo inexistente) en lugar de usar `npm run smoke:demo-app`,
que apunta correctamente a `scripts/smoke-demo-app-reports.mjs`. El error fue de ejecución manual,
no del código del proyecto.

**Verificación:** `npm run smoke:demo-app` → **28/28 PASS** ✅ (confirmado, sin cambios de código).

**Archivos modificados:** Ninguno en código. Solo esta nota en `NEXT_STEPS.md`.

**Confirmación:** No se tocó DB, RLS, ni lógica financiera. No se requería corrección.

**Resultado de checks post-verificación:**
- `npm run smoke:demo-app` → 28/28 PASS ✅
- `npm run check:security-master` → 49/49 PASS ✅
- `npm run verify:cejuassa` → BUILD OK ✅

**✅ SEC-3E queda desbloqueada** — no había ningún fallo real pendiente de resolver.

---

## ~~Fase SEC-3E — Aplicar baseline de tabla auditoria~~ ✅ APLICADA EN REMOTO (2026-07-03)

**Autorización recibida:** `APLICAR BASELINE AUDITORIA SEC-3E`

**Qué se aplicó:** Migración `sec3e_auditoria_baseline` vía Supabase MCP `apply_migration`
(no vía `db push`, para evitar arrastrar la migración SEC-4B aún no autorizada).

**Verificación post-apply:**
- Tabla `public.auditoria` existe con 8 columnas — sin cambios de estructura (ya existía)
- RLS habilitado, 2 policies (`auditoria_select`, `auditoria_insert`) — igual que antes
- `row_count = 0` — cero datos tocados
- `npm run check:rls-sec3c` → 41/41 PASS
- `npm run check:auditoria-baseline-sec3e` → 40/40 PASS
- `npm run check:security-master` → 49/49 PASS
- `npm run verify:cejuassa` → BUILD OK

**Nota de mantenimiento — historial de migraciones reconciliado:**
Se detectó que SEC-3C (`20260702000010_sec3c_rls_hardening.sql`) había sido aplicada
previamente vía MCP `apply_migration` bajo el timestamp remoto `20260703165058`, no vía
`db push`, por lo que el historial local no la reconocía como aplicada. Se ejecutó
`supabase migration repair --status applied 20260702000010` (contenido verificado idéntico
contra las policies reales en remoto antes de repararlo) y luego
`supabase migration repair --status applied 20260703120000` para SEC-3E. **SEC-4B
(`20260703130000`) permanece intencionalmente sin aplicar** — sigue pendiente de
autorización explícita `APLICAR AUDIT LOG SEC-4B`.

**Próximo paso:** Autorización pendiente: `APLICAR AUDIT LOG SEC-4B` (requiere SEC-3E,
ya cumplido). Después de aplicar SEC-4B, activar `AUDIT_ENABLED = true` en
`lib/audit/auditClient.ts` e integrar `registrarAudit()` en los módulos definidos en
`docs/ai-recovery/AUDIT_LOG_IMPLEMENTATION_PLAN.md`.

---

## ~~Fase SECURITY-MASTER — Hardening integral de seguridad~~ ✅ COMPLETADA (2026-07-03)

**Sesión autónoma que completó todo el bloque de seguridad pendiente.**

**Resultado global:** check:security-master **49/49 PASS** ✅

**Autorizaciones pendientes (en orden):**
```
1. APLICAR BASELINE AUDITORIA SEC-3E
   → supabase/migrations/20260703120000_sec3e_auditoria_baseline.sql (idempotente, segura)

2. APLICAR AUDIT LOG SEC-4B
   → supabase/migrations/20260703130000_sec4b_audit_log_implementation.sql
   → Requiere SEC-3E aplicado primero
   → Después activar: AUDIT_ENABLED = true en lib/audit/auditClient.ts
```

**Decisión pendiente con cooperativa:** ¿Restringir Anexo N°6 a admin+contabilidad?
(cambio frontend seguro de 3 líneas, sin tocar DB — confirmar primero con la cooperativa)

**Reporte completo:** `docs/ai-recovery/SECURITY_MASTER_STATUS_REPORT.md`

---

## ~~Fase SEC-0 — Auditoría integral de seguridad~~ ✅ COMPLETADA (2026-07-02)

**Objetivo:** Auditoría completa de seguridad sin modificar DB ni lógica.

**Resultados:** 27/27 checks ✅ · 4 hallazgos ALTO · 7 MEDIO · 5 BAJO · CERO cambios en DB

**Artefactos:**
- `docs/ai-recovery/SECURITY_AUDIT_REPORT.md` — reporte completo con evidencia
- `docs/ai-recovery/SECURITY_HARDENING_PLAN.md` — plan en 6 fases
- `exports/security/security_risk_matrix.xlsx` — 16 hallazgos con severidad y recomendación
- `scripts/check-security-audit.mjs` → `npm run check:security-audit` — 27/27 PASS

**Hallazgos ALTO:** Sin headers HTTP · xlsx HIGH vulnerability · RLS amplio en tablas nuevas · Roles solo en frontend

**Próxima fase recomendada: SEC-1** (quick wins, sin tocar DB)

---

## ~~Fase SEC-1 — Quick wins de seguridad~~ ✅ COMPLETADA (2026-07-02)

**Resultado:** 21/21 checks ✅ · CERO cambios en DB

**Cambios aplicados:**
- `next.config.ts` — 6 headers HTTP (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS, CSP-Report-Only)
- `.env.example` — creado con placeholders (sin secretos)
- `configuracion/page.tsx` — URL Supabase derivada de `NEXT_PUBLIC_SUPABASE_URL` (sin hardcode)
- `npm audit fix` — dompurify actualizado; xlsx y postcss sin fix disponible
- `scripts/check-security-hardening-sec1.mjs` → `npm run check:security-sec1` — 21/21 PASS

**xlsx riesgo documentado:** HIGH sin fix — riesgo práctico BAJO (solo exporta, no lee archivos externos). Fase futura: DEP-1.

**CSP nota:** Implementada como `Content-Security-Policy-Report-Only`. Migrar a CSP activa con nonces en SEC-1B.

---

## ~~Fase SEC-2 — API/backend hardening~~ ✅ COMPLETADA (2026-07-02)

**Resultado:** 30/30 checks ✅ · CERO cambios en DB

**Cambios aplicados:**
- `lib/api/errors.ts` — helper nuevo: `apiError()` (log servidor, mensaje público genérico) + `apiSuccess()`
- `app/api/usuarios/update/route.ts` — UUID regex validation + activo boolean check + nombre max 200 chars + errors sanitizados
- `app/api/usuarios/invite/route.ts` — email regex + rol whitelist (faltaba) + nombre max 200 chars + errors sanitizados
- `scripts/check-security-api-hardening.mjs` → `npm run check:security-api` — 30/30 PASS
- `docs/ai-recovery/SECURITY_API_HARDENING_REPORT.md` — reporte con endpoints, cambios, rate limiting diferido

**Rate limiting:** Diferido — no confiable en serverless sin Redis. Endpoints protegidos por `requireAdmin()`.

---

## ~~Fase SEC-3A — Auditoría real de RLS remoto~~ ✅ COMPLETADA (2026-07-02)

**Resultado:** 40/40 checks ✅ · CERO cambios en DB · SOLO LECTURA

**Hallazgo clave:** El estado real de RLS es SIGNIFICATIVAMENTE MEJOR que lo esperado en SEC-0. La función `get_user_rol()` ya existe en producción con SECURITY DEFINER. 14 de 16 tablas ya tienen policies granulares por rol. Solo 2 tablas requieren corrección.

**Tablas con policy amplia USANDO (true) — requieren SEC-3C:**
1. `socio_beneficiarios` — cualquier autenticado puede CRUD en beneficiarios
2. `pagos_cuotas_aplicaciones` — cualquier autenticado puede CRUD en trazabilidad financiera

**Función helper:** `get_user_rol()` ya existe en prod como SECURITY DEFINER. No hay que crearla en SEC-3B.

**Tablas sin migración local** (creadas directamente en Dashboard): `auditoria`, `cartera_mes`, `cartera_resumen_mes`, `validacion_cuadre_mes` → crear en SEC-3E.

**Artefactos:**
- `docs/ai-recovery/RLS_AUDIT_RESULT.md` — auditoría completa por tabla con riesgo y recomendación
- `docs/ai-recovery/RLS_HARDENING_PLAN.md` — plan SEC-3B a SEC-3F con SQL y rollback
- `exports/security/rls_audit_matrix.xlsx` — 56 filas (2 ALTO, 1 BAJO-MEDIO, 53 BAJO)
- `scripts/check-rls-audit.mjs` → `npm run check:rls-audit` — **40/40 PASS**

---

## ~~Fase SEC-4A — Diseño de audit log para operaciones críticas~~ ✅ COMPLETADA (2026-07-03)

**Objetivo:** Diseñar un sistema de auditoría operativa para CEJUASSA. Solo diseño — sin tocar DB ni código funcional.

**Resultado:** 50/50 checks ✅ · CERO cambios en DB · CERO migraciones

**Hallazgos clave:**
- La tabla `auditoria` YA EXISTE en Supabase (sin migración local) — SELECT+INSERT abierto a autenticados
- No está en uso activo desde la app — ningún componente inserta en ella actualmente
- Decisión: AMPLIAR (no crear tabla nueva) — modelo con 11 campos propuestos
- Implementación recomendada: RPC `registrar_auditoria` SECURITY DEFINER (híbrido con API routes)
- 15 operaciones críticas definidas en 9 módulos

**Artefactos:**
- `docs/ai-recovery/AUDIT_LOG_DESIGN_PLAN.md` — plan completo de diseño
- `exports/security/audit_log_scope.xlsx` — matriz de 15 operaciones con criticidad y riesgo
- `scripts/check-audit-log-design.mjs` → `npm run check:audit-log-design` — 50/50 PASS

**Próximas fases de implementación (requieren autorización):**
- **SEC-3E:** Migración local de sincronización de tabla `auditoria` (prerequisito técnico)
- **SEC-4B:** `ALTER TABLE auditoria ADD COLUMN IF NOT EXISTS ...` + RPC `registrar_auditoria` + nueva policy SELECT (admin+contabilidad) + revocar INSERT directo
- **SEC-4C:** Integración en módulos de alta criticidad (creditos, pagos, egresos, usuarios)
- **SEC-4D:** Integración en módulos de criticidad media (socios, ampliaciones, configuración)
- **SEC-4E:** Pantalla de visualización para admin

---

## ~~Fase SEC-3C — Policies por rol en 2 tablas~~ ✅ COMPLETADA (2026-07-03)

**Resultado:** 41/41 checks ✅ · Aplicada en remoto `ljdjbhsipgkxlgnprzhm` · 0 datos tocados

**Modelo de permisos aplicado:**

| Tabla | admin | tesoreria | creditos | contabilidad |
|---|---|---|---|---|
| `socio_beneficiarios` | CRUD | SELECT/INSERT/UPDATE | SELECT | SELECT |
| `pagos_cuotas_aplicaciones` | CRUD | SELECT/INSERT | SELECT | SELECT |

**Cambios aplicados:**
- `socio_beneficiarios`: eliminada `autenticados_pueden_operar` → 4 policies granulares (`sb_select`, `sb_insert`, `sb_update`, `sb_delete`)
- `pagos_cuotas_aplicaciones`: eliminada `autenticados_pueden_operar_pca` → 4 policies granulares (`pca_select`, `pca_insert`, `pca_update`, `pca_delete`)
- Todas usan `get_user_rol()` con roles explícitos
- SELECT usa `get_user_rol() IN ('admin','tesoreria','creditos','contabilidad')`
- UPDATE tiene `USING` + `WITH CHECK`
- RLS sigue `ENABLED: true` en ambas tablas

**Artefactos:**
- `supabase/migrations/20260702000010_sec3c_rls_hardening.sql` — migración con rollback documentado
- `scripts/check-rls-sec3c.mjs` → `npm run check:rls-sec3c` — 41/41 PASS
- Rollback en comentario de la migración (restaura policies amplias si emergencia)

**Checks post-apply todos ✅:**
- `npm run check:rls-sec3c` — 41/41
- `npm run check:rls-audit` — 40/40
- `npm run check:security-api` — 30/30
- `npm run audit:ui-roles` — 34/34
- `npm run smoke:demo-app` — 28/28

**Próxima fase recomendada: SEC-3D** (migrar `TO public` → `TO authenticated` en 14 tablas — cosmético, baja prioridad)

---

## ~~Fase QA-OPS-0 — Auditoría operativa completa + Manual HTML~~ ✅ COMPLETADA (2026-07-02)

**Objetivo:** Auditar el sistema como operador real. Sin tocar DB.

**Resultados:** 24/24 Playwright ✅ · 23 capturas · 0 errores JS · manual HTML completo · reporte QA con matriz de pruebas

**Artefactos:** `exports/qa-ops/screenshots/` · `exports/qa-ops/manual/manual_usuario_cejuassa.html` · `exports/qa-ops/reports/QA_OPERATIVA_CEJUASSA.md` · `scripts/check-qa-ops-audit.mjs`

**Check:** `npm run check:qa-ops-audit` → **15/15 PASS**

**Hallazgos:** 0 críticos · 0 altos nuevos · 2 medios preexistentes · 3 bajos

**Próxima fase recomendada: POST-QA** — Mejoras de UX operativo:
1. Validaciones client-side en formularios (Zod / react-hook-form)
2. Trazabilidad completa de pagos a cuotas (Fase 10K-2)
3. Notificación de cuotas próximas a vencer
4. Recálculo de cronograma en ampliaciones (Fase 10J-3)

---

## ~~Fase UI-PRO-1 — Rediseño visual integral de todas las pantallas~~ ✅ COMPLETADA (2026-07-02)

**Objetivo:** Extender la línea visual UI-PRO-0B (dashboard) a todos los módulos secundarios del sistema.

**Componentes nuevos en `ui.tsx`:** `PageFrame`, `PageToolbar`, `FilterBar`, `DataTableShell`, `DataTableHeader`, `DataTableEmpty`, `DetailHero`, `DetailSection`, `FieldGrid`, `FieldItem`, `FormPanel`, `FormSection`, `ActionStrip`, `InlineAlert`, `FinancialValue`, `RiskBadge`, `CompactStat`, `RecordMeta`

**Pantallas rediseñadas:** socios, créditos, pagos, aportes, egresos, cartera, mora, convenios, ampliaciones (listados) + socios/[id], créditos/[id], cartera/[id], convenios/[id], aportes/[id] (detalles) + socios/nuevo, socios/editar, créditos/nuevo, créditos/editar, pagos/nuevo, SocioForm (formularios) + reportes, usuarios, configuración

**Patrón aplicado:** `PageFrame` (fondo slate-50) → `PageToolbar` → `FilterBar` → `DataTableShell` con `DataTableHeader` y `DataTableEmpty`. Detalles con `DetailHero` (borde navy izquierdo) + `DetailSection` + `FieldGrid`/`FieldItem`. Formularios con `FormPanel` + `FormSection` + `ActionStrip`.

**No tocado:** `reportes/anexo6/page.tsx`, `lib/supabase.ts`, `lib/api/`, `app/api/`, cálculos financieros, RPC calls, lógica de pagos/aportes, roles/permisos, DB.

**Check:** `npm run check:ui-pro-redesign` → **24/24 PASS**. `tsc --noEmit` OK. `build` OK.

**Test Playwright:** `e2e/ui-pro-screenshots.spec.ts` creado. Screenshots path: `exports/ui-pro/screenshots/`.

---

## ~~Fase UI-PRO-0 — Rediseño visual profesional y dashboard moderno~~ ✅ COMPLETADA (2026-07-02)

**Objetivo:** Eliminar apariencia genérica IA, dirección visual institucional, gráficos profesionales.

**Cambios implementados:**
- `app/dashboard/_components/ui.tsx` — 7 componentes nuevos: `MetricCard`, `SectionHeader`, `ChartCard`, `EmptyChartState`, `StatusBadge`, `TrendIndicator`, `MiniStat`
- `app/dashboard/page.tsx` — Dashboard refactorizado: usa los nuevos componentes, charts mejorados (axes limpios, sin grids verticales, paleta de colores corregida), AccesoRapido con Tailwind hover puro
- Gráficos: AreaChart usa brand blue `#1A56DB` (antes verde oscuro `#2D5A27`); BarChart egresos → `#94A3B8` neutro; PieChart con `strokeWidth={0}` limpio; CartesianGrid `vertical={false}`

**Documentación:**
- `docs/ai-recovery/CEJUASSA_UI_PRO_DESIGN_DIRECTION.md` — guía de dirección visual completa
- `scripts/check-ui-pro-redesign.mjs` — verificación automática
- `npm run check:ui-pro-redesign` → **26/26 PASS**

**Skills usadas:** `emil-design-eng` (filosofía de diseño institucional). TypeScript: 0 errores. DB/lógica financiera: no tocada.

---

## ~~Fase UI-0/UI-1 — Modernización visual minimalista~~ ✅ COMPLETADA (2026-06-30)

**Enfoque elegido:** Minimalismo institucional financiero — sobrio, limpio, legible.

**Páginas modernizadas:** socios, créditos, pagos, aportes.

**Componentes creados:** `app/dashboard/_components/ui.tsx`
- `PageHeader` — encabezado consistente con slot de acción
- `EmptyState` — estado vacío con icono + jerarquía
- `TableSkeleton` — skeleton de filas para loading en tabla
- `ResultCount` — contador de resultados
- Constantes: `btnPrimary`, `btnGhost`, `btnEdit`, `btnDanger`, `inputCls`, `selectCls`

**Patrón aplicado:**
- h1 unificado: `text-xl font-semibold text-slate-800`
- Botones con press feedback: `active:scale-[0.97] transition-transform`
- Tablas: siempre con skeleton loading + EmptyState en tbody (mantiene headers visibles)
- Colores: `gray-*` → `slate-*` en tablas/borders
- Banners DEMO preservados, lógica financiera intacta

**Scripts y docs:**
- `npm run audit:ui-modernization` — 38/38 PASS
- `docs/ai-recovery/CEJUASSA_UI_MODERNIZATION_GUIDE.md` — guía completa de diseño

**Checks:** audit:ui-roles 34/34 ✅ · smoke:demo-app 28/28 ✅ · test:e2e:smoke 3/3 ✅ · tsc OK

**Próxima fase:** UI-2 — detalle de crédito, mora, cartera, egresos, formularios.

---

## ~~Fase QUOTE-0 — Cotización realista del software CEJUASSA~~ ✅ COMPLETADA (2026-06-30)

Documento generado: `docs/ai-recovery/CEJUASSA_SOFTWARE_COTIZACION_MERCADO_PERUANO.md`

**Valorización del sistema:**
- Escenario A (valor conservador): **S/ 12,000 – S/ 18,000**
- Escenario B (sistema operativo completo): **S/ 22,000 – S/ 28,000**
- Escenario C (con BDCC oficial SBS): **S/ 38,000 – S/ 55,000**
- Mantenimiento mensual recomendado: **S/ 800 – S/ 1,200 / mes**
- Infraestructura (cargo al cliente): ~**S/ 50–S/ 250 / mes**
- Checks ejecutados: `audit:tooling-setup` 23/23 · `smoke:demo-app` 28/28 · `verify:cejuassa` BUILD OK

**Próximo paso comercial sugerido:** Presentar el Resumen Ejecutivo al cliente junto con la demo del sistema.

---

## ~~Fase TOOLING-0 — Auditoría e instalación segura de herramientas~~ ✅ COMPLETADA (2026-06-30)

- Playwright instalado (`@playwright/test@1.61.1`), config mínima, 3 smoke tests
- Skills de frontend ya disponibles: `emil-design-eng`, `animation-vocabulary`, `review-animations`
- Context7 documentado — pendiente configuración MCP por el usuario
- Superpowers y Caveman pendientes — requieren confirmación del usuario
- Nuevo comando: `npm run audit:tooling-setup`
- Ver: `docs/ai-recovery/TOOLING_AND_SKILLS_SETUP.md`

**Próximo paso inmediato (TOOLING-0 post):**
- [ ] Correr `npx playwright install chromium` para habilitar los tests e2e
- [ ] Confirmar qué son "Superpowers" y "Caveman" para instalación
- [ ] Opcional: configurar Context7 MCP siguiendo instrucciones del documento

---

## ~~Fase 10J-1 — Ampliaciones funcionales apply~~ ✅ COMPLETADA (2026-06-24)

**RPC `aplicar_ampliacion_credito` aplicada en Supabase.** Prueba controlada apply+revert OK — 14/14 PASS.

- **Qué hace:** INSERT en `ampliaciones` + UPDATE en `creditos` (nro_pagare, monto_aprobado, saldo_capital) — atómico con row lock.
- **Qué NO toca:** `cronograma_cuotas`, `pagos_recibos`, `socios`, `aportes`, `egresos`.
- **UI:** `AmpliacionesSection.tsx` — modo `apply` con campo "Monto a ampliar", vista previa en tiempo real, advertencia roja de cronograma, botón "Aplicar ampliación".
- **Scripts:** `ampliaciones-funcionales:dry-run` · `ampliaciones-funcionales:apply` · `check:ampliaciones-funcionales` 51/51 ✅
- **Nota:** tipo `creditos.id` es `integer` (no UUID). La migración local fue corregida.

---

## ~~Fase 10J-2A — Ajuste visible de alcance final~~ ✅ COMPLETADA (2026-07-02)

**Cambios aplicados (solo UI/labels — sin tocar DB ni lógica):**
- `reportes/page.tsx`: BDCC movido a sección "Archivado / fuera de alcance"; Anexo N°6 queda como único reporte regulatorio principal.
- `reportes/bdcc/page.tsx`: Banner ⚠️ "BDCC/TXT fuera de alcance actual" agregado al inicio. Código preservado — no borrado.
- `creditos/[id]/page.tsx`: label "Tasa Interés Anual" → "Tasa TEA"
- `creditos/nuevo/page.tsx`: label "Tasa de Interés Anual (%)" → "Tasa de interés TEA (%)"
- `creditos/[id]/editar/page.tsx`: label "Tasa de Interés Anual (%)" → "Tasa de interés TEA (%)"
- `check-alcance-final-contadora.mjs`: sección 9 agregada (valida BDCC fuera de nav, banner, TEA labels).

**Confirmaciones de la cooperativa (2026-07-02):**
- BDCC/TXT: fuera del alcance actual.
- Reporte regulatorio activo: solo **Anexo N°6**.
- Tasa de interés: **TEA** (Tasa Efectiva Anual).
- Tipos de crédito: consumo / convenio.
- Ampliaciones: cuota, plazo y tasa se cambian manualmente.

**Checks:** `check:alcance-final-contadora` ✅ · lint ✅ · tsc ✅

---

## ~~Fase 10J-2B — Ampliaciones: cuota/plazo/tasa editables~~ ✅ COMPLETADA (2026-07-02)

**Estado:** Migración aplicada en Supabase. Prueba apply+revert OK — 16/16 PASS. Checks 65/65 ✅.

**Qué se hizo:**
- `ampliaciones.tasa_nueva numeric(8,4) NULL` — columna nueva en Supabase ✅
- `ampliaciones.cuota_nueva numeric(12,2) NULL` — columna nueva en Supabase ✅
- RPC `aplicar_ampliacion_credito` extendida: recibe y valida `p_tasa_nueva`, `p_cuota_nueva`; actualiza `creditos.plazo_meses`, `tasa_interes`, `cuota_mensual`
- UI `AmpliacionesSection.tsx`: campos Tasa TEA y Cuota Nueva agregados al formulario apply; vista previa muestra 6 campos antes/después; valores actuales pre-poblados al abrir el form
- Props nuevas en página detalle: `plazoMeses`, `tasaInteres`, `cuotaMensual`
- Listado histórico: muestra `tasa_nueva` y `cuota_nueva` (fallback `—` para registros anteriores)
- Scripts: `test-ampliaciones-funcionales.mjs` y `check-ampliaciones-funcionales.mjs` actualizados para 10J-2B

**Qué NO toca:** `cronograma_cuotas`, `pagos_recibos`, `socios`, `aportes`, `egresos`.

**Registros históricos anteriores a 10J-2B:** `tasa_nueva` y `cuota_nueva` quedan NULL — la UI muestra `—` sin error.

---

## ~~Fase 10K-0 — Diseño seguro de aplicación de pagos a cuotas~~ ✅ COMPLETADA (2026-07-02)

**Resultado:** Auditoría, dry-run con cascada y documentación completa. NINGÚN DATO MODIFICADO.

**Hallazgos clave:**
- Las tablas actuales SON SUFICIENTES para aplicar pagos (no hace falta migración para el apply básico).
- Falta campo `id_pago` en `cronograma_cuotas` — recomendado para trazabilidad, no bloqueante.
- **25 de 28 pagos son MIXTOS** (crédito + aporte/FPS en mismo recibo) — riesgo contable confirmado: el split ya existe en los campos de `pagos_recibos`.
- Con algoritmo de cascada: **8 cuotas PAGADAS** + **26 PARCIALES** en dry-run.
- Monto aplicable = `monto_capital + monto_interes` (excluye aporte/FPS/otros).
- Scripts: `npm run plan:pagos-cuotas` · `npm run check:pagos-cuotas-plan` **63/63 PASS**.
- Docs: `docs/ai-recovery/PAGOS_CUOTAS_APPLICATION_PLAN.md`.

**Pendientes antes del apply (Fase 10K-2):**
1. ✅ Trazabilidad diseñada y aplicada en Supabase — Fase 10K-1 completada.
2. ⏳ Confirmar los 3 match_medio con área de Créditos.
3. ⏳ Verificar pago 411**** (monto S/1,896.96 para cuota de S/285.59) con Tesorería.

---

## ~~Fase 10K-1 — Trazabilidad segura de pagos aplicados a cuotas~~ ✅ COMPLETADA (2026-07-02)

**Resultado:** Tabla intermedia `pagos_cuotas_aplicaciones` diseñada. Migración local lista. NINGÚN DATO MODIFICADO.

**Decisión:** Modelo B (tabla intermedia) elegido sobre Modelo A (`id_pago` en cuota).
- Modelo A descartado: no soporta múltiples pagos parciales sobre una cuota, ni un pago aplicado a varias cuotas.
- Modelo B soporta: N pagos → 1 cuota, 1 pago → N cuotas, auditoría completa, rollback granular.

**Migración local:** `supabase/migrations/20260702000003_create_pagos_cuotas_aplicaciones.sql`

**Checks:** `check:pagos-cuotas-traceability` **39/39 PASS** ✅

**Migración aplicada en Supabase** — tabla `pagos_cuotas_aplicaciones` operativa en producción (`ljdjbhsipgkxlgnprzhm`). Historial Local + Remote sincronizado (12/12 migraciones en sync).

---

## ~~Fase ANEXO6-0 — Comparación exacta vs modelo contadora~~ ✅ COMPLETADA (2026-07-02)

**Resultado:** **DIFERENTE** (84 diferencias — todas corregibles sin tocar DB).

**Hallazgos clave:**
- El modelo de la contadora tiene 60 columnas SBS exactas en hoja `MARZO2026 sin CEROS`
- La app tiene 60 columnas en la misma posición pero con **nombres abreviados incorrectos**
- Las Col50–Col60 en la app son nombres placeholder (`Col50`…`Col60`) — el modelo real tiene los encabezados SBS oficiales (COVID, DL N°1508, IMPULSO MYPERU)
- Nombre de hoja incorrecto: app exporta `Anexo6` / modelo usa `MARZO2026 sin CEROS`
- **NO se tocó DB, migraciones ni lógica financiera**

**Archivos generados:**
- `exports/anexo6-comparison/anexo6_diferencias.xlsx` — 5 hojas con análisis completo
- `docs/ai-recovery/ANEXO6_COMPARISON_CONTADORA_REPORT.md` — reporte ejecutivo
- `scripts/compare-anexo6-with-contadora.mjs` + `check-anexo6-comparison.mjs`
- `npm run compare:anexo6-contadora` · `npm run check:anexo6-comparison` 8/8 ✅

**Checks:** smoke:report-exports 37/0/3⚠ · smoke:demo-app 28/0 ✅ · check:anexo6-comparison 8/8 ✅

---

## ~~Fase ANEXO6-1 — Corrección de encabezados (solo UI, sin DB)~~ ✅ COMPLETADA (2026-07-02)

**Objetivo:** Corregir los 28 nombres de columna en `handleExportar` para que coincidan exactamente con el modelo SBS de la contadora. Sin tocar DB ni lógica financiera.

**Cambios requeridos en `app/dashboard/reportes/anexo6/page.tsx`:**

| # | App actual | SBS correcto |
|---|---|---|
| 2 | `Apellidos y Nombres` | `Apellidos y Nombres / Razón Social` |
| 6 | `Sigla Empresa` | `Sigla de la Empresa` |
| 13 | `Relación Laboral Coop.` | `Relación Laboral con la Cooperativa` |
| 14 | `Clasificación Deudor` | `Clasificación del Deudor` |
| 15 | `Clasif. Alineam. Interno` | `Clasificación del Deudor con Alineamiento Interno` |
| 16 | `Código Agencia` | `Código de Agencia` |
| 17 | `Moneda` | `Moneda del crédito` |
| 32 | `Cta. Contable Cap. Contingente` | `Cuenta Contable del Capital Contingente` |
| 34 | `Saldo Garantías Preferidas` | `Saldos de Garantías Preferidas` |
| 35 | `Saldo Garantías Autoliquidables` | `Saldos de Garantías Autolíquidables` |
| 38 | `Saldo Créditos Castigados` | `Saldo de Créditos Castigados` |
| 39 | `Cta. Contable Créd. Castigado` | `Cuenta Contable del Crédito Castigado` |
| 44 | `N° Cuotas Programadas` | `Número de Cuotas Programadas` |
| 45 | `N° Cuotas Pagadas` | `Número de Cuotas Pagadas` |
| 46 | `Periodicidad de la Cuota` | `Periodicidad de la cuota` |
| 48 | `Fecha Vencimiento Original` | `Fecha de Vencimiento Original del Crédito` |
| 49 | `Fecha Vencimiento Actual` | `Fecha de Vencimiento Actual del Crédito` |
| 50 | `Col50` | `Saldo de Créditos con Sustitución de Contraparte Crediticia` |
| 51 | `Col51` | `Saldo de Créditos que no cuentan con cobertura` |
| 52 | `Col52` | `Saldo Capital de Créditos Reprogramados` |
| 53 | `Col53` | `Saldo Capital en Cuenta de Orden por efecto del Covid` |
| 54 | `Col54` | `Subcuenta de orden` |
| 55 | `Col55` | `Rendimiento Devengado por efecto del COVID 19` |
| 56 | `Col56` | `Saldo de Garantías con Sustitución de Contraparte` |
| 57 | `Col57` | `Saldo Capital de Créditos Reprogramados por efecto del COVID 19` |
| 58 | `Col58` | `Saldo de Créditos dentro del alcance del DL N°1508` |
| 59 | `Col59` | `Saldo Capital en Cuenta de Orden Programa IMPULSO MYPERU` |
| 60 | `Col60` | `Rendimiento Devengado por Programa IMPULSO MYPERU` |

**Pendiente confirmar con contadora:**
- [ ] Nombre de hoja: ¿debe ser `MARZO2026 sin CEROS` o formato fijo (ej. `Anexo6`)?
- [ ] Nombre de archivo: ¿`Anexo6_CEJUASSA_032026.xlsx` o convención `1106_03_Anexo_6_...`?
- [ ] Cuántas hojas debe tener el archivo (modelo tiene 3: datos + Hoja6 + NA)

**Resultado ANEXO6-1:** ✅ 28 encabezados corregidos · 0 diferencias · 20/20 checks · build OK · sin tocar DB.

**Pendiente confirmar con contadora (no bloqueante para uso interno):**
- [ ] Nombre de hoja: la app genera `MMMYYYY sin CEROS` (ej. `JULIO2026 sin CEROS`) — confirmar si SBS acepta este formato
- [ ] Nombre de archivo: la app genera `Anexo6_CEJUASSA_MMYYYY_sin_ceros.xlsx` — confirmar convención oficial

---

## ~~Fase 10J-2C — Corregir mensajes obsoletos de ampliaciones~~ ✅ COMPLETADA (2026-07-02)

**Cambio:** Solo UI/texto — sin tocar DB, RPC ni lógica financiera.

- `app/dashboard/ampliaciones/page.tsx`: banner ámbar "Registros informativos / No modifican automáticamente" → banner azul "Ampliaciones funcionales" con descripción real + instrucción de dónde registrar.
- `scripts/check-ampliaciones-funcionales.mjs`: 7 checks de texto agregados (sección 10J-2C).
- **Checks:** `check:ampliaciones-funcionales` PASS · `smoke:demo-app` 28/0 ✅ · build OK ✅

---

## Fase 10K-2 — Apply controlado de pagos a cuotas

**Bloqueado hasta:** ✅ migración 10K-1 aplicada · ✅ dry-run final 10K-2A completado · ⏳ confirmación match_medio (área Créditos) · ⏳ verificación pago 411**** (Tesorería).

**Autorización requerida:** `APLICAR PAGOS A CUOTAS 10K-2`

**Script futuro:** `scripts/apply-pagos-cuotas.mjs` (NO crear todavía — Fase 10K-2B).

**Propuesta de referencia:** `docs/ai-recovery/PAGOS_CUOTAS_10K_2A_DRY_RUN_REPORT.md` (Fase 10K-2A, 2026-07-04).

---

## Fase 10J-3 — Próximos pasos en ampliaciones (sugerido)

**Opciones a confirmar con la cooperativa:**
- Recalcular cronograma de cuotas al ampliar (requiere RPC adicional + validación con contabilidad)
- Visualizar el historial de ampliaciones en el módulo global de créditos (página lista)
- Reporte de ampliaciones por período

---

<!-- SECCIÓN ARCHIVADA: plan técnico original 10J-2B
**GAPs técnicos (Fase 10J-1 no los cubría):**
plazo_meses / tasa_interes / cuota_mensual no se actualizaban → resuelto en 10J-2B.
```sql
-- PROPUESTA — NO APLICAR SIN APROBACIÓN DEL USUARIO
ALTER TABLE public.ampliaciones
  ADD COLUMN IF NOT EXISTS tasa_nueva   numeric(8,4),
  ADD COLUMN IF NOT EXISTS cuota_nueva  numeric(12,2);
```

### B) RPC extendida:
Agregar `p_tasa_nueva` y `p_cuota_nueva` a `aplicar_ampliacion_credito`.
UPDATE en `creditos` debe incluir `plazo_meses`, `tasa_interes`, `cuota_mensual`.
INSERT en `ampliaciones` debe incluir `tasa_nueva`, `cuota_nueva`.

### C) UI actualizada:
- Nuevos campos: "Tasa nueva TEA (%)" y "Cuota nueva (S/)" en formulario `apply`
- Vista previa antes/después: pagaré, monto, saldo, plazo, tasa, cuota
- El usuario ingresa cuota manualmente — sin recálculo automático

### D) ~~Label TEA~~ ✅ COMPLETADO (Fase 10J-2A, 2026-07-02):
- `creditos/nuevo/page.tsx` → "Tasa de interés TEA (%)"
- `creditos/[id]/editar/page.tsx` → "Tasa de interés TEA (%)"
- `creditos/[id]/page.tsx` → "Tasa TEA"

### E) ~~BDCC~~ ✅ COMPLETADO (Fase 10J-2A, 2026-07-02):
- Banner "BDCC/TXT fuera de alcance actual" agregado en `reportes/bdcc/page.tsx`
- BDCC removido de la sección principal de `reportes/page.tsx` — solo visible en sección "Archivado"

**Restricciones absolutas:** NO tocar `cronograma_cuotas` · NO tocar `pagos_recibos` · NO recalcular cuotas automáticamente · NO crear migraciones sin autorización

**Scripts:** `npm run plan:alcance-final-contadora` · `npm run check:alcance-final-contadora`

**Documento:** `docs/ai-recovery/COOPERATIVA_RESPUESTAS_FINALES_ALCANCE.md`

---

## Fase 10I — BDCC: corregir archivos BD01 y BD02-A según Oficio SBS N°32791-2026

**Estado:** Análisis completado (Fase 10I-0, 2026-06-24). Pendiente de confirmaciones con contadora antes de implementar.

**Hallazgos críticos del análisis:**

| Problema | Severidad | Acción |
|---|---|---|
| BD01_HDR falta 10 campos: DAKR, CCSIN, CCSID, CCSIS, FPPK, FCC, FUK, FUINT, CCSD, OSD | CRÍTICO | Agregar campos tras confirmar valores con Contabilidad |
| CCRF y CCCO en BD01 ponen `''` vacío pero NO pueden estar vacíos | CRÍTICO | Confirmar con Contabilidad qué valor para créditos no reestructurados/no contingentes |
| BD02A_HDR falta: SCOM, SIM, SCA (deben ser 0.00) | CRÍTICO | Agregar campos |

**Preguntas a confirmar con la contadora (P1–P8) antes de implementar:**
1. **P1/P2:** ¿Qué valor va en CCRF y CCCO cuando el crédito no está reestructurado/no es contingente?
2. **P3:** ¿Cuáles son las cuentas contables para CCSIN (interés vigente), CCSID (diferido), CCSIS (suspendido)?
3. **P4:** ¿FPPK es la fecha de vencimiento de primera cuota o la fecha real del primer pago?
4. **P5:** ¿TPINT debe ser tasa nominal anual o TEA? (valor DB actual: 26.82%)
5. **P6:** ¿Los créditos de CEJUASSA son todos "consumo"? ¿Cuál cuenta va en CCSD?
6. **P7:** ¿CEJUASSA registra seguros de desgravamen? (para SCOM/SIM/SCA)
7. **P8:** ¿El campo `interes_amortizado_pagado` de `pagos_recibos` corresponde exactamente al IAP SBS?

**Fases de implementación (NO empezar sin respuestas a P1–P8):**
- **10I-1:** Confirmar con contadora (acción del equipo, no código)
- **10I-2:** Corregir BD01_HDR y BD02A_HDR + lógica de campos nuevos
- **10I-3:** Validaciones y botón "Generar trimestre completo" (3 meses + ZIP)
- **10I-4:** BD02-B y BD04 (si hay cancelados en período)
- **10I-5:** Validación final + envío SFTP antes del 20/07/2026

**Documento de análisis completo:** `docs/ai-recovery/BDCC_SBS_32791_2026_ANALYSIS.md`

---

## ~~Fase 10F — Pre-entrega técnica y hardening final~~ ✅ COMPLETADA (2026-06-24)

**Script creado:** `scripts/pre-demo-readiness-check.mjs` → `npm run check:pre-demo-readiness`

**Resultado de checks:**
- `check:pre-demo-readiness` → **46/46 PASS** ✅
- `audit:form-validations` → **68/68 PASS** ✅
- `smoke:demo-app` → **28/28 PASS** ✅
- `smoke:report-exports` → **37/37 PASS** (3 WARN esperados por datos demo) ✅
- `audit:ui-roles` → **34/34 PASS** ✅
- `audit:post-excel-import` → **0 críticos** ✅
- TypeScript → OK ✅ · BUILD → OK ✅

**Estado verificado:**
- Variables de entorno (URL, ANON_KEY, SERVICE_ROLE_KEY) — todas SET ✅
- proxy.ts activo — rutas /dashboard/* protegidas ✅
- BDCC: banner DEMO prominente visible ✅
- Anexo 6: banner datos demo visible ✅
- Todas las rutas del sidebar tienen page.tsx (13/13) ✅
- Backups pre-reset y demo-regulatory ambos existen con JSONs ✅
- Scripts apply todos con guards --authorized ✅
- Service role confinado en requireAdmin.ts + rutas /api/usuarios/* ✅

**Riesgos conocidos para contadora (no bloquean el demo):**
- 1 socio con DNI `SINDNI` — pendiente DNI real
- 804 pagos con id_credito NULL — no asociados manualmente
- género/estado_civil socios = demo (M/soltero) — temporales
- subtipo_credito_sbs = 'por_confirmar' — requiere catálogo SBS

**→ La app está lista para prueba con la contadora.**

---

## ~~Fase 10G — Pulido visual/UX pre-demo~~ ✅ COMPLETADA (2026-06-24)

**Objetivo:** Pulir la experiencia visual antes de la reunión con la contadora. Sin tocar DB.

**Mejoras aplicadas:**
- **Egresos**: estado vacío informativo — "Aún no se han registrado egresos." con guía para rol editor
- **Socios/Créditos**: empty state distingue DB vacía vs búsqueda sin resultados
- **Pagos**: empty state contextual con botón "Limpiar filtros" inline
- **Aportes**: empty state muestra período y tipo de ausencia (búsqueda vs período vacío)
- **Cartera**: botón "Limpiar filtros" cuando hay filtros activos; empty state contextual
- **Ampliaciones**: título homogeneizado con el resto de módulos

**Script creado:** `scripts/audit-demo-ux-polish.mjs` → `npm run audit:demo-ux-polish`

**Checks:**
- `audit:demo-ux-polish` → **60/60 PASS** ✅
- `smoke:demo-app` → **28/28 PASS** ✅ · `smoke:report-exports` → **37/37 PASS** ✅
- `audit:form-validations` → **68/68 PASS** ✅ · `audit:ui-roles` → **34/34 PASS** ✅
- BUILD OK ✅ · TypeScript OK ✅

**Restricciones:** CERO DB · CERO migraciones · CERO lógica financiera. Solo UI/UX.

---

## ~~Fase 10H-1 — Correcciones visuales críticas pre-demo~~ ✅ COMPLETADA (2026-06-24)

**Objetivo:** Corregir display de nombres (MAYÚSCULAS→Title Case) y contraste de selects en reportes antes de la reunión con la contadora.

**Implementado:**
- `lib/formatNombre.ts` → `formatNombrePersona(apellidos, nombres)` — Title Case, trim, sin inventar datos
- 15 archivos actualizados con el helper (socios, créditos, pagos, aportes, cartera, mora, egresos, etc.)
- `reportes/bdcc/page.tsx` — 2 selects corregidos con `text-gray-800 bg-white`
- Script: `npm run audit:pre-demo-visual-fixes` → **52/52 PASS** ✅

**Nota importante — corrección de datos en DB:**
Los apellidos como `CHAVEZÑIQUE` (sin espacio interno) están así en la DB porque el Excel fuente los tenía así. La corrección VISUAL ya está aplicada (Title Case). Para corregir el espacio interno en los datos se requiere:
1. Confirmar el nombre correcto en el padrón de socios (fuente confiable)
2. Emitir el comando: `APLICAR CORRECCION NOMBRES 10H-1`
3. El agente preparará un dry-run con los casos específicos

**Checks:**
- `audit:pre-demo-visual-fixes` → **52/52 PASS** ✅
- `smoke:demo-app` → **28/28 PASS** ✅ · `smoke:report-exports` → **37/37 PASS** ✅
- `audit:form-validations` → **68/68 PASS** ✅ · TypeScript OK ✅

---

## Fase 10H — Post-demo: acciones del equipo (después de reunión con contadora)

**Estas acciones las realiza el equipo operativo, no requieren más código:**
1. **Tesorería:** ingresar género y estado civil reales de socios en módulo Socios.
2. **Créditos:** confirmar si TPINT es TEA o nominal; confirmar códigos TIPCRED/SUBTIPCRED del catálogo SBS.
3. **Créditos:** resolver los 3 pagos match_medio pendientes (Excel en `exports/data-corrections/revision_pagos_match_medio.xlsx`).
4. **Contabilidad:** confirmar cuentas contables CCVE y CCJU para BD01.
5. **Con esos datos:** generar BD01 y BD02-A para marzo 2026 y junio 2026, revisar fila por fila antes del 20/07/2026.

---

## ~~Fase 10E — Endurecer formularios, validaciones y UX de errores~~ ✅ COMPLETADO (2026-06-23)

*(ver sección correspondiente en AI_HANDOFF.md)*

---

## ~~Fase 10D-1B — Pantalla global de ampliaciones~~ ✅ COMPLETADO (2026-06-23)

- Ruta: `app/dashboard/ampliaciones/page.tsx` — historial global solo lectura
- Filtros: socio, pagaré, crédito, fecha desde/hasta, limpiar filtros
- Roles: admin, creditos, contabilidad, tesoreria (solo lectura)
- Sidebar actualizado con enlace "Ampliaciones"
- `check:ampliaciones-global` 20/20 PASS · BUILD OK · TypeScript OK

## ~~Fase 10E — Endurecer formularios, validaciones y UX de errores~~ ✅ COMPLETADO (2026-06-23)

**Correcciones aplicadas:**
- `SocioForm`: validación JS de DNI (7-8 dígitos), nombres/apellidos requeridos, `maxLength={8}` en input DNI.
- `BeneficiariosSection`: validación porcentaje (0-100), DNI formato si se ingresa; `confirm()` reemplazado por inline confirm Sí/No; error de delete visible.
- `AmpliacionesSection`: `confirm()` reemplazado por inline confirm Sí/No; error de delete capturado y mostrado.
- `creditos/nuevo`: validación nro_pagare requerido, tasa no negativa; validaciones JS explícitas.
- `pagos/nuevo`: validación montoTotal > 0; validación JS de formato periodo YYYY-MM.
- `egresos`: error de delete capturado y mostrado en banner dismissible.
- Script: `scripts/audit-form-validations.mjs` → `npm run audit:form-validations` → **68/68 PASS**.
- Ningún archivo de DB/migraciones tocado.
- Verificaciones: `audit:form-validations` 68/68 ✅ · `smoke:demo-app` 28/28 ✅ · `smoke:report-exports` 37/37 ✅ · `audit:ui-roles` 34/34 ✅ · TypeScript OK ✅ · BUILD OK ✅

## ~~Prioridad 1 — Protección de rutas (seguridad básica)~~ ✅ COMPLETADO (2026-06-17)

**Hallazgo**: `proxy.ts` ya existía en la raíz con la implementación correcta.
En Next.js 16.0.0, `middleware.ts` fue deprecado y reemplazado por `proxy.ts`.
El build confirma `ƒ Proxy (Middleware)` activo. No fue necesario crear ningún archivo.

- `proxy.ts`: `createServerClient` + `supabase.auth.getUser()` + redirect a `/login` si sin sesión.
- Matcher: excluye `api`, `_next/static`, `_next/image`, `favicon.ico`.
- R1 marcado como resuelto en `RISKS_AND_BUGS.md`.

## ~~Prioridad 1 (nueva) — Matriz de roles y permisos — Fase 2B-1~~ ✅ COMPLETADO (2026-06-17)

Guards de rol implementados en formularios críticos:
- `creditos/nuevo/page.tsx` → `['admin', 'creditos']`
- `creditos/[id]/editar/page.tsx` → `['admin', 'creditos']`
- `pagos/nuevo/page.tsx` → `['admin', 'tesoreria']`
- lint / tsc / build: todos pasaron sin errores nuevos.

## ~~Fase 2B-2: Guard en egresos~~ ✅ COMPLETADO (2026-06-17)

- `egresos/page.tsx`: botones Nuevo/Editar/Eliminar ocultos para roles sin permiso (`contabilidad`, `creditos`)
- Roles permitidos: `['admin', 'tesoreria']`
- Guards defensivos en `openNuevo`, `openEditar`, `handleDelete`
- Contabilidad y Créditos siguen viendo la lista en modo lectura
- lint / tsc / build: todos pasaron sin errores nuevos

## ~~Fase 2B-3: UX — Ocultar botones en listas~~ ✅ COMPLETADO (2026-06-17)

- `socios/page.tsx` → "Nuevo Socio" y "Editar" visibles solo a `['admin', 'creditos']`
- `creditos/page.tsx` → "Nuevo Crédito" y "Editar" visibles solo a `['admin', 'creditos']`
- `pagos/page.tsx` → "Registrar Pago" visible solo a `['admin', 'tesoreria']`; Ver/PDF para todos
- lint / tsc / build: todos pasaron sin errores nuevos

## ~~Fase 2B-4: Corregir enlace roto en aportes~~ ✅ COMPLETADO (2026-06-17)

- `aportes/page.tsx` → botón "Nuevo Aporte" (404) reemplazado por "+ Registrar aporte vía pago" → `/dashboard/pagos/nuevo`
- Visible solo a `['admin', 'tesoreria']`; resto de roles no lo ve
- lint / tsc / build: todos pasaron sin errores nuevos

## ~~Fase 2B-5 — Sidebar por rol~~ ✅ COMPLETADO (2026-06-17)

- `app/dashboard/layout.tsx` → `getVisibleItems(rol, loading)` filtra `navItems` según rol
- admin: todo; tesoreria: sin Usuarios/Config; creditos: sin Egresos/Usuarios/Config; contabilidad: sin Convenios/Usuarios/Config
- lint / tsc / build: todos pasaron sin errores nuevos

## ~~Fase 3A — Auditoría de R7~~ ✅ COMPLETADA (2026-06-17)

- Auditado el flujo completo de pagos y cuotas con `/cejuassa-risk-review`.
- Identificado bug exacto: filtro `.eq('estado','pendiente')` excluía `vencida` y `parcial`.
- Confirmada regla de negocio: pagos parciales son acumulativos.

## ~~Fase 3B — Corrección acumulativa de R7~~ ✅ COMPLETADA (2026-06-17)

- Implementado en `app/dashboard/pagos/nuevo/page.tsx`, bloque del paso 3.
- Filtro cambiado a `.in('estado', ['pendiente','vencida','parcial'])`.
- Lógica acumulativa: `capital_pagado_nuevo = capital_pagado_anterior + montoCapital`.
- Estado determinado por comparación de acumulados vs. montos de la cuota.
- `fecha_pago` solo asignado cuando la cuota queda completamente `pagada`.
- lint sin errores nuevos + tsc limpio + build limpio.

## ~~Fase 4A — Diseño de atomicidad financiera: R5, R6 y R8~~ ✅ COMPLETADA (2026-06-17)

Diseño completo con `/cejuassa-db-plan`. SQL/RPC propuesto, revisado externamente con Opus. No aplicado.

- **R5**: RPC `decrementar_saldo_capital(p_id_credito, p_monto)` — UPDATE atómico con row lock implícito
- **R6**: RPC `registrar_aporte_socio(p_id_socio, p_id_recibo, p_fecha, p_monto, p_observacion)` — advisory lock por socio
- **R8**: RPC `crear_credito_con_cronograma(p_credito JSONB, p_cuotas JSONB)` — transacción implícita plpgsql

## ~~Fase 4B-0 — Guardar SQL propuesto y auditar fallback~~ ✅ COMPLETADO (2026-06-17)

1. SQL de las 3 RPCs guardado en `docs/sql-proposals/` (no aplicado en Supabase).
2. Fallback de RPC A auditado en `pagos/nuevo/page.tsx` (líneas 251-267).
3. **Riesgo crítico detectado**: el fallback se activa con CUALQUIER error de la RPC, incluyendo errores de negocio (`P0001`). Si RPC A lanza 'sobrepago', el fallback ejecuta `Math.max(0, saldo - monto)` incorrectamente.
4. Fix propuesto: verificar `saldoErr.code !== '42883'` antes de ejecutar el fallback.

Ver documentación completa en `docs/sql-proposals/README.md` y `docs/sql-proposals/TEST_PLAN_RPC.md`.

## ~~Fase 4B-1 — Blindar fallback de RPC A en frontend~~ ✅ COMPLETADO (2026-06-17)

- `pagos/nuevo/page.tsx` líneas 251-271: fallback ahora verifica `saldoErr.code === '42883' || saldoErr.code === 'PGRST202'`.
- Errores de negocio de la RPC (`P0001`, RLS, etc.) abortan el submit con mensaje al usuario.
- Riesgo residual documentado: el recibo (`pagos_recibos`) se inserta antes de la RPC — si la RPC falla, el recibo queda sin efecto sobre el saldo. No resuelto en esta fase.
- lint: preexistentes, sin errores nuevos. tsc: limpio. build: limpio (27/27 páginas).

## ~~Fase 4B-1.5 — Validación de sobrepago antes del insert del recibo~~ ✅ COMPLETADO (2026-06-17)

- `pagos/nuevo/page.tsx` líneas 201-204: si `credito && montoCapital > 0 && montoCapital > credito.saldo_capital`, el submit aborta antes de insertar el recibo con mensaje: _"El monto capital (S/ X.XX) supera el saldo disponible del crédito (S/ Y.YY)."_
- Mitiga el escenario principal de recibo huérfano por sobrepago desde la UI.
- Riesgo residual: saldo obsoleto por concurrencia — permanece pero es de baja probabilidad en operación normal.
- lint: preexistentes, sin errores nuevos. tsc: limpio. build: limpio (27/27).

## ~~Fase 4B-2 — Aplicar RPC A en Supabase~~ ✅ COMPLETADO (2026-06-17)

- Usuario aplicó `docs/sql-proposals/02_decrementar_saldo_capital.sql` en Supabase Dashboard.
- Pruebas completadas: monto válido ✓, monto 0 ✗ (correcto), negativo ✗ (correcto), sobrepago ✗ (correcto), app ✓, RLS ✓.
- R5 marcado como RESUELTO en `RISKS_AND_BUGS.md`.

## ~~Fase 4C-0 — Automatización de verificación local~~ ✅ COMPLETADO (2026-06-17)

- Creado `scripts/verify-cejuassa.mjs`: ejecuta lint (no bloqueante) → tsc → build (bloqueantes).
- Agregado `"verify:cejuassa": "node scripts/verify-cejuassa.mjs"` a `package.json`.
- **No se configuró hook automático** — build tarda ~15s; dispararlo en cada Stop haría el flujo lento. Usar `/update-config` si se desea habilitar el hook de Stop en el futuro.

## ~~Fase 4D-0 — Automatización segura de migraciones~~ ✅ COMPLETADO (2026-06-17)

- Supabase CLI no estaba instalado — documentado en `docs/sql-proposals/AUTOMATION_GUIDE.md`.
- Creada estructura `supabase/migrations/` con archivos de migración locales:
  - `20260617000000_create_decrementar_saldo_capital.sql` (RPC A — registro histórico)
  - `20260617000001_create_registrar_aporte_socio.sql` (RPC B — pendiente de aplicar)
- Creado script de prueba: `docs/sql-proposals/tests/test_rpc_b_registrar_aporte_socio.sql`
- Agregados scripts a `package.json`: `db:status` y `db:push` (requieren CLI instalado)
- `verify:cejuassa` no fue modificado.

## ~~Fase 4D-1 — Configurar Supabase CLI~~ ✅ COMPLETADO (2026-06-17)

- CLI disponible via `npx supabase` (v2.107.0) — sin instalación global.
- Login realizado: `Token cli_Kevin@DESKTOP-TFF9A7T` creado.
- Proyecto linkeado: `npx supabase link --project-ref ljdjbhsipgkxlgnprzhm` → `Finished supabase link.`
- Directorio de trabajo confirmado: `C:\Users\Kevin\coopac-cejuassa`

## ~~Fase 4D-2 — Reparar historial de migraciones~~ ✅ COMPLETADO (2026-06-17)

- Creado placeholder local `supabase/migrations/20260605112510_remote_existing_migration_placeholder.sql` (no-op — alinea historial con migración remota preexistente).
- Ejecutado `npx supabase migration repair --status applied 20260617000000` → RPC A marcada como aplicada en historial remoto.
- `npx supabase migration list` confirma historial alineado:
  - `20260605112510` → Local + Remote ✅
  - `20260617000000` → Local + Remote ✅
  - `20260617000001` → solo Local (RPC B pendiente) ⏳
- `npx supabase db push --dry-run` confirma que **solo se aplicaría `20260617000001_create_registrar_aporte_socio.sql`**.
- R6 sigue activo. No se ejecutó `db push`.

## ~~Fase 4B-3T2 — Pruebas automáticas de RPC B mejoradas~~ ✅ COMPLETADO (2026-06-17)

- Script mejorado con 3 niveles de prueba:
  - **L1** (`npm run test:rpc:b`): monto=0 y monto<0 rechazados — sin datos — siempre seguro
  - **L2** (`npm run test:rpc:b:happy`): happy path DB-layer — requiere `CEJUASSA_ALLOW_TEST_WRITES=true` — crea socio+recibo+aporte TEST marcados como `TEST_RPC_B_AUTO`
  - **L3** (`npm run test:rpc:b:auth`): RLS/auth real — requiere `CEJUASSA_TEST_EMAIL` y `CEJUASSA_TEST_PASSWORD`
- L2 bypa RLS (service role) — L3 valida que la RPC sea accesible para usuarios autenticados.
- `npm run test:rpc:b:happy -- --cleanup` limpia socios + recibos + aportes TEST.

## ~~Fase 4B-3T — Pruebas automáticas de RPC B~~ ✅ COMPLETADO (2026-06-17)

- Script `scripts/test-rpc-b-aportes.mjs` creado (mejorado en 4B-3T2).

## ~~Fase 4B-3 — Integrar y aplicar RPC B (`registrar_aporte_socio`)~~ ✅ COMPLETADO (2026-06-17)

- `npx supabase db push --dry-run` confirmó solo `20260617000001`.
- `npx supabase db push` aplicó la migración exitosamente.
- `migration list` confirma `20260617000001` en Local + Remote.
- `pagos/nuevo/page.tsx` líneas 323-339: bloque de aportes reemplazado por `supabase.rpc('registrar_aporte_socio', {...})`. SELECT de último aporte, cálculo manual de saldos e INSERT directo eliminados.
- tsc limpio + build 27/27. Sin errores nuevos.
- R6 RESUELTO.

## ~~Fase 4B-4A — Auditoría de R8 y diseño de RPC C~~ ✅ COMPLETADA (2026-06-17)

- Flujo actual auditado: 2 inserts sin transacción en `creditos/nuevo/page.tsx` (líneas 127-198).
- RPC C `crear_credito_con_cronograma` diseñada en `docs/sql-proposals/03_crear_credito_con_cronograma.sql` — revisada por Opus.
- Campos exactos para `p_credito` y `p_cuotas` documentados.
- Riesgo detectado: SQL original omitía `capital_pagado`/`interes_pagado` en el insert del cronograma.

## ~~Fase 4B-4B — Migración local RPC C~~ ✅ COMPLETADA (2026-06-17)

- Creada `supabase/migrations/20260617000002_create_crear_credito_con_cronograma.sql`.
- Fix aplicado: `capital_pagado` e `interes_pagado` añadidos al INSERT del loop de cuotas con `COALESCE(NULLIF(..., '')::NUMERIC, 0)`.
- `npx supabase db push --dry-run` confirma: **solo** `20260617000002` pendiente.
- `npm run verify:cejuassa`: tsc limpio + build 27/27. Sin errores nuevos.
- **NO ejecutado `db push`** — pendiente aprobación del usuario.

## ~~Fase 4B-4C — Aplicar RPC C en Supabase~~ ✅ COMPLETADA (2026-06-17)

- `npx supabase db push --dry-run` confirmó solo `20260617000002`.
- `npx supabase db push` aplicó la migración exitosamente.
- `npx supabase migration list` confirma `20260617000002` en Local + Remote.
- Build limpio. R8 sigue activo hasta refactor frontend (Fase 4B-4E).

## ~~Fase 4B-4D — Script de pruebas automáticas RPC C~~ ✅ COMPLETADA (2026-06-17)

- `scripts/test-rpc-c-credito-cronograma.mjs` creado con 3 niveles.
- L1 (`npm run test:rpc:c`): 5/5 PASS. Confirmado: RPC existe, rollback funciona, cero datos TEST.
- `package.json`: agregados `test:rpc:c`, `test:rpc:c:happy`, `test:rpc:c:auth`.
- **⚠ HALLAZGO CRÍTICO (T3)**: la columna `tipo_credito` en la tabla `creditos` es un tipo ENUM (`tipo_credito`), no TEXT. La función desplegada lanza `42804` (datatype mismatch) al asignar `p_credito->>'tipo_credito'` sin cast. **Fix requerido en la función antes de la Fase 4B-4E**.

## ~~Fase 4B-4D.1 — Hotfix cast ENUM tipo_credito~~ ✅ COMPLETADA (2026-06-17)

- Creada `supabase/migrations/20260617000003_fix_tipo_credito_cast.sql`.
- Fix: `NULLIF(p_credito->>'tipo_credito', '')::tipo_credito` — maneja null Y string vacío de forma segura.
- `db push --dry-run` confirmó solo `20260617000003`. `db push` aplicado.
- `migration list` confirma `20260617000003` en Local + Remote.
- `npm run test:rpc:c` L1: **5/5 PASS**. T3 ahora falla por FK real (socio inexistente), no por cast ENUM. Build limpio.

## ~~Fase 4B-4D.2 — Happy path RPC C~~ ✅ COMPLETADA (2026-06-17)

- Detectado segundo ENUM: `estado` en `cronograma_cuotas` es tipo `estado_cuota`.
- Hotfix aplicado: migración `20260617000004_fix_estado_cuota_cast.sql`.
- Happy path L2: **13/13 PASS** — crédito TEST + 3 cuotas creados y verificados.
- Cleanup automático: cuotas → crédito → socio TEST eliminados.
- Cero datos TEST residuales confirmados.

## ~~Fase 4B-4E — Refactorizar `creditos/nuevo/page.tsx`~~ ✅ COMPLETADA (2026-06-17)

- `app/dashboard/creditos/nuevo/page.tsx` refactorizado: 2 inserts directos reemplazados por `supabase.rpc('crear_credito_con_cronograma', { p_credito, p_cuotas })`.
- `p_credito`: id_socio, nro_pagare, fecha_desembolso, monto_aprobado, monto_girado_neto, descuentos, tasa_interes, plazo_meses, cuota_mensual, tipo_credito, interes_acumulado.
- `p_cuotas`: array con nro_cuota, fecha_vencimiento, capital, interes, cuota_total, capital_pagado=0, interes_pagado=0, estado='pendiente'.
- `npm run test:rpc:c` L1: 5/5 PASS. `npm run verify:cejuassa`: tsc limpio + build 27/27.
- **R8 RESUELTO.**

## ~~Fase 4B-4F — Marcar R8 resuelto~~ ✅ COMPLETADA (incluida en 4B-4E)

## ~~Fase 5A.1 — Conectar tasas de provisión en Anexo 6~~ ✅ COMPLETADO (2026-06-17)

- `app/dashboard/reportes/anexo6/page.tsx`: `getClasificacion(dias, tasas)` ahora recibe tasas como parámetro.
- En `handleGenerar`: lee `configuracion` id=1 antes del cálculo; usa variable local `tasasActivas` (no depende de `setState` async).
- Fallback: si la query falla → `TASAS_DEFECTO` (valores SBS estándar) + banner amarillo de advertencia.
- Banner: visible cuando se usan tasas por defecto, con enlace a `/dashboard/configuracion`.
- Test automático: `npm run test:provision:config` — 15/15 PASS.
- tsc limpio + build 27/27. Sin errores nuevos.

## ~~Fase 5A.2 — Propagar tasas a `cartera` y `dashboard`~~ ✅ COMPLETADO (2026-06-17)

- `app/dashboard/cartera/page.tsx`: `getTasaProvision(clasificacion, t)` ahora recibe `TasasProvision`. Fetch de config al inicio de `fetchCartera` (useCallback). Banner visible si falla.
- `app/dashboard/page.tsx`: `getTasaProvision(dias, t)` ahora recibe `TasasProvision`. Fetch de config al inicio de `fetchAll` (useEffect). Banner visible justo antes de la sección Provisiones.
- tsc limpio + build 27/27. Sin errores nuevos.
- R2 completamente resuelto — Anexo 6 + Cartera + Dashboard.

## ~~Fase 5B.1 — Cerrar R4: helper requireAdmin + validación de roles + auditoría automática~~ ✅ COMPLETADO (2026-06-18)

- `lib/api/requireAdmin.ts` creado: `getAdminClient()` + `requireAdmin(request)` — único punto de acceso al service role.
- `app/api/usuarios/invite/route.ts`: funciones locales eliminadas, usa `requireAdmin`.
- `app/api/usuarios/update/route.ts`: funciones locales eliminadas, usa `requireAdmin`, validación de lista blanca de roles.
- `scripts/audit-service-role-usage.mjs`: escanea `.ts/.tsx/.js/.mjs/.cjs`, reporta WARNINGs si service role aparece en zonas no permitidas.
- `package.json`: agregado `"audit:service-role"`.
- Todos los tests pasaron: `audit:service-role` OK, `test:provision:config` 15/15, `test:rpc:b` 2/2, `test:rpc:c` 5/5, `verify:cejuassa` tsc+build limpio.
- R4 marcado como RESUELTO.

## ~~Prioridad 2 — Revisar Bug B3~~ — MITIGADO (Fase 6A.1, 2026-06-18)

B3 mitigado con transparencia: campo propio `provision_constituida`, banner naranja de advertencia, confirmación antes de exportar Excel y script `npm run check:provision:constituida` (10/10 PASS). El placeholder es explícito en código — ya no es silencioso.

---

## Fase 7A — Auditoría documental — ✅ COMPLETADA (2026-06-18)

Archivos reales del cliente analizados. Ver:
- `docs/ai-recovery/CLIENT_FILES_AUDIT.md` — inventario completo + hallazgos
- `docs/ai-recovery/SBS_BDCC_REPORTS_PLAN.md` — plan regulatorio BDCC SBS

**Hallazgos críticos:**
- B3-Opción C **queda PAUSADA** — la auditoría reveló que Provisiones Constituidas = Genéricas + Específicas registradas contablemente (S/16,800.91 + S/295,171.84 = S/311,972.75). No son calculables automáticamente. **Requiere campo mensual en DB, no por clasificación.**
- **Nueva urgencia máxima: BDCC SBS** — Oficio N°32791-2026-SBS requiere 6 archivos TXT por mes antes del **20/07/2026**. La app no tiene ningún módulo para esto.
- **No crear campos de provisiones constituidas hasta decisión contable confirmada.**

---

## Fase 7B-0 — Ajuste de roadmap — ✅ COMPLETADA (2026-06-18)

**Decisión del usuario:** El historial BDCC 2024/2025 queda fuera del alcance actual y se trabajará como proyecto futuro separado.

- Creado `docs/ai-recovery/ACCOUNTING_QUESTIONS_BDCC_B3.md` — preguntas para el contador/cliente.
- BDCC histórico 2024/2025 → **proyecto futuro separado** (no implementar en esta fase).
- 7H (importación histórica masiva) → **no implementar por ahora**.
- B3 sigue MITIGADO, no resuelto definitivamente.
- No implementar exportadores BDCC hasta confirmar datos mínimos (ver documento de preguntas).

**Prioridad actual (en orden):**
1. Resolver preguntas contables/regulatorias (ver `ACCOUNTING_QUESTIONS_BDCC_B3.md`)
2. Planificar Fase 7C — campos mínimos en DB
3. Implementar migraciones mínimas solo después de aprobación del cliente
4. BDCC actual 2026 después de confirmar datos mínimos

---

## ~~Fase 8A-1 — Cerrar B3 formalmente en Anexo 6~~ ✅ COMPLETADA (2026-06-20)

- `provision_constituida_fuente` cambiado a `'criterio_contable_confirmado'` en `reportes/anexo6/page.tsx`.
- Banner naranja → nota informativa azul: "Provisiones Constituidas calculadas igual a Provisiones Requeridas según criterio confirmado por Contabilidad."
- Mensaje inline "sin fuente contable" eliminado de la tabla.
- `window.confirm` eliminado de `handleExportar`.
- Script `check-provision-constituida.mjs` actualizado: 10 checks alineados al nuevo criterio.
- `npm run check:provision:constituida` 10/10 PASS. `npm run verify:cejuassa` tsc + build limpios.
- B3 cerrado. No se creó SQL, migración ni tabla `provisiones_mensuales`.

---

## Fase 7B — B3 definitivo — CRITERIO CONFIRMADO (2026-06-20)

**Decisión contable recibida de Contabilidad (Fase 7B-1):**
- Provisiones Constituidas = calculadas del saldo de cada deudor, por clasificación, con las tasas SBS.
- "Sí, debe ser igual" (a las Provisiones Requeridas).
- **Conclusión: C37 = C36 por deudor.** No es placeholder — es criterio contable confirmado.

**Impacto:**
- ~~No crear tabla `provisiones_mensuales`~~ — descartada para el alcance actual.
- B3 pasa de MITIGADO a **LISTO PARA CERRAR FORMALMENTE**.
- Próxima tarea (Fase 7B-2): actualizar `reportes/anexo6/page.tsx` para cambiar el indicador de fuente de `'sin_fuente_contable'` a `'criterio_contable_confirmado'` y ajustar el banner de advertencia.
- La diferencia histórica observada en la auditoría (S/311,972.75 vs. requerida) se debía a provisiones genéricas adicionales registradas contablemente. Para el Anexo 6, la regla SBS a aplicar es la misma tasa × saldo por deudor.

**⚠ No implementar Fase 7B-2 todavía** — esperar resolución de pendientes con Créditos/Tesorería para no hacer cambios parciales en el Anexo 6.

---

## Fase 7B-1 — Registro de respuestas de Contabilidad — ✅ COMPLETADA (2026-06-20)

Respuestas recibidas y registradas en `docs/ai-recovery/ACCOUNTING_QUESTIONS_BDCC_B3.md`.

**Confirmados:**
- Código COOPAC SBS: `01270`
- Provisiones Constituidas = Provisiones Requeridas por deudor (C37 = C36) — B3 resuelto conceptualmente
- Sin garantías preferidas → BD03A/BD03B solo encabezado
- Aporte descontado al desembolso aplica para socios nuevos

**Parciales (valor candidato, validar antes de usar):**
- Tipo crédito: consumo no revolvente ✓; código SBS C19/C20 pendiente
- Cuenta contable BD01: `1411050604` candidata; falta confirmar por estado del crédito

**Pendientes (consultar a Créditos y Tesorería):**
- Género y estado civil → Tesorería
- Tipo K y créditos cancelados → Créditos
- Tasa 0.2682 en Anexo 6 (¿TEA o nominal?) → Créditos

---

## ~~Fase 8C-1 — Cierre MVP y checklist operativo para lunes~~ ✅ COMPLETADA (2026-06-20)

- `docs/ai-recovery/MONDAY_DELIVERY_CHECKLIST.md` — estado de módulos, checklist de prueba manual, tabla de archivos BDCC, pendientes explícitos y mensaje recomendado para Gerencia/Contabilidad.
- `docs/ai-recovery/MONDAY_DEMO_SCRIPT.md` — guía de demo de 10 minutos paso a paso para mostrar la app el lunes.
- `scripts/check-monday-readiness.mjs` — 37 checks: página BDCC, card en Reportes, documentos de entrega, comandos npm, BD02-B/BD04 bloqueados, histórico 2024/2025 fuera de alcance, advertencias regulatorias visibles, seguridad.
- `package.json`: agregado `"check:monday-readiness"`.
- Resultados: `check:monday-readiness` 37/37 PASS · `smoke:bdcc` 51/51 PASS · `check:bdcc:mvp-exporters` 38/38 PASS · `check:bdcc:ui-fields` 26/26 PASS · `check:bdcc:min-fields` 16/16 PASS · `verify:cejuassa` tsc OK + build OK.

---

## ~~Fase 8B-2 — Smoke test funcional pantalla BDCC~~ ✅ COMPLETADA (2026-06-20)

- `scripts/smoke-bdcc-runtime.mjs` creado: 51 checks estáticos — página existe, navegación desde Reportes activa, 4 funciones de descarga presentes, nombres de archivo patrón `01270_BDXX_YYYYMM.txt`, tabulador confirmado en `buildTxt`, BD03A/BD03B solo encabezado, BD02-B/BD04 sin generador activo, advertencias regulatorias visibles, sin service role en frontend.
- `package.json`: agregado `"smoke:bdcc": "node scripts/smoke-bdcc-runtime.mjs"`.
- Resultados: `smoke:bdcc` 51/51 PASS · `check:bdcc:mvp-exporters` 38/38 PASS · `check:bdcc:ui-fields` 26/26 PASS · `check:bdcc:min-fields` 16/16 PASS · `verify:cejuassa` tsc OK + build 35/35 OK (incluye `/dashboard/reportes/bdcc` en el árbol de rutas).
- Sin errores nuevos. Pantalla BDCC lista para uso operativo.

---

## ~~Fase 8B-1 — Generador BDCC MVP~~ ✅ COMPLETADA (2026-06-20)

- `app/dashboard/reportes/bdcc/page.tsx` creado con selectores de período y botones por archivo.
- `lib/bdcc/format.ts` creado: `fmtFechaBdcc`, `fmtNumBdcc`, `buildTxt`, `downloadTxt`.
- **BD01** — genera `01270_BD01_YYYYMM.txt` (créditos vigentes con clasificación y provisiones).
- **BD02-A** — genera `01270_BD02A_YYYYMM.txt` (cuotas pagadas en el período).
- **BD03A** — genera `01270_BD03A_YYYYMM.txt` solo encabezado (sin garantías confirmado).
- **BD03B** — genera `01270_BD03B_YYYYMM.txt` solo encabezado (sin garantías confirmado).
- BD02-B y BD04 — marcados como pendientes en UI; no tienen generador activo.
- Página BDCC agregada al índice de Reportes.
- Script `check-bdcc-mvp-exporters.mjs` 38/38 PASS. `npm run check:bdcc:mvp-exporters` disponible.
- `npm run verify:cejuassa` tsc OK + build 34/34 OK.
- Advertencias permanentes en UI: TPINT, CCVE/CCJU, TIPCRED/SUBTIPCRED, género/estado civil.

**Pendientes antes de enviar a SBS (no bloquean la generación MVP):**
- Confirmar con Créditos: TPINT (¿nominal o TEA?), TIPCRED/SUBTIPCRED códigos SBS exactos.
- Confirmar con Contabilidad: cuentas contables CCVE y CCJU (para capital vencido y judicial).
- Ingresar género y estado civil de socios en módulo Socios.
- Módulo de créditos cancelados para BD02-B y BD04.

---

## ~~Fase 9A-9B — Manual HTML + auditorías~~ ✅ COMPLETADA (2026-06-20)

- `docs/ai-recovery/manuals/CEJUASSA_MANUAL_USUARIO.html` — manual standalone 16 secciones
- `docs/ai-recovery/FUNCTIONAL_AUDIT_REPORT.md` — 25 funcionalidades auditadas
- `docs/ai-recovery/ROLE_FUNCTIONAL_AUDIT.md` — matriz de roles, rutas, botones, riesgos
- `scripts/check-manual-and-audit.mjs` + `npm run check:manual-audit`
- Riesgos de rol encontrados: BDCC sin restricción de rol (todos pueden descargar), acceso directo a módulos ocultos solo lectura
- No se tocó DB, no se crearon migraciones, no se modificó lógica financiera

## ~~Fase 9D-0 — Auditoría de requisitos faltantes~~ ✅ COMPLETADA (2026-06-20)

- `docs/ai-recovery/MISSING_REQUIREMENTS_AUDIT.md` creado.
- Hallazgos clave:
  - `socios`: ya tiene `apellidos` + `nombres` separados. No existe `apellido_paterno/materno`. Problema puede ser de datos, no de estructura.
  - Beneficiarios: existe solo 1 por socio (3 campos en `socios`). No hay tabla `socio_beneficiarios`.
  - Ampliaciones: tabla `ampliaciones` YA existe en Supabase (confirmado en PENDIENTES.md + RLS). NO existe módulo en la app.
  - Pagaré en ampliaciones: no existe lógica. Depende de regla de negocio no definida.
  - Manual: no menciona ampliaciones ni múltiples beneficiarios.
- No se tocó código, DB ni manual. Solo auditoría.
- Plan por fases: 9D-1 (manual) → 9E (nombres) → 9F (beneficiarios) → 9G (ampliaciones).

---

## ~~Fase 9C-6J-FUNC — Prueba funcional completa de app y reportes demo~~ ✅ COMPLETADA (2026-06-23)

- `scripts/smoke-demo-app-reports.mjs` creado — **28/28 PASS** ✅
- `npm run smoke:demo-app` agregado a `package.json`
- Rutas verificadas: `/dashboard`, `/socios`, `/creditos`, `/pagos`, `/aportes`, `/egresos`, `/convenios`, `/cartera`, `/mora`, `/reportes`, `/reportes/anexo6`, `/reportes/bdcc`, `/reportes/aportes`, `/reportes/caja`
- TypeScript OK · Build OK · 0 errores de NaN/undefined bloqueantes
- `audit:post-excel-import` → 0 críticos · 1 medio (DNI SINDNI) · 4 warnings esperados
- App lista para prueba con contadora.

---

## ~~Fase 10A — Auditoría funcional por roles, rutas, sidebar, botones y permisos~~ ✅ COMPLETADA (2026-06-23)

**Resultado:** 2 gaps corregidos + script de auditoría estática creado.

**Correcciones aplicadas:**
1. `egresos/page.tsx` — route guard bloquea `creditos` con `AccesoDenegado` (solo sidebar ocultaba el módulo antes)
2. `reportes/bdcc/page.tsx` — route guard restringe BDCC a `['admin', 'contabilidad']` (antes sin control)

**Script creado:** `scripts/audit-ui-roles-routes.mjs` → `npm run audit:ui-roles` → **34/34 PASS**

**Estado por rol (confirmado):**
| Rol | Estado |
|---|---|
| `admin` | Acceso total — ✅ sin restricciones |
| `tesoreria` | Pagos ✅ · Aportes ✅ · Egresos ✅ (botones, no BDCC) · Socios lectura ✅ |
| `creditos` | Créditos ✅ · Socios ✅ · Egresos ❌ (guard activo) · BDCC ❌ (guard activo) |
| `contabilidad` | Reportes ✅ · BDCC ✅ · Cartera ✅ · Egresos lectura ✅ · Sin crear/editar ✅ |

**Verificación final:** `audit:ui-roles` 34/34 ✅ · `smoke:demo-app` 28/28 ✅ · `audit:post-excel-import` 0 críticos ✅ · `verify:cejuassa` TSC OK + BUILD 36/36 OK ✅

---

## ~~Fase 9C-6I-DEMO — Completar campos regulatorios con valores temporales~~ ✅ COMPLETADA (2026-06-23)

**Autorización recibida:** `APLICAR DATOS DEMO 9C-6I`

⚠️ DATOS DE DEMOSTRACIÓN — NO OFICIALES. Valores temporales para pruebas con la contadora.

| Campo | Valor demo | Registros |
|---|---|---|
| `socios.genero` | `M` | 782 |
| `socios.estado_civil` | `soltero` | 782 |
| `creditos.subtipo_credito_sbs` | `por_confirmar` | 31 |

- Backup: `backups/demo-data-fill/2026-06-23T02-18/` (socios.json + creditos.json)
- Scripts: `demo:reg-fields:dry-run` · `demo:reg-fields:apply` · `check:demo-reg-fields` (**26/26 PASS**)
- Reporte: `docs/ai-recovery/DEMO_REGULATORY_FIELDS_FILL_REPORT.md`
- `audit:post-excel-import` → 0 críticos · 1 medio (DNI SINDNI)
- `verify:cejuassa` → tsc OK + build OK
- `tipo_credito_sbs` NO convertido a código SBS ✅ · DNI placeholder NO inventado ✅
- `pagos_recibos`, `cronograma_cuotas`, montos, saldos → NO modificados ✅

**Pendientes tras esta fase:**
- Reemplazar valores demo con datos reales antes del BDCC oficial
- 1 socio con DNI `SINDNI` (nro_socio 0001606) — pendiente de DNI real
- Confirmar subtipo_credito_sbs real con catálogo SBS

---

## ~~Fase 10B — Endurecer reportes, filtros y exportaciones~~ ✅ COMPLETADA (2026-06-23)

**Bugs corregidos:**
1. Anexo 6 Excel export — cuenta contable `1411030604` → `1411050604` (dato incorrecto)
2. BDCC `generarBD01()` — `subtipo_credito_sbs = 'por_confirmar'` ahora genera advertencia específica (antes pasaba sin aviso)
3. BDCC — banner DEMO prominente rojo: "🚫 DEMO — DATOS NO OFICIALES — NO ENVIAR A SBS"
4. Anexo 6 — banner DEMO agregado: génro=M, estado_civil=S, subtipo=por_confirmar son temporales

**Script creado:** `scripts/smoke-report-exports.mjs` → `npm run smoke:report-exports`

**Resultado de checks:**
- `smoke:report-exports` → **37/37 PASS** · 3 WARN esperados (datos demo)
- `smoke:demo-app` → **28/28 PASS**
- `audit:ui-roles` → **34/34 PASS**
- `audit:post-excel-import` → **0 críticos**
- TypeScript → ✅ limpio

---

## ~~Fase 10C — Beneficiarios múltiples por socio~~ ✅ COMPLETADA (2026-06-23)

**Objetivo:** Soporte para múltiples beneficiarios por socio sin romper campos legacy de `socios`.

**Entregables:**
- `supabase/migrations/20260623000001_create_socio_beneficiarios.sql` — migración idempotente aplicada ✅
- `socio_beneficiarios` — tabla creada en Supabase con 10 columnas, RLS + policy `autenticados_pueden_operar` ✅
- `app/dashboard/socios/_components/BeneficiariosSection.tsx` — CRUD completo (listar/agregar/editar/eliminar/marcar principal) ✅
- Integración en `socios/[id]/page.tsx` (detalle) y `socios/[id]/editar/page.tsx` (edición) ✅
- Scripts: `dry-run-migrate-socio-beneficiarios.mjs`, `migrate-socio-beneficiarios.mjs`, `check-socio-beneficiarios-module.mjs`, `audit-beneficiarios-schema.mjs`, `check-beneficiarios-schema-sync.mjs`
- npm: `beneficiarios:dry-run`, `beneficiarios:apply`, `check:beneficiarios-module`, `audit:beneficiarios-schema`, `check:beneficiarios-schema-sync`

**Estado final:**
- Tabla real confirmada: 10/10 columnas, RLS ON, policy ALL authenticated ✅
- Campos legacy `beneficiario_nombre/dni/parentesco` en `socios` intactos ✅
- 0 beneficiarios legacy para migrar (columnas vacías en DB actual)
- `check:beneficiarios-module` 26/26 ✅ · `check:beneficiarios-schema-sync` 29/29 ✅ · `audit:beneficiarios-schema` OK ✅

**Permisos UI implementados:**
- `admin`: crear/editar/eliminar/marcar principal
- `tesoreria`: crear/editar/marcar principal
- `creditos`/`contabilidad`: solo lectura

---

## ~~Fase 10C.1 — Sincronización de esquema socio_beneficiarios~~ ✅ COMPLETADA (2026-06-23)

**Hallazgo:** La tabla no existía en Supabase (falso positivo en dry-run por manejo de error PGRST205).
**Correcciones:** tipo `socio_id` corregido de `BIGINT` a `INTEGER` (para coincidir con `socios.id` int4).
**Migración aplicada vía MCP** con autorización `SINCRONIZAR BENEFICIARIOS 10C.1`.
**Post-apply:** 10/10 columnas verificadas en `information_schema` · policy confirmada · `audit:beneficiarios-schema` PASS.

---

## ~~Fase 10C.2 — Prueba CRUD controlada de beneficiarios múltiples~~ ✅ COMPLETADA (2026-06-23)

**Autorización recibida:** `PROBAR CRUD BENEFICIARIOS 10C.2`

**Resultado:** INSERT ✅ · UPDATE ✅ · DELETE ✅ · Limpieza final ✅
- Socio usado: ID=3329 (datos enmascarados)
- Beneficiario temporal ID=1 — eliminado al finalizar
- Tabla `socio_beneficiarios` queda vacía y limpia
- Otras tablas: NINGUNA modificada
- `check:beneficiarios-crud` 22/22 PASS · `smoke:demo-app` 28/28 PASS · BUILD OK

**Reporte completo:** `docs/ai-recovery/BENEFICIARIOS_CRUD_TEST_REPORT.md`

---

## ~~Fase 10D-0 — Auditoría y diseño seguro del módulo Ampliaciones~~ ✅ COMPLETADA (2026-06-23)

**Tabla `ampliaciones` auditada — 11 columnas, 0 registros, RLS ON.**

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | SERIAL PK | auto-increment |
| `id_credito` | integer FK→creditos.id | NOT NULL |
| `fecha` | date | NOT NULL |
| `nro_pagare_anterior` | text | NOT NULL |
| `nro_pagare_nuevo` | text | NOT NULL · **UNIQUE** |
| `monto_nuevo` | numeric(12,2) | NOT NULL |
| `plazo_nuevo` | integer | NOT NULL |
| `saldo_nuevo` | numeric(12,2) | NOT NULL |
| `observacion` | text | nullable |
| `created_at` | timestamptz | DEFAULT now() |
| `created_by` | uuid FK→usuarios.id | nullable |

**Políticas RLS:** SELECT (all auth) · INSERT/UPDATE (admin+creditos) · DELETE (admin)
**FK:** id_credito→creditos.id · created_by→usuarios.id
**Modelo implícito:** Modelo D — modifica crédito existente, registra cambio de pagaré.
**Campos faltantes:** `estado` (workflow), `tasa_nueva`, `cuota_nueva`.
**MVP sin migración:** posible (solo registro/consulta, sin tocar crédito automáticamente).

**Scripts:** `audit:ampliaciones-module` 37/37 PASS · `check:ampliaciones-plan` 24/24 PASS
**Docs:** `docs/ai-recovery/AMPLIACIONES_MODULE_AUDIT_AND_PLAN.md`
**Verificación:** `smoke:demo-app` 28/28 · TypeCheck OK · BUILD 34/34 OK

---

## ~~Fase 10D-1 — UI segura de historial de ampliaciones~~ ✅ COMPLETADA (2026-06-23)

**Componente:** `app/dashboard/creditos/_components/AmpliacionesSection.tsx`
- Lista, crea, edita y elimina registros en tabla `ampliaciones`
- Aviso visible: "Registro informativo. No modifica saldo, cronograma ni pagaré del crédito automáticamente."
- Guards por rol: `admin` (CRUD completo) · `creditos` (crear + editar) · `tesoreria`/`contabilidad` (solo lectura lista)

**Integración:** `app/dashboard/creditos/[id]/page.tsx` — sección entre Descuentos y Cronograma.

**Restricciones cumplidas:**
- CERO updates a `creditos`, `cronograma_cuotas`, `pagos_recibos`, `socios`
- Solo INSERT/UPDATE/DELETE en `ampliaciones`
- Sin migraciones

**Script:** `scripts/check-ampliaciones-ui.mjs` → `npm run check:ampliaciones-ui` → **10/10 PASS**

**Verificación:** `check:ampliaciones-ui` 10/10 ✅ · `audit:ampliaciones-module` OK ✅ · `smoke:demo-app` 28/28 ✅ · `verify:cejuassa` BUILD OK ✅ · TypeScript OK ✅

**Pendiente financiero (bloqueado):** recalcular cronograma, modificar saldo, cancelar crédito, aplicar pagaré — requiere confirmación de Créditos/Contabilidad.

---

## ~~Fase 10D-1A — Prueba CRUD controlada de ampliaciones~~ ✅ COMPLETADA (2026-06-23)

**Autorización recibida:** `PROBAR CRUD AMPLIACIONES 10D-1A`

| Operación | Resultado |
|---|---|
| INSERT | ✅ OK — id=1, nro_pagare_nuevo=TEST_PAGARE_10D_1A, monto=10000 |
| UPDATE | ✅ OK — observacion + monto_nuevo=10100 |
| DELETE | ✅ OK |
| Limpieza final | ✅ OK — sin registros huérfanos |

- Crédito usado: ID=1131 (enmascarado `201***`)
- Tablas no modificadas: `creditos` ✅ · `cronograma_cuotas` ✅ · `pagos_recibos` ✅ · `socios` ✅
- Scripts: `ampliaciones:crud:dry-run` · `ampliaciones:crud:apply` · `check:ampliaciones-crud` 22/22 PASS
- Post-apply: dry-run 4/4 ✅ · check 22/22 ✅ · `smoke:demo-app` 28/28 ✅ · BUILD OK ✅
- Reporte: `docs/ai-recovery/AMPLIACIONES_CRUD_TEST_REPORT.md`
- **Módulo ampliaciones: ✅ OPERATIVO**

---

## Fase 10D-1B — Confirmar modelo de negocio con Créditos/Contabilidad

**Objetivo:** Obtener respuestas a las preguntas de negocio antes de implementar lógica financiera.

**Acción requerida:** Presentar las 13 preguntas documentadas en `AMPLIACIONES_MODULE_AUDIT_AND_PLAN.md` (sección 7) al área de Créditos y Contabilidad.

**Preguntas clave (no implementar sin estas respuestas):**
1. ¿La ampliación cancela el crédito original y crea uno nuevo, o modifica el existente?
2. ¿El cronograma se regenera desde cero o se agregan cuotas al final?
3. ¿El número de pagaré siempre cambia al ampliar?
4. ¿Qué define `saldo_nuevo` exactamente?
5. ¿La tasa de interés puede cambiar al ampliar?
6. ¿Hay proceso de aprobación antes de ejecutar?
7. ¿Puede haber más de una ampliación por crédito?

**Entregable:** `docs/ai-recovery/AMPLIACIONES_BUSINESS_RULES.md` con respuestas documentadas.

---

## Fase 10D-2 — Migración mínima (Solo si Créditos confirma flujo con aprobación)

**Condición:** Solo si el modelo requiere workflow de aprobación.

```sql
-- PROPUESTA — NO APLICAR SIN APROBACIÓN DEL USUARIO
ALTER TABLE public.ampliaciones
  ADD COLUMN estado TEXT NOT NULL DEFAULT 'registrada'
    CHECK (estado IN ('registrada', 'aprobada', 'rechazada', 'anulada'));
```

**No aplicar hasta tener respuestas de Créditos/Contabilidad.**

---

## Fase 10D-3 — UI MVP Ampliaciones (después de confirmar reglas)

**Solo implementar después de Fase 10D-1.**

**Plan tentativo (sujeto a cambios según respuestas de negocio):**
1. Tab "Ampliaciones" en `creditos/[id]/page.tsx` — tabla de historial por crédito
2. Formulario `creditos/[id]/ampliar/page.tsx` — registro sin tocar el crédito automáticamente
3. Roles: admin + creditos para registrar; todos pueden ver
4. Sin botón "Aplicar" hasta confirmar modelo definitivo

---

## Fase 10D-1 — Mejoras al módulo de beneficiarios (diferida)

**Opciones una vez completada 10D-0:**
- Validación de suma de porcentajes (≤ 100% entre todos los beneficiarios del socio) — ver B4 en RISKS_AND_BUGS.md
- Límite de beneficiarios por socio (ej. máximo 5)
- Exportación de beneficiarios en fichas de socio PDF

---

## Fase 10C.2 — [ARCHIVADA] — Pasos originales planificados

**Objetivo (original):** Verificar que la UI de beneficiarios funciona correctamente en la app real: insertar, editar, marcar principal y eliminar desde un socio de prueba, con los distintos roles.

**Pasos:**
1. Abrir `http://localhost:3000/dashboard/socios/[id]` con rol `admin`.
2. Verificar que sección "Beneficiarios" carga sin error.
3. Agregar un beneficiario de prueba → confirmar que aparece en la lista.
4. Editar el beneficiario → confirmar cambios guardados.
5. Marcar como principal → confirmar badge "Principal".
6. Eliminar → confirmar que desaparece de la lista.
7. Verificar con rol `tesoreria`: puede crear/editar pero NO eliminar.
8. Verificar con rol `creditos`: solo lectura (sin botones de acción).
9. Ejecutar: `npm run check:beneficiarios-module` + `npm run audit:beneficiarios-schema` → ambos PASS.

**Pendientes de datos reales (bloquean BDCC oficial):**
- Género y estado civil de socios → ingresar en módulo Socios
- Subtipo de crédito SBS → confirmar catálogo SBS con área de Créditos
- 3 pagos match_medio → decisión del área de Créditos
- 1 socio con DNI `SINDNI` → localizar DNI real

---

## Fase 9D-1 — Actualizar manual con requisitos faltantes

- Agregar sección "Módulos en roadmap" al manual HTML.
- Documentar estado real de ampliaciones, beneficiarios y campos de nombre.
- No requiere cambios de código ni DB.

---

## ~~Fase 9C-0 — Plan seguro de limpieza y recarga de datos~~ ✅ COMPLETADA (2026-06-20)

**Conteos actuales (dry-run confirmado):**
- `socios`: 434 registros
- `creditos`: 431 registros
- `pagos_recibos`: 401 registros
- `aportes`: 1 registro
- Tablas vacías: cronograma_cuotas, egresos, convenios, auditoria, cartera_mes, etc.

**Archivos creados:**
- `docs/ai-recovery/DATA_RESET_PLAN.md` — plan completo con orden de borrado y riesgos
- `docs/ai-recovery/DATA_RELOAD_CHECKLIST.md` — checklist de recarga paso a paso
- `scripts/plan-data-reset.mjs` — dry-run: muestra conteos sin borrar nada
- `supabase/manual/data-reset-template.sql` — plantilla SQL (ROLLBACK por defecto, NO ejecutar sin autorización)
- `scripts/check-data-reset-plan.mjs` — 18/18 validaciones PASS

**Comandos disponibles:**
- `npm run plan:data-reset` — ver conteos actuales (seguro, solo lectura)
- `npm run check:data-reset-plan` — verificar que el plan es seguro

**No se ejecutó ningún borrado.** El plan requiere autorización explícita del usuario.

---

## ~~Fase 9C-1 — Backup real antes de limpiar datos operativos~~ ✅ COMPLETADA (2026-06-20)

**Backup verificado:**
- Carpeta: `backups/data-reset/20260620-1327/`
- Tablas exportadas: socios (434), creditos (431), pagos_recibos (401), aportes (1), cronograma_cuotas (0), egresos (0), convenios (0), ampliaciones (0)
- Total: 1267 registros
- `BACKUP_MANIFEST.md` generado en la raíz del proyecto
- `npm run check:operational-backup` — 27/27 PASS
- **NADA FUE BORRADO.**

**Scripts disponibles:**
```bash
npm run backup:operational-data    # exportar datos (seguro — solo lectura)
npm run check:operational-backup   # verificar backup 27/27 PASS
```

---

## ~~Fase 9C-2 — Limpieza real controlada de datos operativos~~ ✅ COMPLETADA (2026-06-20)

**Ejecutada con autorización explícita del usuario vía Supabase MCP.**

| Tabla | Antes | Después |
|---|---|---|
| `socios` | 434 | **0** |
| `creditos` | 431 | **0** |
| `pagos_recibos` | 401 | **0** |
| `aportes` | 1 | **0** |
| `usuarios` *(conservado)* | 2 | **2** |
| `configuracion` *(conservada)* | 1 | **1** |

- Backup pre-reset: `backups/data-reset/20260620-1327/`
- SQL ejecutado: `supabase/manual/data-reset-execute-9c2.sql`
- `plan:data-reset` → 0 registros en todas las tablas operativas ✅
- `check:data-reset-plan` → 18/18 PASS ✅
- `verify:cejuassa` → tsc OK + build 28/28 OK ✅

---

## ~~Fase 9C-3 — Preparar recarga controlada de datos reales~~ ✅ COMPLETADA (2026-06-20)

**Fuentes identificadas y dry-run ejecutado. No se insertó ningún dato.**

- `docs/ai-recovery/DATA_RELOAD_SOURCE_MAP.md` — mapa de fuentes completo
- `docs/ai-recovery/DATA_RELOAD_DRY_RUN_REPORT.md` — 0 issues, 2 warnings (genero/estado_civil vacíos)
- `scripts/reload/dry-run-reload-data.mjs` — validación sin escrituras
- `npm run reload:dry-run` → 0 issues ✅
- `npm run check:data-reload-prep` → 13/13 PASS ✅
- `npm run verify:cejuassa` → tsc OK + build 28/28 OK ✅

**Fuentes disponibles:**
| Fuente | Tipo | Registros | Tablas |
|---|---|---|---|
| Backup JSON (F1) | `backups/data-reset/20260620-1327/` | 434+431+401+1 | socios, creditos, pagos, aportes |
| Excel cliente (F2-F4) | `_client_files/raw/extracted/` | ~876 filas | pagos (mar-2026) + creditos (~32) |

---

## ~~Fase 9C-4A — Preparar recarga desde Excel del proyecto~~ ✅ COMPLETADA (2026-06-20)

**Auditoría Excel ejecutada. Dry-run completado. No se insertó ningún dato.**

**Excels detectados (7 archivos en `_client_files/raw/extracted/Archvos app/`):**

| Archivo | Tipo | Tabla destino | Registros |
|---|---|---|---|
| DSCTO Y DESMBOLSO DE CRDITO MA ABR-2026 (1).xlsx | B | `creditos` | 32 desembolsos (mar-2026) |
| INGRESO DETALLADO MARZO 2026 (1).xlsx | C | `pagos_recibos` | 34 (caja) |
| CONVENIO MES MARZO 2026 (1).xlsx | C/D | `pagos_recibos` | 800 (convenios) |
| 1106_03 Anexo Nø6... ENERO 2026 (1).xlsx | G | Referencia | — |
| 1105-05 informe de deudores (1).xlsx | G | Referencia | — |
| 1105_04_Cuadre del Anexo 5... (1).xlsx | G | Referencia | — |
| ELABORACION DE REPORTES... (1).xlsx | G | Referencia | — |

**Hallazgo crítico:** No existe Excel de padrón de socios → `socios` debe cargarse desde backup JSON.

**Artefactos creados:**
- `docs/ai-recovery/EXCEL_IMPORT_SOURCE_AUDIT.md` — auditoría completa
- `docs/ai-recovery/EXCEL_IMPORT_MAPPING_PLAN.md` — plan de mapping con transformaciones
- `docs/ai-recovery/EXCEL_IMPORT_DRY_RUN_REPORT.md` — reporte del dry-run
- `scripts/import-excel/dry-run-excel-import.mjs` — script dry-run
- `scripts/check-excel-import-prep.mjs` — 35/35 PASS
- `npm run import:excel:dry-run` + `npm run check:excel-import-prep` disponibles

**Dry-run: 6 issues, 9 warnings — ninguno bloqueante:**
- 1 fila vacía en cada Excel (fila de total/separador al final)
- Tasa de interés no disponible en Excel de créditos (calcular o usar default)
- id_credito en pagos requiere lookup post-carga de créditos

---

## ~~Fase 9C-4B — Importación Excel real~~ ✅ COMPLETADA (2026-06-21)

**Importación ejecutada exitosamente. Autorización: `EJECUTAR IMPORTACION EXCEL 9C-4B`**

| Tabla | Resultado |
|---|---|
| `convenios` | 8 insertados |
| `socios` | 782 insertados (derivados desde Excel) |
| `creditos` | 31 insertados (26 vigentes, 5 cancelados) |
| `pagos_recibos` | 832 insertados |
| `aportes` | 785 insertados |
| `cronograma_cuotas` | 0 — regenerar manualmente |

- `usuarios` (2) y `configuracion` (1) conservados intactos
- `verify:cejuassa` → tsc OK + build OK
- `check:excel-import-mvp` → 31/31 PASS
- Dos correcciones de ENUM durante el apply (dni NOT NULL → placeholder, estado_flujo → 'registrado')

**Pendientes de datos (completar en la app):**
1. `socios.genero` y `socios.estado_civil` — NULL en todos (requerido para BDCC BD01)
2. `creditos.tasa_interes` — 0 en todos (actualizar en módulo Créditos)
3. `creditos.tipo_credito` — 'consumo' en todos (verificar con Créditos)
4. `pagos_recibos.id_credito` — NULL en todos
5. `cronograma_cuotas` — vacío (regenerar via RPC o en la app crédito por crédito)
6. 1 socio con DNI placeholder `SINDNI{nro_socio}` — localizar y actualizar DNI real

---

## ~~Fase 9C-5 — Auditoría post-importación~~ ✅ COMPLETADA (2026-06-21)

Script: `npm run audit:post-excel-import` · Check: `npm run check:post-excel-import-audit` → **32/32 PASS**
Reporte: `docs/ai-recovery/POST_EXCEL_IMPORT_AUDIT.md`

**4 problemas críticos encontrados:**
1. Todos los socios (782) sin `genero` → BDCC BD01 bloqueado
2. Todos los socios (782) sin `estado_civil` → BDCC BD01 bloqueado
3. `cronograma_cuotas` vacío → módulo de cuotas no funcional
4. `tasa_interes = 0` en todos los créditos (31) → interés incorrecto

**1 problema medio:** 1 socio con DNI placeholder SINDNI

**Módulos listos:** Socios, Pagos, Aportes, Caja, Créditos lista, Cartera
**Módulos bloqueados:** BDCC BD01/BD02-A · Cronograma de cuotas

---

## ~~Fase 9C-6A — Plan y dry-run de correcciones~~ ✅ COMPLETADA (2026-06-21)

Scripts: `fix:post-import:dry-run` + `check:post-import-fix-plan` → **31/31 PASS**
Plan: `docs/ai-recovery/POST_IMPORT_FIX_PLAN.md`
Reporte: `docs/ai-recovery/POST_IMPORT_FIX_DRY_RUN_REPORT.md`

**Hallazgos clave:**
- `tipo_credito_sbs`: valor actual = `'consumo_no_revolvente'` (texto, no código SBS numérico). Código '004' NO documentado en el proyecto → no se puede aplicar automáticamente
- `subtipo_credito_sbs`: NULL en 31 créditos → requiere catálogo SBS
- `cuenta_contable_bd01`: ya correcta ('1411050604') en todos ✅
- `tipo_pago`: ya poblado en todos ✅
- `cronograma_cuotas`: 0 créditos listos (todos con tasa = 0) → bloqueado hasta completar tasa

**Correcciones pendientes (clasificadas):**

| Grupo | Campo | Cantidad | Fuente requerida |
|---|---|---|---|
| B — Cliente | `genero` | 782 socios | Lista de socios |
| B — Cliente | `estado_civil` | 782 socios | Lista de socios |
| B — Cliente | `tasa_interes` | 31 créditos | Pagarés físicos |
| B — Cliente | `tipo_credito_sbs` (código) | 31 créditos | Oficio SBS C19 |
| B — Cliente | `subtipo_credito_sbs` | 31 créditos | Oficio SBS C20 |
| B — Cliente | DNI placeholder | 1 socio | DNI real |
| C — Negocio | `cronograma_cuotas` | 26 vigentes | Depende de tasa_interes |
| C — Negocio | `id_credito` en pagos | 832 pagos | Decisión de negocio |
| C — Negocio | pagos tipo K | 46 pagos | Confirmar con SBS |

---

## ~~Fase 9C-6A.1 — Verificar tasa/tipo/subtipo en Excel adjuntos~~ ✅ COMPLETADA (2026-06-21)

Resultado: Anexo 6 contiene "Tasa de Interés Anual" con valor `0.2682` en 433/435 filas.
"Tipo de Crédito" y "Sub Tipo de Crédito" están vacíos en el Anexo 6. Ver `CREDIT_FIELDS_SOURCE_VERIFICATION.md`.

## ~~Fase 9C-6A.2 — Refinar cruce créditos × Anexo 6~~ ✅ COMPLETADA (2026-06-21)

Cruce 31/31 con confianza ALTA via Código Socio (strip de ceros). Tasa 0.2682 confirmada para todos.
Tipo y Subtipo no recuperables desde Excel. Preview: `proposed_credit_field_updates_preview.json`.

## ~~Fase 9C-6C — Dry-run regeneración cronograma_cuotas~~ ✅ COMPLETADA (2026-06-22)

**26/26 créditos vigentes elegibles · 0 no elegibles · 911 cuotas simuladas · 26/26 ΣCapital = Monto exacto**

- `docs/ai-recovery/CRONOGRAMA_REGENERATION_PLAN.md` — plan completo: campos, fórmula, riesgos, rollback
- `docs/ai-recovery/CRONOGRAMA_REGENERATION_DRY_RUN_REPORT.md` — reporte con tabla por crédito
- `scripts/dry-run-regenerate-cronogramas.mjs` — script de simulación (sin insertar)
- `scripts/check-cronograma-regeneration-plan.mjs` — 22/22 PASS — verificación de seguridad
- `npm run cronogramas:dry-run` + `npm run check:cronogramas:plan` disponibles
- Fórmula: sistema francés (idéntica a `creditos/nuevo/page.tsx`) · r = 0.2682/100/12
- **Riesgo principal:** 832 pagos con `id_credito = NULL` → cuotas regeneradas quedan como `pendiente` hasta vincular pagos
- **Saldo < Monto en los 26 créditos** → diferencia (ΔSaldo) varía por crédito (pagos sin cronograma previo)

---

## ~~Fase 9C-6B — Aplicar tasa_interes desde Anexo 6~~ ✅ COMPLETADA (2026-06-21)

`tasa_interes = 0.2682` aplicada en 31/31 créditos. tipo/subtipo_credito_sbs NO modificados.
Auditoría post-apply: `tasa_interes = 0` en 0 créditos ✅. `cronograma_cuotas` desbloqueado.
Scripts: `apply:tasa-anexo6:dry-run` · `apply:tasa-anexo6:apply` · `check:apply-tasa-anexo6`

## Fase 9C-6A.1 — Verificar tasa/tipo/subtipo en Excel adjuntos (ARCHIVADA)

**Objetivo:** Antes de pedir datos al cliente, verificar si `tasa_interes`, `tipo_credito_sbs` (código)
y `subtipo_credito_sbs` ya están presentes en alguno de los 7 archivos Excel del proyecto.

**Reglas estrictas:**
- NO insertar · NO actualizar · NO borrar · NO migraciones
- NO tocar usuarios / configuracion / auth.users · NO modificar _client_files/
- Solo lectura, cruce de datos y reporte · NO imprimir datos personales completos

**Archivos a revisar (en `_client_files/raw/extracted/Archvos app/`):**
1. `DSCTO Y DESMBOLSO DE CRDITO MA ABR-2026 (1).xlsx` — contiene Hoja3 (32 filas con campos: Monto, Plazo, Interes, etc.)
2. `INGRESO DETALLADO MARZO 2026 (1).xlsx` — Hoja1, 34 filas
3. `CONVENIO MES MARZO 2026 (1).xlsx` — hoja DETALLE, 800 filas
4. Los 4 archivos de referencia adicionales (Anexo 6, informe deudores, Cuadre, Elaboración reportes)

**Qué buscar:**
- ¿Hay columna de tasa de interés en DSCTO u otro Excel? (puede llamarse "Tasa", "TEA", "TNA", "TPINT", "%", etc.)
- ¿Hay columna de tipo de crédito con código numérico SBS? (puede llamarse "TIPCRED", "Tipo", "Cod.", etc.)
- ¿Hay subtipo? (puede llamarse "SUBTIPCRED", "Subtipo", etc.)
- ¿Hay datos de género o estado civil en algún Excel? (puede estar en una hoja distinta del padrón)

**Entregable:** reporte breve con columnas encontradas y valores de muestra (sin datos personales completos)

---

## ~~Fase 9C-6C.2 — Convertir tasa_interes decimal → porcentaje~~ ✅ COMPLETADA (2026-06-22)

- 31/31 créditos convertidos de `tasa_interes = 0.2682` a `26.82` (×100).
- Guard `WHERE tasa_interes > 0 AND tasa_interes < 1` — idempotente.
- `audit:interest-rate-unit` → ✅ 0 decimales / 31 porcentaje.
- `check:tasa-conversion` → ✅ 25/25 PASS.
- `verify:cejuassa` → ✅ TSC OK + BUILD 28/28.
- Scripts: `convert:tasa:dry-run` · `convert:tasa:apply` · `check:tasa-conversion` disponibles.

---

## ~~Fase 9C-6D.0 — Re-ejecutar dry-run con tasa corregida~~ ✅ COMPLETADA (2026-06-22)

- `npm run audit:interest-rate-unit` → ✅ 0 decimales / 31 porcentaje
- `npm run cronogramas:dry-run` → ✅ 26/26 elegibles · 911 cuotas · ΔMonto = S/0.00 en todos
- `npm run check:cronogramas:plan` → ✅ 22/22 PASS
- `npm run verify:cejuassa` → ✅ TSC OK + BUILD 28/28
- Reporte actualizado: `CRONOGRAMA_REGENERATION_DRY_RUN_REPORT.md`
- Tasa usada: **26.82% TEA** · Total monto: **S/ 196,100.00** · Total cuotas: **911**

## ~~Fase 9C-6D — Apply: insertar cuotas regeneradas~~ ✅ COMPLETADA (2026-06-22)

**Autorización recibida:** `INSERTAR CRONOGRAMA 9C-6D`

- `scripts/apply-regenerate-cronogramas.mjs` ✅ creado
- `scripts/check-cronograma-apply.mjs` ✅ 18/18 PASS
- `npm run cronogramas:apply` ✅ 26/26 créditos · **911 cuotas insertadas** · 0 errores
- `npm run check:cronogramas:apply` ✅ 18/18 PASS (post-apply)
- `npm run audit:post-excel-import` ✅ cronograma_cuotas = 911
- `npm run verify:cejuassa` ✅ tsc OK + build OK

**Conteo final:** `cronograma_cuotas` = 911 registros en Supabase.
`creditos`, `pagos_recibos`, `socios`, `usuarios`, `configuracion` — no modificados.

**Riesgos restantes:**
- 832 pagos con `id_credito = NULL` → cuotas en estado `pendiente` (vinculación es Fase 9C-6E)
- 782 socios sin `genero`/`estado_civil` → BDCC BD01 bloqueado
- 1 socio con DNI placeholder SINDNI

**Siguiente fase recomendada:** Fase 9C-6E — vincular `pagos_recibos.id_credito` (832 pagos con NULL)

---

## ~~Fase 9C-6D.1 — Corregir bug en auditoría post-import~~ ✅ COMPLETADA (2026-06-22)

**Bug corregido (B4):** `scripts/audit-post-excel-import.mjs` sección C decía "31 sin cronograma (todos — tabla vacía)" aunque `cronograma_cuotas` tenía 911 registros. La sección G también decía "Cronograma de cuotas: ❌ Vacío".

**Causa:** la lógica hardcodeaba `creditosSinCronograma = creditos.length` asumiendo tabla vacía, y no consultaba `cronograma_cuotas` por crédito.

**Corrección aplicada:**
- Sección C: fetch de `id_credito` desde `cronograma_cuotas` → Set de IDs con cuotas → separación vigentes/cancelados con/sin cronograma.
- Sección G: estado dinámico basado en `creditosVigentesSinCronograma.length`.
- Clasificación de issues: cancelados sin cronograma → no crítico (esperado). Solo vigentes sin cronograma es crítico.
- **No se tocó la base de datos.**

**Resultado:** `audit:post-excel-import` reporta:
- cronograma_cuotas = **911**
- Vigentes con cronograma: **26/26**
- Vigentes sin cronograma: **0** ✅
- Cancelados sin cronograma: **5** (esperado — no crítico)
- Críticos: **2** (solo género/estado_civil en socios)
- `verify:cejuassa` → tsc OK + build OK

**Reglas:**
- Solo editar `scripts/audit-post-excel-import.mjs`
- No tocar `creditos`, `pagos_recibos`, `socios`, ni ninguna otra tabla
- Después de corregir: `npm run audit:post-excel-import` y `npm run verify:cejuassa`

---

## ~~Fase 9C-6E — Dry-run vinculación pagos_recibos → créditos~~ ✅ COMPLETADA (2026-06-22)

**Prerequisito:** Fase 9C-6D.1 completada.

**Resultados del dry-run (832 pagos analizados):**

| Categoría | Cantidad | % |
|---|---|---|
| `match_alto` | 28 | 3.4% |
| `match_medio` | 3 | 0.4% |
| `ambiguo` | 0 | 0.0% |
| `no_aplica_credito` | 417 | 50.1% |
| `sin_match` | 384 | 46.2% |

**Hallazgo clave:** 417 pagos (50%) son solo aporte/FPS/otros — NO deben vincularse a crédito.
384 pagos (46%) pertenecen a socios sin crédito en DB — socios de convenio sin deuda activa.
Solo 31 pagos tienen componente de crédito vinculable (28 alto + 3 medio).

**Scripts:**
- `npm run pagos:link-creditos:dry-run` — clasificación y propuesta (solo lectura)
- `npm run check:pagos-link-creditos` → **25/25 PASS**

**Preview:** `docs/ai-recovery/proposed_pago_credito_links_preview.json` (IDs enmascarados)
**Reporte:** `docs/ai-recovery/PAGOS_CREDITOS_LINK_DRY_RUN_REPORT.md`

**Riesgos:**
- 384 sin_match: socios de convenio sin crédito importado — esperado, no es error
- 47 tipo K: confirmar con Créditos/SBS antes de vincular (28 ya en match_alto)
- 3 match_medio: fuera de rango de fecha — revisar manualmente con cliente

**Recomendación:** apply de 28 match_alto es seguro. Los 3 match_medio requieren revisión del cliente.

---

## ~~Fase 9C-6F — Apply: vincular pagos_recibos.id_credito~~ ✅ COMPLETADA (2026-06-22)

**Autorización recibida:** `VINCULAR 28 PAGOS 9C-6F`

- `scripts/apply-link-pagos-creditos.mjs` ✅ creado (soporta --dry-run y --apply)
- `scripts/check-pagos-creditos-link-apply.mjs` ✅ **39/39 PASS**
- `npm run pagos:link-creditos:apply:dry-run` ✅ Preflight 6/6 OK — 28 pagos en plan, 0 datos modificados
- `npm run pagos:link-creditos:apply` ✅ **28/28 exitosos** — 0 errores
- `npm run check:pagos-link-creditos-apply` ✅ 39/39 PASS (post-apply)
- `npm run audit:post-excel-import` ✅ → 804 pagos con id_credito NULL (era 832 → bajó 28)
- `npm run verify:cejuassa` ✅ tsc OK + build OK

**Solo se actualizó `pagos_recibos.id_credito`.** `cronograma_cuotas`, `creditos`, `socios`, `usuarios`, `configuracion` — no modificados.

**Estado post-apply:**
| Categoría | Cantidad |
|---|---|
| Pagos vinculados (id_credito asignado) | 28 |
| Pagos restantes con id_credito = NULL | **804** |
| match_medio pendientes de revisión manual | 3 |
| no_aplica_credito (solo aporte/FPS) | 417 |
| sin_match (socios de convenio sin crédito) | 384 |

**Riesgos restantes:**
- 3 match_medio requieren revisión manual con el área de Créditos
- Cuotas (`cronograma_cuotas`) siguen en estado `pendiente` — vinculación a pagos es fase posterior
- 782 socios sin `genero`/`estado_civil` → BDCC BD01 bloqueado
- 1 socio con DNI placeholder SINDNI

**Reportes:** `docs/ai-recovery/PAGOS_CREDITOS_LINK_APPLY_DRY_RUN.md` · `PAGOS_CREDITOS_LINK_APPLY_REPORT.md`

---

## ~~Fase 9C-6G — Preparar revisión de 3 match_medio~~ ✅ COMPLETADA (2026-06-22)

- Excel generado: `exports/data-corrections/revision_pagos_match_medio.xlsx` (3 filas, IDs enmascarados)
- Documento de revisión: `docs/ai-recovery/PAGOS_MATCH_MEDIO_REVIEW.md`
- Script de check: `scripts/check-pagos-match-medio-review.mjs` — **15/15 PASS**
- `npm run check:pagos-match-medio-review` disponible
- `npm run verify:cejuassa` → tsc OK + build OK
- **La DB NO fue modificada en esta fase.**

**Qué debe confirmar el área de Créditos (en el Excel):**
Completar columna `decision_creditos` con uno de:
- `vincular_al_credito_propuesto` — el pago sí corresponde al crédito propuesto
- `no_vincular` — el pago no corresponde, dejar NULL
- `credito_faltante_en_importacion` — el crédito real no fue importado (planificar importación)
- `requiere_revision` — revisar documentación física

## ~~Fase 9C-6H.0 — Dry-run: reflejar pagos en cronograma_cuotas~~ ✅ COMPLETADA (2026-06-22)

- `scripts/dry-run-apply-pagos-to-cuotas.mjs` ✅ creado — SOLO LECTURA
- `scripts/check-pagos-to-cuotas-plan.mjs` ✅ creado → **37/37 PASS**
- `docs/ai-recovery/proposed_cuotas_payment_updates_preview.json` ✅ generado (IDs enmascarados)
- `docs/ai-recovery/PAGOS_TO_CUOTAS_DRY_RUN_REPORT.md` ✅ generado
- `npm run pagos:to-cuotas:dry-run` + `npm run check:pagos-to-cuotas-plan` disponibles
- **DB NO modificada.**

**Resultado del dry-run:**
| Métrica | Valor |
|---|---|
| Pagos vinculados analizados | **28** |
| Créditos afectados | **27** (un crédito tiene 2 pagos vinculados) |
| Cuotas propuestas como PAGADAS | **0** |
| Cuotas propuestas como PARCIALES | **26** |
| Pagos no asignables | **2** |

**Hallazgos clave:**
- **0 cuotas pagadas completas:** todos los 26 pagos cubren solo una parte de la cuota mensual. Esto es esperado — el pago de marzo 2026 importado corresponde a UN mes de cuota, pero la cuota_total de cada crédito es mayor que el monto_capital + monto_interes registrado en ese pago parcial.
- **Crédito 1145****: tiene un pago vinculado pero NO tiene cuotas en cronograma_cuotas (es un crédito cancelado que no tuvo cronograma generado — esperado).
- **Pago 1232****: tiene `monto_capital = 0` y `monto_interes = 0` (es solo aporte/FPS) — no asignable a cuota.
- **Recomendación:** Esperar los 3 match_medio antes del apply de cuotas (Opción B del reporte).

## Fase 9C-6H — Apply: vincular 3 match_medio + apply de cuotas (SIGUIENTE RECOMENDADA)

**Paso 1 (pendiente del cliente):** área de Créditos completa `decision_creditos` en el Excel de revisión.

**Paso 2 (una vez decidido el cliente):**
- Leer decisiones y aplicar UPDATE solo para `vincular_al_credito_propuesto`
- Crear `scripts/apply-link-pagos-match-medio.mjs` con --dry-run y --apply
- Requiere autorización explícita antes del apply

**Paso 3 (Fase 9C-6H.1 — Apply de cuotas):**
- Una vez confirmados los match_medio, aplicar los cambios propuestos en `proposed_cuotas_payment_updates_preview.json`
- Crear `scripts/apply-pagos-to-cuotas.mjs` con --dry-run y --apply
- Requiere autorización explícita antes del apply

---

## ~~Fase 9C-6C — Regenerar cronograma_cuotas~~ ✅ COMPLETADA (2026-06-22)

**Desbloqueada por Fase 9C-6B — tasa_interes = 0.2682 ya disponible en 31/31 créditos.**

**Opciones:**
1. **Vía app (UI):** Abrir cada crédito vigente en `/dashboard/creditos/[id]/editar` → guardar → la RPC `crear_credito_con_cronograma` regenera las cuotas.
2. **Vía script bulk:** Crear `scripts/regenerate-cronograma-bulk.mjs` que llame la RPC por cada crédito vigente (26 créditos). Requiere autorización explícita.

**Pendientes de datos aún abiertos:**

| Campo | Estado | Fuente requerida |
|---|---|---|
| `tasa_interes` | ✅ Resuelto — 0.2682 en 31/31 | Fase 9C-6B completada |
| `cronograma_cuotas` | ⚠️ Vacío — desbloqueado | Regenerar en app o script |
| `genero`/`estado_civil` | ❌ NULL en 782 socios | Pedir a Tesorería/cliente |
| `tipo_credito_sbs` (código SBS C19) | ❌ Texto descriptivo, sin código | Confirmar con área Créditos |
| `subtipo_credito_sbs` | ❌ NULL en 31 créditos | Confirmar con SBS/Créditos |
| `id_credito` en pagos | ❌ NULL en 832 pagos | Decisión de negocio |
| 1 DNI placeholder SINDNI | ⚠️ Pendiente | DNI real del socio |
| `egresos` | ❌ 0 registros | Ingreso manual |

---

## Fase 8C — Validación interna BDCC y preparación para envío a SBS (SIGUIENTE)

**Fecha límite: 20/07/2026 — BD01 + BD02-A de trimestres marzo y junio 2026**

Con la pantalla BDCC operativa, el siguiente paso es completar los datos faltantes y generar archivos reales para revisión interna.

**Pasos en orden:**
1. Ingresar género y estado civil en módulo Socios (campo SEXO / ESTCIV vacío en BD01 para socios sin datos)
2. Confirmar con Créditos: TPINT — ¿tasa nominal anual o TEA? (actualmente usa `tasa_interes` del crédito)
3. Confirmar con Créditos: códigos exactos TIPCRED y SUBTIPCRED según el Oficio SBS (actualmente usa el valor ingresado en el formulario)
4. Confirmar con Contabilidad: cuentas CCVE (capital vencido) y CCJU (capital judicial) por separado de CCVI
5. Generar BD01 y BD02-A para marzo 2026 — revisar internamente fila por fila
6. Revisar mnemónicos contra el Oficio SBS N°32791-2026 original (columnas, formatos, longitudes)
7. Módulo de créditos cancelados para habilitar BD02-B y BD04 — planificar como subproyecto separado

**No hacer en esta fase:** cambios de lógica regulatoria profunda, BD02-B/BD04, histórico 2024/2025.

---

## Fase 7C — Módulo BDCC SBS (EN CURSO — datos parcialmente confirmados)

**Fecha límite regulatoria: 20/07/2026 (BD01 + BD02-A de trimestres marzo y junio 2026)**

Ver `docs/ai-recovery/SBS_BDCC_REPORTS_PLAN.md` para el plan completo.

**Estado actual de datos mínimos:**
| Dato | Estado |
|---|---|
| Código COOPAC (`01270`) | ✅ Confirmado |
| Provisiones Constituidas (C37 = C36) | ✅ Confirmado |
| Sin garantías preferidas | ✅ Confirmado |
| Tipo crédito SBS (código exacto C19/C20) | ⚠ Parcial |
| Cuenta contable BD01 (`1411050604`) | ⚠ Parcial |
| Género y estado civil socios | ⏳ Tesorería |
| Tipo K / créditos cancelados | ⏳ Créditos |
| Tasa TPINT (¿TEA o nominal?) | ⏳ Créditos |

**Siguiente paso inmediato:** Consultar a Créditos y Tesorería los 4 pendientes. Una vez resueltos, planificar:
1. Migraciones mínimas de DB: `socios.genero`, `socios.estado_civil`, `pagos_recibos.tipo_pago`, `configuracion.codigo_coopac` (si no existe)
2. Crear `/dashboard/reportes/bdcc/page.tsx`
3. Generador BD01.txt — con datos confirmados + placeholders para parciales
4. Generador BD02-A.txt
5. BD03A/BD03B — solo encabezado
6. BD02-B y BD04 — bloqueados hasta data de créditos cancelados

**Fase 7H (importación histórica 2024/2025) → PROYECTO FUTURO SEPARADO. No implementar en esta fase.**

## Prioridad 3 — ~~Validar módulos de detalle~~ ✅ COMPLETADO

Todos verificados: `aportes/[id]`, `convenios/[id]`, `cartera/[id]`, `configuracion/convenios`.

## Prioridad 4 — ~~Verificar lógica de creación de aportes~~ ✅ COMPLETADO

Confirmado: los aportes se crean en el paso 4 del submit de `pagos/nuevo/page.tsx`. No hay triggers en Supabase.

## Prioridad 5 — Guards de rol por módulo (si el negocio lo requiere)

Decidir si los roles `tesoreria`, `creditos`, `contabilidad` deben tener acceso restringido a ciertos módulos. Si sí, agregar verificación de rol con `useRol()` al inicio de cada page relevante.

## Mejoras opcionales (baja prioridad)

- Paginación server-side en módulos con muchos registros (Socios, Créditos, Pagos)
- Eliminar el `useMemo` async en `aportes/page.tsx`
- Reemplazar los `any` con tipos correctos en egresos y reportes
- Agregar script `"typecheck": "tsc --noEmit"` al `package.json`

---

## Protocolo de autonomía controlada y ahorro de tokens

Todas las skills del proyecto operan en **modo autónomo controlado**. Claude Code:

- Lee solo los archivos mínimos necesarios para cada tarea.
- Implementa cambios aprobados sin pedir confirmación en cada paso.
- Ejecuta verificación obligatoria (lint / tsc / build) después de cada cambio de código.
- Corrige automáticamente errores causados por el cambio y repite hasta que pase.
- No termina una tarea sin haber verificado.
- No imprime archivos completos ni logs largos.

**Hard stops** (siempre pedir permiso antes de):
SQL / RPC / triggers, service role key, variables .env, instalar paquetes, borrar archivos, refactor global, lógica financiera fuera del alcance aprobado, reportes SBS sin plan aprobado.

**Definition of Done**: cambio implementado + verificación pasada + errores nuevos corregidos + docs/ai-recovery actualizado si cambió un riesgo o flujo.

---

## Skills disponibles y cuándo usarlas

Skills ubicadas en `.claude/skills/`. Invocar con `/cejuassa-<nombre>` al inicio del prompt.

| Skill | Invocar con | Cuándo usarla |
|---|---|---|
| `cejuassa-safe-change` | `/cejuassa-safe-change` | Antes de **cualquier** edición de código. Obliga a leer contexto, declarar plan mínimo y verificar al final. |
| `cejuassa-risk-review` | `/cejuassa-risk-review` | Antes de cambios en pagos, créditos, aportes, reportes SBS o API routes con service role. |
| `cejuassa-checkpoint` | `/cejuassa-checkpoint` | Antes de `/compact` o `/clear`. Actualiza documentación y genera resumen de continuación. |
| `cejuassa-verify` | `/cejuassa-verify` | Después de implementar. Ejecuta lint/tsc/build y reporta errores sin arreglar nada. |
| `cejuassa-db-plan` | `/cejuassa-db-plan` | Para cualquier cambio en Supabase: tablas, RPC, triggers, RLS. Genera plan + SQL + rollback sin ejecutar nada. |

### Flujo recomendado para un cambio típico

```
/cejuassa-safe-change   → declarar plan
/cejuassa-risk-review   → si toca lógica financiera o roles  (opcional)
[implementar el cambio]
/cejuassa-verify        → confirmar que lint/tsc/build pasan
/cejuassa-checkpoint    → antes de cerrar la sesión
```

### Flujo recomendado para un cambio de base de datos

```
/cejuassa-db-plan       → genera SQL + rollback
[usuario revisa y aprueba]
[usuario aplica en Supabase Dashboard]
/cejuassa-verify        → verifica que el código sigue funcionando
```
