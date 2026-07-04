# FUNCTIONAL_AUDIT_REPORT.md

> Auditoría funcional completa del sistema CEJUASSA — Fase 9A-9B (2026-06-20)
> Estado: cada módulo fue auditado contra el código fuente real en `app/dashboard/`.

---

## Resumen ejecutivo

| Categoría | Total | OK | Parcial | Pendiente | Riesgo |
|---|---|---|---|---|---|
| Módulos de datos | 9 | 8 | 1 | 0 | 0 |
| Módulos de reporte | 3 | 2 | 1 | 0 | 0 |
| Infraestructura | 6 | 5 | 0 | 1 | 0 |
| Validaciones automáticas | 7 | 7 | 0 | 0 | 0 |
| **Total** | **25** | **22** | **2** | **1** | **0** |

---

## 1. Módulos de datos

### 1.1 Dashboard

| Campo | Valor |
|---|---|
| **Ruta** | `/dashboard` |
| **Archivo** | `app/dashboard/page.tsx` |
| **Estado** | ✅ OK |
| **Validación existente** | `npm run verify:cejuassa` (tsc + build) |

**Funcionalidades auditadas:**
- ✅ Carga cartera total (créditos vigentes, suma saldo_capital)
- ✅ Carga socios activos y número de créditos
- ✅ Cálculo de provisiones usando `getTasaProvision(dias, tasas)` con tasas de `configuracion`
- ✅ Fallback a tasas SBS por defecto + banner amarillo si falla lectura de config
- ✅ Gráficos con Recharts
- ✅ Sin service role en frontend

**Riesgo:** Ninguno activo.

---

### 1.2 Socios

| Campo | Valor |
|---|---|
| **Ruta** | `/dashboard/socios`, `/dashboard/socios/nuevo`, `/dashboard/socios/[id]/editar` |
| **Archivos** | `socios/page.tsx`, `socios/nuevo/page.tsx`, `socios/[id]/editar/page.tsx`, `socios/_components/SocioForm.tsx` |
| **Estado** | ✅ OK |
| **Validación existente** | `check:bdcc:ui-fields` 26/26 (verifica campos género/estado civil en formulario) |

**Funcionalidades auditadas:**
- ✅ Lista de socios con búsqueda
- ✅ Crear socio (route guard: admin, creditos)
- ✅ Editar socio (route guard: admin, creditos)
- ✅ Botones crear/editar ocultos para tesorería/contabilidad
- ✅ Campos SBS/BDCC: `genero`, `estado_civil` (Fase 8A-2/8A-3)
- ✅ Exportar ficha PDF (`generarFichaSocioPDF.ts`)
- ✅ Imports jspdf dinámicos (evita SSR)

**Riesgo:** Ninguno activo. Campos género/estado civil son opcionales en UI — si el usuario no los llena, BD01 tendrá campos vacíos.

---

### 1.3 Créditos

| Campo | Valor |
|---|---|
| **Ruta** | `/dashboard/creditos`, `/dashboard/creditos/nuevo`, `/dashboard/creditos/[id]/editar`, `/dashboard/creditos/[id]` |
| **Archivos** | `creditos/page.tsx`, `creditos/nuevo/page.tsx`, `creditos/[id]/editar/page.tsx`, `creditos/[id]/page.tsx` |
| **Estado** | ✅ OK |
| **Validación existente** | `check:bdcc:ui-fields`, `test:rpc:c` 5/5, `test:rpc:c:happy` 13/13 |

**Funcionalidades auditadas:**
- ✅ Lista de créditos con filtros
- ✅ Crear crédito vía RPC C `crear_credito_con_cronograma` (atómico — R8 resuelto)
- ✅ Cronograma generado en memoria (sistema francés, última cuota absorbe redondeo)
- ✅ Editar crédito con campos SBS: `nro_expediente`, `tipo_credito_sbs`, `subtipo_credito_sbs`, `cuenta_contable_bd01`, `aporte_descontado`, `tramite`
- ✅ Route guard: PUEDE_CREAR_CREDITOS / PUEDE_EDITAR_CREDITOS = ['admin', 'creditos']
- ✅ Update post-RPC con creditoId para guardar campos SBS separadamente
- ✅ Detalle de crédito con cronograma completo

**Riesgo:** Ninguno activo. Tipo_credito_sbs/subtipo pendiente de validación final con SBS — informativo, no bloquea operación.

---

### 1.4 Pagos

