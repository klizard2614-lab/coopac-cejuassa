# RISKS_AND_BUGS.md

> Riesgos y bugs detectados. Solo lo confirmado en el código.

## Riesgos altos

### ~~R1 — Sin protección de rutas a nivel de framework~~ ✅ RESUELTO (2026-06-17)

- **Diagnóstico original**: se asumía que no existía `middleware.ts` y que las rutas `/dashboard/*` quedaban desprotegidas.
- **Hallazgo**: en Next.js 16.0.0, `middleware.ts` fue deprecado y reemplazado por `proxy.ts`. El proyecto ya tiene [`proxy.ts`](../../proxy.ts) en la raíz con la lógica correcta:
  - `createServerClient` + cookies SSR para verificar sesión en cada request.
  - `supabase.auth.getUser()` — no `getSession()` (correcto para SSR).
  - Redirect a `/login` si `!user && pathname.startsWith('/dashboard')`.
  - Matcher que excluye `api`, `_next/static`, `_next/image`, `favicon.ico`.
- **Evidencia**: `.next/server/middleware.js` existe en el build, confirmando que Next.js compila y ejecuta `proxy.ts`.
- **Estado**: riesgo eliminado. No se requiere ninguna acción adicional.

### ~~R2 — Tasas de provisión hardcodeadas no respetan la configuración~~ ✅ RESUELTO (Fase 5A.1 + 5A.2, 2026-06-17)

Los tres módulos que usaban tasas hardcodeadas ahora leen desde `configuracion` (id=1):
- `reportes/anexo6/page.tsx` — Fase 5A.1 ✅
- `cartera/page.tsx` — Fase 5A.2 ✅
- `dashboard/page.tsx` — Fase 5A.2 ✅

Patrón aplicado en los 3 módulos:
- `TasasProvision` type + `TASAS_DEFECTO` const (fallback: Normal 1%, CPP 5%, Deficiente 25%, Dudoso 60%, Pérdida 100%)
- Variable local `tasasActivas` dentro de la función de carga — no depende de React state async
- Fallback a `TASAS_DEFECTO` + `setTasasWarning(true)` si la query falla
- Banner amarillo visible si se usan tasas por defecto, con enlace a Configuración
- `mora/page.tsx` auditado — no usa tasas de provisión, sin cambio requerido

Test automático: `npm run test:provision:config` — 15/15 PASS (existencia, valores >= 0, orden creciente, provision_perdida = 1.00 SBS)

### ~~R3 — Guards de rol incompletos~~ ✅ COMPLETADO (Fase 2B-5 completada 2026-06-17)

Guards implementados en Fase 2B-1:
- `creditos/nuevo/page.tsx` → solo `admin`, `creditos`
- `creditos/[id]/editar/page.tsx` → solo `admin`, `creditos`
- `pagos/nuevo/page.tsx` → solo `admin`, `tesoreria`

Guards anteriores (ya existentes):
- `configuracion/page.tsx`, `configuracion/convenios/page.tsx` → solo `admin`
- `usuarios/page.tsx`, `usuarios/nuevo/page.tsx`, `usuarios/[id]/page.tsx` → solo `admin`
- `socios/nuevo/page.tsx`, `socios/[id]/editar/page.tsx` → `admin`, `creditos`

Guards implementados en Fase 2B-2 (2026-06-17):
- `egresos/page.tsx` → botones Nuevo/Editar/Eliminar visibles solo a `['admin', 'tesoreria']`; contabilidad ve la lista en modo lectura

Guards adicionales — Fase 10A (2026-06-23):
- `egresos/page.tsx` → route guard bloquea `creditos` con `AccesoDenegado` (antes solo sidebar lo ocultaba; acceso directo por URL era posible)
- `reportes/bdcc/page.tsx` → route guard restringe BDCC a `['admin', 'contabilidad']`; `tesoreria` y `creditos` ven `AccesoDenegado`
- Script `scripts/audit-ui-roles-routes.mjs` → `npm run audit:ui-roles` 34/34 PASS (auditoría estática de guards)

UX de botones en listas implementada en Fase 2B-3 (2026-06-17):
- `socios/page.tsx` → "Nuevo Socio" y "Editar" ocultos; visibles solo a `['admin', 'creditos']`
- `creditos/page.tsx` → "Nuevo Crédito" y "Editar" ocultos; visibles solo a `['admin', 'creditos']`
- `pagos/page.tsx` → "Registrar Pago" oculto; visible solo a `['admin', 'tesoreria']`; Ver/PDF mantienen visibilidad para todos

