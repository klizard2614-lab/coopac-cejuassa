# SECURITY_HARDENING_PLAN.md

> Plan ordenado de correcciones de seguridad para CEJUASSA.
> Cada fase es independiente y puede ejecutarse en orden.
> Fase SEC-0 completada: auditoría integral (2026-07-02).
> Fase SEC-1 completada: quick wins (headers HTTP, .env.example, URL fix, npm audit fix) (2026-07-02).

---

## Resumen de fases

| Fase | Nombre | Bloqueante para demo | Requiere autorización DB |
|------|--------|----------------------|--------------------------|
| SEC-1 | Quick wins — configuración y dependencias | No | No |
| SEC-2 | API/backend — validaciones y errores | No | No |
| SEC-3 | Supabase RLS — políticas por rol | Sí (operación real) | ✅ Sí |
| SEC-4 | Auditoría/logs — trazabilidad de acciones | No | ✅ Sí |
| SEC-5 | Backups/operación — procedimientos seguros | No | No |
| SEC-6 | Validaciones UX — guards de rol adicionales | No | No |

---

## SEC-1 — Quick wins (sin riesgo, sin DB) ✅ COMPLETADA 2026-07-02

### SEC-1.1 — Agregar headers HTTP de seguridad ✅

**Archivo:** `next.config.ts`

Agregar función `headers()` con:
```ts
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // unsafe-eval requerido por Next.js dev
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL}`,
            "font-src 'self'",
            "frame-ancestors 'none'",
          ].join('; ')
        },
      ],
    },
  ]
}
```

**Prioridad:** Alta — 30 min de trabajo, cero riesgo.

**Implementado (2026-07-02):**
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
- Strict-Transport-Security: max-age=63072000; includeSubDomains
- Content-Security-Policy-Report-Only (activa pero en modo report-only — ver SEC-1B)

**Nota SEC-1B (pendiente):** Migrar CSP de Report-Only a activa usando nonces en Next.js App Router para eliminar `unsafe-inline`. Requiere refactor en Server Components.

---

### SEC-1.2 — Ejecutar `npm audit fix` (seguro) ✅

```bash
npm audit fix   # Sin --force — solo actualiza dompurify
```

**NO ejecutar:** `npm audit fix --force` — downgrade Next.js a v9.3.3.

**Resultado (2026-07-02):** `dompurify` actualizado (1 paquete). postcss y xlsx permanecen sin fix.

---

### SEC-1.3 — Crear `.env.example` ✅

Crear `C:\Users\Kevin\coopac-cejuassa\.env.example` con:
```
# Supabase (reemplazar con valores reales)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  # ANON KEY pública