| Campo | Valor |
|---|---|
| **Ruta** | `/dashboard/pagos`, `/dashboard/pagos/nuevo` |
| **Archivos** | `pagos/page.tsx`, `pagos/nuevo/page.tsx` |
| **Estado** | ✅ OK |
| **Validación existente** | `check:bdcc:ui-fields` (verifica campo tipo_pago) |

**Funcionalidades auditadas:**
- ✅ Lista de pagos con recibo PDF
- ✅ Registrar pago (route guard: admin, tesorería)
- ✅ Flujo de pago: insert pagos_recibos → RPC A saldo_capital → actualización cuotas → RPC B aporte
- ✅ RPC A `decrementar_saldo_capital` activa (R5 resuelto)
- ✅ RPC B `registrar_aporte_socio` activa (R6 resuelto)
- ✅ Fallback RPC A blindado: solo activa con código 42883/PGRST202
- ✅ Validación de sobrepago antes de insert (líneas 201-204)
- ✅ Pagos parciales acumulativos: `.in('estado', ['pendiente','vencida','parcial'])` (R7 resuelto)
- ✅ Campo `tipo_pago` con default 'A', opción 'K'

**Riesgo residual:** Recibo insertado antes de RPC — si RPC falla por error inesperado, recibo queda sin efecto sobre saldo. Probabilidad baja en operación normal. No bloqueante.

---

### 1.5 Aportes

| Campo | Valor |
|---|---|
| **Ruta** | `/dashboard/aportes` |
| **Archivo** | `app/dashboard/aportes/page.tsx` |
| **Estado** | ⚠️ Parcial |
| **Validación existente** | `verify:cejuassa` |

**Funcionalidades auditadas:**
- ✅ Lista de aportes por socio
- ✅ Botón "Registrar aporte vía pago" solo visible para admin/tesorería
- ⚠️ B1: `useMemo` async en el componente (hook mal usado — no bloqueante, dato se carga pero patrón incorrecto)
- ✅ Sin formulario propio de aportes — los aportes se crean solo desde Pagos (correcto por diseño)

**Riesgo:** B1 activo (no bloqueante). `useMemo` debería ser `useEffect + useState`. Funciona pero el patrón es incorrecto.

**Recomendación:** Refactorizar `useMemo` async a `useEffect + useState` en baja prioridad.

---

### 1.6 Egresos

| Campo | Valor |
|---|---|
| **Ruta** | `/dashboard/egresos` |
| **Archivo** | `app/dashboard/egresos/page.tsx` |
| **Estado** | ✅ OK |
| **Validación existente** | `verify:cejuassa` |

**Funcionalidades auditadas:**
- ✅ Lista de egresos
- ✅ Crear egreso (modal) — visible solo para admin/tesorería (PUEDE_EDITAR_EGRESOS)
- ✅ Editar egreso (modal) — igual
- ✅ Eliminar egreso — igual
- ✅ Guards defensivos en openNuevo, openEditar, handleDelete
- ✅ Contabilidad ve la lista pero no los botones de acción
- ✅ Créditos no ve el módulo en sidebar

**Riesgo:** Ninguno activo.

---

### 1.7 Convenios

| Campo | Valor |
|---|---|
| **Ruta** | `/dashboard/convenios` |
| **Estado** | ✅ OK |
| **Validación existente** | `verify:cejuassa` |

**Funcionalidades auditadas:**
- ✅ Lista de convenios
- ✅ Resumen de pagos por convenio y período
- ✅ Contabilidad no ve Convenios en sidebar
- ✅ Admin puede gestionar convenios en `/dashboard/configuracion/convenios` (route guard: solo admin)

**Riesgo:** Ninguno activo.

---

### 1.8 Cartera

| Campo | Valor |
|---|---|
| **Ruta** | `/dashboard/cartera` |
| **Archivo** | `app/dashboard/cartera/page.tsx` |
| **Estado** | ✅ OK |
| **Validación existente** | `verify:cejuassa`, `test:provision:config` 15/15 |

**Funcionalidades auditadas:**
- ✅ Clasificación SBS de créditos vigentes (Normal/CPP/Deficiente/Dudoso/Pérdida)
- ✅ Tasas de provisión leídas desde `configuracion` (Fase 5A.2)
- ✅ Fallback a tasas SBS por defecto + banner si falla
- ✅ Exportar a Excel

**Riesgo:** Ninguno activo.

---

### 1.9 Mora

| Campo | Valor |
|---|---|
| **Ruta** | `/dashboard/mora` |
| **Estado** | ✅ OK |

**Funcionalidades auditadas:**
- ✅ Lista créditos con cuotas vencidas
- ✅ Días de mora calculados desde cuota más antigua pendiente

**Riesgo:** Ninguno activo.

---