UX de botones en listas implementada en Fase 2B-4 (2026-06-17):
- `aportes/page.tsx` → botón "Nuevo Aporte" corregido: ahora apunta a `/dashboard/pagos/nuevo`, renombrado a "+ Registrar aporte vía pago", visible solo a `['admin', 'tesoreria']`

Sidebar filtrado por rol — Fase 2B-5 (2026-06-17):
- `app/dashboard/layout.tsx` → `getVisibleItems(rol, loading)` filtra `navItems` según rol
- `admin` → ve todo
- `tesoreria` → oculta Usuarios y Configuración
- `creditos` → oculta Egresos, Usuarios y Configuración
- `contabilidad` → oculta Convenios, Usuarios y Configuración
- Durante loading (breve): nav vacío para evitar flash de desaparición de ítems

**Estado**: R3 completamente resuelto — formularios con guard + UX de botones + sidebar filtrado.

### ~~R4 — Service role key en API routes~~ ✅ RESUELTO (Fase 5B.1, 2026-06-18)

- Helper compartido `lib/api/requireAdmin.ts` creado: centraliza `getAdminClient()` + validación de sesión + validación de rol `admin`.
- `app/api/usuarios/invite/route.ts` y `app/api/usuarios/update/route.ts` refactorizados para usar el helper — código duplicado eliminado.
- `update/route.ts`: validación estricta de `rol` contra lista blanca `['admin','tesoreria','creditos','contabilidad']` — rol inválido retorna 400.
- `SUPABASE_SERVICE_ROLE_KEY` confinado a `lib/api/requireAdmin.ts` (server-side únicamente).
- Script de auditoría automática: `npm run audit:service-role` — escanea el proyecto y verifica que la key no aparezca en zonas de frontend.
- `npm run audit:service-role`: OK — 10/10 usos en zonas permitidas.
- `npm run verify:cejuassa`: tsc limpio + build 27/27.

### ~~R5 — Race condition en actualización de saldo capital~~ ✅ RESUELTO (2026-06-17)

**Resumen**: RPC `decrementar_saldo_capital` aplicada en Supabase por el usuario y verificada con el plan de pruebas completo. El UPDATE atómico con `FOR UPDATE` row lock elimina la race condition. El fallback en el frontend ya fue blindado (Fase 4B-1) para solo ejecutarse si la función no existe (`42883`/`PGRST202`). Validación de sobrepago agregada en el frontend antes del insert del recibo (Fase 4B-1.5). Riesgo residual mínimo: saldo obsoleto por concurrencia (muy baja probabilidad en operación de caja secuencial).


### ~~R6 — Race condition en cálculo de saldo de aportes~~ ✅ RESUELTO (Fase 4B-3, 2026-06-17)

- **Diagnóstico original**: `pagos/nuevo/page.tsx` leía el último aporte del socio, calculaba `saldoAnterior + montoAporte` y hacía un INSERT directo — dos pagos simultáneos podían leer el mismo `saldo_nuevo`.
- **Corrección**: el bloque de aportes fue reemplazado por `supabase.rpc('registrar_aporte_socio', {...})`. La RPC usa `pg_advisory_xact_lock(p_id_socio)` para serializar transacciones del mismo socio.
- **Migración aplicada**: `20260617000001_create_registrar_aporte_socio.sql` — confirmada en Local + Remote via `migration list`.
- **Verificación**: tsc limpio + build 27/27 páginas. Sin errores nuevos.
- **Estado**: riesgo eliminado.

### ~~R8 — Crédito sin cronograma si el bulk insert falla~~ ✅ RESUELTO (Fase 4B-4E, 2026-06-17)

- **Corrección**: `creditos/nuevo/page.tsx` refactorizado. El submit ya no usa 2 inserts separados — llama `supabase.rpc('crear_credito_con_cronograma', { p_credito, p_cuotas })`.
- Si el insert de cuotas falla, PostgreSQL hace rollback del crédito automáticamente (transacción implícita plpgsql).
- Migraciones aplicadas:
  - `20260617000002`: función base con `capital_pagado`/`interes_pagado`
  - `20260617000003`: fix cast ENUM `tipo_credito`
  - `20260617000004`: fix cast ENUM `estado_cuota` en cronograma
- Test L2 happy path: 13/13 PASS (crédito + 3 cuotas creados y verificados). Cleanup automático.
- tsc limpio + build 27/27.

### ~~R7 — Cuotas vencidas/parciales no se actualizan al pagar~~ ✅ RESUELTO (Fase 3B, 2026-06-17)

