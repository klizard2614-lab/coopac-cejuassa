# AI_HANDOFF.md

> Contexto completo para que otro chat de IA continúe sin leer el repositorio.
> Pegar este archivo al inicio de una nueva conversación.

---

## Proyecto: CEJUASSA App

Sistema de gestión para una cooperativa de ahorro y crédito (COOPAC) peruana llamada CEJUASSA.

## Stack

- **Next.js 16.2.7** con App Router (puede diferir de Next.js 13/14 — revisar docs antes de escribir código)
- **React 19** + **TypeScript 5**
- **Tailwind CSS v4** (PostCSS plugin — sin `tailwind.config.js`)
- **Supabase** como backend completo (Auth + DB)
- **jspdf + jspdf-autotable** para PDFs
- **xlsx** para Excel
- **lucide-react** para iconos, **recharts** para gráficos
- **@playwright/test 1.61.1** — tests e2e (instalado Fase TOOLING-0, 2026-06-30)

## UI — Sistema de componentes (Fase UI-PRO-1 — 2026-07-02)

`app/dashboard/_components/ui.tsx` exporta:

**Componentes ejecutivos del dashboard (UI-PRO-0B):**
- `ExecutiveMetricPanel` — panel cartera con borde institucional, saldo dominante, sub-métricas
- `RiskPanel` — panel mora/riesgo con estado visual fuerte, enlace a mora
- `CompactKpi` — KPI en fila dividida (sin card individual)
- `FinanceChartPanel` — wrapper de gráfico con título editorial
- `PeriodBadge` — badge de período actual
- `OperationalAlert` — indicador de estado operativo con dot animado
- `DividerLabel` — separador con label

**Componentes de pantallas secundarias (UI-PRO-1):**
- `PageFrame` — wrapper de página: `min-h-full bg-slate-50 p-6 lg:p-8`
- `PageToolbar` — header de página: título, subtítulo, acciones, meta
- `FilterBar` — barra de filtros y búsqueda
- `DataTableShell` — wrapper blanco redondeado con borde para tablas
- `DataTableHeader` — `<thead>` con `bg-slate-50 border-b border-slate-200`
- `DataTableEmpty` — estado vacío dentro de `<tbody>` con colspan
- `DetailHero` — hero de detalle: título, subtítulo, badge, acciones, borde navy izquierdo
- `DetailSection` — sección de detalle con título y acción opcional
- `FieldGrid` — grid de campos: cols 2, 3 o 4
- `FieldItem` — par etiqueta/valor: soporta `mono`, `accent`, `span`
- `FormPanel` — wrapper de formulario blanco con borde
- `FormSection` — sección de formulario con título y descripción
- `ActionStrip` — barra de acciones al pie alineada a la derecha
- `InlineAlert` — alerta inline: `info`, `warning`, `danger`, `success`
- `FinancialValue` — valor monetario S/ formateado con Intl.NumberFormat
- `RiskBadge` — badge de clasificación SBS (normal/cpp/deficiente/dudoso/pérdida)
- `CompactStat` — estadística compacta horizontal para barras de resumen
- `RecordMeta` — metadata de registro (creado por, fecha, etc.)

**Componentes legacy (compatibilidad):**
- `MetricCard`, `SectionHeader`, `ChartCard`, `EmptyChartState`
- `StatusBadge`, `TrendIndicator`, `MiniStat`
- `PageHeader`, `EmptyState`, `TableSkeleton`, `ResultCount`
- Constantes: `btnPrimary`, `btnGhost`, `btnEdit`, `btnDanger`, `inputCls`, `selectCls`

Dashboard principal (`app/dashboard/page.tsx`): layout ejecutivo asimétrico — ExecutiveMetricPanel (7 cols) + RiskPanel (5 cols), fila CompactKpi x4, gráficos FinanceChartPanel asimétrico (7/5), área aportes full-width. Paleta PALETTE institucional sin #1A56DB.
Pantallas rediseñadas en UI-PRO-1: socios, créditos, pagos, aportes, egresos, cartera, mora, convenios, ampliaciones, socios/[id], créditos/[id], cartera/[id], convenios/[id], aportes/[id], socios/nuevo, socios/editar, créditos/nuevo, créditos/editar, pagos/nuevo, SocioForm, reportes, usuarios, configuración.
Dirección visual: `docs/ai-recovery/CEJUASSA_UI_PRO_DESIGN_DIRECTION.md`
Check: `npm run check:ui-pro-redesign` → **24/24 PASS**

**Logo (2026-07-02):** `public/logo-cejuassa.svg` — SVG del logo oficial COOPAC CEJUASSA LL Trujillo (círculo azul, personaje, dos pinos verdes, texto arco). Reemplaza `logo-cejuassa.png`. Referenciado en `app/dashboard/layout.tsx` → `src="/logo-cejuassa.svg"`.

**Bug fix (2026-07-02):** `convenios/page.tsx` y `convenios/[id]/page.tsx` — hydration error corregido: `DataTableEmpty` (`<tr>`) envuelta en `<table><tbody>` dentro de `DataTableShell`. Ver B5 en RISKS_AND_BUGS.md.

## Skills y herramientas (Fase TOOLING-0 — 2026-06-30)

Ver documento completo: `docs/ai-recovery/TOOLING_AND_SKILLS_SETUP.md`

| Herramienta | Estado |
|---|---|
| `emil-design-eng` + `animation-vocabulary` + `review-animations` | ✅ Skills instaladas |
| Playwright `@playwright/test@1.61.1` | ✅ Instalado — requires `npx playwright install chromium` first run |
| Context7 MCP | ⏳ Pendiente — ver instrucciones en TOOLING_AND_SKILLS_SETUP.md |
| Superpowers | ❓ Sin confirmar |
| Caveman | ❓ Sin confirmar |

**Nuevos comandos E2E:**
```bash
npx playwright install chromium   # Solo primera vez
npm run test:e2e                  # Todos los tests (dev server must be running)
npm run test:e2e:smoke            # Smoke básico
npm run audit:tooling-setup       # Auditar tooling
```

## Estructura de datos (tablas Supabase)

- `socios` — (nro_socio, dni, apellidos, nombres, estado, id_convenio, fecha_nacimiento, direccion, beneficiario_nombre, beneficiario_dni, beneficiario_parentesco [legacy — campos únicos], genero, estado_civil)
- `socio_beneficiarios` — (socio_id FK→socios.id, nombres, dni, parentesco, porcentaje, es_principal, observacion, created_at, updated_at) — tabla nueva para múltiples beneficiarios; RLS ON, policies granulares por rol: sb_select/sb_insert/sb_update/sb_delete (admin=CRUD, tesoreria=S/I/U, creditos=S, contabilidad=S) — SEC-3C aplicada 2026-07-03
- `creditos` — (nro_pagare, id_socio, monto_aprobado, monto_girado_neto, descuento_fps, descuento_seguro, descuento_otros, saldo_capital, cuota_mensual, tasa_interes, plazo_meses, tipo_credito, estado, fecha_desembolso, interes_acumulado)
- `cronograma_cuotas` — (id_credito, nro_cuota, fecha_vencimiento, capital, interes, cuota_total, capital_pagado, interes_pagado, estado, fecha_pago) — generado en bulk al crear el crédito
- `pagos_recibos` — (id_socio, id_credito, id_convenio, nro_recibo, fecha, periodo YYYY-MM, canal_pago, estado_flujo, monto_aporte, monto_capital, monto_interes, monto_fps, monto_fps_extra, monto_otros, monto_total, interes_amortizado_pagado, observacion)
- `aportes` — (id_socio, id_recibo, fecha, tipo, monto, saldo_anterior, saldo_nuevo, observacion, created_by)
- `egresos` — (fecha, tipo, monto, beneficiario, descripcion, id_socio, created_by)
- `convenios` — (nombre, ruc, contacto, telefono, activo)
- `usuarios` — (id = auth UUID, nombre, email, rol, activo)
- `configuracion` — fila única (id=1) con: nombre_cooperativa, codigo_coopac, ruc, direccion, telefono, email, tasa_interes_anual, tasa_fps, provision_normal, provision_cpp, provision_deficiente, provision_dudoso, provision_perdida

## Auth y roles

- Login: email + contraseña vía Supabase Auth
- Roles: `admin`, `tesoreria`, `creditos`, `contabilidad`
- `lib/supabase.ts` exporta `createClient()` (browser) — usado en todos los componentes
- `lib/useRol.ts` exporta `useRol()` — hook para obtener rol del usuario actual
- Las API routes (`/api/usuarios/invite` y `/api/usuarios/update`) son las únicas que usan service role key
- Guard de rol (Fases 2B-1 a 2B-5 completadas 2026-06-17): `creditos/nuevo`, `creditos/[id]/editar` → `['admin','creditos']`; `pagos/nuevo` → `['admin','tesoreria']`; `egresos` → botones ocultos `['admin','tesoreria']`; listas `socios`, `creditos`, `pagos` → botones crear/editar ocultos según rol; `aportes/page.tsx` → botón corregido; sidebar → filtrado por rol (`layout.tsx`)
- **Fase 10A (2026-06-23):** route guard en `egresos/page.tsx` bloquea `creditos` con AccesoDenegado; route guard en `reportes/bdcc/page.tsx` restringe a `['admin','contabilidad']`; script `audit:ui-roles` 34/34 PASS

## Estado actual de datos (2026-06-23 — Fase 10E completada)

**Estado actual de la DB tras Fase 9C-4B (importación desde Excel ejecutada 2026-06-21):**

| Tabla | Registros |
|---|---|
| `convenios` | **8** |
| `socios` | **782** |
| `creditos` | **31** (26 vigentes, 5 cancelados) |
| `pagos_recibos` | **832** |
| `aportes` | **785** |
| `cronograma_cuotas` | **911** ✅ (Fase 9C-6D, 2026-06-22) |
| `egresos` | 0 |
| `usuarios` *(conservado)* | 2 |
| `configuracion` *(conservada)* | 1 |

- **Fuente de importación:** Excel del proyecto (`_client_files/raw/extracted/Archvos app/`)
- **Script:** `scripts/import-excel/import-excel-mvp.mjs --apply`
- **Período cubierto:** marzo 2026 (solo datos de ese mes)
- **Verificación:** `verify:cejuassa` OK · `check:excel-import-mvp` 31/31 PASS
- **cuenta_contable_bd01:** '1411050604' ya correcta en todos ✅ · tipo_pago: ya correcto en todos ✅
- **tasa_interes:** ✅ **RESUELTO (Fases 9C-6B + 9C-6C.2, 2026-06-22)** — Valor final: `26.82` (porcentaje, no decimal) en 31/31 créditos. La app usa `r = tasa/100/12`, por lo que el valor debe ser porcentaje. Corregido de `0.2682 → 26.82` en Fase 9C-6C.2.
- **cronograma_cuotas:** ✅ **COMPLETADO (Fase 9C-6D, 2026-06-22)** — 911 cuotas insertadas para 26 créditos vigentes. `check:cronogramas:apply` 18/18 PASS. Cuotas en estado `pendiente` (vinculación con pagos es Fase 9C-6E). `creditos`/`pagos_recibos` no modificados.
- **audit:post-excel-import:** ✅ **BUG CORREGIDO (Fase 9C-6D.1, 2026-06-22)** — Script ahora consulta `cronograma_cuotas` por `id_credito` y separa vigentes/cancelados. Reporta: 911 cuotas · 26/26 vigentes con cronograma · 5 cancelados sin cronograma (no crítico). Solo quedan 2 críticos: género y estado_civil.
- **pagos_recibos.id_credito:** ✅ **APPLY COMPLETADO (Fase 9C-6F, 2026-06-22)** — 28 pagos match_alto vinculados. `pagos_recibos.id_credito` actualizado para 28 registros. Solo se tocó ese campo. `cronograma_cuotas`, `creditos`, `socios` NO modificados. Pagos restantes con id_credito=NULL: **804**. Scripts: `pagos:link-creditos:apply:dry-run` · `pagos:link-creditos:apply` · `check:pagos-link-creditos-apply` (39/39 PASS). Reportes: `docs/ai-recovery/PAGOS_CREDITOS_LINK_APPLY_DRY_RUN.md` · `PAGOS_CREDITOS_LINK_APPLY_REPORT.md`. Pendiente: 3 match_medio requieren revisión manual. 804 pagos restantes (417 no_aplica + 384 sin_match + 3 match_medio).
- **match_medio (3 pagos) — REVISIÓN PREPARADA (Fase 9C-6G, 2026-06-22):** Excel de revisión generado en `exports/data-corrections/revision_pagos_match_medio.xlsx` con los 3 casos (IDs enmascarados). Documento de instrucciones: `docs/ai-recovery/PAGOS_MATCH_MEDIO_REVIEW.md`. `check:pagos-match-medio-review` 15/15 PASS. DB NO modificada. **Pendiente:** área de Créditos debe completar columna `decision_creditos` (valores: `vincular_al_credito_propuesto` / `no_vincular` / `credito_faltante_en_importacion` / `requiere_revision`). Siguiente fase: 9C-6H.1 (apply de cuotas tras confirmar match_medio).
- **pagos→cuotas DRY-RUN COMPLETADO (Fase 9C-6H.0, 2026-06-22):** Simulación de los 28 pagos vinculados sobre cronograma_cuotas. 26 cuotas propuestas como parciales, 0 pagadas, 2 no asignables. Todos los pagos representan pagos parciales de la cuota mensual (monto_capital + monto_interes < cuota_total). Crédito 1145**** sin cronograma (es cancelado — esperado). Pago 1232**** solo tiene aporte/FPS. Scripts: `pagos:to-cuotas:dry-run` · `check:pagos-to-cuotas-plan` (37/37 PASS). Preview: `docs/ai-recovery/proposed_cuotas_payment_updates_preview.json`. Reporte: `PAGOS_TO_CUOTAS_DRY_RUN_REPORT.md`. **Recomendación: esperar decisión de los 3 match_medio antes de apply.**
- **Fase 10K-3B.2 — Hotfix canal_pago (R-K4) — ✅ APLICADA EN SUPABASE REMOTO (2026-07-04):**
  - Corrige R-K4: `registrar_pago_con_aplicacion` normaliza/valida
    `p_canal_pago` contra el enum real (`caja`/`convenio`, confirmado por
    auditoría de solo lectura vía `pg_enum`) y solo entonces lo castea a
    `public.canal_pago` en una variable tipada — reemplaza el
    `COALESCE(p_canal_pago,'caja')` (texto sin cast) que causaba `42804`.
  - Auditoría confirmó que `canal_pago` es la única columna afectada:
    `estado_flujo` (también enum) se inserta como literal sin tipo (no
    requiere corrección), `tipo_pago` es `text` plano (no requiere
    corrección).
  - **Aplicado vía Supabase MCP `apply_migration`** (nombre
    `10k3b2_hotfix_registrar_pago_canal_pago`, no `db push`), con la misma
    firma exacta de 10K-3B, mismo `SECURITY DEFINER`/`search_path`/
    `REVOKE`/`GRANT`, resto de la lógica (cascada, tope, trazabilidad)
    idéntico. Migración local:
    `supabase/migrations/20260704140000_10k3b2_hotfix_registrar_pago_canal_pago.sql`.
  - **Verificado post-apply:** función existe, firma sin cambios,
    `SECURITY DEFINER=true`, roles con `EXECUTE` = solo `{authenticated}`
    (`anon` sin EXECUTE, confirmado) · `get_advisors(security)`: única
    advertencia esperada "Signed-In Users Can Execute", sin advertencia de
    `anon` · datos sin cambios: `pagos_recibos`=832, `pagos_cuotas_aplicaciones`=0,
    crédito 1134 y sus cuotas sin cambios.
  - **Prueba controlada 10K-3C.1 repetida con éxito tras el hotfix**
    (mismo método de rollback estructural vía `DO $$...RAISE EXCEPTION$$`):
    pago exacto ✅ (cuota 133 → pagada), pago parcial ✅ (cuota 134 →
    parcial), rechazo de recibo duplicado ✅, rechazo de `canal_pago`
    inválido (`'bitcoin'`) ✅ (confirma el fix), trazabilidad ✅ (2 filas en
    `pagos_cuotas_aplicaciones` dentro de la transacción), rollback ✅
    (conteos después idénticos a antes: 832/0, crédito y cuotas sin
    cambios, 0 recibos de prueba persistentes).
  - Docs: `docs/ai-recovery/PAGOS_CUOTAS_10K_3B2_HOTFIX_CANAL_PAGO.md`
    (actualizado con verificación post-apply y re-prueba) ·
    `docs/ai-recovery/PAGOS_CUOTAS_10K3C1_PRUEBA_CONTROLADA_REPORT.md`
    (actualizado con nota de corrección). Scripts:
    `scripts/check-pagos-cuotas-10k3b2-hotfix.mjs` →
    `npm run check:pagos-cuotas-10k3b2` (**34/34 PASS**).
  - Checks: `check:pagos-cuotas-10k3b2` 34/34 ✅ · `check:pagos-cuotas-10k3c1`
    23/23 ✅ · `check:pagos-cuotas-10k3c` 38/38 ✅ · `check:pagos-cuotas-10k3b`
    67/67 ✅ · `smoke:demo-app` 28/28 ✅ (confirma datos reales de producción
    sin cambios) · `verify:cejuassa` BUILD OK ✅.
  - **No se tocó:** UI, Anexo 6, seguridad existente, `AUDIT_ENABLED`,
    ninguna tabla, pagos históricos, 10K-2B (sigue diferida).
  - **R-K4 queda RESUELTO. `pagos/nuevo` queda apta para operación.**