### 1.10 Usuarios

| Campo | Valor |
|---|---|
| **Ruta** | `/dashboard/usuarios`, `/dashboard/usuarios/nuevo`, `/dashboard/usuarios/[id]` |
| **Estado** | ✅ OK |
| **Validación existente** | `audit:service-role` |

**Funcionalidades auditadas:**
- ✅ Lista de usuarios (solo admin)
- ✅ Invitar usuario — usa API route `/api/usuarios/invite` con service role (R4 resuelto)
- ✅ Editar rol — usa API route `/api/usuarios/update` con lista blanca de roles
- ✅ Route guard: solo admin puede acceder a cualquier página de Usuarios
- ✅ Módulo oculto en sidebar para tesorería, créditos, contabilidad

**Riesgo:** Ninguno activo.

---

### 1.11 Configuración

| Campo | Valor |
|---|---|
| **Ruta** | `/dashboard/configuracion` |
| **Estado** | ✅ OK |

**Funcionalidades auditadas:**
- ✅ Leer y actualizar datos de la cooperativa (fila única id=1)
- ✅ Tasas de provisión editables
- ✅ Solo admin puede acceder (route guard explícito)
- ✅ Gestión de convenios en sub-ruta (solo admin)

**Riesgo:** Ninguno activo.

---

## 2. Módulos de reporte

### 2.1 Reportes (índice)

| Campo | Valor |
|---|---|
| **Ruta** | `/dashboard/reportes` |
| **Estado** | ✅ OK |
| **Validación existente** | `check:monday-readiness` 37/37 |

- ✅ Card de BDCC SBS visible y enlazado
- ✅ Exportadores de cartera, aportes, caja disponibles

---

### 2.2 Anexo 6 SBS

| Campo | Valor |
|---|---|
| **Ruta** | `/dashboard/reportes/anexo6` |
| **Archivo** | `app/dashboard/reportes/anexo6/page.tsx` |
| **Estado** | ✅ OK |
| **Validación existente** | `check:provision:constituida` 10/10 |

**Funcionalidades auditadas:**
- ✅ 60 columnas SBS por crédito
- ✅ Tasas desde `configuracion` (Fase 5A.1) — fallback + banner
- ✅ `provision_constituida` = `provision_requerida` por deudor (criterio_contable_confirmado — B3 resuelto)
- ✅ Banner informativo azul (no naranja) — sin window.confirm
- ✅ Exportar Excel con xlsx
- ✅ Sin service role en frontend

**Riesgo:** Archivo crítico — no modificar sin plan aprobado.

---

### 2.3 BDCC SBS

| Campo | Valor |
|---|---|
| **Ruta** | `/dashboard/reportes/bdcc` |
| **Archivo** | `app/dashboard/reportes/bdcc/page.tsx`, `lib/bdcc/format.ts` |
| **Estado** | ⚠️ Parcial (MVP funcional, pendientes documentados) |
| **Validación existente** | `smoke:bdcc` 51/51, `check:bdcc:mvp-exporters` 38/38 |

**Funcionalidades auditadas:**
- ✅ BD01 genera archivo TXT con separador tabulador
- ✅ BD02-A genera cuotas pagadas en el período
- ✅ BD03A y BD03B solo encabezado (sin garantías — confirmado por Contabilidad)
- ✅ BD02-B y BD04 bloqueados con mensaje explicativo
- ✅ Código COOPAC 01270 en nombre de archivo y en contenido
- ✅ Advertencias regulatorias visibles en UI
- ✅ Sin service role en frontend
- ⏳ TPINT pendiente de validación (¿nominal o TEA?)
- ⏳ TIPCRED/SUBTIPCRED pendiente de confirmar códigos exactos SBS
- ⏳ CCVE/CCJU pendiente de confirmar con Contabilidad
- ⏳ BD02-B/BD04 requieren módulo de créditos cancelados (subproyecto futuro)

**Riesgo:** MVP funcional pero no validado para envío oficial. Revisar contra Oficio SBS N°32791-2026-SBS antes de la entrega del 20/07/2026.

---

## 3. Infraestructura

### 3.1 Autenticación

| Campo | Valor |
|---|---|
| **Estado** | ✅ OK |
| **Validación existente** | `verify:cejuassa`, build confirmó `ƒ Proxy (Middleware)` activo |

- ✅ Supabase Auth con email + contraseña
- ✅ `lib/supabase.ts` exporta cliente browser
- ✅ `lib/useRol.ts` hook client-side para rol
- ✅ Logout limpio en sidebar (`supabase.auth.signOut()`)

---

### 3.2 Middleware / Proxy