- **Diagnóstico**: el paso 3 del submit en `pagos/nuevo/page.tsx` solo buscaba cuotas con `estado='pendiente'`. Las cuotas con `estado='vencida'` o `estado='parcial'` no se actualizaban al pagar.
- **Corrección**: el filtro se cambió a `.in('estado', ['pendiente', 'vencida', 'parcial'])`. La lógica ahora acumula `capital_pagado` e `interes_pagado` (suma, no reemplaza), determina si la cuota queda `pagada` o `parcial`, y solo asigna `fecha_pago` cuando la cuota queda completamente pagada.
- **Regla de negocio aplicada**: pagos parciales son acumulativos — un pago posterior suma al capital e interés ya pagados.
- **Sobrepagos**: se registran sin limitación; la cuota queda `pagada` si el acumulado supera el monto de la cuota.
- **Archivos modificados**: `app/dashboard/pagos/nuevo/page.tsx` (solo el bloque del paso 3, líneas 270–302).
- **Verificación**: lint sin errores nuevos + tsc sin errores + build limpio.

## Bugs confirmados en código

### ~~B5 — Hydration error: `<tr>` hijo directo de `<div>` en Convenios~~ ✅ RESUELTO (2026-07-02)

- **Diagnóstico:** `DataTableEmpty` renderiza `<tr>`, pero en `convenios/page.tsx` y `convenios/[id]/page.tsx` se usaba directamente dentro de `DataTableShell` (un `<div>`) sin `<table><tbody>` intermedio. HTML inválido → error de hidratación React.
- **Corrección:** Ambos archivos envuelven ahora `DataTableEmpty` con `<table className="w-full"><tbody>...</tbody></table>` dentro del `DataTableShell`.
- **Archivos:** `app/dashboard/convenios/page.tsx` · `app/dashboard/convenios/[id]/page.tsx`

### B1 — `useMemo` async en Aportes (no bloqueante)
- Archivo: `app/dashboard/aportes/page.tsx`, línea ~99
- `const totalAnio = useMemo(async () => 0, [])` — useMemo no debe recibir función async.
- La variable `totalAnio` nunca se usa (hay un `sumaAnio` que sí funciona). No afecta la UI.

### B4 — Sin constraint de suma de porcentajes en `socio_beneficiarios` (deuda técnica, no bloqueante)
- La tabla `socio_beneficiarios` no tiene constraint que valide que la suma de `porcentaje` de todos los beneficiarios de un socio sea ≤ 100%.
- Detectado en Fase 10C.2 (prueba CRUD). El INSERT de 100% no bloquea agregar más beneficiarios.
- La validación debería ser a nivel de DB (CHECK + trigger o RPC) o en el frontend (`BeneficiariosSection.tsx`).
- **No es bloqueante** para el MVP — el módulo queda operativo. Resolver en Fase 10D si se requiere.

### B2 — `any` type en múltiples archivos
- `egresos/page.tsx`, `reportes/caja/page.tsx`, `reportes/aportes/page.tsx` usan `// eslint-disable-next-line @typescript-eslint/no-explicit-any`.
- No causa errores en producción pero reduce la seguridad de tipos.

### ~~B3~~ — Provisión constituida = provisión requerida en Anexo 6 ✅ RESUELTO (Fase 8A-1, 2026-06-20)

- **Diagnóstico original**: No existe fuente contable real para "Provisiones Constituidas" en la DB.
- **Mitigación previa** (Fase 6A.1): `provision_constituida_fuente = 'sin_fuente_contable'`, banner naranja, confirmación antes de exportar Excel.
- **Decisión contable confirmada** (Fase 7B-1, 2026-06-20): Contabilidad confirmó que C37 = C36 por deudor. No es placeholder — es la regla contable oficial para CEJUASSA.
- **Cierre formal** (Fase 8A-1, 2026-06-20):
  - `provision_constituida_fuente` cambiado a `'criterio_contable_confirmado'`
  - Banner naranja de advertencia reemplazado por nota informativa azul: "Provisiones Constituidas calculadas igual a Provisiones Requeridas según criterio confirmado por Contabilidad."
  - Mensaje inline "sin fuente contable" eliminado de la tabla.
  - `window.confirm` innecesario antes de exportar Excel eliminado.
  - `npm run check:provision:constituida` 10/10 PASS.
- **No se requiere tabla `provisiones_mensuales`** — descartada para el alcance actual.
- **Estado**: RESUELTO. C37 = C36 por criterio contable oficial.