# Solo server-side (NUNCA exponer en frontend ni NEXT_PUBLIC_*)
SUPABASE_SERVICE_ROLE_KEY=eyJ...      # SERVICE ROLE — mantener privada
```

---

### SEC-1.4 — Corregir URL hardcodeada en configuracion/page.tsx ✅

Implementado (2026-07-02): URL derivada de `process.env.NEXT_PUBLIC_SUPABASE_URL` — extrae el project ID dinámicamente, elimina hardcode del ID `ljdjbhsipgkxlgnprzhm`.

---

### SEC-1 — Resultado final (2026-07-02)

| Check | Estado |
|-------|--------|
| `npm run check:security-sec1` | 21/21 PASS ✅ |
| `npm run check:security-audit` | 27/27 PASS ✅ |
| `npm run audit:ui-roles` | 34/34 PASS ✅ |
| `npm run smoke:demo-app` | 28/28 PASS ✅ |
| `npm run smoke:report-exports` | 37/37 PASS ✅ |
| `npm run verify:cejuassa` | tsc OK + build OK ✅ |

**xlsx — Documentación de riesgo pendiente (DEP-1):**
- Versión: `xlsx@0.18.5`
- Severidad: HIGH (Prototype Pollution + ReDoS)
- Sin fix disponible en npm audit (SheetJS no publica fixes en npm)
- Riesgo práctico en CEJUASSA: BAJO — la app solo exporta archivos (no lee archivos de usuarios externos). Prototype Pollution requiere datos de entrada no confiables.
- Acción futura en DEP-1: evaluar migración a `exceljs` o `@exceljs/exceljs` antes de operación con usuarios externos.
- Pendiente de autorización: No bloquea demo supervisada.

---

## SEC-2 — API/backend (sin DB) ✅ COMPLETADA 2026-07-02

### SEC-2.1 — Validar formato UUID en `update/route.ts` ✅

**Implementado:** `UUID_REGEX.test(String(id))` antes del query. Rechaza strings no-UUID con 400.
También se agregó: validación de `activo` como boolean, `nombre` con `.trim().slice(0, 200)`.

---

### SEC-2.2 — Mapear errores internos a mensajes genéricos ✅

**Implementado:** `lib/api/errors.ts` — helper `apiError(status, publicMessage, internalError?)`:
- Registra el error interno en `console.error` server-side
- Devuelve solo el mensaje público genérico al cliente
- Mensajes: "No se pudo crear el usuario." / "No se pudo actualizar el usuario." / "Solicitud inválida." / "Error interno del servidor."

---

### SEC-2.3 — Validar email en `invite/route.ts` ✅ (plus de SEC-0)

**Implementado:** `EMAIL_REGEX.test(String(email))` — formato básico.
`ROLES_VALIDOS` whitelist también agregada en invite (solo existía en update).

---

### SEC-2.4 — Rate limiting — Diferido (producción)

**Evaluación (2026-07-02):** Rate limiting en memoria no confiable en serverless (Vercel Lambda: múltiples instancias, Map se vacía en cold start). Endpoint ya protegido por `requireAdmin()` + sesión. Riesgo residual BAJO para MVP.

**Solución recomendada en producción:** `@upstash/ratelimit` con Redis, o Vercel Edge Middleware.

---

### SEC-2 — Resultado final (2026-07-02)

| Check | Estado |
|-------|--------|
| `npm run check:security-api` | 30/30 PASS ✅ |
| `npm run check:security-sec1` | 21/21 PASS ✅ |
| `npm run check:security-audit` | 27/27 PASS ✅ |
| `npm run audit:ui-roles` | 34/34 PASS ✅ |
| `npm run smoke:demo-app` | 28/28 PASS ✅ |
| `npm run verify:cejuassa` | tsc OK + build OK ✅ |

**Reporte detallado:** `docs/ai-recovery/SECURITY_API_HARDENING_REPORT.md`

---

## SEC-3 — Supabase RLS (requiere autorización DB)

**⚠️ Esta fase requiere autorización explícita antes de cualquier cambio en Supabase.**

### SEC-3.1 — Auditar RLS de tablas existentes

Verificar en Supabase Dashboard → Table Editor → RLS:
- `socios` — ¿tiene RLS? ¿policy?
- `creditos` — ¿tiene RLS? ¿policy?
- `pagos_recibos` — ¿tiene RLS? ¿policy?
- `cronograma_cuotas` — ¿tiene RLS? ¿policy?
- `aportes` — ¿tiene RLS? ¿policy?
- `egresos` — ¿tiene RLS? ¿policy?
- `convenios` — ¿tiene RLS? ¿policy?
- `usuarios` — ¿tiene RLS? ¿policy?
- `configuracion` — ¿tiene RLS? ¿policy?
- `ampliaciones` — ya auditada: SELECT all auth, INSERT/UPDATE admin+creditos, DELETE admin ✅

**Documentar resultado en** `docs/ai-recovery/RLS_AUDIT_RESULT.md`.

---

### SEC-3.2 — Crear función helper para verificar rol

```sql
-- Requiere autorización: APLICAR RLS HELPER SEC-3.2
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text AS $$
  SELECT rol FROM public.usuarios WHERE id = auth.uid()::text::uuid
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

---

### SEC-3.3 — Refinar policies en tablas nuevas