- **Fase 10K-3C.1 — Prueba controlada de la RPC EJECUTADA — hallazgo crítico bloqueante (2026-07-04):** 🚨 **`pagos/nuevo` NO APTA PARA PRODUCCIÓN.**
  - Autorización recibida: `EJECUTAR PRUEBA CONTROLADA PAGOS 10K-3C.1`. Ejecutada vía Supabase MCP `execute_sql` (proyecto `ljdjbhsipgkxlgnprzhm`) como **un solo statement autocontenido** (bloque `DO $$...$$` que siempre termina en `RAISE EXCEPTION`) — se descartó `BEGIN`/`ROLLBACK` en llamadas separadas porque no hay garantía de que `execute_sql` reutilice la misma sesión/conexión entre llamadas; un statement único hace que Postgres revierta todo automáticamente sin depender de eso.
  - Usuario de prueba real usado (sin UUID inventado, hallado por `SELECT ... WHERE rol IN ('admin','tesoreria') AND activo=true`): `55f7e60f...` (rol `admin`).
  - **Hallazgo crítico:** al ejecutar el Escenario 1 (pago exacto), Postgres rechazó el `INSERT INTO pagos_recibos` interno de la RPC con `42804: column "canal_pago" is of type canal_pago but expression is of type text`. Causa: `pagos_recibos.canal_pago` es un **enum de Postgres** (`udt_name=canal_pago`), pero `registrar_pago_con_aplicacion` inserta `COALESCE(p_canal_pago, 'caja')` (tipo `text`) sin castear. Como esta sección corre para **todo** pago (con o sin crédito), **ningún pago nuevo puede registrarse hoy** a través de la RPC.
  - No detectado antes porque los checks de 10K-3B/10K-3C son estáticos (regex sobre el texto del SQL/TS) — nunca habían ejecutado la función contra la base real. Esta es la primera invocación real desde que se aplicó en 10K-3B.
  - Rollback confirmado: conteos antes/después idénticos (`pagos_recibos`=832, `pagos_cuotas_aplicaciones`=0, crédito `1134` saldo=6142.83, cuotas 133/134 sin cambios), 0 recibos `TEST_10K3C1_%` persistentes.
  - Escenarios 2 (parcial) y 4 (rechazo duplicado) no llegaron a ejecutarse (la transacción abortó en el escenario 1); 3 (multi-cuota) y 5 (crédito cancelado) quedaron fuera del alcance mínimo autorizado.
  - Docs: `docs/ai-recovery/PAGOS_CUOTAS_10K3C1_PRUEBA_CONTROLADA_REPORT.md` (actualizado con resultados reales). Scripts: `scripts/dry-run-pagos-cuotas-10k3c1-candidates.mjs` · `scripts/check-pagos-cuotas-10k3c1-prueba.mjs` → `npm run check:pagos-cuotas-10k3c1` (**23/23 PASS**).
  - Checks: `check:pagos-cuotas-10k3c1` 23/23 ✅ · `check:pagos-cuotas-10k3c` 38/38 ✅ · `check:pagos-cuotas-10k3b` 67/67 ✅ · `smoke:demo-app` 28/28 ✅ · `verify:cejuassa` BUILD OK ✅ (estos checks son estáticos y siguen pasando porque no ejecutan la RPC — no contradicen el hallazgo).
  - **No se tocó:** ningún dato real (rollback automático confirmado), Anexo 6, seguridad existente, `AUDIT_ENABLED` (sigue `false`), los 832 pagos históricos, 10K-2B (sigue diferida). No se usó `db push`, no se aplicó ninguna migración — el bug se detectó, no se corrigió.
  - **Próxima acción urgente:** Fase **10K-3B.2 — hotfix de tipo `canal_pago`** (agregar `::canal_pago` explícito al INSERT de la RPC), con su propio plan `cejuassa-db-plan` y autorización explícita, seguida de repetir esta prueba controlada para confirmar los 5 escenarios completos.
- **Fase 10K-3C — UI de pagos nuevos integrada con la RPC (2026-07-04):** ✅ COMPLETADO — SOLO CÓDIGO DE APLICACIÓN, NINGÚN DATO MODIFICADO.
  - `app/dashboard/pagos/nuevo/page.tsx` refactorizado: ya no inserta directo en `pagos_recibos`, ya no llama `decrementar_saldo_capital`, ya no actualiza manualmente `cronograma_cuotas`. Ahora llama `registrar_pago_con_aplicacion` (aplicada en 10K-3B) a través de un helper tipado nuevo.
  - Helper nuevo: `lib/pagos/registrarPagoConAplicacion.ts` — payload/resultado tipados, `RegistrarPagoError` con código de negocio, `mensajeErrorAmigable()` traduce `recibo_duplicado`/`credito_cancelado_no_admite_pagos`/`credito_no_encontrado`/`monto_credito_sin_credito`/etc.
  - Pantalla de éxito nueva: muestra cuotas afectadas/pagadas/parciales, monto aplicado al crédito, alerta de excedente (no bloqueante) y advertencias de la RPC, con botones "Registrar otro pago" / "Ver pagos" (reemplaza la redirección automática anterior).
  - Aporte (`monto_aporte`) sigue igual que antes: llamada separada a `registrar_aporte_socio` **después** de que la RPC de pago tenga éxito — sigue siendo una segunda operación no atómica, documentado como deuda diferida a 10K-3D.
  - Checks: `check:pagos-cuotas-10k3c` 38/38 ✅ · `check:pagos-cuotas-10k3b` 67/67 ✅ · `check:pagos-cuotas-10k3a` 48/48 ✅ · `check:security-master` 49/49 ✅ · `smoke:demo-app` 28/28 ✅ · `verify:cejuassa` BUILD OK ✅ (tsc limpio; lint sin errores nuevos — los 8 errores `set-state-in-effect` preexistentes en 8 archivos no relacionados no fueron introducidos por esta fase).
  - Docs: `docs/ai-recovery/PAGOS_CUOTAS_10K_3C_UI_INTEGRATION_REPORT.md` · Script: `scripts/check-pagos-cuotas-10k3c-ui.mjs` → `npm run check:pagos-cuotas-10k3c`.
  - **No se tocó:** Anexo 6, seguridad existente, `AUDIT_ENABLED` (sigue `false`), ninguna migración nueva, los 832 pagos históricos (10K-2B, sigue diferida). No se registraron pagos reales de prueba contra Supabase remoto.
  - **Próxima acción:** los pagos nuevos ya pueden registrarse con la lógica de cascada/tope/trazabilidad de la RPC. Pendiente opcional: 10K-3D (prueba controlada apply+revert e integración del aporte en la misma transacción).
- **Fase 10K-3B — RPC `registrar_pago_con_aplicacion` (2026-07-04):** ✅ **APLICADA EN SUPABASE REMOTO** — autorización recibida `APLICAR RPC PAGOS NUEVOS 10K-3B`.
  - Aplicado vía Supabase MCP `apply_migration` (no `db push`): índice único `pagos_recibos_nro_recibo_unique_idx` (Paso 0, Fase 10K-3B.1) + función `registrar_pago_con_aplicacion` (`SECURITY DEFINER`, `SET search_path = public`) + `REVOKE EXECUTE ... FROM anon`.
  - Verificado post-apply: función e índice existen; `pagos_recibos` sigue en 832 filas; `pagos_cuotas_aplicaciones` sigue en 0 filas — **nadie ha invocado la RPC todavía**, la UI (`pagos/nuevo/page.tsx`) sigue sin cambios.
  - `get_advisors` (security): solo advertencia esperada de "ejecutable por authenticated" (comportamiento intencional); sin advertencia de `anon` — confirma el `REVOKE` correcto.
  - Historial de migraciones reconciliado: `supabase migration repair --status applied 20260704120000` (aplicada en remoto bajo timestamp `20260704024854`, mismo patrón de SEC-3E/SEC-4B).
  - Checks post-apply: `check:pagos-cuotas-10k3b` 67/67 ✅ · `check:security-master` 49/49 ✅ · `smoke:demo-app` 28/28 ✅ · `verify:cejuassa` BUILD OK ✅.
  - **Próxima fase: 10K-3C** — refactor de `pagos/nuevo/page.tsx` para usar la nueva RPC (requiere su propia autorización). El aporte sigue diferido a 10K-3C/10K-3D. Los 832 pagos históricos (10K-2B) siguen diferidos, no tocados.
- **Fase 10K-3B.1 — Cierre de brecha de duplicados de nro_recibo (2026-07-04):** ✅ COMPLETADO — SOLO MIGRACIÓN LOCAL ACTUALIZADA, NADA APLICADO EN REMOTO (histórico, ver entrada de 10K-3B arriba para el estado final aplicado).
  - Auditoría de solo lectura sobre 832 `pagos_recibos`: 0 `nro_recibo` NULL/vacíos, **0 duplicados exactos**, **0 duplicados normalizados**.
  - Estrategia elegida: **índice único parcial normalizado** `pagos_recibos_nro_recibo_unique_idx` sobre `lower(trim(nro_recibo))` (agregado como Paso 0 de la misma migración 10K-3B) + captura de `unique_violation` en el `INSERT` de la RPC, traducida a `recibo_duplicado`.
  - Sin cambios en: rechazo de créditos cancelados (regla 7) · aporte diferido a 10K-3C/10K-3D · nada aplicado en remoto · UI sin tocar.
  - Migración actualizada: `supabase/migrations/20260704120000_10k3b_registrar_pago_con_aplicacion.sql` (aún NO aplicada).
  - Docs: `docs/ai-recovery/PAGOS_CUOTAS_10K_3B_RPC_PLAN.md` (secciones "Auditoría de duplicados"/"Estrategia elegida" agregadas).
  - Check: `npm run check:pagos-cuotas-10k3b` (**67/67 PASS**, actualizado con 10 checks nuevos).
  - **Próxima acción:** ya no quedan preguntas abiertas de bloqueo técnico — autorización pendiente: `APLICAR RPC PAGOS NUEVOS 10K-3B`.
- **Fase 10K-3B — SQL final (local, NO aplicado) de RPC para pagos nuevos (2026-07-04):** ✅ COMPLETADO — SOLO MIGRACIÓN LOCAL, NADA APLICADO EN REMOTO.
  - RPC diseñada: `registrar_pago_con_aplicacion(p_nro_recibo, p_id_socio, p_id_credito, ...) RETURNS jsonb` — transacción única: valida entrada+rol, inserta `pagos_recibos`, cascada con tope exacto sobre `cronograma_cuotas` (`fecha_vencimiento ASC`), trazabilidad en `pagos_cuotas_aplicaciones`, reutiliza `decrementar_saldo_capital`. Aporte diferido a 10K-3C/10K-3D.
  - `SECURITY DEFINER` + `SET search_path = public` (mismo patrón que `decrementar_saldo_capital`/`aplicar_ampliacion_credito`/`registrar_auditoria`) — necesario porque `cronograma_cuotas`/`creditos` solo permiten UPDATE directo a admin/creditos vía RLS, y quien registra pagos es tesorería. La función revalida rol manualmente (bypasea RLS por diseño).
  - Evita doble aplicación validando `nro_recibo` duplicado a nivel de aplicación (gap detectado: no hay `UNIQUE` en el schema — no se inventó, queda como pregunta abierta).
  - Migración local (NO aplicada): `supabase/migrations/20260704120000_10k3b_registrar_pago_con_aplicacion.sql`.
  - Docs: `docs/ai-recovery/PAGOS_CUOTAS_10K_3B_RPC_PLAN.md` · Excel: `exports/pagos-cuotas-dryrun/10k_3b_rpc_plan.xlsx` (6 hojas).
  - Scripts: `npm run pagos-cuotas-10k3b:plan:gen` · `npm run check:pagos-cuotas-10k3b` (**57/57 PASS**).
  - **Próxima acción:** autorización explícita `APLICAR RPC PAGOS NUEVOS 10K-3B` (solo la RPC; la UI queda para 10K-3C con su propia autorización). Preguntas abiertas: ¿rechazo estricto de crédito cancelado correcto? ¿se necesita `UNIQUE` en `nro_recibo`? ¿se aprueba diferir el aporte?