### R-K — Pagos mixtos en pagos_recibos (Fase 10K-0, 2026-07-02)

- **Hallazgo:** 25 de los 28 pagos vinculados a crédito son "mixtos" — contienen `monto_capital > 0` Y `monto_aporte > 0` o `monto_fps > 0` en el mismo recibo. Esto es correcto (los socios pagan cuota + aporte + FPS en un solo recibo).
- **Riesgo:** Si el split de campos en `pagos_recibos` es incorrecto (ej. el monto_capital importado no corresponde exactamente al capital de cuota), la aplicación de pagos a cuotas quedaría con montos inexactos.
- **Mitigación:** El split existe y fue importado desde Excel del cliente. Antes del apply, verificar 2-3 casos con Tesorería para confirmar que `monto_capital + monto_interes` corresponde exactamente al pago de la cuota.
- **Severidad:** Media — afecta solo a los 25 pagos mixtos, no a la estructura del sistema.
- **Estado:** Activo — pendiente verificación con Tesorería antes del apply (Fase 10K-2).

### ~~R-K3~~ — Registro de pago nuevo actualiza solo 1 cuota, sin tope ni trazabilidad ✅ RESUELTO (Fase 10K-3C, 2026-07-04)

- **Hallazgo:** Al auditar `app/dashboard/pagos/nuevo/page.tsx` para diseñar la lógica de pagos nuevos (Fase 10K-3A), se confirmó que el flujo actual de registro de pago (vigente en producción) solo actualiza **una** cuota (la más antigua pendiente/vencida/parcial), sin cascada a las siguientes aunque el monto alcance para cubrir varias, **sin tope** (puede escribir `capital_pagado`/`interes_pagado` por encima del `capital`/`interes` real de la cuota si el monto pagado es mayor a lo que falta), y **sin insertar** ninguna fila en `pagos_cuotas_aplicaciones` (tabla de trazabilidad creada en Fase 10K-1 pero nunca consumida por este flujo).
- **Riesgo:** Un socio que paga 2+ meses de una vez, o un monto ligeramente mayor al de la cuota, deja datos incoherentes en `cronograma_cuotas` (cuota con `capital_pagado` mayor a `capital`) o cuotas siguientes que no reflejan el pago ya cobrado, sin trazabilidad de qué pago causó qué cambio.
- **Mitigación:** RPC transaccional `registrar_pago_con_aplicacion` con cascada, tope por cuota y trazabilidad completa — diseñada en `docs/ai-recovery/PAGOS_CUOTAS_10K_3A_LOGICA_NUEVOS_PAGOS.md`, SQL final en `docs/ai-recovery/PAGOS_CUOTAS_10K_3B_RPC_PLAN.md`, **aplicada** en Supabase remoto (Fase 10K-3B, 2026-07-04) tras autorización explícita `APLICAR RPC PAGOS NUEVOS 10K-3B` — incluye índice único `pagos_recibos_nro_recibo_unique_idx` (Fase 10K-3B.1, 0 duplicados confirmados sobre 832 pagos antes de aplicar). **UI integrada en Fase 10K-3C (2026-07-04):** `app/dashboard/pagos/nuevo/page.tsx` ahora llama `registrar_pago_con_aplicacion` a través de `lib/pagos/registrarPagoConAplicacion.ts`, y ya no inserta directo en `pagos_recibos`, ni llama `decrementar_saldo_capital`, ni actualiza manualmente `cronograma_cuotas`. Ver `docs/ai-recovery/PAGOS_CUOTAS_10K_3C_UI_INTEGRATION_REPORT.md`.
- **Severidad:** Media-Alta — afectaba todo pago nuevo que no coincida exactamente con el monto de una sola cuota (caso común en la operación real).
- **Estado:** **RESUELTO por completo.** El diseño (cascada, tope, trazabilidad) está correcto, la UI la invoca correctamente, y el bug bloqueante distinto que impedía ejecutarla (R-K4) fue corregido en Fase 10K-3B.2. El aporte (`monto_aporte`) sigue siendo una segunda operación separada (`registrar_aporte_socio`, llamada después de que la RPC de pago tenga éxito) — riesgo residual menor, sin relación con R-K4, documentado y diferido a una eventual Fase 10K-3D si se decide integrarlo en la misma transacción.

### ~~R-K4~~ — `registrar_pago_con_aplicacion` no podía insertar pagos: `canal_pago` texto vs enum ✅ RESUELTO (Fase 10K-3B.2, 2026-07-04)

