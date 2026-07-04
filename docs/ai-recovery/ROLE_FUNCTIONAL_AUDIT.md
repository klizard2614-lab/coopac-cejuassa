# ROLE_FUNCTIONAL_AUDIT.md

> Auditoría de roles y permisos del sistema CEJUASSA — Fase 9A-9B (2026-06-20)
> Basado en código real auditado en `app/dashboard/` y `app/dashboard/layout.tsx`.

---

## 1. Roles del sistema

| Rol | Descripción | Usuario típico |
|---|---|---|
| `admin` | Acceso total al sistema | Gerencia / Administrador del sistema |
| `tesoreria` | Pagos, aportes, socios (lectura) | Área de Tesorería |
| `creditos` | Socios y créditos (crear/editar), pagos (lectura) | Área de Créditos |
| `contabilidad` | Lectura general + reportes | Área de Contabilidad |

---

## 2. Matriz de permisos esperados vs. encontrados en código

### 2.1 Visibilidad en sidebar (HIDDEN_FOR_ROLE en `layout.tsx`)

| Módulo | admin | tesoreria | creditos | contabilidad | Fuente |
|---|---|---|---|---|---|
| Dashboard | ✅ | ✅ | ✅ | ✅ | `layout.tsx` L47 |
| Socios | ✅ | ✅ | ✅ | ✅ | `layout.tsx` L47 |
| Créditos | ✅ | ✅ | ✅ | ✅ | `layout.tsx` L47 |
| Pagos | ✅ | ✅ | ✅ | ✅ | `layout.tsx` L47 |
| Aportes | ✅ | ✅ | ✅ | ✅ | `layout.tsx` L47 |
| Egresos | ✅ | ✅ | ❌ Oculto | ✅ | `layout.tsx` L40 |
| Convenios | ✅ | ✅ | ✅ | ❌ Oculto | `layout.tsx` L42 |
| Cartera | ✅ | ✅ | ✅ | ✅ | `layout.tsx` L47 |
| Mora | ✅ | ✅ | ✅ | ✅ | `layout.tsx` L47 |
| Reportes | ✅ | ✅ | ✅ | ✅ | `layout.tsx` L47 |
| Usuarios | ✅ | ❌ Oculto | ❌ Oculto | ❌ Oculto | `layout.tsx` L40 |
| Configuración | ✅ | ❌ Oculto | ❌ Oculto | ❌ Oculto | `layout.tsx` L40 |

### 2.2 Permisos de acción dentro de módulos

| Módulo / Acción | admin | tesoreria | creditos | contabilidad | Mecanismo | Archivo |
|---|---|---|---|---|---|---|
| **Socios — crear** | ✅ | ❌ | ✅ | ❌ | Route guard PUEDE_CREAR_SOCIOS | `socios/nuevo/page.tsx` L8 |
| **Socios — editar** | ✅ | ❌ | ✅ | ❌ | Route guard PUEDE_EDITAR_SOCIOS | `socios/[id]/editar/page.tsx` L11 |
| **Socios — botón editar en lista** | ✅ | ❌ | ✅ | ❌ | `puedeEditar` condicional | `socios/page.tsx` L37 |
| **Créditos — crear** | ✅ | ❌ | ✅ | ❌ | Route guard PUEDE_CREAR_CREDITOS | `creditos/nuevo/page.tsx` L11 |
| **Créditos — editar** | ✅ | ❌ | ✅ | ❌ | Route guard PUEDE_EDITAR_CREDITOS | `creditos/[id]/editar/page.tsx` L10 |
| **Créditos — botón editar en lista** | ✅ | ❌ | ✅ | ❌ | `puedeEditar` condicional | `creditos/page.tsx` L46 |
| **Pagos — registrar** | ✅ | ✅ | ❌ | ❌ | Route guard PUEDE_CREAR_PAGOS | `pagos/nuevo/page.tsx` L11 |
| **Pagos — botón registrar en lista** | ✅ | ✅ | ❌ | ❌ | `puedeRegistrar` condicional | `pagos/page.tsx` L63 |
| **Aportes — botón registrar** | ✅ | ✅ | ❌ | ❌ | Condicional inline | `aportes/page.tsx` L140 |
| **Egresos — crear/editar/eliminar** | ✅ | ✅ | ❌ (no accede) | ❌ | PUEDE_EDITAR_EGRESOS + guards | `egresos/page.tsx` L8 |
| **Usuarios — acceso total** | ✅ | ❌ | ❌ | ❌ | Route guard rol !== 'admin' | `usuarios/page.tsx` L117 |
| **Usuarios — crear** | ✅ | ❌ | ❌ | ❌ | Route guard rol !== 'admin' | `usuarios/nuevo/page.tsx` L24 |
| **Usuarios — editar rol** | ✅ | ❌ | ❌ | ❌ | Route guard rol !== 'admin' | `usuarios/[id]/page.tsx` L94 |
| **Configuración — acceso** | ✅ | ❌ | ❌ | ❌ | Route guard rol !== 'admin' | `configuracion/page.tsx` L138 |
| **Configuración — convenios** | ✅ | ❌ | ❌ | ❌ | Route guard rol !== 'admin' | `configuracion/convenios/page.tsx` L117 |