- **Fase 10K-3A — Diseño de lógica para pagos nuevos contra cuotas (2026-07-04):** ✅ COMPLETADO — SOLO DISEÑO, NINGÚN SQL APLICADO.
  - Decisión del usuario: datos históricos NO son prioridad (se cargarán datos nuevos). **10K-2B queda diferida** (no cancelada); los 3 casos ambiguos históricos no se revisaron en esta fase.
  - Auditoría de `pagos/nuevo/page.tsx`: hoy actualiza **solo 1 cuota** (sin cascada), **sin tope** por cuota, **sin trazabilidad** en `pagos_cuotas_aplicaciones` (tabla creada en 10K-1 pero no usada), en 2 escrituras no atómicas.
  - Arquitectura recomendada: RPC transaccional `aplicar_pago_a_cuotas` (mismo patrón que `decrementar_saldo_capital`/`registrar_aporte_socio`/`crear_credito_con_cronograma`).
  - Reglas de negocio, 8 escenarios de prueba y SQL boceto (NO ejecutado) documentados.
  - Docs: `docs/ai-recovery/PAGOS_CUOTAS_10K_3A_LOGICA_NUEVOS_PAGOS.md` · Excel: `exports/pagos-cuotas-dryrun/10k_3a_matriz_logica_pagos_nuevos.xlsx` (6 hojas).
  - Scripts: `npm run pagos-cuotas-10k3a:matriz:gen` · `npm run check:pagos-cuotas-10k3a` (**48/48 PASS**).
  - **Próxima acción:** 10K-3B — SQL final ejecutable (formato completo `cejuassa-db-plan`), requiere aprobación explícita del usuario antes de aplicar en Supabase.
- **Fase 10K-2A.1 — Paquete de revisión manual para Tesorería/Créditos (2026-07-04):** ✅ COMPLETADO — SOLO DOCUMENTACIÓN, NINGÚN DATO MODIFICADO.
  - Traduce los 3 casos ambiguos de 10K-2A a lenguaje simple: pago 411**** (R-K2), 3 pagos `match_medio`, crédito cancelado 1145****.
  - Documento: `docs/ai-recovery/PAGOS_CUOTAS_10K_2A_REVISION_MANUAL.md` (resumen simple, preguntas exactas, recomendación por caso, matriz aprobar/excluir/corregir).
  - Excel: `exports/pagos-cuotas-dryrun/10k_2a_casos_para_revision_manual.xlsx` (5 hojas, incluida `decisiones_requeridas` para Tesorería/Créditos).
  - Scripts: `npm run pagos-cuotas-10k2a:revision-manual:gen` · `npm run check:pagos-cuotas-10k2a-revision` (**46/46 PASS**).
  - **Próxima acción:** entregar Excel a Tesorería/Créditos, esperar `decisiones_requeridas` completa, luego solicitar autorización `APLICAR PAGOS A CUOTAS 10K-2` (10K-2B sigue bloqueada).
- **Fase 10K-2A — Dry-run final de pagos contra cuotas (2026-07-04):** ✅ COMPLETADO — NINGÚN DATO MODIFICADO.
  - Auditados 832 pagos_recibos (28 con id_credito, 804 sin). `pagos_cuotas_aplicaciones` confirmada en 0 filas.
  - Simulación de cascada reproduce exactamente 10K-0: 34 propuestas (8 cuotas PAGADAS + 26 PARCIALES), monto total propuesto S/8,870.70 sobre 33 cuotas únicas.
  - 2 casos ambiguos confirmados (ya documentados): pago 411**** monto excesivo (R-K2) y crédito cancelado 1145**** sin cronograma.
  - Excel de revisión: `exports/pagos-cuotas-dryrun/10k_2a_propuesta_aplicacion_pagos_cuotas.xlsx` (7 hojas).
  - Scripts: `npm run pagos-cuotas-10k2a:dry-run` · `npm run check:pagos-cuotas-10k2a` (**43/43 PASS**).
  - Docs: `docs/ai-recovery/PAGOS_CUOTAS_10K_2A_DRY_RUN_REPORT.md`.
  - **Próxima acción:** resolver pago 411**** con Tesorería + 3 match_medio con Créditos antes de autorizar 10K-2B (apply real).
- **Fase 10K-1 — Trazabilidad segura pagos→cuotas (2026-07-02):** ✅ COMPLETADO — MIGRACIÓN APLICADA EN SUPABASE.
  - Auditado: no existía ninguna tabla de trazabilidad (pagos_cuotas, pagos_cuotas_aplicaciones, cuota_pagos, recibo_cuotas).
  - Decisión: **Modelo B — tabla intermedia `pagos_cuotas_aplicaciones`** (Modelo A: `id_pago` en cuota descartado).
  - Migración: `supabase/migrations/20260702000003_create_pagos_cuotas_aplicaciones.sql` — ✅ Local + Remote.
  - Tabla creada en Supabase: 11 columnas, FK RESTRICT a pagos_recibos + cronograma_cuotas + creditos, FK SET NULL a usuarios, CHECK capital/interes >= 0, CHECK total > 0, columna GENERATED `monto_aplicado`, 3 índices (id_pago, id_cuota, id_credito), UNIQUE (id_pago, id_cuota, fecha_aplicacion), RLS ON, policies granulares: pca_select/pca_insert/pca_update/pca_delete (admin=CRUD, tesoreria=S/I, creditos=S, contabilidad=S) — SEC-3C aplicada 2026-07-03.
  - Scripts: `npm run check:pagos-cuotas-traceability` → **39/39 PASS**.
  - Docs: `docs/ai-recovery/PAGOS_CUOTAS_TRACEABILITY_PLAN.md`.
  - **Próxima fase:** 10K-2 — apply de pagos a cuotas (bloqueado hasta: confirmación match_medio + verificación pago 411****).
- **Fase 10K-0 — Diseño seguro aplicación pagos→cuotas (2026-07-02):** ✅ COMPLETADO — NINGÚN DATO MODIFICADO.
  - Auditoría de estructura: `cronograma_cuotas` TIENE capital_pagado/interes_pagado/estado/fecha_pago. Falta `id_pago` (trazabilidad).
  - Monto aplicable = `monto_capital + monto_interes` (excluye aporte/FPS/otros) — confirmado.
  - **25 de 28 pagos son MIXTOS** (crédito + aporte/FPS simultáneo en mismo recibo) — riesgo contable.
  - Con algoritmo de cascada: **8 cuotas propuestas como PAGADAS** (vs 0 con algoritmo anterior), **26 PARCIALES**, 34 propuestas total.
  - 2 pagos no asignables: 1 crédito cancelado sin cronograma + 1 monto_capital+interes=0.
  - Migración recomendada (NO bloqueante): `id_pago` FK en `cronograma_cuotas` para trazabilidad.
  - Scripts: `npm run plan:pagos-cuotas` · `npm run check:pagos-cuotas-plan` (**63/63 PASS**). `npm run check:pagos-cuotas-traceability` (**39/39 PASS** — Fase 10K-1).
  - Docs: `docs/ai-recovery/PAGOS_CUOTAS_APPLICATION_PLAN.md` · `plan_pagos_cuotas_10k0_preview.json`.
  - **Próxima acción:** Fase 10K-1 — decidir `id_pago` (trazabilidad) y apply de los 28 pagos.
- **Fase 9C-6I-DEMO — Datos demo regulatorios (2026-06-23):** ✅ COMPLETADO
  - `socios.genero` → `M` (temporal, 782 registros) — ⚠️ DEMO, no oficial
  - `socios.estado_civil` → `soltero` (temporal, 782 registros) — ⚠️ DEMO, no oficial
  - `creditos.subtipo_credito_sbs` → `por_confirmar` (temporal, 31 registros) — ⚠️ DEMO, no oficial
  - Scripts: `demo:reg-fields:dry-run` · `demo:reg-fields:apply` · `check:demo-reg-fields` (26/26 PASS)
  - Backup: `backups/demo-data-fill/2026-06-23T02-18/` (socios.json + creditos.json)
  - Reporte: `docs/ai-recovery/DEMO_REGULATORY_FIELDS_FILL_REPORT.md`
  - Auditoría post: 0 problemas críticos · 1 medio (DNI SINDNI) · Build/TypeCheck OK
- **Pendientes en datos (post Fase 9C-6I-DEMO):**
  - genero/estado_civil socios = `M`/`soltero` DEMO → reemplazar con datos reales antes de BDCC oficial
  - tipo_credito_sbs = 'consumo_no_revolvente' (texto, no código SBS C19) — pedir al cliente
  - subtipo_credito_sbs = 'por_confirmar' DEMO (31) — confirmar catálogo SBS con contadora
  - id_credito pagos = NULL (804) — 417 no_aplica + 384 sin_match + 3 match_medio pendiente revisión manual
  - 1 DNI placeholder SINDNI (nro_socio 0001606) — requiere DNI real del socio

### Fase UI-0/UI-1 — Modernización visual minimalista (2026-06-30) ✅ COMPLETADA

- **Enfoque:** Minimalismo institucional financiero — sobrio, legible, consistente.
- **Componentes creados:** `app/dashboard/_components/ui.tsx`
  - `PageHeader`, `EmptyState`, `TableSkeleton`, `ResultCount`
  - Constantes de botón: `btnPrimary`, `btnGhost`, `btnEdit`, `btnDanger`
  - Clases de input: `inputCls`, `selectCls`
- **Páginas modernizadas:** `socios/page`, `creditos/page`, `pagos/page`, `aportes/page`
  - `h1` unificado: `text-xl font-semibold text-slate-800`
  - Botones con press feedback: `active:scale-[0.97] transition-transform duration-150`
  - Loading: skeleton rows en `<tbody>` (tabla siempre visible con headers)
  - Empty states: icono + jerarquía de texto
  - Colores: `gray-*` → `slate-*` en borders y backgrounds de tabla
  - Sin inline `style={{ backgroundColor }}` — todo Tailwind v4 arbitrary values
- **Docs:** `docs/ai-recovery/CEJUASSA_UI_MODERNIZATION_GUIDE.md`
- **Script nuevo:** `npm run audit:ui-modernization` → 38/38 PASS
- **Checks finales:** `audit:ui-roles` 34/34 ✅ · `smoke:demo-app` 28/28 ✅ · `test:e2e:smoke` 3/3 ✅ · tsc OK ✅ · BUILD OK ✅
- **No se tocó:** DB, migraciones, lógica financiera, banners DEMO, permisos por rol.
- **Pendiente UI-2:** mora, cartera, egresos, páginas de detalle, formularios.

### Fase 10J-1 — Apply funcional de ampliaciones (2026-06-24) ✅ COMPLETADA

- **RPC aplicada en Supabase:** `public.aplicar_ampliacion_credito(p_id_credito integer, p_fecha date, p_nro_pagare_nuevo text, p_monto_a_ampliar numeric, p_plazo_nuevo integer, p_observacion text, p_created_by uuid)`
- **Migración local:** `supabase/migrations/20260624000001_create_aplicar_ampliacion_credito.sql` — corrección de tipo `id` de `uuid` → `integer` aplicada vía MCP (`fix_aplicar_ampliacion_credito_integer_id`)
- **Qué actualiza en `creditos`:** solo `nro_pagare`, `monto_aprobado`, `saldo_capital` (atómico con row lock)
- **Qué NO toca:** `cronograma_cuotas`, `pagos_recibos`, `socios`, `aportes`, `egresos`, `usuarios`, `configuracion`, `auth.users`
- **Fórmula:** `nuevo_monto_aprobado = monto_aprobado + monto_a_ampliar` · `nuevo_saldo_capital = saldo_capital + monto_a_ampliar`
- **UI actualizada:** `AmpliacionesSection.tsx` — modo `'apply'` con campo "Monto a ampliar", vista previa en tiempo real, advertencia "No se recalculará el cronograma de cuotas", botón "Aplicar ampliación" deshabilitado mientras guarda. Modo `'edit'` mantiene edición directa de historial.
- **Página actualizada:** `creditos/[id]/page.tsx` pasa `montoAprobado`, `saldoCapital`, `onCreditoUpdated` (con `refreshKey`) a `AmpliacionesSection`
- **Prueba controlada:** apply+revert OK — 14/14 verificaciones PASS. BD limpia al finalizar.
  - `monto_aprobado`: 8000 → 8500 (+500) ✅ · revertido a 8000 ✅
  - `saldo_capital`: 6142.83 → 6642.83 (+500) ✅ · revertido a 6142.83 ✅
  - `nro_pagare`: `2018830` → `TEST_PAGARE_FUNC_10J_1` ✅ · revertido ✅
  - `cronograma_cuotas`: 36 cuotas sin cambio ✅ · `pagos_recibos`: 1 sin cambio ✅
- **Scripts:** `ampliaciones-funcionales:dry-run` · `ampliaciones-funcionales:apply` · `check:ampliaciones-funcionales` → 51/51 PASS
- **Checks finales:** `check:ampliaciones-funcionales` 51/51 ✅ · `smoke:demo-app` 28/28 ✅ · `audit:ui-roles` 34/34 ✅ · `verify:cejuassa` BUILD OK ✅
- **Pendiente confirmado:** cronograma NO se recalcula en esta fase (confirmado por Contabilidad como regla de esta fase). Fase 10J-2 (recálculo de cronograma) bloqueada hasta nueva confirmación.