- **Hallazgo:** Prueba controlada ejecutada (autorización `EJECUTAR PRUEBA CONTROLADA PAGOS 10K-3C.1`) contra Supabase remoto encontró que `registrar_pago_con_aplicacion` fallaba con `42804: column "canal_pago" is of type canal_pago but expression is of type text` al intentar el `INSERT INTO pagos_recibos` interno. `pagos_recibos.canal_pago` es un **enum de Postgres** (`udt_name=canal_pago`); la función declaraba `p_canal_pago text DEFAULT 'caja'` y lo insertaba vía `COALESCE(p_canal_pago, 'caja')` — seguía siendo `text`, sin cast a `canal_pago`.
- **Riesgo (mientras estuvo activo):** esta sección de la RPC (Sección B — `INSERT INTO pagos_recibos`) se ejecuta **incondicionalmente para todo pago**, con o sin crédito. Bloqueaba el 100% de los pagos nuevos vía `pagos/nuevo` (integrada con esta RPC desde 10K-3C) y llamando la RPC directamente.
- **Por qué no se detectó en 10K-3B/10K-3C:** los checks de esas fases (`check:pagos-cuotas-10k3b`, `check:pagos-cuotas-10k3c`) son verificaciones estáticas por texto/regex — nunca ejecutaron la función contra la base real. La prueba 10K-3C.1 fue la primera invocación real desde que se aplicó.
- **Confirmado sin efectos secundarios en su detección:** la prueba se ejecutó como un único statement SQL que aborta automáticamente ante cualquier error — Postgres revirtió todo. Conteos antes/después idénticos, 0 datos de prueba persistentes.
- **Corrección aplicada — Fase 10K-3B.2 (2026-07-04), autorización `APLICAR HOTFIX CANAL PAGO 10K-3B.2`:** `registrar_pago_con_aplicacion` ahora normaliza/valida `p_canal_pago` contra el enum real (`caja`/`convenio`) y solo entonces lo castea a `public.canal_pago` en una variable tipada, antes de insertar. Rechaza valores inválidos con `canal_pago_invalido` (mensaje claro, en vez de un error críptico de Postgres). Aplicada vía Supabase MCP `apply_migration` (no `db push`); migración: `supabase/migrations/20260704140000_10k3b2_hotfix_registrar_pago_canal_pago.sql`.
- **Verificado post-apply:** función existe, firma sin cambios, `anon` sin `EXECUTE`, datos sin cambios (`pagos_recibos`=832, `pagos_cuotas_aplicaciones`=0).
- **Prueba controlada 10K-3C.1 repetida con éxito tras el hotfix:** pago exacto ✅, pago parcial ✅, rechazo de recibo duplicado ✅, rechazo de `canal_pago` inválido ✅ (confirma el fix), trazabilidad ✅ (2 filas en `pagos_cuotas_aplicaciones` dentro de la transacción), rollback ✅ (conteos después idénticos a antes, 0 datos de prueba persistentes). Detalle completo: `docs/ai-recovery/PAGOS_CUOTAS_10K_3B2_HOTFIX_CANAL_PAGO.md`.
- **Severidad (histórica):** Crítica — bloqueaba el 100% de los pagos nuevos vía el flujo integrado.
- **Estado:** **RESUELTO.** `pagos/nuevo` queda apta para operación.

### R-K2 — Pago 411**** con monto excesivo (Fase 10K-0, 2026-07-02)

- **Hallazgo:** El pago 411**** (crédito 1138****) tiene `monto_capital + monto_interes = S/1,896.96` para una cuota de S/285.59. Con el algoritmo de cascada, este pago cubriría 6 cuotas completas y una parcial.
- **Riesgo:** Si es un error de importación (ej. el monto real es S/189.69 y hubo un dígito extra), el apply estaría marcando cuotas que no deberían estar pagadas.
- **Mitigación:** Verificar con Tesorería si el recibo 411**** corresponde a un prepago real de múltiples cuotas.
- **Severidad:** Alta — afecta 7 cuotas en un crédito si el monto es correcto, o genera error si no lo es.
- **Estado:** Activo — pendiente verificación con Tesorería antes del apply (Fase 10K-2). Reconfirmado en Fase 10K-2A (2026-07-04) como el único caso `monto_alto` sobre los 28 pagos vinculados — ver `PAGOS_CUOTAS_10K_2A_DRY_RUN_REPORT.md`. Paquete de revisión simple para Tesorería preparado en Fase 10K-2A.1 (2026-07-04) — ver `PAGOS_CUOTAS_10K_2A_REVISION_MANUAL.md` y `exports/pagos-cuotas-dryrun/10k_2a_casos_para_revision_manual.xlsx`.

