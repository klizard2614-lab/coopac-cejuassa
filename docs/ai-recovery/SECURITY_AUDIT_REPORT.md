# SECURITY_AUDIT_REPORT.md

> **Fase SEC-0 — Auditoría integral de seguridad CEJUASSA**
> Fecha: 2026-07-02
> Clasificación: SOLO USO INTERNO
> Autor: Claude Code (auditoría estática — sin modificar DB ni lógica)

---

## Resumen ejecutivo

El sistema CEJUASSA presenta una base de seguridad razonable para una cooperativa en operación supervisada, con los riesgos críticos de autenticación y control de acceso resueltos en fases anteriores (R1–R8 del historial). Sin embargo, existen brechas significativas en capas defensivas que deben cerrarse antes de una operación real no supervisada:

1. **Headers HTTP completamente ausentes** — no hay CSP, X-Frame-Options ni protección contra clickjacking.
2. **Roles aplicados solo en frontend** — cualquier usuario autenticado con cliente Supabase directo puede eludir restricciones de rol a nivel de DB.
3. **`xlsx` con vulnerabilidad HIGH sin fix disponible** — el paquete de exportación de reportes tiene Prototype Pollution y ReDoS.
4. **RLS demasiado amplio en tablas nuevas** — `socio_beneficiarios` y `pagos_cuotas_aplicaciones` aceptan cualquier usuario autenticado para cualquier operación.

**Estado general:** `PROCEDER CON CAUTELA` — el sistema puede operar en demo supervisada, pero requiere hardening antes de operación autónoma.

---

## Estado general de seguridad

| Capa | Estado | Detalle |
|------|--------|---------|
| Autenticación (login/logout/sesión) | ✅ BUENO | `proxy.ts` usa `getUser()` SSR, redirect a `/login`, sin sesiones stale |
| Middleware de rutas | ✅ BUENO | `proxy.ts` activo en Next.js 16, matcher correcto |
| Autorización frontend | ✅ BUENO | Guards en formularios críticos, sidebar filtrado por rol |
| Autorización backend (API routes) | ✅ BUENO | `requireAdmin` centralizado, lista blanca de roles |
| Autorización DB (RLS por rol) | ⚠️ PARCIAL | Nuevas tablas tienen RLS broad; tablas legacy sin confirmar |
| Service role confinamiento | ✅ BUENO | Solo en `lib/api/requireAdmin.ts` + `lib/` scripts |
| Variables de entorno | ✅ BUENO | `.gitignore` cubre `.env*`, sin secrets NEXT_PUBLIC |
| Headers HTTP de seguridad | ❌ AUSENTE | `next.config.ts` vacío — sin CSP, X-Frame, HSTS |
| Validaciones de entrada | ⚠️ PARCIAL | Frontend OK, sin validación server-side en API routes |
| Dependencias | ⚠️ RIESGO | `xlsx` HIGH, `dompurify` + `postcss` MODERATE |
| Logs y datos sensibles | ✅ BUENO | Sin `console.log` con datos sensibles en código de app |
| Backups y recuperación | ⚠️ PARCIAL | Backups manuales existen, sin automatización |
| Auditoría de acciones | ❌ AUSENTE | Sin log de quién hizo qué en operaciones financieras |

---

## Matriz de riesgos

| ID | Área | Severidad | Probabilidad | Impacto |
|----|------|-----------|--------------|---------|
| SEC-A01 | Headers HTTP | Alto | Media | Alto |
| SEC-A02 | Dependencias (xlsx) | Alto | Baja-Media | Alto |
| SEC-A03 | Supabase RLS (tablas nuevas) | Alto | Media | Alto |
| SEC-A04 | Autorización DB por rol | Alto | Media | Alto |
| SEC-B01 | Validación id en update API | Medio | Baja | Medio |
| SEC-B02 | Mensajes error internos al cliente | Medio | Media | Medio |
| SEC-B03 | Sin .env.example | Bajo | Baja | Bajo |
| SEC-B04 | Guard pattern inconsistente en usuarios/page | Bajo | Baja | Bajo |
| SEC-B05 | postcss vulnerable (via next) | Medio | Baja | Medio |
| SEC-B06 | dompurify vulnerable | Medio | Baja | Bajo |
| SEC-B07 | Páginas read-only sin guard de rol | Medio | Media | Bajo |
| SEC-B08 | Sin rate limiting en API routes | Medio | Baja | Medio |
| SEC-C01 | Sin paginación server-side | Bajo | Alta | Bajo |
| SEC-C02 | Sin automatización de backups | Bajo | Media | Alto |
| SEC-C03 | Sin auditoría de acciones (audit log) | Bajo | Alta | Medio |
| SEC-C04 | URL hardcodeada en configuración | Bajo | Baja | Bajo |