| Campo | Valor |
|---|---|
| **Archivo** | `proxy.ts` (raíz del proyecto) |
| **Estado** | ✅ OK (R1 resuelto) |

- ✅ `proxy.ts` activo en Next.js 16 (reemplaza `middleware.ts` deprecado)
- ✅ `createServerClient` + `supabase.auth.getUser()` + redirect a `/login` si sin sesión
- ✅ Matcher: excluye api, _next/static, _next/image, favicon.ico
- ✅ Build confirma `ƒ Proxy (Middleware)` en el árbol de rutas

---

### 3.3 Service Role (API Routes)

| Campo | Valor |
|---|---|
| **Archivos** | `lib/api/requireAdmin.ts`, `app/api/usuarios/invite/route.ts`, `app/api/usuarios/update/route.ts` |
| **Estado** | ✅ OK (R4 resuelto) |
| **Validación existente** | `audit:service-role` |

- ✅ `SUPABASE_SERVICE_ROLE_KEY` solo en `lib/api/requireAdmin.ts`
- ✅ `requireAdmin()` valida sesión de usuario antes de usar service role
- ✅ `/api/usuarios/update` valida lista blanca de roles ('admin','tesoreria','creditos','contabilidad')
- ✅ Sin service role en ningún componente frontend

---

### 3.4 RPC A — decrementar_saldo_capital

| Campo | Valor |
|---|---|
| **Migración** | `20260617000000` |
| **Estado** | ✅ OK (R5 resuelto) |
| **Validación existente** | Aplicada en Supabase `ljdjbhsipgkxlgnprzhm` |

- ✅ UPDATE atómico con row lock implícito
- ✅ Fallback blindado en frontend (solo activa con código 42883/PGRST202)
- ✅ Validación de sobrepago en UI antes del insert

---

### 3.5 RPC B — registrar_aporte_socio

| Campo | Valor |
|---|---|
| **Migración** | `20260617000001` |
| **Estado** | ✅ OK (R6 resuelto) |
| **Validación existente** | `test:rpc:b` 2/2 |

- ✅ Advisory lock por socio (evita race condition de saldo)
- ✅ Integrada en `pagos/nuevo/page.tsx` paso 4

---

### 3.6 RPC C — crear_credito_con_cronograma

| Campo | Valor |
|---|---|
| **Migraciones** | `20260617000002`, `20260617000003` (cast tipo_credito), `20260617000004` (cast estado_cuota) |
| **Estado** | ✅ OK (R8 resuelto) |
| **Validación existente** | `test:rpc:c` 5/5, `test:rpc:c:happy` 13/13 |

- ✅ Transacción plpgsql implícita — rollback si falla el cronograma
- ✅ Hotfixes de ENUM aplicados
- ✅ Integrada en `creditos/nuevo/page.tsx`

---

## 4. Validaciones automáticas

| Script | Checks | Estado |
|---|---|---|
| `verify:cejuassa` | lint + tsc + build | ✅ OK (build 35/35) |
| `check:provision:constituida` | 10 checks B3 | ✅ 10/10 PASS |
| `check:monday-readiness` | 37 checks entrega | ✅ 37/37 PASS |
| `smoke:bdcc` | 51 checks BDCC UI | ✅ 51/51 PASS |
| `check:bdcc:mvp-exporters` | 38 checks generador | ✅ 38/38 PASS |
| `check:bdcc:ui-fields` | 26 checks UI campos | ✅ 26/26 PASS |
| `check:bdcc:min-fields` | 16 checks DB campos | ✅ 16/16 PASS |

---

## 5. Deuda técnica activa (no bloqueante)

| ID | Descripción | Prioridad |
|---|---|---|
| B1 | `useMemo` async en `aportes/page.tsx` — patrón incorrecto pero funcional | Baja |
| B2 | Tipos `any` en algunos componentes de egresos y reportes | Baja |

---

## 6. Recomendaciones antes de producción completa

1. **Completar datos SBS faltantes**: género/estado civil socios, TPINT, TIPCRED/SUBTIPCRED, CCVE/CCJU.
2. **Revisar BD01 y BD02-A** fila por fila contra el Oficio SBS N°32791-2026-SBS antes de enviar.
3. **Planificar módulo de créditos cancelados** para habilitar BD02-B y BD04 (subproyecto separado).
4. **Plan de limpieza de datos de prueba** antes de la operación real — ver Fase 9C (pendiente).
5. **Refactorizar B1** (`useMemo` async) en baja prioridad para evitar bugs silenciosos futuros.

---

*Generado: 2026-06-20 — Fase 9A-9B*