Para `socio_beneficiarios` y `pagos_cuotas_aplicaciones`:
```sql
-- Requiere autorización: APLICAR RLS REFINADO SEC-3.3
-- Reemplazar policy broad por política granular:
DROP POLICY IF EXISTS autenticados_pueden_operar ON public.socio_beneficiarios;

CREATE POLICY leer_beneficiarios ON public.socio_beneficiarios
  FOR SELECT TO authenticated USING (true);

CREATE POLICY escribir_beneficiarios ON public.socio_beneficiarios
  FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() IN ('admin', 'creditos', 'tesoreria'));

CREATE POLICY actualizar_beneficiarios ON public.socio_beneficiarios
  FOR UPDATE TO authenticated
  USING (get_current_user_role() IN ('admin', 'creditos', 'tesoreria'));

CREATE POLICY eliminar_beneficiarios ON public.socio_beneficiarios
  FOR DELETE TO authenticated
  USING (get_current_user_role() IN ('admin', 'creditos'));
```

---

### SEC-3.4 — Agregar RLS a tablas críticas (si faltan)

Para `creditos`, `pagos_recibos`, `aportes`:
- Solo roles con permiso pueden INSERT/UPDATE
- Todos los roles autenticados pueden SELECT

**⚠️ No implementar sin auditoría completa de tablas (SEC-3.1 primero)**

---

## SEC-4 — Auditoría/logs (requiere autorización para tabla)

### SEC-4.1 — Diseño de tabla de audit log

```sql
-- Requiere autorización: APLICAR AUDIT LOG SEC-4.1
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          bigserial PRIMARY KEY,
  tabla       text NOT NULL,
  operacion   text NOT NULL,  -- INSERT, UPDATE, DELETE
  registro_id text,
  usuario_id  uuid REFERENCES public.usuarios(id),
  datos_antes jsonb,
  datos_nuevo jsonb,
  created_at  timestamptz DEFAULT now()
);
```

### SEC-4.2 — Triggers para operaciones financieras críticas

Tablas a auditar: `pagos_recibos`, `creditos`, `aportes`, `ampliaciones`.

### SEC-4.3 — Agregar `created_by` y `updated_by` a tablas sin ellos

Verificar qué tablas no tienen `created_by`.

---

## SEC-5 — Backups/operación

### SEC-5.1 — Documentar procedimiento de backup antes de migraciones

Crear `docs/ai-recovery/BACKUP_PROCEDURE.md` con pasos:
1. Antes de cualquier migración: `npm run backup:operational-data`
2. Verificar backup con `npm run check:operational-backup`
3. Guardar hash del backup para verificar integridad

### SEC-5.2 — Script de backup automatizado (opcional)

Crear script que use `pg_dump` via Supabase CLI para backup completo:
```bash
npx supabase db dump -f backups/auto/$(date +%Y%m%d_%H%M).sql
```

### SEC-5.3 — Procedimiento de rollback documentado

Crear `docs/ai-recovery/ROLLBACK_PROCEDURE.md` con:
- Cómo revertir una migración fallida
- Cómo restaurar desde backup JSON
- Contactos de soporte Supabase

---

## SEC-6 — Validaciones UX

### SEC-6.1 — Guards en reportes financieros (decisión de negocio)

Definir con la cooperativa si el Anexo 6, Reporte Caja y Reporte Aportes deben ser accesibles solo para ciertos roles. Si la respuesta es sí, agregar guards en:
- `app/dashboard/reportes/page.tsx`
- `app/dashboard/reportes/anexo6/page.tsx`
- `app/dashboard/reportes/caja/page.tsx`
- `app/dashboard/reportes/aportes/page.tsx`

### SEC-6.2 — Validación con librería formal (Zod)

Reemplazar validaciones manuales JS por Zod en formularios críticos:
- `creditos/nuevo/page.tsx`
- `pagos/nuevo/page.tsx`
- `socios/_components/SocioForm.tsx`

Esto proporciona tipado seguro y mensajes de error consistentes.

### SEC-6.3 — Consistencia en patrón de guard de usuarios/page.tsx

`usuarios/page.tsx` usa `rolActual` (state local) en lugar del hook `useRol`. Unificar al patrón estándar con `useRol` + `AccesoDenegado`.

---

## Checklist de progreso — Actualizado 2026-07-03 (sesión SECURITY-MASTER)

