# SECURITY_API_HARDENING_REPORT.md

> Fase SEC-2 — Endurecimiento de API/backend (2026-07-02)
> Solo lectura de esta fase: no se tocó DB, migraciones ni lógica financiera.

---

## Endpoints auditados

| Ruta | Método | Service role | Valida sesión | Valida rol | Inputs | Cambios SEC-2 |
|---|---|---|---|---|---|---|
| `/api/usuarios/invite` | POST | ✅ Sí (via requireAdmin) | ✅ getUser() | ✅ admin | email, rol, nombre | Email regex, rol whitelist, error sanitization |
| `/api/usuarios/update` | PUT | ✅ Sí (via requireAdmin) | ✅ getUser() | ✅ admin | id, rol, activo, nombre | UUID regex, activo boolean, error sanitization |

---

## Cambios aplicados

### lib/api/errors.ts (NUEVO)

Helper de respuestas seguras y logging controlado:

```typescript
apiError(status, publicMessage, internalError?)
// → Response.json({ error: publicMessage }, { status })
// → console.error([CEJUASSA API] ..., internalError.message) solo en servidor

apiSuccess(data?)
// → Response.json({ success: true, ...data })
```

**Garantiza:**
- Los mensajes de error internos de Supabase nunca llegan al cliente
- Los errores se registran en logs del servidor para debugging
- No se imprime el stack trace, keys ni payloads completos en logs

---

### app/api/usuarios/update/route.ts

**Antes (riesgos):**
- `id` no validado como UUID — cualquier string llegaba al query Supabase
- `error.message` de Supabase devuelto directo al cliente
- `activo` no tipado — podía llegar como string u objeto

**Después (cambios):**
- UUID_REGEX valida `id` antes del query (`/^[0-9a-f]{8}-...-[0-9a-f]{12}$/i`)
- `activo` validado como `boolean` — rechaza strings, objetos, números
- `nombre` sanitizado con `.trim().slice(0, 200)` — longitud máxima garantizada
- Todos los errores → `apiError()` → mensaje público genérico
- Updates construidos con whitelist explícita (rol, activo, nombre, updated_at)

---

### app/api/usuarios/invite/route.ts

**Antes (riesgos):**
- `email` sin validación de formato — cualquier string pasaba a Supabase Auth
- `rol` sin validación contra whitelist — podía enviarse un rol inválido/arbitrario
- `inviteError.message`, `updateError.message`, `insertError.message` → todos al cliente
- `nombre` sin longitud máxima ni sanitización

**Después (cambios):**
- EMAIL_REGEX valida formato antes de llamar a Supabase Auth
- ROLES_VALIDOS whitelist: `['admin', 'tesoreria', 'creditos', 'contabilidad']`
- Todos los errores → `apiError()` → mensaje genérico + log servidor
- `nombre` sanitizado con `.trim().slice(0, 200)`

---

## Errores sanitizados

### Antes (exponían internos al cliente):
```json
{ "error": "User already registered" }
{ "error": "duplicate key value violates unique constraint usuarios_pkey" }
{ "error": "invalid input syntax for type uuid: \"abc123\"" }
```

### Después (mensajes genéricos):
```json
{ "error": "No se pudo crear el usuario." }
{ "error": "No se pudo actualizar el usuario." }
{ "error": "Solicitud inválida." }
{ "error": "Error interno del servidor." }
```

Los mensajes originales de Supabase/PostgreSQL se registran en `console.error` server-side para debugging en Vercel Logs o similar.

---

## Rate limiting — Diferido (SEC-2.4)

**Evaluación:**

Un `Map` en memoria (ej. `Map<string, number[]>`) **no es confiable** en entornos serverless porque:
1. Vercel escala con múltiples instancias Lambda simultáneas — cada instancia tiene su propio proceso
2. Las instancias se reinician en cold starts — el Map se vacía
3. No hay estado compartido entre instancias sin un store externo

**Impacto práctico en CEJUASSA:**
- `/api/usuarios/invite` y `/api/usuarios/update` requieren rol admin
- Un admin malintencionado ya tiene acceso completo — rate limiting no es la defensa crítica aquí
- El endpoint de invite ya está limitado por `requireAdmin()` + sesión activa

**Solución recomendada para producción (SEC-2.4 diferido):**
- **Opción A:** Vercel Edge Middleware con Redis/Upstash (`@upstash/ratelimit`)
- **Opción B:** Supabase Edge Function como proxy con rate limiting en DB
- **Opción C:** Cloudflare WAF + Rate Limiting rules (si aplica en deploy final)

**Decisión:** No implementar en esta fase. Riesgo residual BAJO dado que el endpoint está protegido por autenticación + rol admin.

---

## Riesgos restantes después de SEC-2

| ID | Hallazgo | Severidad | Fase |
|---|---|---|---|
| SEC-A03 | RLS amplio en `socio_beneficiarios` y `pagos_cuotas_aplicaciones` | ALTO | SEC-3 |
| SEC-A04 | Roles solo en frontend — sin RLS Supabase por rol | ALTO | SEC-3 |
| SEC-B07 | Páginas de reportes sin guard de rol explícito | MEDIO | SEC-6 |
| SEC-C01 | Sin paginación server-side | BAJO | Backlog |
| SEC-C02 | Sin backup automatizado | BAJO | SEC-5 |
| SEC-C03 | Sin audit log de operaciones financieras | BAJO | SEC-4 |
| DEP-1 | xlsx HIGH vulnerability sin fix | ALTO | DEP-1 |
| SEC-2.4 | Rate limiting diferido | MEDIO | Producción |

---

## Recomendación para SEC-3

SEC-3 requiere **autorización explícita** antes de cualquier cambio en Supabase.

Pasos previos obligatorios:
1. Revisar en Supabase Dashboard → Table Editor → RLS el estado actual de cada tabla
2. Documentar resultado en `docs/ai-recovery/RLS_AUDIT_RESULT.md`
3. Diseñar policies por rol con función helper `get_current_user_role()`
4. Aplicar solo en staging primero, verificar que la app sigue funcionando
5. Aplicar en producción con backup previo

**Tablas a priorizar en SEC-3:**
- `socio_beneficiarios` — RLS con `USING (true)` amplio
- `pagos_cuotas_aplicaciones` — RLS con `USING (true)` amplio
- `usuarios` — sensible, debería restringir a admin

---

*Generado: 2026-07-02 · Fase SEC-2 · 0 cambios en DB*