### ~~R-SEC-A03 — RLS amplio en socio_beneficiarios y pagos_cuotas_aplicaciones~~ ✅ RESUELTO (SEC-3C, 2026-07-03)

- **Hallazgo original (SEC-0/SEC-3A):** Ambas tablas tenían una sola policy `FOR ALL TO authenticated USING (true) WITH CHECK (true)` — cualquier usuario autenticado podía CRUD sin restricción de rol.
- **Riesgo:** Un usuario de contabilidad podía borrar beneficiarios de socios o insertar aplicaciones de pago falsas vía API directa.
- **Solución aplicada:** Migración `supabase/migrations/20260702000010_sec3c_rls_hardening.sql` aplicada en remoto `ljdjbhsipgkxlgnprzhm`.
- **Modelo resultante:**
  - `socio_beneficiarios`: admin=CRUD, tesoreria=S/I/U, creditos=S, contabilidad=S
  - `pagos_cuotas_aplicaciones`: admin=CRUD, tesoreria=S/I, creditos=S, contabilidad=S
- **Verificación:** `npm run check:rls-sec3c` 41/41 PASS · RLS enabled en ambas tablas · `get_user_rol()` en todas las expressions · policies `USING (true)` eliminadas.
- **Estado:** RESUELTO.

### ~~R-K3 — Sin trazabilidad pago→cuota~~ ✅ RESUELTO (Fase 10K-1, 2026-07-02)

- **Hallazgo original:** La tabla `cronograma_cuotas` no tenía FK a `pagos_recibos`.
- **Solución:** Tabla intermedia `pagos_cuotas_aplicaciones` creada y aplicada en Supabase (`ljdjbhsipgkxlgnprzhm`). FK RESTRICT a pagos_recibos + cronograma_cuotas + creditos. Columna GENERATED `monto_aplicado`. RLS ON.
- **Migración:** `supabase/migrations/20260702000003_create_pagos_cuotas_aplicaciones.sql` — Local + Remote ✅.
- **Estado:** RESUELTO — tabla operativa en producción. Fase 10K-2 (apply) puede proceder cuando se liberen los pendientes de Créditos/Tesorería.

---

### Patrón conocido — RPC signature conflict en Supabase (Fase 10J-2B, 2026-07-02)

`CREATE OR REPLACE FUNCTION` falla con `42725: function name is not unique` si la firma (tipos de parámetros) cambia respecto a la versión anterior. Supabase no puede resolver el overload automáticamente.

**Solución probada:** `DROP FUNCTION IF EXISTS public.nombre_funcion(arg1_type, arg2_type, ...)` primero, luego `CREATE OR REPLACE`. La migración de Fase 10J-2B implementó este patrón con éxito. Aplicar siempre que se extienda la firma de una RPC existente.

---

### Observación confirmada — Integridad numérica de créditos PASS (Fase 9C-6J-FUNC, 2026-06-23)

`npm run smoke:demo-app` — 28/28 PASS. Confirmado:
- 0 créditos con `monto_aprobado`, `saldo_capital`, `cuota_mensual`, `tasa_interes` o `plazo_meses` NULL.
- 0 créditos con `tasa_interes` fuera del rango 1–100 (todos = 26.82).
- 26/26 créditos vigentes tienen cronograma generado.
- Campos demo regulatorios `genero`/`estado_civil`/`subtipo_credito_sbs` poblados (valores temporales — no oficiales SBS).
- No se detectaron NaN/undefined en campos de exportación de Anexo 6 ni reportes.
- BDCC marcado explícitamente como DEMO en UI — sin riesgo de envío accidental.

### Observación confirmada — 804 pagos con id_credito NULL (no es bug crítico)

**Fase 9C-6F apply (2026-06-22):** Tras vincular los 28 match_alto, quedan 804 pagos con `id_credito = NULL`. Desglose:
- **417 no_aplica_credito**: pagos de solo aporte/FPS/otros — correcto que no tengan id_credito.
- **384 sin_match**: socios sin crédito importado. Esperado — convenio puro (descuentos planilla sin deuda activa con CEJUASSA).
- **3 match_medio**: fuera de rango de fecha — revisión preparada en Fase 9C-6G. Excel: `exports/data-corrections/revision_pagos_match_medio.xlsx`. Pendiente: área de Créditos completa `decision_creditos`. Siguiente: Fase 9C-6H (apply).
No hay acción correctiva requerida para los 801 pagos restantes (417 + 384). Los 3 match_medio son el único pendiente de decisión.