### Fase 10J-0 — Diseño seguro de ampliaciones funcionales (2026-06-24)
- **Objetivo:** Convertir módulo de ampliaciones de informativo a funcional — solo diseño, sin tocar DB.
- **Regla confirmada:** "En una ampliación se suma el monto al socio/crédito y cambia el número de pagaré."
- **Decisión `monto_nuevo`:** = monto aprobado total resultante (Opción B). El delta = `monto_nuevo[n] - monto_nuevo[n-1]`. NO hace falta migración ni campo `monto_ampliacion`.
- **Flujo apply propuesto (Fase 10J-1):** INSERT `ampliaciones` + UPDATE `creditos` (nro_pagare, monto_aprobado += delta, saldo_capital += delta) atómico vía RPC. NO toca cronograma_cuotas ni pagos_recibos.
- **Sin migración en esta fase:** la tabla actual es suficiente para el apply básico. Migraciones futuras solo si: workflow aprobación (campo `estado`), cambio de tasa (campo `tasa_nueva`), cambio de cuota (campo `cuota_nueva`).
- **Pendiente que bloquea Fase 10J-1:** confirmar con contadora si cronograma se recalcula, si cuota cambia, si tasa cambia, si plazo cambia.
- **Artefactos creados:**
  - `docs/ai-recovery/AMPLIACIONES_FUNCIONALES_PLAN.md` — plan completo con reglas, ambigüedad resuelta, rollback, riesgos, vista previa UI
  - `scripts/plan-ampliaciones-funcionales.mjs` → `npm run plan:ampliaciones-funcionales` — dry-run con crédito real (ID=1131), muestra antes/después
  - `scripts/check-ampliaciones-funcionales-plan.mjs` → `npm run check:ampliaciones-funcionales-plan` — 27/27 PASS
- **Verificación:** `check:ampliaciones-funcionales-plan` 27/27 ✅ · `smoke:demo-app` 28/28 ✅ · TypeCheck OK ✅ · BUILD 36/36 OK ✅
- **Restricciones cumplidas:** CERO updates a DB · CERO migraciones · CERO inserts · CERO lógica financiera aplicada.

### Fase 10I-0 — Análisis Oficio SBS N°32791-2026-SBS para BDCC (2026-06-24)
- **Documento analizado:** Oficio N°32791-2026-SBS (Lima, 28 mayo 2026), Firmante: Ursula Paola Galdos Franco, Intendente de Supervisión de Cooperativas A
- **Resultado:** Análisis completo en `docs/ai-recovery/BDCC_SBS_32791_2026_ANALYSIS.md`
- **Hallazgos críticos (no implementados aún):**
  - BD01_HDR falta 10 campos: `DAKR`, `CCSIN`, `CCSID`, `CCSIS`, `FPPK`, `FCC`, `FUK`, `FUINT`, `CCSD`, `OSD`
  - BD01: `CCRF` y `CCCO` ponen `''` en código actual pero oficio dice NO pueden estar vacíos → riesgo de rechazo SBS
  - BD02A_HDR falta 3 campos: `SCOM`, `SIM`, `SCA` (valor `0.00` si no corresponde)
  - Nuevo campo `IAP` (Anexo N°2): ya implementado en BD02-A ✅
  - Nuevo campo `IAP_C` (Anexo N°2): para BD02-B (pendiente de implementación)
- **Plazos confirmados:**
  - 20/07/2026 → trimestres marzo y junio 2026 → 36 archivos
  - 20/08/2026 → 2024–2025 histórico → 144 archivos (subproyecto futuro separado)
- **Regla clave confirmada:** un archivo por mes (no por trimestre) → para 1 trimestre = 18 archivos
- **NO se modificó código ni DB.**
- **Próximo paso:** Confirmar preguntas P1–P8 con contadora antes de corregir código

### Fase 10H-1 — Correcciones visuales críticas pre-demo (2026-06-24)
- **Problema nombres:** Datos importados desde Excel en MAYÚSCULAS completas (ej. `CHAVEZÑIQUE, JOSE JACK`). Los apellidos pegados se deben a ausencia de espacio en el campo `apellidos` de la DB (el importador tomó los datos tal cual). **No se modificó la DB.**
- **Corrección visual (solo display):** Nuevo helper `lib/formatNombre.ts` → `formatNombrePersona(apellidos, nombres)` que aplica Title Case, trim y normalización de espacios. No inserta espacios internos que no existan en los datos.
- **Pantallas actualizadas (15 archivos):** socios, créditos, pagos, aportes, cartera, mora, egresos, convenios/[id], cartera/[id], aportes/[id], pagos/[id], créditos/[id], SocioSearch, ampliaciones, reportes/anexo6.
- **Selects corregidos:** `reportes/bdcc/page.tsx` — 2 selects de Mes/Año ahora tienen `text-gray-800 bg-white`. Resto de reportes ya tenían contraste correcto.
- **Script creado:** `scripts/audit-pre-demo-visual-fixes.mjs` → `npm run audit:pre-demo-visual-fixes` → **52/52 PASS**
- **Checks finales:** `audit:pre-demo-visual-fixes` 52/52 ✅ · `smoke:demo-app` 28/28 ✅ · `smoke:report-exports` 37/37 ✅ · `audit:form-validations` 68/68 ✅ · TypeScript OK ✅
- **Restricciones cumplidas:** CERO cambios en DB · CERO migraciones · CERO cambios en auth/usuarios/configuración · CERO lógica financiera
- **Socios afectados visualmente:** todos los 782 (datos en MAYÚSCULAS). Corrección de datos en DB requiere autorización explícita `APLICAR CORRECCION NOMBRES 10H-1`.

### Fase 10G — Pulido visual/UX pre-demo (2026-06-24)
- **Mejoras empty states:** Socios, Créditos, Pagos distinguen "sin datos" vs "sin resultados de búsqueda". Aportes muestra período exacto. Egresos mensaje informativo con call to action (DB tiene 0 egresos).
- **Cartera:** botón "Limpiar filtros" agregado cuando hay filtros activos; empty state contextual.
- **Ampliaciones:** título homogeneizado a `text-2xl font-bold text-gray-800` (consistente con otros módulos).
- **Script creado:** `scripts/audit-demo-ux-polish.mjs` → `npm run audit:demo-ux-polish` → **60/60 PASS**
- **Checks finales:** `audit:demo-ux-polish` 60/60 ✅ · `smoke:demo-app` 28/28 ✅ · `smoke:report-exports` 37/37 ✅ · `audit:form-validations` 68/68 ✅ · `audit:ui-roles` 34/34 ✅ · BUILD OK ✅
- **Restricciones cumplidas:** CERO cambios en DB · CERO migraciones · CERO cambios en auth/usuarios/configuración · CERO lógica financiera