---

## Hallazgos por severidad

### 🔴 ALTO — Requieren corrección antes de operación autónoma

---

#### SEC-A01 — Sin headers de seguridad HTTP

**Evidencia:** `next.config.ts` contiene solo la configuración vacía `const nextConfig: NextConfig = {}`.

**Archivos afectados:**
- `next.config.ts` (línea 3)

**Headers ausentes:**
- `Content-Security-Policy` (CSP) — no hay restricción de carga de scripts externos
- `X-Frame-Options: DENY` — la app puede embeberse en iframes de terceros (clickjacking)
- `X-Content-Type-Options: nosniff` — MIME sniffing no está bloqueado
- `Referrer-Policy: strict-origin-when-cross-origin` — headers referrer no controlados
- `Permissions-Policy` — cámara, micrófono, geolocalización sin restricción
- `Strict-Transport-Security` — HSTS ausente (aplica si hay HTTPS en producción)

**Impacto:** Exposición a ataques de clickjacking, XSS amplificado sin CSP, MIME sniffing attacks. Para un sistema financiero con datos de socios y créditos, esto es una brecha estándar que cualquier escáner básico detectaría.

**Recomendación:** Agregar `headers()` en `next.config.ts` con los headers recomendados.

**Fase sugerida:** SEC-1 (quick win — no toca DB ni lógica)

---

#### SEC-A02 — `xlsx` con vulnerabilidades HIGH sin fix disponible

**Evidencia:**
```
xlsx  *
Severity: high
Prototype Pollution in sheetJS - GHSA-4r6h-8v6p-xvw6
SheetJS Regular Expression Denial of Service (ReDoS) - GHSA-5pgg-2g8v-p4x9
No fix available
```

**Archivos afectados:**
- `package.json` (dependencia `"xlsx": "^0.18.5"`)
- Páginas que usan xlsx: `reportes/anexo6/page.tsx`, `reportes/aportes/page.tsx`, `reportes/caja/page.tsx`, `scripts/` varios

**Impacto:**
- **Prototype Pollution:** Un atacante que controle el contenido del Excel procesado podría contaminar el prototipo de Object y alterar comportamiento de la app.
- **ReDoS:** Procesamiento de cadenas regex maliciosas podría causar denegación de servicio en el cliente.
- En el contexto actual (solo exportación, sin importación de archivos de usuarios externos), el riesgo es menor. Si se agrega importación de Excel desde fuentes externas, el riesgo sube a CRÍTICO.

**Recomendación:** Evaluar migración a `exceljs` (alternativa activa con mantenimiento). No ejecutar `npm audit fix --force` — requeriría downgrade de Next.js a v9.

**Fase sugerida:** SEC-2 (requiere evaluación de impacto de migración)

---

#### SEC-A03 — RLS demasiado amplio en tablas nuevas