---

### ~~R9 — cronograma_cuotas vacío con créditos cargados~~ ✅ RESUELTO (Fase 9C-6D, 2026-06-22)

- **Diagnóstico original**: créditos importados directamente sin pasar por la app; `cronograma_cuotas` quedó en 0.
- **Resolución**: `scripts/apply-regenerate-cronogramas.mjs` — insertó **911 cuotas** para los 26 créditos vigentes. Sistema francés, tasa 26.82% TEA.
- **Validación**: `check:cronogramas:apply` 18/18 PASS · `audit:post-excel-import` confirma 911 · `verify:cejuassa` OK.
- **Riesgo residual actualizado (Fase 9C-6H.0, 2026-06-22)**: Dry-run de cuotas completado. 26 cuotas propuestas como `parcial`, 0 como `pagada`. Esto revela que los pagos importados de marzo 2026 representan pagos parciales de la cuota mensual — monto_capital + monto_interes < cuota_total en todos los casos. Significa que los socios pagan en múltiples abonos y solo se importó parte del historial. 2 pagos no asignables: 1 crédito cancelado sin cronograma (esperado), 1 pago sin componente de crédito (monto_capital=0). **Recomendación: esperar los 3 match_medio antes del apply de cuotas (Fase 9C-6H.1).**
- **Estado**: RESUELTO. `cronograma_cuotas` = 911 en Supabase. Dry-run de aplicación completado. Siguiente: apply de cuotas (Fase 9C-6H.1) tras confirmar match_medio.

### ~~B4 — Bug en `audit-post-excel-import.mjs`: sección C reportaba "31 sin cronograma"~~ ✅ RESUELTO (Fase 9C-6D.1, 2026-06-22)

- **Archivo**: `scripts/audit-post-excel-import.mjs`, sección C "Auditando créditos"
- **Síntoma original**: `Sin cronograma_cuotas` mostraba `31 (todos — tabla vacía)` aunque había 911 registros. La sección G mostraba `❌ Vacío`.
- **Causa**: `creditosSinCronograma = creditos.length` hardcodeado — no consultaba la tabla. Secciones G y resumen ejecutivo también eran texto fijo.
- **Corrección**: fetch de `id_credito` desde `cronograma_cuotas` → Set de IDs con cuotas → separación vigentes/cancelados con/sin cronograma. Secciones C, G y resumen ahora son dinámicos.
- **Resultado post-fix**: vigentes con cronograma 26/26 · vigentes sin cronograma 0 · cancelados sin cronograma 5 (no crítico). Solo 2 críticos activos: género y estado_civil.
- **Estado**: RESUELTO.

### ~~B5 — Anexo 6 Excel export: cuenta contable incorrecta~~ ✅ RESUELTO (Fase 10B, 2026-06-23)

- **Archivo**: `app/dashboard/reportes/anexo6/page.tsx`, función `handleExportar`
- **Síntoma**: exportación Excel hardcodeaba `'1411030604'` en columna Cuenta Contable (col 25). El valor correcto es `'1411050604'` (confirmado en Fase 7B-1 con Contabilidad).
- **Corrección**: `'1411030604'` → `'1411050604'`.
- **Estado**: RESUELTO.

### ~~B6 — BDCC: `por_confirmar` en subtipo_credito_sbs no generaba advertencia~~ ✅ RESUELTO (Fase 10B, 2026-06-23)

- **Archivo**: `app/dashboard/reportes/bdcc/page.tsx`, función `generarBD01()`
- **Síntoma**: la condición `if (!subtipcred)` solo detectaba vacíos. El valor `'por_confirmar'` (32 caracteres, no vacío) pasaba sin advertencia — el TXT se generaba con este valor demo sin avisar.
- **Corrección**: condición cambiada a `if (!subtipcred || subtipcred === 'por_confirmar')` + mensaje de advertencia específico: "SUBTIPCRED inválido (vacío o "por_confirmar") — confirmar con área de Créditos".
- **También corregido en esta fase**: banner DEMO rojo prominente en BDCC ("🚫 DEMO — NO ENVIAR A SBS") y banner DATOS DE PRUEBA en Anexo 6.
- **Estado**: RESUELTO.

---

### R10 — Ampliaciones no actualizan tasa/plazo/cuota en creditos (Fase 10J-2 pendiente)