### SEC-1 Quick wins ✅ COMPLETADA
- [x] SEC-1.1 Headers HTTP en next.config.ts
- [x] SEC-1.2 npm audit fix (dompurify)
- [x] SEC-1.3 Crear .env.example
- [x] SEC-1.4 URL hardcodeada en configuracion/page.tsx

### SEC-2 API/backend ✅ COMPLETADA
- [x] SEC-2.1 Validar UUID en update/route.ts
- [x] SEC-2.2 Mensajes error genéricos en API routes
- [x] SEC-2.3 Evaluar migración de xlsx a exceljs → ver DEP-1 (documentado, sin reemplazar aún)
- [ ] SEC-2.4 Rate limiting (diferido — requiere Redis en serverless)

### SEC-3 Supabase RLS
- [x] SEC-3A Auditoría real RLS remoto (27 tablas verificadas) ✅ COMPLETADA
- [x] SEC-3C Refinar policies en socio_beneficiarios + pagos_cuotas_aplicaciones ✅ COMPLETADA (APLICADA)
- [x] SEC-3E Baseline local tabla auditoria ✅ PREPARADA (pendiente autorización APLICAR BASELINE AUDITORIA SEC-3E)
- [ ] SEC-3D Migrar `TO public` → `TO authenticated` (cosmético, baja prioridad)

### SEC-4 Auditoría/logs
- [x] SEC-4A Diseño de audit log (11 columnas, 15 operaciones) ✅ COMPLETADA
- [x] SEC-4B Migración local + RPC registrar_auditoria + helpers ✅ PREPARADA (pendiente autorización APLICAR AUDIT LOG SEC-4B)
- [ ] SEC-4C Integrar registrarAudit() en módulos (usuarios, creditos, pagos, egresos) — requiere SEC-4B aplicado primero
- [ ] SEC-4D Pantalla de visualización para admin

### SEC-5 Backups/operación ✅ DOCUMENTADA
- [x] SEC-5.1 Runbook completo creado (docs/ai-recovery/SECURITY_BACKUP_AND_RECOVERY_RUNBOOK.md)
- [x] SEC-5.2 Backups existentes auditados (2 snapshots con manifest)
- [x] SEC-5.3 Rollback documentado en runbook + en migraciones locales

### SEC-6 Validaciones UX ✅ DOCUMENTADA
- [x] SEC-6.1 Guards auditados — decisión pendiente para Anexo N°6 y reportes
- [ ] SEC-6.2 Zod en formularios críticos (backlog — validaciones manuales son suficientes por ahora)
- [ ] SEC-6.3 Agregar guard a reportes/anexo6/page.tsx (pendiente decisión cooperativa)

### DEP-1 Dependencias vulnerables ✅ DOCUMENTADA
- [x] xlsx HIGH — plan documentado, sin reemplazar en esta fase (riesgo práctico BAJO)
- [ ] postcss MODERATE — sin fix sin downgrade de Next.js; monitorear actualizaciones

---

## Estado final sesión SECURITY-MASTER (2026-07-03)

| Fase | Estado | Check |
|------|--------|-------|
| SEC-0 | ✅ Completada | check:security-audit 27/27 |
| SEC-1 | ✅ Completada | check:security-sec1 21/21 |
| SEC-2 | ✅ Completada | check:security-api 30/30 |
| SEC-3A | ✅ Completada | (rls_audit_result.md) |
| SEC-3C | ✅ Aplicada | check:rls-sec3c 41/41 |
| SEC-3E | ⏳ Preparada | check:auditoria-baseline-sec3e 40/40 |
| SEC-4A | ✅ Completada | check:audit-log-design 50/50 |
| SEC-4B | ⏳ Preparada | check:audit-log-implementation-plan 40/40 |
| SEC-5 | ✅ Documentada | check:security-backup-runbook 29/29 |
| SEC-6 | ✅ Documentada | check:security-guards-validations 37/37 |
| DEP-1 | ✅ Documentada | check:xlsx-risk-plan 22/22 |
| SEC-FINAL | ✅ Completada | check:security-master 49/49 |
