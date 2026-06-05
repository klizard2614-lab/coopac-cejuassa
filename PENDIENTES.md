# PENDIENTES — POST-MVP — COOPAC CEJUASSA

## 0. Logo real
- [x] Logo real PNG aplicado en `/public/logo-cejuassa.png` (2026-06-05)
- [x] `app/dashboard/layout.tsx` actualizado → `src="/logo-cejuassa.png"`
- [x] `app/login/page.tsx` actualizado → `src="/logo-cejuassa.png"`
- [x] Placeholder SVG eliminado

MVP completado. Los siguientes son mejoras y módulos adicionales para fases posteriores.

---

## 1. Auditoría
**Ruta:** `/dashboard/auditoria`
Tabla `auditoria` ya existe en Supabase (id, id_usuario, modulo, accion, descripcion, registro_id, ip, fecha_hora).
- [ ] Vista de log de acciones por módulo
- [ ] Filtros por usuario, módulo, fecha
- [ ] Registrar automáticamente acciones importantes (crear/editar/eliminar)

---

## 3. RLS / Seguridad por rol
- [x] Middleware de autenticación (`proxy.ts`) — redirige a /login si no hay sesión
- [x] `useRol` hook + `AccesoDenegado` componente reutilizable
- [x] Rutas admin-only: `/usuarios/*`, `/configuracion/*`
- [x] Rutas admin+creditos: `/socios/nuevo`, `/socios/[id]/editar`
- [x] APIs protegidas server-side: `/api/usuarios/invite`, `/api/usuarios/update`
- [x] **EJECUTADO Y VERIFICADO** — SQL correctivo RLS aplicado (2026-06-05):
  - ✅ Eliminada política `auth_only` FOR ALL de las 14 tablas
  - ✅ Recreadas INSERT con WITH CHECK y restricción por rol en cada tabla
  - ✅ Corregido `socios_update`: solo admin + creditos (sin tesoreria)
  - ✅ Corregida función `get_user_rol()`: ahora usa `WHERE id = auth.uid()`
  - ✅ Corrección propagada a `app/api/usuarios/invite/route.ts` (ahora llena `auth_id`)
- [ ] Proteger más rutas según necesidad: `/creditos/nuevo`, `/pagos/nuevo` por rol

---

## 4. Integración completa Usuarios ↔ Auth
- [x] Invitar usuario vía `supabase.auth.admin.inviteUserByEmail` + insertar en `public.usuarios`
- [x] API PUT `/api/usuarios/update` para cambiar rol/estado
- [x] Protección por rol en `/dashboard/usuarios` (solo admin)
- [ ] **Completar**: agregar `SUPABASE_SERVICE_ROLE_KEY` en `.env.local` y en Vercel env vars
- [ ] Trigger en Supabase: al crear auth.user → insertar en public.usuarios (para flujo sin invitación)
- [ ] Leer rol del usuario logueado para personalizar el sidebar (mostrar/ocultar ítems por rol)

---

## 2. Alertas de mora por email / notificaciones push
- [ ] Enviar email automático cuando un crédito entra en mora
- [ ] Notificaciones push para el cajero/tesorero
*(Las alertas visuales ya están implementadas en `/dashboard/mora`)*

---

## 5. Mejoras Dashboard
- [x] Gráfico de evolución mensual — BarChart Ingresos vs Egresos (últimos 6 meses)
- [x] Gráfico de evolución de Aportes — AreaChart (últimos 6 meses)
- [x] Gráfico de distribución por estado — PieChart donut
- [ ] Comparativo mes actual vs mes anterior en recaudación (pendiente)

---

## 7. Módulo Ampliaciones
Tabla `ampliaciones` ya existe en Supabase.
- [ ] Lista de ampliaciones por crédito
- [ ] Formulario de nueva ampliación
- [ ] Actualizar cronograma al ampliar

---

## 8. Exportación PDF
- [x] Recibo de pago en PDF — desde `/dashboard/pagos`, botón por fila
- [x] Ficha de socio en PDF — desde `/dashboard/socios`, botón por fila
- [ ] Reporte de cartera en PDF