**Evidencia:** Migración `20260702000003_create_pagos_cuotas_aplicaciones.sql` (líneas 48-53):
```sql
CREATE POLICY autenticados_pueden_operar_pca
  ON public.pagos_cuotas_aplicaciones
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

Y migración `20260623000001_create_socio_beneficiarios.sql` usa patrón idéntico (`autenticados_pueden_operar`).

**Tablas afectadas:**
- `socio_beneficiarios` — RLS ON, policy `FOR ALL TO authenticated USING (true)`
- `pagos_cuotas_aplicaciones` — RLS ON, policy `FOR ALL TO authenticated USING (true)`

**Impacto:** Cualquier usuario autenticado (tesorería, créditos, contabilidad) puede INSERT/UPDATE/DELETE en estas tablas directamente via la API de Supabase sin pasar por el frontend. Las restricciones de rol están solo en el frontend.

**Tablas legacy (sin confirmar desde migraciones):** `socios`, `creditos`, `pagos_recibos`, `cronograma_cuotas`, `aportes`, `egresos`, `convenios`, `usuarios`, `configuracion` — estado de RLS desconocido desde código local. Requiere verificación en Supabase Dashboard.

**Recomendación:** Refinir policies con funciones `get_role()` que lean el rol del usuario desde la tabla `usuarios`. Requiere autorización explícita para cambios en DB.

**Fase sugerida:** SEC-3 (requiere autorización para cambios en Supabase RLS)

---

#### SEC-A04 — Autorización de roles aplicada solo en frontend

**Evidencia:** El hook `useRol()` (`lib/useRol.ts`) lee el rol del usuario con la ANON_KEY del browser. Las restricciones como "tesorería no puede crear créditos" son verificadas client-side. Un usuario con acceso a las Supabase JS tools podría:

```js
// Desde consola del browser, autenticado como "tesoreria":
const supabase = createClient(URL, ANON_KEY)
await supabase.from('creditos').insert({...})  // solo bloqueado por RLS, no por rol
```

**Archivos afectados:** Todos los guards frontend en `app/dashboard/**`:
- `creditos/nuevo/page.tsx` — guard `PUEDE_CREAR_CREDITOS = ['admin','creditos']` (solo frontend)
- `pagos/nuevo/page.tsx` — guard `PUEDE_CREAR_PAGOS = ['admin','tesoreria']` (solo frontend)
- `egresos/page.tsx` — guard bloquea `creditos` (solo frontend)

**Impacto:** Un usuario de tesorería podría crear créditos directamente en Supabase. Un usuario de créditos podría registrar pagos. Esto solo es explotable por usuarios internos con conocimiento técnico.

**Recomendación:** Complementar con RLS por rol en Supabase usando funciones `auth.jwt()` para verificar rol. Esto es SEC-3.

**Fase sugerida:** SEC-3

---

### 🟡 MEDIO — Corregir antes de operación no supervisada

---

#### SEC-B01 — `id` en `update/route.ts` sin validación de formato

**Evidencia:** `app/api/usuarios/update/route.ts` línea 11:
```ts
const { id, rol, activo, nombre } = await request.json()
if (!id) { return Response.json({ error: 'id es requerido' }, { status: 400 }) }
```

No valida que `id` sea un UUID válido antes de la query Supabase.

**Impacto:** Un input malformado podría llegar a la capa de DB. Supabase filtrará el tipo, pero es una capa de defensa ausente. No explotable actualmente porque el endpoint requiere rol `admin`.

**Recomendación:** Agregar validación de UUID con regex antes de la query.

**Fase sugerida:** SEC-2

---

#### SEC-B02 — Mensajes de error internos expuestos al cliente

**Evidencia:**
- `invite/route.ts` línea 17: `return Response.json({ error: inviteError.message }, ...)`
- `update/route.ts` línea 32: `return Response.json({ error: error.message }, ...)`
- Ambos también exponen `err.message` en catch genérico

**Impacto:** Mensajes internos de Supabase/PostgreSQL pueden filtrar información sobre estructura interna de la DB, nombres de columnas, constraints. No es una falla directamente explotable, pero reduce la postura de seguridad.

**Recomendación:** Mapear errores internos a mensajes genéricos. Solo loguear el error real en servidor (no consola del browser).

**Fase sugerida:** SEC-2

---

#### SEC-B05 — `postcss` vulnerable (via next)

**Evidencia:**
```
postcss  <8.5.10
XSS via Unescaped </style> in CSS Stringify Output - GHSA-qx2v-qp2m-jg93
fix available via npm audit fix --force (requiere downgrade a Next.js 9.3.3)
```

**Impacto:** XSS en build-time via strings CSS maliciosas. Afecta al proceso de build, no al runtime de producción directamente. El riesgo es bajo en producción pero puede afectar entornos de CI/CD.

**Recomendación:** Monitorear actualizaciones de Next.js que actualicen postcss. No ejecutar `npm audit fix --force`.

**Fase sugerida:** SEC-1 (monitoreo, sin acción inmediata)

---

#### SEC-B06 — `dompurify` vulnerable

**Evidencia:**
```
dompurify  <=3.4.10
DOMPurify: Trusted Types policy survives clearConfig() - GHSA-vxr8-fq34-vvx9
DOMPurify: ALLOWED_ATTR pollution via setConfig() - GHSA-cmwh-pvxp-8882
fix available via npm audit fix
```

**Impacto:** Bypass potencial de sanitización HTML si dompurify es usado. En CEJUASSA no se usa dompurify directamente — es dependencia de una dependencia. El impacto práctico es bajo.

**Recomendación:** Ejecutar `npm audit fix` (sin `--force`) para actualizar dompurify sin breaking changes.

**Fase sugerida:** SEC-1 (safe — no breaking changes)

---

#### SEC-B07 — Páginas de solo lectura sin guard de rol explícito

**Evidencia:** Las siguientes páginas NO tienen `useRol` + `AccesoDenegado` pattern:
- `app/dashboard/page.tsx` — Dashboard principal
- `app/dashboard/mora/page.tsx` — Lista de mora
- `app/dashboard/cartera/page.tsx` — Cartera
- `app/dashboard/cartera/[id]/page.tsx` — Detalle cartera
- `app/dashboard/convenios/page.tsx` — Lista convenios
- `app/dashboard/convenios/[id]/page.tsx` — Detalle convenio
- `app/dashboard/creditos/[id]/page.tsx` — Detalle crédito
- `app/dashboard/pagos/[id]/page.tsx` — Detalle pago
- `app/dashboard/aportes/[id]/page.tsx` — Detalle aporte
- `app/dashboard/reportes/page.tsx` — Índice de reportes
- `app/dashboard/reportes/anexo6/page.tsx` — Reporte regulatorio SBS

**Impacto:** Cualquier rol autenticado puede ver estas páginas. La mayoría son read-only y es aceptable en la política actual, pero el Anexo 6 (reporte regulatorio con datos financieros de todos los socios) está accesible para tesorería, créditos y contabilidad por igual — puede ser intencional pero no está explícitamente documentado como política.

**Recomendación:** Documentar explícitamente que el acceso a estas páginas es intencional para todos los roles. Si el Anexo 6 debe ser solo para `contabilidad`/`admin`, agregar guard.

**Fase sugerida:** SEC-6 (decisión de negocio requerida)

---

#### SEC-B08 — Sin rate limiting en API routes

**Evidencia:** `app/api/usuarios/invite/route.ts` y `app/api/usuarios/update/route.ts` no tienen limitación de intentos.

**Impacto:** Un admin malicioso podría enviar invitaciones masivas o actualizar usuarios en bucle. El endpoint ya requiere rol `admin`, lo que limita el vector de ataque a usuarios internos admin.

**Recomendación:** Agregar rate limiting con `@upstash/ratelimit` o middleware de Next.js.

**Fase sugerida:** SEC-2

---

### 🟢 BAJO — Deuda técnica de seguridad

---

#### SEC-C01 — Sin paginación server-side

Todo el fetching de datos es client-side con `useEffect` + Supabase. Con 782 socios y 832 pagos, la carga es manejable, pero escalar a miles de registros puede causar degradación.

**Fase sugerida:** SEC-6

---

#### SEC-C02 — Sin automatización de backups

Backups manuales existen (`backups/data-reset/` y `backups/demo-data-fill/`), pero no hay un proceso automatizado de backup periódico de producción.

**Fase sugerida:** SEC-5

---

#### SEC-C03 — Sin auditoría de acciones financieras

No hay registro de quién registró un pago, quién editó un crédito, quién aplicó una ampliación. El campo `created_by` existe en algunas tablas pero no está poblado consistentemente.

**Fase sugerida:** SEC-4

---

#### SEC-C04 — URL hardcodeada en `configuracion/page.tsx`

La página de configuración tiene una URL hardcodeada al proyecto Supabase. Si se migra de proyecto, se rompe.

**Fase sugerida:** SEC-1

---

## Seguridad de reportes y exportaciones

| Reporte | Acceso actual | Estado |
|---------|---------------|--------|
| Anexo 6 SBS | Todos los roles autenticados | ⚠️ Sin guard de rol (decisión de negocio pendiente) |
| BDCC/TXT | Solo admin + contabilidad | ✅ Guard activo desde Fase 10A |
| Reporte Aportes | Todos los roles | ⚠️ Sin guard (dato financiero agregado) |
| Reporte Caja | Todos los roles | ⚠️ Sin guard (dato financiero agregado) |
| Exportación Excel (Anexo 6) | Todos los roles | ⚠️ Misma restricción que visualización |
| BDCC: banner DEMO | ✅ Visible y prominente | ✅ No hay riesgo de envío accidental |

---

## Resultado de auditoría de service role

El script `npm run audit:service-role` verifica que `SUPABASE_SERVICE_ROLE_KEY` solo aparezca en:
- `lib/api/requireAdmin.ts` — único punto de acceso en código de producción
- Scripts en `scripts/` — solo se ejecutan server-side en desarrollo

**No aparece en:**
- Ningún componente React client-side (`'use client'`)
- Ningún archivo con prefijo `NEXT_PUBLIC_`
- Ningún archivo de configuración de Next.js
- Ningún bundle de frontend

**Estado:** ✅ CONFINADO CORRECTAMENTE

---

## Resultado de auditoría de variables de entorno

| Variable | Tipo | Riesgo |
|----------|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Pública (correcto) | Ninguno — URL de Supabase es pública |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Pública (correcto) | Ninguno — ANON_KEY es pública por diseño de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Privada (correcto) | Solo server-side — confinada en `lib/api/requireAdmin.ts` |

**`.gitignore`:** `*.env*` y `.env*.local` están en `.gitignore` — los secretos no se suben al repositorio.

**Sin `.env.example`:** No existe plantilla para nuevos desarrolladores. Riesgo bajo pero documenta la necesidad de configuración manual.

---

## Resultado de `npm audit`

```
4 vulnerabilities (3 moderate, 1 high)

dompurify ≤3.4.10     MODERATE   fix: npm audit fix (safe)
postcss <8.5.10       MODERATE   fix: npm audit fix --force (BREAKING — downgrade Next.js)
xlsx *                HIGH       sin fix disponible
```

**Acción inmediata segura:** `npm audit fix` (solo dompurify — sin `--force`).
**NO ejecutar `npm audit fix --force`** — causaría downgrade de Next.js a v9.3.3.
**xlsx:** Evaluar migración a `exceljs` como tarea en SEC-2.

---

## Confirmación de restricciones

- ❌ No se tocó la base de datos
- ❌ No se crearon migraciones
- ❌ No se modificó Supabase remoto
- ❌ No se modificó el Anexo 06 exporter
- ❌ No se aplicó ningún fix
- ✅ Solo lectura, auditoría y documentación

---

## Próxima fase recomendada

**Inmediata (SEC-1 quick wins):**
1. Agregar headers HTTP en `next.config.ts` — 30 minutos, sin riesgo
2. Ejecutar `npm audit fix` (solo dompurify) — sin breaking changes
3. Crear `.env.example` sin valores reales — documentación

**Media prioridad (SEC-2 API/backend):**
4. Validar UUID en `update/route.ts`
5. Mapear errores internos a mensajes genéricos

**Con autorización (SEC-3 Supabase RLS):**
6. Refinir policies en `socio_beneficiarios` y `pagos_cuotas_aplicaciones`
7. Verificar y documentar RLS de tablas legacy