- **Diagnóstico (Fase 10J-2, 2026-07-02):** La RPC `aplicar_ampliacion_credito` actualiza solo `nro_pagare`, `monto_aprobado` y `saldo_capital`. Según decisión de la contadora, en una ampliación también deben cambiar `tasa_interes`, `plazo_meses` y `cuota_mensual` en `creditos`.
- **Impacto:** Si se registra una ampliación con nueva tasa o plazo, el registro en `creditos` queda con los valores anteriores (inconsistencia entre `ampliaciones` y `creditos`).
- **Tabla `ampliaciones` también incompleta:** faltan columnas `tasa_nueva` y `cuota_nueva`.
- **UI:** No tiene campos para ingresar tasa nueva ni cuota nueva.
- **Severidad:** Alta — pero solo afecta flujo de ampliaciones, no pagos ni cronograma.
- **No es bloqueante** para operación actual — la Fase 10J-1 funciona correctamente para monto y pagaré.
- **Plan:** Ver Fase 10J-2 en NEXT_STEPS.md. Requiere migración y nueva versión de RPC con autorización del usuario.

---

## Riesgos bajos / deuda técnica

| Item | Detalle |
|---|---|
| Sin tests | Cero cobertura. Cambios pueden romper sin aviso. |
| Fetching solo client-side | Todo con `useEffect`. Sin SSR ni caching. Puede ser lento con datos grandes. |
| Sin paginación server-side | Los módulos con muchos registros cargan todos de una vez (excepto Anexo 6 que pagina en cliente). |
| ~~Link hardcodeado a Supabase~~ | ✅ RESUELTO SEC-1 — URL derivada de `NEXT_PUBLIC_SUPABASE_URL`. |
| `sharp` en node_modules | Dependencia indirecta pesada. No es problema funcional pero aumenta tamaño del deploy. |

---

## Riesgos de seguridad identificados en Fase SEC-0 (2026-07-02)

Ver reporte completo: `docs/ai-recovery/SECURITY_AUDIT_REPORT.md` · Plan de hardening: `docs/ai-recovery/SECURITY_HARDENING_PLAN.md` · Matriz: `exports/security/security_risk_matrix.xlsx`

### SEC-A01 — Sin headers HTTP de seguridad ~~(ALTO)~~ ✅ RESUELTO SEC-1 (2026-07-02)
- ~~`next.config.ts` vacío~~ → 6 headers implementados: X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, HSTS, CSP-Report-Only.
- CSP activa con nonces pendiente en SEC-1B.

### SEC-A02 — `xlsx` con vulnerabilidad HIGH (ALTO, sin fix disponible)
- Prototype Pollution + ReDoS en `xlsx ^0.18.5`. Sin fix disponible en npm.
- Riesgo práctico BAJO — la app solo exporta archivos, no lee archivos de usuarios externos.
- **Plan futuro:** DEP-1 — evaluar migración a `exceljs` antes de operación con usuarios externos.

### SEC-A03 — RLS demasiado amplio en tablas nuevas (ALTO, pendiente)
- `socio_beneficiarios` y `pagos_cuotas_aplicaciones`: `FOR ALL TO authenticated USING (true)`.
- Cualquier usuario autenticado puede INSERT/UPDATE/DELETE directamente via Supabase API.
- **Plan:** SEC-3 — refinar policies (requiere autorización DB explícita).

### SEC-A04 — Roles solo en frontend (ALTO, pendiente)
- Restricciones de rol (tesorería, créditos, contabilidad) son exclusivamente client-side.
- Un usuario con cliente Supabase directo puede saltear guards.
- **Plan:** SEC-3 — RLS por rol en DB (requiere autorización DB explícita).

### SEC-B: Riesgos medios
- ~~B01: `id` sin validación UUID en `update/route.ts`~~ ✅ RESUELTO SEC-2 — UUID_REGEX validado
- ~~B02: Mensajes de error internos al cliente~~ ✅ RESUELTO SEC-2 — `lib/api/errors.ts` sanitiza
- B05: `postcss` vulnerable via next (sin fix seguro) → monitorear actualizaciones Next.js
- ~~B06: `dompurify` vulnerable~~ ✅ RESUELTO SEC-1 — `npm audit fix` aplicado
- B07: Reportes y cartera sin guard de rol → SEC-6 (decisión de negocio)
- B08: Rate limiting diferido — no confiable en serverless sin Redis. SEC-2.4 → producción.

### SEC-C: Riesgos bajos
- C02: Sin backups automatizados → SEC-5
- C03: Sin audit log financiero → SEC-4
- ~~C04: URL hardcodeada en configuración~~ ✅ RESUELTO SEC-1 — derivada de NEXT_PUBLIC_SUPABASE_URL