---

## 3. Mecanismos de control encontrados en código

### 3.1 Tipos de control implementados

| Tipo | Descripción | Cobertura |
|---|---|---|
| **Sidebar filter** | `getVisibleItems(rol, loading)` en `layout.tsx` oculta ítems del menú | Módulos completos (egresos/convenios/usuarios/config) |
| **Route guard con AccesoDenegado** | Componente `AccesoDenegado` renderizado si rol no autorizado | creditos/nuevo, creditos/editar, pagos/nuevo, socios/nuevo, socios/editar, usuarios/*, configuracion/* |
| **Condicional UI** | `{condicion && <Boton />}` — oculta botones sin bloquear ruta | aportes, creditos lista, socios lista, pagos lista |
| **Guard defensivo en handler** | Check de rol dentro de `handleDelete`, `openEditar` etc. | egresos |
| **API route guard** | `requireAdmin()` en API routes de usuarios | /api/usuarios/invite, /api/usuarios/update |

### 3.2 Componente AccesoDenegado

Usado en:
- `creditos/nuevo/page.tsx` — si rol no está en PUEDE_CREAR_CREDITOS
- `creditos/[id]/editar/page.tsx` — si rol no está en PUEDE_EDITAR_CREDITOS
- `pagos/nuevo/page.tsx` — si rol no está en PUEDE_CREAR_PAGOS
- `socios/nuevo/page.tsx` — si rol no está en PUEDE_CREAR_SOCIOS
- `socios/[id]/editar/page.tsx` — si rol no está en PUEDE_EDITAR_SOCIOS
- `usuarios/page.tsx`, `usuarios/nuevo/page.tsx`, `usuarios/[id]/page.tsx` — si rol !== 'admin'
- `configuracion/page.tsx`, `configuracion/convenios/page.tsx` — si rol !== 'admin'

---

## 4. Rutas protegidas

| Ruta | Protección | Roles permitidos |
|---|---|---|
| `/dashboard/*` | `proxy.ts` (middleware) | Cualquier usuario autenticado |
| `/dashboard/creditos/nuevo` | Route guard | admin, creditos |
| `/dashboard/creditos/[id]/editar` | Route guard | admin, creditos |
| `/dashboard/pagos/nuevo` | Route guard | admin, tesoreria |
| `/dashboard/socios/nuevo` | Route guard | admin, creditos |
| `/dashboard/socios/[id]/editar` | Route guard | admin, creditos |
| `/dashboard/usuarios` | Route guard | admin |
| `/dashboard/usuarios/nuevo` | Route guard | admin |
| `/dashboard/usuarios/[id]` | Route guard | admin |
| `/dashboard/configuracion` | Route guard | admin |
| `/dashboard/configuracion/convenios` | Route guard | admin |
| `/api/usuarios/invite` | requireAdmin() | admin (via API) |
| `/api/usuarios/update` | requireAdmin() + lista blanca | admin (via API) |

---

## 5. Botones y acciones ocultos por rol

### Rol Tesorería
- ✅ Ve: Dashboard, Socios, Créditos, Pagos, Aportes, Egresos, Convenios, Cartera, Mora, Reportes
- ❌ No ve en sidebar: Usuarios, Configuración
- ❌ No puede crear/editar socios (botón oculto en lista + route guard)
- ❌ No puede crear/editar créditos (botón oculto en lista + route guard)
- ✅ Puede registrar pagos y aportes
- ✅ Puede crear/editar/eliminar egresos
- ✅ Puede exportar reportes y BDCC

### Rol Créditos
- ✅ Ve: Dashboard, Socios, Créditos, Pagos, Aportes, Convenios, Cartera, Mora, Reportes
- ❌ No ve en sidebar: Egresos, Usuarios, Configuración
- ✅ Puede crear/editar socios y créditos
- ❌ No puede registrar pagos (botón oculto + route guard)
- ❌ No puede crear aportes directamente (botón oculto)
- ❌ No accede a egresos
- ✅ Puede exportar reportes y BDCC

### Rol Contabilidad
- ✅ Ve: Dashboard, Socios, Créditos, Pagos, Aportes, Egresos, Cartera, Mora, Reportes
- ❌ No ve en sidebar: Convenios, Usuarios, Configuración
- ❌ No puede crear/editar socios (botón oculto)
- ❌ No puede crear/editar créditos (botón oculto)
- ❌ No puede registrar pagos (botón oculto)
- ✅ Ve egresos en modo lectura (sin botones de acción)
- ✅ Puede exportar reportes y BDCC

---

## 6. Acciones de alto riesgo

| Acción | Quién puede | Protección actual | Nivel de riesgo |
|---|---|---|---|
| Invitar nuevo usuario | Solo admin | API route + requireAdmin() | 🟡 Medio — correo va a la persona |
| Cambiar rol de usuario | Solo admin | API route + requireAdmin() + lista blanca | 🔴 Alto — puede escalar privilegios |
| Eliminar egreso | admin, tesoreria | Guard defensivo en handler | 🟡 Medio — no hay soft-delete |
| Modificar configuración (tasas) | Solo admin | Route guard | 🔴 Alto — afecta todos los reportes |
| Crear crédito (RPC C atómica) | admin, creditos | Route guard + RPC con rollback | 🟡 Medio — atómica pero irreversible desde UI |
| Descargar BDCC TXT | Todos los roles | Sin restricción | 🟡 Medio — contiene datos personales |

---

## 7. Diferencias y riesgos identificados

### 7.1 Acceso a BDCC sin restricción de rol
**Situación:** Cualquier rol puede descargar los archivos TXT de BDCC (BD01, BD02-A), incluyendo el rol `creditos` que no debería necesitar acceso a reportes regulatorios.

**Riesgo:** Los archivos TXT contienen DNI, nombres, montos y datos personales de los socios.

**Recomendación:** Evaluar si se desea restringir la descarga de BDCC a roles admin/contabilidad. Actualmente no hay control de rol en la pantalla BDCC.

### 7.2 Sidebar oculta módulo pero ruta sigue accesible
**Situación:** Si un usuario con rol `creditos` escribe manualmente `/dashboard/egresos` en el navegador, puede ver la lista de egresos (módulo oculto en sidebar pero sin route guard en la lista).

**Riesgo:** Solo lectura — no puede crear/editar. Sin embargo, accede a información financiera de egresos.

**Recomendación:** Agregar route guard en `egresos/page.tsx` para redirigir a roles no autorizados si se desea control estricto.

### 7.3 Rol contabilidad puede acceder a convenios directamente (sin sidebar)
**Situación:** `contabilidad` no ve Convenios en sidebar pero si navega directamente a `/dashboard/convenios` puede ver la información.

**Riesgo:** Bajo — solo lectura. Convenios no contiene información sensible.

### 7.4 Sin expiración de sesión configurable
**Situación:** La sesión de Supabase usa los valores por defecto del proyecto. No hay configuración de expiración automática en el código.

**Riesgo:** Bajo para la operación actual. Considerar configurar en Supabase Dashboard si se requiere compliance.

---

## 8. Recomendaciones antes de producción

### Alta prioridad
1. **Decidir si BDCC necesita restricción de rol** — actualmente cualquier usuario autenticado puede descargar los archivos con datos personales.
2. **Documentar internamente los roles** con la Matriz de Roles del Manual de Usuario (sección 14) para que el equipo entienda qué puede hacer cada uno.

### Media prioridad
3. **Agregar route guard en `egresos/page.tsx`** para bloquear acceso directo a creditos si se quiere control estricto (actualmente solo el sidebar lo oculta).
4. **Agregar route guard en `convenios/page.tsx`** para contabilidad si se desea control estricto.

### Baja prioridad
5. **Revisar la lista blanca de roles en `/api/usuarios/update`** periódicamente para asegurar que no se puedan asignar roles no existentes.
6. **Configurar expiración de sesión** en el proyecto Supabase si hay requerimientos de compliance.

---

## 9. Estado de seguridad general

| Área | Estado | Notas |
|---|---|---|
| Autenticación | ✅ OK | Supabase Auth con SSR |
| Protección de rutas (/dashboard) | ✅ OK | `proxy.ts` activo |
| Protección por rol (formularios críticos) | ✅ OK | Route guards implementados |
| Service role confinado | ✅ OK | Solo en API routes con requireAdmin() |
| BDCC acceso sin restricción de rol | ⚠️ Revisable | Ver sección 7.1 |
| Acceso directo a módulos ocultos | ⚠️ Revisable | Ver secciones 7.2 y 7.3 |
| Expiración de sesión | ⚠️ No configurado | Bajo riesgo actual |

---

*Generado: 2026-06-20 — Fase 9A-9B*