### Fase 10F — Pre-entrega técnica y hardening final (2026-06-24)
- **Script creado:** `scripts/pre-demo-readiness-check.mjs` → `npm run check:pre-demo-readiness` → **46/46 PASS**
- **Checks ejecutados:** `check:pre-demo-readiness` 46/46 ✅ · `audit:form-validations` 68/68 ✅ · `smoke:demo-app` 28/28 ✅ · `smoke:report-exports` 37/37 (3 WARN esperados) ✅ · `audit:ui-roles` 34/34 ✅ · `audit:post-excel-import` 0 críticos ✅ · TypeScript OK ✅ · BUILD OK ✅
- **Revisión técnica:**
  - package.json: todos los scripts críticos presentes ✅
  - Variables de entorno: NEXT_PUBLIC_SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY todas SET ✅
  - proxy.ts activo (R1 resuelto) — rutas /dashboard/* protegidas ✅
  - service role confinado solo en lib/api/requireAdmin.ts + rutas /api/usuarios/* ✅
  - Todas las rutas del sidebar tienen page.tsx (13/13) ✅
  - Todos los scripts apply tienen guards --authorized o CEJUASSA_ALLOW ✅
  - data-reset-template.sql tiene ROLLBACK por defecto ✅
  - 8 migraciones locales, todas documentadas en AI_HANDOFF.md ✅
- **Estado de demo:**
  - BDCC: banner "🚫 DEMO — DATOS NO OFICIALES — NO ENVIAR A SBS" prominente ✅
  - Anexo 6: banner demo con génro=M, estado_civil=S, subtipo=por_confirmar como temporales ✅
  - AmpliacionesSection: aviso "Registro informativo. No modifica..." visible ✅
  - Backups: pre-reset (20260620-1327) y demo-regulatory (2026-06-23T02-18) ambos existen con JSONs ✅
- **Restricciones cumplidas:** CERO cambios en DB · CERO migraciones · CERO cambios en auth/usuarios/configuración
- **Correcciones aplicadas:** Ninguna (app ya estaba en estado óptimo)
- **Riesgos residuales:** DNI SINDNI (1 socio) · 804 pagos con id_credito NULL · género/estado_civil demo · subtipo_credito_sbs='por_confirmar' (31) — todos conocidos y documentados, no bloquean el demo con contadora

### Fase 10E — Endurecer formularios, validaciones y UX de errores (2026-06-23)
- **SocioForm**: validación JS de DNI (regex `\d{7,8}`), nombres/apellidos requeridos, `maxLength={8}` en input DNI.
- **BeneficiariosSection**: validación porcentaje (0-100), DNI formato si se ingresa; `confirm()` → inline confirm Sí/No; error de delete visible.
- **AmpliacionesSection**: `confirm()` → inline confirm Sí/No; error de delete capturado y mostrado.
- **creditos/nuevo**: nro_pagare requerido JS, tasa no negativa, orden de validaciones mejorado.
- **pagos/nuevo**: montoTotal > 0 bloqueante, validación JS de formato periodo YYYY-MM.
- **egresos**: error de delete capturado y mostrado en banner dismissible con `×`.
- **Script**: `scripts/audit-form-validations.mjs` → `npm run audit:form-validations` → **68/68 PASS**.
- **Restricciones confirmadas**: CERO migraciones · CERO cambios en DB · CERO cambios en auth/usuarios/configuración.
- **Verificación**: `audit:form-validations` 68/68 ✅ · `smoke:demo-app` 28/28 ✅ · `smoke:report-exports` 37/37 ✅ · `audit:ui-roles` 34/34 ✅ · TypeScript OK ✅ · BUILD OK ✅

### Fase 10D-1B — Pantalla global de ampliaciones informativas (2026-06-23)
- **Ruta creada:** `app/dashboard/ampliaciones/page.tsx`
  - Historial global de TODAS las ampliaciones registradas (no limitado a un crédito)
  - JOIN con `creditos` → `socios` para mostrar nombre de socio y pagaré del crédito
  - Enlace "Ver crédito" a `/dashboard/creditos/{id_credito}`
  - Solo lectura — sin formulario de creación ni edición desde esta pantalla
- **Filtros:** socio (nombre/nro_socio) · pagaré (anterior o nuevo) · crédito (ID o nro_pagare) · fecha desde / hasta · botón limpiar filtros
- **Aviso visible:** "Las ampliaciones son registros informativos. No modifican automáticamente el crédito ni el cronograma."
- **Roles con acceso:** admin · creditos · contabilidad · tesoreria (todos ven, nadie edita desde aquí)
- **Sidebar:** "Ampliaciones" agregado en `layout.tsx` con ícono RefreshCw, después de Créditos, visible para todos los roles
- **Restricciones confirmadas:** CERO updates a `creditos`, `cronograma_cuotas`, `pagos_recibos`, `socios`. CERO migraciones.
- **Script:** `scripts/check-ampliaciones-global-page.mjs` → `npm run check:ampliaciones-global` → **20/20 PASS**
- **Verificación:** `check:ampliaciones-global` 20/20 ✅ · `check:ampliaciones-ui` 10/10 ✅ · `audit:ui-roles` 34/34 ✅ · `smoke:demo-app` 28/28 ✅ · BUILD OK ✅ · TypeScript OK ✅

### Fase 10D-1A — Prueba CRUD controlada de ampliaciones (2026-06-23)
- **Autorización recibida:** `PROBAR CRUD AMPLIACIONES 10D-1A`
- **INSERT:** ✅ OK — id=1, nro_pagare_nuevo=TEST_PAGARE_10D_1A, monto=10000
- **UPDATE:** ✅ OK — observacion actualizada, monto_nuevo=10100
- **DELETE:** ✅ OK
- **Limpieza final:** ✅ OK — sin registros huérfanos
- **Crédito usado:** ID=1131 (datos enmascarados, nro_pagare `201***`)
- **Tablas no modificadas:** creditos ✅ · cronograma_cuotas ✅ · pagos_recibos ✅ · socios ✅
- **Scripts:** `ampliaciones:crud:dry-run` · `ampliaciones:crud:apply` · `check:ampliaciones-crud` (22/22 PASS)
- **Post-apply checks:** dry-run 4/4 ✅ · check 22/22 ✅ · smoke:demo-app 28/28 ✅ · BUILD OK ✅
- **Reporte:** `docs/ai-recovery/AMPLIACIONES_CRUD_TEST_REPORT.md`
- **Módulo ampliaciones:** ✅ OPERATIVO — CRUD real contra Supabase verificado

### Fase 10D-1 — UI segura de historial de ampliaciones (2026-06-23)
- **Componente creado:** `app/dashboard/creditos/_components/AmpliacionesSection.tsx`
  - Lista, crea, edita y elimina registros en tabla `ampliaciones`
  - Aviso visible: "Registro informativo. No modifica saldo, cronograma ni pagaré del crédito automáticamente."
  - Guards por rol: admin (CRUD completo) · creditos (crear + editar) · tesoreria/contabilidad (solo lectura lista)
- **Integración:** añadido en `app/dashboard/creditos/[id]/page.tsx` entre Descuentos y Cronograma
- **Restricciones confirmadas:** CERO operaciones a `creditos`, `cronograma_cuotas`, `pagos_recibos`, `socios`. Solo INSERT/UPDATE/DELETE en `ampliaciones`.
- **Script de auditoría:** `scripts/check-ampliaciones-ui.mjs` → `npm run check:ampliaciones-ui` → **10/10 PASS**
- **Verificación:** `check:ampliaciones-ui` 10/10 ✅ · `audit:ampliaciones-module` OK ✅ · `smoke:demo-app` 28/28 ✅ · `verify:cejuassa` BUILD OK ✅ · TypeScript OK ✅
- **Pendiente financiero (no implementado):** recalcular cronograma, modificar saldo, cancelar crédito original, aplicar nuevo pagaré — bloqueado hasta confirmación de Créditos/Contabilidad.

### Fase 10B — Endurecer reportes, filtros y exportaciones (2026-06-23)
- **Bugs corregidos:**
  1. Anexo 6 Excel export: cuenta contable `1411030604` → `1411050604` (bug real)
  2. BDCC `generarBD01()`: `por_confirmar` en `subtipo_credito_sbs` ahora se detecta y genera advertencia específica (antes solo detectaba vacíos)
  3. BDCC: banner DEMO prominente (rojo) agregado: "🚫 DEMO — DATOS NO OFICIALES — NO ENVIAR A SBS"
  4. Anexo 6: banner DEMO agregado con advertencia sobre genero=M, estado_civil=S, subtipo=por_confirmar
- **Script creado:** `scripts/smoke-report-exports.mjs` → `npm run smoke:report-exports` → **37/37 PASS**
- **Verificación final:** `smoke:report-exports` 37/37 ✅ · `smoke:demo-app` 28/28 ✅ · `audit:ui-roles` 34/34 ✅ · `audit:post-excel-import` 0 críticos ✅ · TypeScript OK ✅

### Fase 9C-6J-FUNC — Prueba funcional completa (2026-06-22)
- `scripts/smoke-demo-app-reports.mjs` — smoke test: 28/28 PASS ✅
- `npm run smoke:demo-app` → 28/28 PASS
- `npm run audit:post-excel-import` → 0 críticos · 1 medio (SINDNI) · 4 warnings normales
- `npm run verify:cejuassa` → LINT OK · TYPECHECK OK · BUILD OK
- App lista para prueba con contadora. Ver tabla abajo.

### Auditoría 9C-5 — Diagnóstico de módulos

| Módulo | Estado |
|---|---|
| Socios lista/edición | ✅ Operable |
| Pagos, Aportes, Reporte Caja | ✅ Operable |
| Créditos lista/cartera | ✅ Operable |
| Egresos | ✅ Operable (sin datos aún) |
| Convenios | ✅ Operable |
| Anexo 6 | ✅ Operable — tasa_interes=26.82% en 31/31 créditos |
| Reporte Aportes | ✅ Operable — 785 aportes con monto |
| Reporte Caja | ✅ Operable — 832 pagos con monto |
| Cronograma de cuotas | ✅ COMPLETADO (9C-6D) — 911 cuotas · 26/26 vigentes · 5 cancelados sin cronograma (OK) |
| BDCC BD01/BD02-A | ⚠️ DEMO solo — subtipo="por_confirmar", genero=M demo. NO enviar a SBS. |

### Fase 9C-3 — Preparación de recarga (2026-06-20)
- `docs/ai-recovery/DATA_RELOAD_SOURCE_MAP.md` — mapa de fuentes (backup JSON + Excel cliente)
- `docs/ai-recovery/DATA_RELOAD_DRY_RUN_REPORT.md` — reporte dry-run: 0 issues críticos
- `scripts/reload/dry-run-reload-data.mjs` — validación sin insertar datos
- `npm run reload:dry-run` → 0 issues, 2 warnings (genero/estado_civil vacíos en backup)
- `npm run check:data-reload-prep` → 13/13 PASS

### Fase 9C-4A — Auditoría de fuentes Excel (2026-06-20)
- 7 archivos Excel en `_client_files/raw/extracted/Archvos app/` auditados (solo lectura)
- `docs/ai-recovery/EXCEL_IMPORT_SOURCE_AUDIT.md` — clasificación completa por tipo
- `docs/ai-recovery/EXCEL_IMPORT_MAPPING_PLAN.md` — transformaciones columna→campo DB
- `docs/ai-recovery/EXCEL_IMPORT_DRY_RUN_REPORT.md` — dry-run: 6 issues (filas vacías), 9 warnings
- `scripts/import-excel/dry-run-excel-import.mjs` — script dry-run solo lectura
- `npm run import:excel:dry-run` → 6 issues leves (1 fila vacía por archivo) + warnings técnicos
- `npm run check:excel-import-prep` → **35/35 PASS**
- **Excels importables:** DSCTO Y DESEMBOLSO (32 créditos mar-2026), INGRESO (34 pagos), CONVENIO (800 pagos)
- **ALERTA:** No hay Excel de padrón de socios → `socios` debe cargarse desde backup JSON
- **Convenios detectados:** BELEN, CHEPEN, DIRES, IREN, IRO, LAFORA, REGION, UTES (8 únicos)
- **Decisión pendiente:** ¿usar Excel (solo mar-2026, 32 créditos) o backup JSON (431 créditos históricos)?
- NO se insertó ningún dato. La recarga real requiere autorización explícita.

---

## Módulos pendientes (auditados 2026-06-20 en MISSING_REQUIREMENTS_AUDIT.md)

- **Ampliaciones de crédito** (Fase 10D-0, 2026-06-23): tabla `ampliaciones` auditada — 11 columnas, 0 registros, RLS ON. Columnas: `id`, `id_credito` (FK→creditos.id), `fecha`, `nro_pagare_anterior`, `nro_pagare_nuevo` (UNIQUE), `monto_nuevo`, `plazo_nuevo`, `saldo_nuevo`, `observacion`, `created_at`, `created_by` (FK→usuarios.id). Falta `estado` (workflow), `tasa_nueva`, `cuota_nueva`. Modelo implícito: Modelo D (modifica crédito existente + registra cambio de pagaré). MVP seguro posible sin migración (solo registro/consulta). NO implementar lógica financiera hasta confirmar reglas con Créditos/Contabilidad. Ver `AMPLIACIONES_MODULE_AUDIT_AND_PLAN.md`. Scripts: `audit:ampliaciones-module` (37/37) · `check:ampliaciones-plan` (24/24).
- **~~Múltiples beneficiarios~~**: ✅ COMPLETADO (Fase 10C/10C.1, 2026-06-23) — tabla `socio_beneficiarios` creada en Supabase. UI integrada en detalle y edición de socio. Campos legacy `beneficiario_nombre/dni/parentesco` en `socios` conservados.
- **Nombres separados**: `socios` tiene `apellidos` + `nombres`. No hay `apellido_paterno/materno`.

---

## Módulos existentes (todos implementados)

Dashboard, Socios (CRUD + PDF + **Beneficiarios múltiples**), Créditos (CRUD), Pagos (lista + nuevo + PDF), Aportes (lista + detalle), Egresos (CRUD en modal), Convenios (resumen por período), Cartera (clasificación SBS), Mora (créditos vencidos), Reportes (Anexo 6 SBS + Aportes + Caja — todos con export Excel), Usuarios (admin), Configuración (admin).

### Módulo Beneficiarios (Fase 10C/10C.1, 2026-06-23)
- Tabla: `socio_beneficiarios` (SERIAL PK, socio_id INTEGER FK → socios.id, nombres NOT NULL, dni, parentesco, porcentaje NUMERIC(5,2), es_principal BOOLEAN DEFAULT FALSE, observacion, created_at, updated_at)
- RLS: ON · Policy: `autenticados_pueden_operar` (ALL / authenticated)
- UI: `BeneficiariosSection.tsx` — CRUD en detalle (`socios/[id]/page.tsx`) y edición (`socios/[id]/editar/page.tsx`)
- Permisos: admin → crear/editar/eliminar; tesoreria → crear/editar; creditos/contabilidad → solo lectura
- Migración local: `supabase/migrations/20260623000001_create_socio_beneficiarios.sql`
- Scripts: `beneficiarios:dry-run`, `beneficiarios:apply`, `check:beneficiarios-module`, `audit:beneficiarios-schema`, `check:beneficiarios-schema-sync`

## Reglas de negocio clave

- **Clasificación de cartera**: Normal (0-8 días mora), CPP (9-30), Deficiente (31-60), Dudoso (61-120), Pérdida (+120)
- **Tasas de provisión**: leídas desde `configuracion` en los 3 módulos: Anexo 6 (5A.1 ✅), Cartera y Dashboard (5A.2 ✅). Fallback a SBS por defecto + banner si falla la lectura.
- **Mora**: cuota en mora si `estado='vencida'` O (`estado IN ('pendiente','parcial')` Y `fecha_vencimiento < hoy`)
- Días de mora = desde la fecha de vencimiento de la cuota más antigua pendiente
- **Períodos** almacenados como `YYYY-MM`
- Moneda: Soles peruanos (S/)
- Fechas en DB: `YYYY-MM-DD`; en UI: `DD/MM/YYYY`

## Creación de crédito (lógica cliente, confirmado en `creditos/nuevo/page.tsx`)

Fórmula: **sistema francés** (cuota fija). `M = P·r·(1+r)^n / [(1+r)^n - 1]`, donde `r = tasa_anual/100/12`.

Submit ejecuta en una sola llamada atómica (Fase 4B-4E ✅):
1. Genera N cuotas en memoria (capital, interés, cuota_total, fecha_vencimiento, estado='pendiente', capital_pagado=0, interes_pagado=0).
2. Llama `supabase.rpc('crear_credito_con_cronograma', { p_credito, p_cuotas })` — transacción implícita plpgsql. Si el insert de cuotas falla, PostgreSQL hace rollback del crédito.
3. La RPC devuelve el `id_credito`. Ante error, se muestra al usuario y no se redirige.

La última cuota usa `saldo_exacto` para absorber desfase de redondeo. ~~Los dos inserts directos (riesgo R8) fueron eliminados.~~

## Flujo de registro de pago (lógica cliente, confirmado en `pagos/nuevo/page.tsx`)

El submit ejecuta en secuencia:
1. Insert en `pagos_recibos`
2. Si `monto_capital > 0`: RPC `decrementar_saldo_capital` — **aplicada en Supabase (R5 RESUELTO)**. Fallback blindado (líneas 251-271): solo corre si `saldoErr.code === '42883' || 'PGRST202'` (Fase 4B-1 ✅).
3. Busca la cuota más antigua en `estado IN ('pendiente','vencida','parcial')`, acumula `capital_pagado` e `interes_pagado`, determina estado `pagada` o `parcial`; `fecha_pago` solo se asigna si queda `pagada` (Fase 3B ✅)
4. Si `monto_aporte > 0`: RPC `registrar_aporte_socio` — **aplicada en Supabase (R6 RESUELTO, Fase 4B-3)**. Advisory lock por socio elimina race condition.

No hay triggers en Supabase. Toda la lógica es cliente.

## Seguridad base

- `proxy.ts` confirmado en Next.js 16 como reemplazo de `middleware.ts` (deprecado desde v16.0.0).
- El build confirma `ƒ Proxy (Middleware)` activo — rutas `/dashboard/*` están protegidas.
- Verificado: `supabase.auth.getUser()` + cookies SSR + redirect a `/login` si sin sesión.

## Riesgos conocidos

1. ~~Sin protección de rutas~~ — **RESUELTO (R1)**: `proxy.ts` activo (2026-06-17)
2. ~~Tasas de provisión hardcodeadas~~ — **R2 RESUELTO** (Fases 5A.1 + 5A.2, 2026-06-17)
3. ~~Guards de rol~~ — **RESUELTO (R3)**: Fases 2B-1 a 2B-5 (2026-06-17)
4. ~~Race condition `saldo_capital`~~ — **RESUELTO (R5)**: RPC A `decrementar_saldo_capital` (2026-06-17)
5. ~~Race condition `saldo_nuevo` aportes~~ — **RESUELTO (R6)**: RPC B `registrar_aporte_socio` (2026-06-17)
6. ~~Cuotas `vencida`/`parcial` no se actualizan al pagar~~ — **RESUELTO (R7)**: Fase 3B (2026-06-17)
7. ~~Crédito sin cronograma si bulk insert falla~~ — **RESUELTO (R8)**: RPC C `crear_credito_con_cronograma` (2026-06-17)
8. ~~Service role key en API routes~~ — **RESUELTO (R4)**: helper `requireAdmin` + validación de lista blanca + script de auditoría (Fase 5B.1, 2026-06-18)
9. `useMemo` async en `aportes/page.tsx` (no bloqueante — B1)
10. Scripts de prueba automática disponibles: `test:rpc:b` y `test:rpc:c` (L1/L2/L3)
11. ~~B3 Provisiones Constituidas silenciosas~~ — **RESUELTO (Fase 8A-1, 2026-06-20)**: Contabilidad confirmó C37 = C36 por deudor. `provision_constituida_fuente = 'criterio_contable_confirmado'`, banner informativo azul, sin `window.confirm`, sin mensaje "sin fuente contable". `npm run check:provision:constituida` 10/10 PASS. No se creó tabla `provisiones_mensuales`.

## Archivos críticos (no modificar sin revisión)

- `lib/supabase.ts`
- `lib/api/requireAdmin.ts` (único punto de acceso al service role — cualquier cambio afecta ambas rutas)
- `app/api/usuarios/invite/route.ts` (usa requireAdmin)
- `app/api/usuarios/update/route.ts` (usa requireAdmin, valida lista blanca de roles)
- `app/dashboard/reportes/anexo6/page.tsx` (reporte regulatorio SBS, 60 columnas)
- `app/dashboard/pagos/utils/generarReciboPDF.ts`

## Convenciones del código

- Todo el fetching es **client-side** con `useEffect` + Supabase
- Estilo inline con `style={{ color: '#1E3A5F' }}` para colores de marca (navy + blue)
- Sin comentarios en el código excepto donde hay `eslint-disable`
- Sin archivo de configuración de Tailwind — Tailwind v4 se configura en CSS

## Comandos

```bash
npm run dev    # desarrollo
npm run build  # producción
npm run lint   # eslint
npx tsc --noEmit  # typecheck (no hay script definido)
```

## Skills disponibles (en `.claude/skills/`)

Invocar con `/cejuassa-<nombre>` al inicio de cada prompt:

- `/cejuassa-safe-change` — obligatorio antes de cualquier edición de código
- `/cejuassa-risk-review` — para cambios en pagos, créditos, aportes, reportes SBS, API routes
- `/cejuassa-checkpoint` — antes de `/compact` o `/clear`
- `/cejuassa-verify` — después de implementar (ejecuta lint/tsc/build)
- `/cejuassa-db-plan` — para cualquier cambio en Supabase (RPC, triggers, tablas, RLS)

## Cotización del software (Fase QUOTE-0 — 2026-06-30)

Documento generado: `docs/ai-recovery/CEJUASSA_SOFTWARE_COTIZACION_MERCADO_PERUANO.md`

Resumen ejecutivo:
- **Sistema actual (Escenario A):** S/ 12,000 – S/ 18,000
- **Sistema completo operativo (Escenario B):** S/ 22,000 – S/ 28,000
- **Sistema + BDCC oficial + conciliación (Escenario C):** S/ 38,000 – S/ 55,000
- **Mantenimiento mensual recomendado:** S/ 800 – S/ 1,200 / mes (Plan Recomendado)
- **Infraestructura (cargo al cliente):** S/ 50 – S/ 250 / mes estimado
- **Checks:** `audit:tooling-setup` 23/23 · `smoke:demo-app` 28/28 · `verify:cejuassa` BUILD OK

---

## Estado del proyecto al último checkpoint (2026-06-30)

### Fases completadas
- **Fase 1**: R1 resuelto — `proxy.ts` activo en Next.js 16
- **Fase 2**: R3 resuelto — guards de rol + UX botones + sidebar filtrado (Fases 2B-1 a 2B-5)
- **Fase 3**: R7 resuelto — pagos parciales acumulativos en cuotas vencida/parcial (Fase 3B)
- **Fase 4 (COMPLETA)**: R5, R6, R8 resueltos — las 3 RPCs financieras aplicadas y probadas
- **Fase 5A.1 + 5A.2**: R2 resuelto — Anexo 6, Cartera y Dashboard leen tasas desde `configuracion` con fallback + banner
- **Fase 5B.1**: R4 resuelto — helper `requireAdmin`, validación de roles en `update`, script `audit:service-role`
- **Fase 6A.1**: B3 mitigado — `reportes/anexo6/page.tsx`: `provision_constituida` campo propio, fuente `'sin_fuente_contable'`, banner naranja, confirmación Excel
- **Fase 7A**: Auditoría documental completa — 7 Excel + 7 JPEG del cliente analizados. Ver `docs/ai-recovery/CLIENT_FILES_AUDIT.md` y `docs/ai-recovery/SBS_BDCC_REPORTS_PLAN.md`
- **Fase 7B-0**: Roadmap ajustado — histórico 2024/2025 como proyecto futuro; documento de preguntas contables creado
- **Fase 7B-1**: Respuestas de Contabilidad registradas — código COOPAC `01270`, B3 confirmado, sin garantías, tipo K y cancelados pendientes con Créditos
- **Fase 8A-1**: B3 RESUELTO — `provision_constituida_fuente = 'criterio_contable_confirmado'`, banner informativo azul, sin `window.confirm`, sin mensaje "sin fuente contable". C37=C36 por deudor (criterio contable oficial). No se crea `provisiones_mensuales`. Histórico 2024/2025 fuera del alcance actual.
- **Fase 8A-2 + 8A-2.1**: Migraciones mínimas BDCC/SBS aplicadas en producción (`ljdjbhsipgkxlgnprzhm`) — `socios.genero`, `socios.estado_civil`, `creditos.nro_expediente`, `creditos.tipo_credito_sbs`, `creditos.subtipo_credito_sbs`, `creditos.cuenta_contable_bd01`, `creditos.aporte_descontado`, `creditos.tramite`, `pagos_recibos.tipo_pago`. UPDATE seguro de `configuracion.codigo_coopac = '01270'`. `npm run check:bdcc:min-fields` 16/16 PASS. Local y Remote en sincronía 7/7.
- **Fase 8A-3**: UI mínima para captura de campos SBS/BDCC implementada. `SocioForm` (crear + editar): `genero` + `estado_civil` con selects + nota. `creditos/nuevo`: campos SBS + update post-RPC con creditoId. `creditos/editar`: campos SBS editables. `pagos/nuevo`: `tipo_pago` con default `A`. `npm run check:bdcc:ui-fields` 26/26 PASS. Typecheck OK, build 33/33 OK.
- **Fase 8B-1**: Generador BDCC MVP implementado. `app/dashboard/reportes/bdcc/page.tsx` + `lib/bdcc/format.ts`. BD01, BD02-A, BD03A, BD03B generables. BD02-B y BD04 pendientes. `npm run check:bdcc:mvp-exporters` 38/38 PASS. Typecheck OK, build 34/34 OK.
- **Fase 8B-2**: Smoke test funcional BDCC completado. `scripts/smoke-bdcc-runtime.mjs` 51/51 PASS. Página carga, acceso desde Reportes activo, 4 descargas TXT funcionales, BD02-B/BD04 bloqueados, advertencias regulatorias visibles, separador tabulador confirmado, código COOPAC `01270` presente, seguridad sin service role en frontend. `npm run smoke:bdcc` disponible. Build 35/35 OK.
- **Fase 8C-1**: Cierre MVP para lunes. `docs/ai-recovery/MONDAY_DELIVERY_CHECKLIST.md` + `docs/ai-recovery/MONDAY_DEMO_SCRIPT.md` creados. Script `check-monday-readiness.mjs` 37/37 PASS. Todos los checks pasan. App lista para entrega/demo del lunes.
- **Fase 10A**: 2 route guards corregidos (`egresos` bloquea `creditos`, BDCC restringido a `admin/contabilidad`). `audit:ui-roles` 34/34 PASS.
- **Fase 10B**: Reportes endurecidos — cuenta contable corregida en Anexo 6, banners DEMO en BDCC y Anexo 6, detección de `por_confirmar`. `smoke:report-exports` 37/37 PASS.
- **Fase 10C + 10C.1**: Módulo beneficiarios múltiples completo — tabla `socio_beneficiarios` creada en Supabase, UI integrada en detalle y edición, permisos por rol, campos legacy conservados. `check:beneficiarios-module` 26/26 · `check:beneficiarios-schema-sync` 29/29.
- **Fase 10C.2 (2026-06-23)**: CRUD real verificado contra Supabase. INSERT ✅ UPDATE ✅ DELETE ✅ Limpieza ✅. Tabla queda vacía. `check:beneficiarios-crud` 22/22 · `smoke:demo-app` 28/28 · BUILD OK. **El módulo de beneficiarios queda operativo.**
- **Fase 10D-0 (2026-06-23)**: Auditoría módulo Ampliaciones completada. Tabla `ampliaciones` tiene 11 columnas, 0 registros, RLS ON (SELECT: all auth, INSERT/UPDATE: admin+creditos, DELETE: admin). FK: id_credito→creditos.id · created_by→usuarios.id. UNIQUE en `nro_pagare_nuevo`. Falta: estado, tasa_nueva, cuota_nueva. Modelo implícito: Modelo D. MVP seguro posible sin migración. `audit:ampliaciones-module` 37/37 PASS · `check:ampliaciones-plan` 24/24 PASS · `smoke:demo-app` 28/28 PASS · TypeCheck OK · BUILD 34/34 OK. Ver `docs/ai-recovery/AMPLIACIONES_MODULE_AUDIT_AND_PLAN.md`.
- **Fase 10E (2026-06-23)**: Formularios endurecidos. SocioForm: DNI regex+maxLength, nombres/apellidos JS. BeneficiariosSection: porcentaje 0-100, DNI formato, confirm→inline Sí/No. AmpliacionesSection: confirm→inline Sí/No, error delete capturado. creditos/nuevo: nro_pagare JS, tasa no negativa. pagos/nuevo: montoTotal>0, periodo YYYY-MM. egresos: error delete visible. Script `audit:form-validations` 68/68 PASS. TypeScript OK · BUILD OK. CERO cambios DB.
- **Fase 10G (2026-06-24)**: ✅ COMPLETADA — Pulido visual/UX pre-demo. Empty states mejorados (Egresos/Socios/Créditos/Pagos/Aportes/Cartera). Cartera: botón Limpiar filtros. Ampliaciones: título consistente. Script `audit:demo-ux-polish` 60/60 PASS. BUILD OK.
- **Fase 10F (2026-06-24)**: ✅ COMPLETADA — Pre-entrega técnica y hardening final. `check:pre-demo-readiness` 46/46 PASS. Ver sección de fase 10F abajo.

### BDCC SBS (Oficio N°32791-2026-SBS) — estado al 2026-06-20

- La SBS requiere 6 archivos TXT por mes (BD01, BD02-A, BD02-B, BD03A, BD03B, BD04)
- **Primera entrega: 20/07/2026** — trimestres marzo y junio 2026
- **Módulo BDCC implementado (Fase 8B-1/8B-2)** — genera BD01, BD02-A, BD03A, BD03B. BD02-B y BD04 pendientes (requieren módulo créditos cancelados).
- **BDCC histórico 2024/2025 → PROYECTO FUTURO SEPARADO** — no implementar en esta fase

**Respuestas de Contabilidad recibidas (Fase 7B-1, 2026-06-20):**

| Dato | Valor | Estado |
|---|---|---|
| Código COOPAC SBS | `01270` | ✅ Confirmado |
| Provisiones Constituidas | = Provisiones Requeridas por deudor (C37=C36) | ✅ Confirmado — B3 resuelto |
| Garantías preferidas | No tiene | ✅ BD03A/BD03B solo encabezado |
| Tipo de crédito | Consumo no revolvente | ⚠ Código SBS C19/C20 pendiente |
| Cuenta contable BD01 | `1411050604` (candidata) | ⚠ Confirmar por estado del crédito |
| Género y estado civil | Pendiente — fuente: Tesorería | ⏳ |
| Tipo K / créditos cancelados | Pendiente — área: Créditos | ⏳ |
| Tasa TPINT (0.2682 en Anexo 6) | Pendiente — ¿TEA o nominal? — área: Créditos | ⏳ |

**B3 RESUELTO (Fase 8A-1):** C37 = C36 calculado por deudor con tasas SBS. Indicador `criterio_contable_confirmado` activo en `reportes/anexo6/page.tsx`. No requiere tabla `provisiones_mensuales`.

### RPCs aplicadas en Supabase (proyecto `ljdjbhsipgkxlgnprzhm`)
| Migración | RPC | Estado |
|-----------|-----|--------|
| `20260617000000` | `decrementar_saldo_capital` (RPC A) | ✅ aplicada |
| `20260617000001` | `registrar_aporte_socio` (RPC B) | ✅ aplicada |
| `20260617000002` | `crear_credito_con_cronograma` (RPC C — base) | ✅ aplicada |
| `20260617000003` | hotfix cast ENUM `tipo_credito` | ✅ aplicada |
| `20260617000004` | hotfix cast ENUM `estado_cuota` | ✅ aplicada |

### Estado de código
- `pagos/nuevo/page.tsx`: usa RPC A (saldo_capital) + RPC B (aportes). Fallback blindado (code 42883/PGRST202).
- `creditos/nuevo/page.tsx`: usa RPC C (crédito + cronograma en una sola transacción).
- `reportes/anexo6/page.tsx`: tasas desde `configuracion` (Fase 5A.1) + `provision_constituida` separada con `criterio_contable_confirmado` (Fase 8A-1). B3 RESUELTO.
- `cartera/page.tsx`: `getTasaProvision(clasif, t)` lee tasas de `configuracion`; fallback + banner (Fase 5A.2).
- `dashboard/page.tsx`: `getTasaProvision(dias, t)` lee tasas de `configuracion`; fallback + banner (Fase 5A.2).
- `npm run verify:cejuassa`: tsc limpio + build 35/35. Lint: errores preexistentes no bloqueantes (todos pre-Fase 8).

### Automatización disponible
```bash
npm run verify:cejuassa              # lint + tsc + build
npm run check:provision:constituida  # B3 RESUELTO: 10/10 PASS — criterio_contable_confirmado, sin sin_fuente_contable, nota visible
npm run check:monday-readiness       # Fase 8C-1: 37/37 PASS — estado de entrega del lunes
npm run smoke:bdcc                   # Fase 8B-2: 51/51 PASS — smoke test pantalla BDCC (página, nav, descargas, nombres, tabulador, advertencias, bloqueos)
npm run check:bdcc:mvp-exporters     # Fase 8B-1: 38/38 PASS — generador BDCC MVP implementado
npm run check:bdcc:min-fields        # Fase 8A-2: 16/16 PASS — migración campos mínimos BDCC/SBS aplicada en producción
npm run check:bdcc:ui-fields         # Fase 8A-3: 26/26 PASS — UI formularios con campos SBS/BDCC
npm run test:provision:config        # Verifica tasas de provisión en configuracion — 15/15 PASS
npm run audit:service-role           # Verifica confinamiento de SUPABASE_SERVICE_ROLE_KEY — OK
npm run test:rpc:b                   # RPC B L1 (sin datos)
npm run test:rpc:b:happy             # RPC B L2 (requiere CEJUASSA_ALLOW_TEST_WRITES=true)
npm run test:rpc:c                   # RPC C L1 (sin datos) — 5/5 PASS
npm run test:rpc:c:happy             # RPC C L2 (requiere CEJUASSA_ALLOW_TEST_WRITES=true) — 13/13 PASS
npx supabase migration list          # verificar historial Local + Remote
npx supabase db push --dry-run       # previsualizar migraciones pendientes
npm run import:excel:dry-run         # Fase 9C-4A: dry-run lectura Excels del cliente (no inserta)
npm run check:excel-import-prep      # Fase 9C-4A: 35/35 PASS — preparación importación Excel
npm run cronogramas:dry-run          # Fase 9C-6C: simula 911 cuotas para 26 créditos vigentes (no inserta)
npm run check:cronogramas:plan       # Fase 9C-6C: 22/22 PASS — plan de regeneración seguro
npm run pagos:link-creditos:dry-run  # Fase 9C-6E: clasificar 832 pagos y proponer matches (solo lectura)
npm run check:pagos-link-creditos    # Fase 9C-6E: 25/25 PASS — plan de vinculación seguro
npm run pagos:link-creditos:apply:dry-run  # Fase 9C-6F: preflight apply 28 match_alto (solo lectura)
npm run check:pagos-link-creditos-apply    # Fase 9C-6F: 39/39 PASS — apply vinculación completado
npm run check:pagos-match-medio-review     # Fase 9C-6G: 15/15 PASS — Excel revisión match_medio listo
npm run pagos:to-cuotas:dry-run      # Fase 9C-6H.0: simula 28 pagos sobre 911 cuotas (solo lectura) — 26 parciales, 0 pagadas
npm run check:pagos-to-cuotas-plan   # Fase 9C-6H.0: 37/37 PASS — plan dry-run cuotas verificado
npm run beneficiarios:crud:dry-run   # Fase 10C.2: dry-run CRUD beneficiarios (solo lectura)
npm run beneficiarios:crud:apply     # Fase 10C.2: apply CRUD test — requiere autorización PROBAR CRUD BENEFICIARIOS 10C.2
npm run check:beneficiarios-crud     # Fase 10C.2: 22/22 PASS — verificación de seguridad del script CRUD
npm run check:beneficiarios-module   # Fase 10C.1: 26/26 PASS — módulo socio_beneficiarios
npm run check:beneficiarios-schema-sync  # Fase 10C.1: 29/29 PASS — esquema sincronizado con Supabase
npm run audit:beneficiarios-schema   # Fase 10C.1: auditoría de columnas y RLS
npm run audit:form-validations       # Fase 10E: 68/68 PASS — validaciones frontend, loading states, sin confirm() nativo, sin NaN/undefined visibles
npm run audit:demo-ux-polish         # Fase 10G: 60/60 PASS — rutas, empty states, banners DEMO, sin TODO/FIXME, sidebar válido
npm run check:pre-demo-readiness     # Fase 10F: 46/46 PASS — readiness check pre-demo completo
```

### Riesgos activos
- Ningún riesgo alto activo. R1–R8 todos resueltos.
- Deuda técnica: B1 (useMemo async — no bloqueante), B2 (any types — no bloqueante).
- B3: **RESUELTO (Fase 8A-1)** — C37 = C36 por criterio contable confirmado. `criterio_contable_confirmado` en código, banner informativo, sin placeholders.

### Fase 9A-9B (2026-06-20) — Manual HTML + auditorías completados

- `docs/ai-recovery/manuals/CEJUASSA_MANUAL_USUARIO.html` — manual standalone de 16 secciones para usuarios administrativos
- `docs/ai-recovery/FUNCTIONAL_AUDIT_REPORT.md` — auditoría de 25 funcionalidades: 22 OK, 2 parciales, 1 pendiente, 0 riesgos altos
- `docs/ai-recovery/ROLE_FUNCTIONAL_AUDIT.md` — matriz de permisos, rutas protegidas, botones ocultos, acciones de riesgo, recomendaciones
- `scripts/check-manual-and-audit.mjs` + `npm run check:manual-audit` — validación automática de la documentación
- Riesgos de rol identificados: BDCC sin restricción de rol (solo lectura), acceso directo a módulos ocultos (solo lectura)
- **Próxima fase recomendada: Fase 9C — plan seguro de limpieza de datos de prueba y recarga con datos reales**

### Fase 10C — Beneficiarios múltiples (✅ COMPLETADA 2026-06-23)

- `socio_beneficiarios`: tabla creada con 10 cols, RLS ON, policy ALL authenticated ✅
- `BeneficiariosSection.tsx`: CRUD completo integrado en detalle y edición de socio ✅
- Fase 10C.1: esquema sincronizado, socio_id corregido a INTEGER ✅
- Fase 10C.2: prueba CRUD real ejecutada — INSERT/UPDATE/DELETE/limpieza todos OK ✅
  - Socio ID=3329 · Beneficiario ID=1 (auto-increment) · Tabla limpia al finalizar
  - `check:beneficiarios-crud` 22/22 PASS · `smoke:demo-app` 28/28 PASS

### Fase 10J-2 — Ajuste de alcance final (2026-07-02) ✅ PLAN COMPLETADO

**Decisiones finales de la cooperativa/contadora recibidas y documentadas:**

| Decisión | Valor confirmado |
|---|---|
| Tasa de interés | **TEA** (Tasa Efectiva Anual) |
| Tipo de crédito | **Consumo** (ya configurado por defecto) |
| Subtipo/tipo interno | **Convenio** (modelado via socios.id_convenio — sin campo nuevo) |
| BDCC/TXT (archivos SBS) | **Fuera del alcance actual** |
| Reporte regulatorio | Solo **Anexo N°6** |
| Ampliaciones | Cambia **cuota, plazo y tasa** — editables manualmente |

**Documentación actualizada:**
- `docs/ai-recovery/COOPERATIVA_RESPUESTAS_FINALES_ALCANCE.md` — decisiones finales, alcance, impacto
- `AI_HANDOFF.md` — esta sección
- `NEXT_STEPS.md` — sección de Fase 10J-2

**Scripts creados:**
- `scripts/plan-alcance-final-contadora.mjs` → `npm run plan:alcance-final-contadora`
- `scripts/check-alcance-final-contadora.mjs` → `npm run check:alcance-final-contadora`

**Fase 10J-2A completada (2026-07-02) — cambios solo visuales:**
- Labels TEA aplicados: `creditos/[id]/page.tsx` ("Tasa TEA"), `creditos/nuevo/page.tsx` ("Tasa de interés TEA (%)"), `creditos/[id]/editar/page.tsx` ("Tasa de interés TEA (%)")
- BDCC removido de sección principal de `reportes/page.tsx` → sección "Archivado / fuera de alcance"
- Banner de advertencia agregado en `reportes/bdcc/page.tsx` (código preservado, no borrado)
- Check sección 9 agregada en `check-alcance-final-contadora.mjs`
- **Restricciones cumplidas:** CERO cambios en DB · CERO migraciones · CERO datos modificados

**Fase 10J-2B completada (2026-07-02) — cuota/plazo/tasa editables:** ✅ APLICADA EN SUPABASE

- **DB:** `ampliaciones.tasa_nueva numeric(8,4) NULL` + `ampliaciones.cuota_nueva numeric(12,2) NULL` — aplicadas.
- **RPC:** `aplicar_ampliacion_credito` extendida — firma: `(integer, date, text, numeric, integer, numeric, numeric, text DEFAULT NULL, uuid DEFAULT NULL)`. Actualiza `creditos`: nro_pagare, monto_aprobado, saldo_capital, plazo_meses, tasa_interes, cuota_mensual. NO toca cronograma_cuotas ni pagos_recibos.
- **UI:** `AmpliacionesSection.tsx` — campos Tasa TEA nueva (%) y Cuota Nueva (S/) en formulario apply. Props nuevas: `plazoMeses`, `tasaInteres`, `cuotaMensual`. Vista previa 6 columnas. Listado con fallback `—` para registros históricos.
- **Test apply+revert:** 16/16 PASS · **check:ampliaciones-funcionales:** 65/65 OK.
- **Registros históricos:** tasa_nueva / cuota_nueva quedan NULL — la UI muestra `—` sin error.

### Próxima fase recomendada (post 10J-2B)

- **Fase 10J-3:** Recalcular cronograma de cuotas al ampliar (requiere confirmación con contabilidad)
- **Fase 10J-4:** Historial de ampliaciones visible en módulo global de créditos (lista)
- **Opcional:** Reporte de ampliaciones por período

### Fase QA-OPS-0 — Auditoría operativa completa (2026-07-02) ✅ COMPLETADA

- **Objetivo:** Auditar el sistema como operador real. Sin tocar DB, datos ni lógica financiera.
- **Alcance:** 15 módulos, 24 tests Playwright, 23 capturas, manual HTML, reporte QA, script de verificación.
- **Resultado:** 24/24 tests ✅ · 0 errores JS de consola · 0 errores funcionales · 0 rutas 4xx/5xx.
- **Artefactos generados:**
  - `e2e/qa-ops-audit.spec.ts` — suite Playwright 15 módulos x 24 tests
  - `exports/qa-ops/screenshots/` — 23 capturas (.jpg) de todos los módulos
  - `exports/qa-ops/manual/manual_usuario_cejuassa.html` — manual de usuario completo con portada, índice, flujos, capturas, buenas prácticas, limitaciones, errores comunes
  - `exports/qa-ops/reports/QA_OPERATIVA_CEJUASSA.md` — reporte QA con matriz de pruebas, hallazgos por severidad, evidencia con screenshots
  - `exports/qa-ops/reports/console-errors.json` — errores de consola por módulo (todos vacíos)
  - `scripts/check-qa-ops-audit.mjs` → `npm run check:qa-ops-audit` — 15/15 PASS
- **Hallazgos:** 0 críticos · 0 altos nuevos · 2 medios preexistentes (trazabilidad pagos→cuotas, validación client-side) · 3 bajos (búsqueda selector, filtros selector, mobile sin hamburguesa)
- **Checks ejecutados:**
  - `check:qa-ops-audit` → **15/15 PASS**
  - `check:ui-pro-redesign` → **24/24 OK**
  - `audit:ui-roles` → **34/34 PASS**
  - `smoke:demo-app` → **28/28 PASS**
  - `smoke:report-exports` → **37/37 PASS**
  - `verify:cejuassa` → **tsc OK + build OK** (8 errores lint preexistentes, no bloqueantes)
- **Restricciones cumplidas:** CERO cambios en DB · CERO migraciones nuevas · CERO datos modificados · CERO lógica financiera tocada · Anexo 06 no modificado
- **Próxima fase recomendada:** POST-QA — Mejoras de UX operativo (validaciones client-side, notificación de cuotas, trazabilidad pagos→cuotas)

### Fase SEC-0 — Auditoría integral de seguridad (2026-07-02) ✅ COMPLETADA

- **Objetivo:** Auditoría completa de seguridad sin modificar DB, migraciones ni lógica financiera.
- **Alcance:** Autenticación, autorización, API routes, service role, variables de entorno, RLS, validaciones, reportes, headers HTTP, dependencias, logs, backups.
- **Resultado:** 27/27 checks PASS · 4 hallazgos ALTO · 7 MEDIO · 5 BAJO · CERO cambios en DB.
- **Artefactos generados:**
  - `docs/ai-recovery/SECURITY_AUDIT_REPORT.md` — reporte completo con evidencia y recomendaciones
  - `docs/ai-recovery/SECURITY_HARDENING_PLAN.md` — plan en 6 fases (SEC-1 a SEC-6)
  - `exports/security/security_risk_matrix.xlsx` — matriz de riesgos con 16 hallazgos
  - `scripts/check-security-audit.mjs` → `npm run check:security-audit` — 27/27 PASS
  - `scripts/gen-security-matrix.mjs` — generador de la matriz XLSX
- **Hallazgos ALTO (sin fix aplicado todavía):**
  - SEC-A01: Sin headers HTTP (CSP, X-Frame-Options, HSTS) en `next.config.ts`
  - SEC-A02: `xlsx` con HIGH vulnerability (Prototype Pollution + ReDoS) — sin fix disponible
  - SEC-A03: RLS demasiado amplio en `socio_beneficiarios` y `pagos_cuotas_aplicaciones`
  - SEC-A04: Roles solo en frontend — sin RLS por rol en Supabase
- **Checks ejecutados:**
  - `check:security-audit` → **27/27 PASS**
  - `audit:ui-roles` → **34/34 PASS**
  - `smoke:demo-app` → **28/28 PASS**
  - `verify:cejuassa` → **tsc OK + build OK**
- **npm audit:** 4 vulnerabilidades (1 HIGH xlsx, 3 MODERATE — documentadas, sin fix aplicado)
- **Restricciones cumplidas:** CERO cambios en DB · CERO migraciones · CERO datos modificados · CERO lógica financiera · Anexo 06 no modificado
- **Próxima fase recomendada:** SEC-1 (quick wins — headers HTTP en `next.config.ts`, `npm audit fix` para dompurify, `.env.example`)

### Fase SEC-1 — Quick wins de seguridad (2026-07-02) ✅ COMPLETADA

- **Objetivo:** Aplicar correcciones rápidas sin tocar DB ni lógica financiera.
- **Cambios aplicados:**
  - `next.config.ts` — 6 headers HTTP: X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy, HSTS max-age=63072000, CSP-Report-Only conservadora
  - `.env.example` — creado con 3 placeholders (sin secretos reales)
  - `app/dashboard/configuracion/page.tsx` — URL Supabase derivada de `NEXT_PUBLIC_SUPABASE_URL` (eliminado hardcode del project ID)
  - `npm audit fix` — dompurify actualizado; xlsx (HIGH) y postcss (MODERATE) sin fix seguro disponible
  - `scripts/check-security-hardening-sec1.mjs` → `npm run check:security-sec1` — 21/21 PASS
- **xlsx — riesgo documentado:** HIGH sin fix en npm. Riesgo práctico BAJO porque la app solo exporta archivos, no lee archivos de usuarios externos. Fase futura: DEP-1 (migrar a exceljs).
- **CSP — estado:** Report-Only. CSP activa con nonces pendiente en SEC-1B (requiere refactor Server Components).
- **Checks ejecutados:**
  - `check:security-sec1` → **21/21 PASS**
  - `check:security-audit` → **27/27 PASS**
  - `audit:ui-roles` → **34/34 PASS**
  - `smoke:demo-app` → **28/28 PASS**
  - `smoke:report-exports` → **37/37 PASS**
  - `verify:cejuassa` → **tsc OK + build OK**
- **Restricciones cumplidas:** CERO cambios en DB · CERO migraciones · CERO datos modificados · CERO lógica financiera · Anexo 06 no modificado
- **npm audit final:** 2 vulnerabilidades restantes (xlsx HIGH sin fix, postcss MODERATE via Next.js sin fix seguro)
- **Próxima fase recomendada:** SEC-2 (API/backend — UUID validation, error mapping, rate limiting)

### Fase SEC-2 — API/backend hardening (2026-07-02) ✅ COMPLETADA

- **Objetivo:** Endurecer las 2 API routes del proyecto sin tocar DB ni lógica financiera.
- **Endpoints auditados:** `/api/usuarios/invite` (POST) y `/api/usuarios/update` (PUT) — únicos endpoints de la app.
- **Cambios aplicados:**
  - `lib/api/errors.ts` (nuevo) — `apiError(status, publicMsg, internalErr?)` + `apiSuccess()`. Logging solo en servidor via `console.error`, mensaje genérico al cliente.
  - `app/api/usuarios/update/route.ts` — UUID_REGEX valida `id` antes del query · `activo` validado como boolean · `nombre` sanitizado a 200 chars máx · todos los errores Supabase → mensaje genérico
  - `app/api/usuarios/invite/route.ts` — EMAIL_REGEX valida formato · ROLES_VALIDOS whitelist (faltaba en invite) · `nombre` sanitizado · todos los errores → mensaje genérico
  - `scripts/check-security-api-hardening.mjs` → `npm run check:security-api` — 30/30 PASS
  - `docs/ai-recovery/SECURITY_API_HARDENING_REPORT.md` — reporte con endpoints, validaciones, rate limiting diferido
- **Rate limiting:** Diferido — no confiable en serverless (Vercel Lambda sin estado compartido). Solución correcta: Upstash Redis en producción.
- **Checks ejecutados:**
  - `check:security-api` → **30/30 PASS**
  - `check:security-sec1` → **21/21 PASS**
  - `check:security-audit` → **27/27 PASS**
  - `audit:ui-roles` → **34/34 PASS**
  - `smoke:demo-app` → **28/28 PASS**
  - `verify:cejuassa` → **tsc OK + build OK**
- **Restricciones cumplidas:** CERO cambios en DB · CERO migraciones · CERO lógica financiera
- **Próxima fase recomendada:** SEC-3A (Auditoría real de RLS remoto — solo lectura)

### Fase SEC-3A — Auditoría real de RLS remoto (2026-07-02) ✅ COMPLETADA

- **Objetivo:** Auditar el estado real de RLS y policies en Supabase remoto — SOLO LECTURA. Sin modificar DB, policies ni datos.
- **Resultado:** 40/40 checks PASS · CERO cambios en DB · Estado real MUCHO MEJOR que lo esperado en SEC-0.
- **Hallazgo crítico:** La función `get_user_rol()` ya existe en producción como SECURITY DEFINER. 14/16 tablas tienen policies granulares por rol. Solo 2 tablas tienen policies amplias.
- **Tablas con policy amplia `USING (true)` — requieren corrección en SEC-3C:**
  - `socio_beneficiarios` — `autenticados_pueden_operar` (ALL authenticated, true)
  - `pagos_cuotas_aplicaciones` — `autenticados_pueden_operar_pca` (ALL authenticated, true)
- **Tablas correctamente protegidas:** usuarios (admin only), configuracion (admin only), creditos (admin/creditos), pagos_recibos (admin/tesoreria), aportes (admin/tesoreria), socios (admin/creditos), cronograma_cuotas (admin/creditos), egresos (admin/tesoreria), ampliaciones (admin/creditos), convenios (admin/tesoreria), cartera_mes (admin/creditos), cartera_resumen_mes (admin/creditos), validacion_cuadre_mes (admin/contabilidad), auditoria (SELECT+INSERT cualquier autenticado — *estado en el momento de esta auditoría SEC-3A; ver SEC-3E/SEC-4B más abajo para el estado actual, ya endurecido*).
- **Tablas sin migración local** (solo en Dashboard): `auditoria`, `cartera_mes`, `cartera_resumen_mes`, `validacion_cuadre_mes` → `auditoria` resuelta en SEC-3E (ver más abajo); las otras 3 siguen sin migración local.
- **Función helper:** `get_user_rol()` existe, SECURITY DEFINER, STABLE. Lee `rol::text` de `public.usuarios WHERE id = auth.uid()`. No necesita recrearse.
- **Riesgo transversal:** Policies usan `TO public` en lugar de `TO authenticated`. Equivalente en seguridad práctica, pero menos defensivo. Migrar en SEC-3D.
- **No hacen falta RPCs adicionales** para SEC-3C. Las writes actuales desde cliente son seguras con las nuevas policies.
- **Artefactos generados:**
  - `docs/ai-recovery/RLS_AUDIT_RESULT.md` — auditoría completa por tabla con riesgo y recomendación
  - `docs/ai-recovery/RLS_HARDENING_PLAN.md` — plan SEC-3B a SEC-3F con SQL exacto y rollback
  - `exports/security/rls_audit_matrix.xlsx` — 56 filas (2 ALTO, 1 BAJO-MEDIO, 53 BAJO)
  - `scripts/check-rls-audit.mjs` → `npm run check:rls-audit` — **40/40 PASS**
- **Checks ejecutados:**
  - `check:rls-audit` → **40/40 PASS**
  - `check:security-api` → **30/30 PASS**
  - `check:security-sec1` → **21/21 PASS**
  - `audit:ui-roles` → **34/34 PASS**
  - `smoke:demo-app` → **28/28 PASS**
  - `verify:cejuassa` → **tsc OK + build OK**
- **Restricciones cumplidas:** CERO cambios en DB · CERO migraciones · CERO cambios en policies · CERO datos modificados · CERO lógica financiera · Anexo 06 no modificado
- **Próxima fase recomendada:** ~~SEC-3C~~ ✅ COMPLETADA → SEC-3D (higiene `TO public` → `TO authenticated`)

### Fase SEC-3C — Hardening RLS en 2 tablas (2026-07-03) ✅ COMPLETADA

- **Objetivo:** Reemplazar las 2 policies amplias `FOR ALL ... USING (true)` con policies granulares por rol usando `get_user_rol()`.
- **Resultado:** 41/41 checks PASS · Migración aplicada en remoto `ljdjbhsipgkxlgnprzhm` · CERO datos tocados
- **Modelo de permisos aplicado:**
  - `socio_beneficiarios`: admin=CRUD, tesoreria=S/I/U, creditos=S, contabilidad=S
  - `pagos_cuotas_aplicaciones`: admin=CRUD, tesoreria=S/I, creditos=S, contabilidad=S
- **Policies eliminadas:** `autenticados_pueden_operar` (sb) · `autenticados_pueden_operar_pca` (pca)
- **Policies creadas:** `sb_select`, `sb_insert`, `sb_update`, `sb_delete`, `pca_select`, `pca_insert`, `pca_update`, `pca_delete`
- **Detalles técnicos:** SELECT usa `get_user_rol() IN (...)` explícito · UPDATE tiene `USING` + `WITH CHECK` · RLS sigue `ENABLED: true` en ambas tablas
- **UI alineada:** `BeneficiariosSection.tsx` ya tenía `canEdit = admin || tesoreria` — sin cambios al frontend
- **Artefactos generados:**
  - `supabase/migrations/20260702000010_sec3c_rls_hardening.sql` — migración con rollback documentado
  - `scripts/check-rls-sec3c.mjs` → `npm run check:rls-sec3c` — **41/41 PASS**
- **Checks post-apply:** `check:rls-sec3c` 41/41 · `check:rls-audit` 40/40 · `check:security-api` 30/30 · `audit:ui-roles` 34/34 · `smoke:demo-app` 28/28
- **Restricciones cumplidas:** CERO datos tocados · CERO tablas distintas tocadas · CERO lógica financiera · Anexo 06 intacto · CERO RPCs modificadas
- **Próxima fase recomendada:** SEC-3D (migrar `TO public` → `TO authenticated` — cosmético, baja prioridad)

### Fase SEC-4A — Diseño de audit log (2026-07-03) ✅ COMPLETADA

- **Objetivo:** Diseñar un sistema de auditoría operativa para registrar quién realizó acciones críticas, cuándo y sobre qué módulo/registro. SOLO DISEÑO — sin tocar DB, migraciones ni lógica funcional.
- **Resultado:** 50/50 checks PASS · CERO cambios en DB · CERO migraciones aplicadas
- **Hallazgo clave:** La tabla `auditoria` YA EXISTE en Supabase (creada directamente en Dashboard, sin migración local).
  - RLS: ON · 2 policies: `auditoria_select` (SELECT, auth.uid() IS NOT NULL) + `auditoria_insert` (INSERT, auth.uid() IS NOT NULL)
  - Sin UPDATE/DELETE policies → inmutabilidad preservada ✅
  - INSERT abierto a cualquier autenticado → se reemplazará por RPC SECURITY DEFINER en SEC-4B ⚠️
  - Estructura de columnas: desconocida desde archivos locales (crear migración local en SEC-3E)
  - En uso activo desde la app: NO (ningún componente React inserta en ella)
  - Datos con valor de trazabilidad: SÍ (no borrar sin autorización del cliente)
- **Decisión de diseño:** AMPLIAR la tabla `auditoria` existente (no crear tabla nueva)
- **Modelo recomendado:** campos `actor_user_id`, `actor_email`, `actor_rol`, `accion`, `modulo`, `tabla_afectada`, `registro_id`, `descripcion`, `metadata jsonb`, `ip_hash` (opcional), `user_agent` (opcional)
- **Implementación recomendada:** RPC `registrar_auditoria` (SECURITY DEFINER) + API routes para operaciones de usuarios
- **Operaciones críticas a auditar (15 definidas):** CREAR_CREDITO, EDITAR_CREDITO, APLICAR_AMPLIACION, REGISTRAR_PAGO, REGISTRAR_APORTE, CREAR_EGRESO, ELIMINAR_EGRESO, CREAR_SOCIO, EDITAR_SOCIO, EDITAR_BENEFICIARIOS, REGISTRAR_AMPLIACION_INFO, INVITAR_USUARIO, CAMBIAR_ESTADO_USUARIO, EDITAR_CONFIGURACION, EXPORTAR_ANEXO6
- **Permisos recomendados:**
  - Lectura: admin (todo) + contabilidad (solo módulos financieros)
  - Escritura: solo via RPC SECURITY DEFINER (INSERT directo revocado en SEC-4B)
  - UPDATE/DELETE: nadie (inmutabilidad)
- **Artefactos generados:**
  - `docs/ai-recovery/AUDIT_LOG_DESIGN_PLAN.md` — plan completo: estado actual, modelo, permisos, comparación A/B/C/D, fases, rollback
  - `exports/security/audit_log_scope.xlsx` — 15 operaciones con criticidad, tabla afectada, método, fase, riesgo
  - `scripts/check-audit-log-design.mjs` → `npm run check:audit-log-design` — **50/50 PASS**
  - `scripts/generate-audit-log-scope-matrix.mjs` → `npm run generate:audit-log-matrix`
- **Checks ejecutados:**
  - `check:audit-log-design` → **50/50 PASS**
  - `check:rls-sec3c` → **41/41 PASS**
  - `check:security-api` → **30/30 PASS**
  - `audit:ui-roles` → **34/34 PASS**
  - `smoke:demo-app` → **28/28 PASS**
  - `verify:cejuassa` → **tsc OK + build OK**
- **Restricciones cumplidas:** CERO cambios en DB · CERO migraciones aplicadas · CERO cambios en RLS/policies · CERO lógica financiera · CERO cambios en Anexo 06 · CERO pagos a cuotas tocados

### Fase SEC-3E — Baseline local de `auditoria` (2026-07-03) ✅ APLICADA EN REMOTO

- **Autorización recibida:** `APLICAR BASELINE AUDITORIA SEC-3E`
- **Qué hizo:** documentó en migración local (`20260703120000_sec3e_auditoria_baseline.sql`) la estructura ya existente de `auditoria` (8 columnas: `id`, `id_usuario`, `modulo`, `accion`, `descripcion`, `registro_id`, `ip`, `fecha_hora`) — sin cambios de estructura, solo sincroniza historial local con lo que ya existía en remoto.
- **Aplicada vía:** Supabase MCP `apply_migration` (no `db push`, para no arrastrar SEC-4B aún no autorizada).
- **Hallazgo colateral resuelto:** el historial de migraciones local estaba desincronizado — SEC-3C había sido aplicada en sesión anterior directamente vía MCP (quedó como remote-only `20260703165058`) en vez de vía `db push`. Se verificó que el contenido remoto coincidía exactamente con el archivo local `20260702000010` antes de reparar el historial con `supabase migration repair --status applied`.
- **Verificación post-apply:** tabla intacta, RLS habilitado, 2 policies, `row_count = 0`.
- **Artefactos:** `docs/ai-recovery/AUDITORIA_TABLE_BASELINE_REPORT.md`, `supabase/migrations/20260703120000_sec3e_auditoria_baseline.sql`, `scripts/check-auditoria-baseline-sec3e.mjs` → `npm run check:auditoria-baseline-sec3e` — **40/40 PASS**

### Fase SEC-4B — Implementación de audit log (2026-07-03) ✅ APLICADA EN REMOTO

- **Autorización recibida:** `APLICAR AUDIT LOG SEC-4B` (dos veces: primero la migración base, luego una revisión de endurecimiento pre-apply antes de la autorización final)
- **Revisión de endurecimiento (previa al apply):** la versión original de la RPC solo afirmaba "sanitizar metadata" en un comentario sin control técnico real. Se reescribió `registrar_auditoria` con 7 controles reales:
  - A. Requiere `auth.uid()` + rol existente en `usuarios`, si no → `RETURN` silencioso
  - B. Whitelist fija de 14 acciones (`p_accion NOT IN (...)` → `RETURN`)
  - C. Whitelist fija de 10 módulos (`p_modulo NOT IN (...)` → `RETURN`)
  - D. Truncado seguro de longitud (80/80/120/500 caracteres, nunca rechaza por longitud)
  - E. `metadata` debe ser objeto JSON o NULL (rechaza arrays/strings/números/booleanos)
  - F. Tamaño máximo de `metadata` serializada: 4000 caracteres
  - G. Rechazo de metadata si alguna clave de primer nivel coincide con términos sensibles (dni, password, token, email, etc.) — **limitación documentada:** solo inspecciona primer nivel, no objetos anidados
- **`lib/audit/types.ts` alineado** con la whitelist SQL antes del apply (se habían detectado `EXPORTAR_BDCC`, `ACTIVAR_USUARIO`, `DESACTIVAR_USUARIO` que la RPC iba a rechazar en silencio — corregidos a coincidir exactamente: 14 acciones / 10 módulos).
- **Qué se aplicó en remoto:** 5 columnas nuevas (`actor_email`, `actor_rol`, `tabla_afectada`, `metadata`, `ip_hash`), `auditoria_insert` (INSERT directo) eliminada, `auditoria_select` restringida a `get_user_rol() IN ('admin','contabilidad')`, RPC `registrar_auditoria` SECURITY DEFINER creada.
- **Hallazgo corregido durante el apply:** Supabase concede `EXECUTE` a `anon`/`authenticated`/`service_role` automáticamente en funciones nuevas del schema `public` (`ALTER DEFAULT PRIVILEGES`) — esto no lo cubre `REVOKE ALL FROM PUBLIC`. Se ejecutó `REVOKE EXECUTE ... FROM anon` adicional (agregado también a la migración local). No era explotable (el control A ya bloqueaba inserciones sin sesión), pero se corrigió para alinear con el diseño declarado.
- **Verificación post-apply:** 13 columnas en `auditoria`, solo policy `auditoria_select`, RPC con `SECURITY DEFINER = true` y ACL `{postgres, authenticated, service_role}` (sin `anon`), `row_count = 0`.
- **Artefactos:** `docs/ai-recovery/AUDIT_LOG_IMPLEMENTATION_PLAN.md`, `supabase/migrations/20260703130000_sec4b_audit_log_implementation.sql`, `lib/audit/types.ts`, `lib/audit/auditClient.ts` (`AUDIT_ENABLED = false`), `scripts/check-audit-log-implementation-plan.mjs` → `npm run check:audit-log-implementation-plan` — **63/63 PASS**
- **Estado real:** la infraestructura existe y es segura, pero está **inactiva** — `AUDIT_ENABLED = false`, ningún módulo llama a `registrarAudit()` todavía.
- **Próxima fase recomendada:** SEC-4C (integrar `registrarAudit()` en módulos, empezando por `usuarios`, luego activar `AUDIT_ENABLED = true`) — no urgente, requiere su propia autorización cuando se decida iniciar.

### Regla de trabajo
Automatizar todo lo seguro. Pedir intervención del usuario solo para SQL productivo, datos reales, credenciales, acciones destructivas o permisos RLS.
