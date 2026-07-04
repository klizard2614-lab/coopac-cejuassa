# SECURITY_VALIDATIONS_AND_GUARDS_REVIEW.md

> **Fase SEC-6 — Auditoría de validaciones, guards de rol y exposición de reportes**
> Fecha: 2026-07-03
> Clasificación: SOLO USO INTERNO
> Modo: SOLO AUDITORÍA — no se modificaron datos, DB ni lógica financiera

---

## Resumen ejecutivo

El sistema CEJUASSA tiene una base de guards sólida para operaciones de escritura.
Los gaps identificados son todos en páginas de **solo lectura**, lo que reduce el riesgo
práctico significativamente. La prioridad alta es documentar los gaps para que puedan
ser atendidos en una fase posterior con confirmación del equipo operativo sobre las
reglas de negocio de acceso.

---

## Guards revisados por página

### ✅ Páginas con guard de rol correcto (AccesoDenegado)

| Página | Guard | Roles permitidos |
|--------|-------|-----------------|
| `configuracion/page.tsx` | ✅ useRol + AccesoDenegado | admin |
| `configuracion/convenios/page.tsx` | ✅ useRol + AccesoDenegado | admin |
| `usuarios/nuevo/page.tsx` | ✅ useRol + AccesoDenegado | admin |
| `usuarios/[id]/page.tsx` | ✅ useRol + AccesoDenegado | admin |
| `creditos/nuevo/page.tsx` | ✅ useRol + AccesoDenegado | admin, creditos |
| `creditos/[id]/editar/page.tsx` | ✅ useRol + AccesoDenegado | admin, creditos |
| `pagos/nuevo/page.tsx` | ✅ useRol + AccesoDenegado | admin, tesoreria |
| `socios/nuevo/page.tsx` | ✅ useRol + AccesoDenegado | admin, creditos |
| `socios/[id]/editar/page.tsx` | ✅ useRol + AccesoDenegado | admin, creditos |
| `egresos/page.tsx` | ✅ useRol + AccesoDenegado | admin, tesoreria (para escritura) |
| `reportes/bdcc/page.tsx` | ✅ useRol + AccesoDenegado | admin, contabilidad |

### ⚠️ Páginas sin guard de rol explícito (solo lectura — riesgo bajo)

| Página | Descripción | Riesgo | Recomendación |
|--------|-------------|--------|----------------|
| `reportes/page.tsx` | Hub de reportes | BAJO | Todos los roles pueden ver el hub — aceptable |
| `reportes/anexo6/page.tsx` | Reporte regulatorio Anexo N°6 | BAJO-MEDIO | Considerar restricción a admin+contabilidad (SUGERIDO) |
| `reportes/aportes/page.tsx` | Reporte de aportes | BAJO | Solo lectura — aceptable con RLS |
| `reportes/caja/page.tsx` | Reporte de caja | BAJO | Solo lectura — aceptable con RLS |
| `cartera/page.tsx` | Clasificación SBS cartera | BAJO | Solo lectura — aceptable con RLS |
| `mora/page.tsx` | Créditos en mora | BAJO | Solo lectura — aceptable con RLS |
| `convenios/page.tsx` | Listado de convenios | BAJO | Solo lectura — aceptable con RLS |
| `aportes/page.tsx` | Listado de aportes | BAJO | Solo lectura — aceptable con RLS (botones ocultos por rol) |
| `pagos/page.tsx` | Listado de pagos | BAJO | Solo lectura — aceptable con RLS (botones ocultos por rol) |
| `creditos/page.tsx` | Listado de créditos | BAJO | Solo lectura — aceptable con RLS (botones ocultos por rol) |
| `socios/page.tsx` | Listado de socios | BAJO | Solo lectura — aceptable con RLS (botones ocultos por rol) |
| `ampliaciones/page.tsx` | Historial ampliaciones | BAJO | Solo lectura — aceptable |

**Nota importante:** Las páginas sin guard de rol en el frontend aún tienen RLS en la DB.
Un usuario autenticado puede ver los datos en la UI, pero no puede modificarlos sin el rol
correcto. El riesgo es de **exposición de lectura**, no de escritura no autorizada.

---

## Análisis por rol

### admin
- Acceso completo a todos los módulos ✅
- Único rol con acceso a: Configuración, Usuarios, Egresos (escritura), BDCC

### tesoreria
- Sidebar oculta: Usuarios, Configuración ✅
- Puede crear pagos y egresos ✅
- Sin acceso a: Créditos nuevos/editar ✅
- Riesgo: puede navegar directamente a URLs de módulos sin guard de lectura (datos solo lectura)

### creditos
- Sidebar oculta: Egresos, Usuarios, Configuración ✅
- Puede crear/editar socios y créditos ✅
- Guard en egresos/page.tsx bloquea con AccesoDenegado ✅
- Sin acceso a BDCC ✅

### contabilidad
- Sidebar oculta: Convenios, Usuarios, Configuración ✅
- Guard BDCC correcto ✅
- Acceso a Anexo N°6 sin guard explícito (solo lectura — riesgo bajo) ⚠️

---

## Auditoría de validaciones de formularios

### ✅ Validaciones correctas (verificadas en SEC-6)

| Formulario | Validaciones presentes |
|------------|----------------------|
| `SocioForm.tsx` | DNI regex 7-8 dígitos, maxLength=8, nombres/apellidos requeridos |
| `creditos/nuevo` | nro_pagare requerido JS, tasa no negativa, validaciones JS explícitas |
| `pagos/nuevo` | montoTotal > 0, formato periodo YYYY-MM, sobrepago verificado |
| `BeneficiariosSection` | porcentaje 0-100, DNI formato, confirm inline |
| `AmpliacionesSection` | confirm inline, error de delete visible |
| `egresos` | error de delete capturado en banner dismissible |
| `usuarios/invite` | email regex, rol whitelist, nombre max 200 chars (server-side) |
| `usuarios/update` | UUID regex, activo boolean, rol whitelist (server-side) |

### ⚠️ Validaciones faltantes documentadas

| Formulario | Validación faltante | Riesgo | Prioridad |
|-----------|---------------------|--------|-----------|
| `BeneficiariosSection` | Suma de porcentajes ≤ 100% (solo frontend, sin constraint DB) | BAJO | Baja — B4 en RISKS_AND_BUGS.md |
| `creditos/nuevo` | Validación de plazo_meses > 0 y ≤ límite máximo | BAJO | Baja |
| `socios/nuevo` | Sin validación de nro_socio único en frontend (confía en DB) | BAJO | Baja — DB tiene constraint |
| `pagos/nuevo` | Fecha del pago no puede ser futura (validación de negocio) | BAJO | Media — decisión de negocio |
| `egresos` | Fecha del egreso no puede ser futura | BAJO | Baja |

---

## Exposición de datos en reportes

### ✅ Reportes con protección correcta

| Reporte | Guard | Protección |
|---------|-------|-----------|
| BDCC/TXT | ✅ admin, contabilidad solo | Guard de rol + marcado "fuera de alcance" |

### ⚠️ Reportes con acceso amplio (solo lectura, riesgo bajo)

| Reporte | Acceso | Riesgo | Mitigación actual |
|---------|--------|--------|-------------------|
| Anexo N°6 | Todos los roles | BAJO-MEDIO | Banner DEMO visible — datos no oficiales |
| Aportes | Todos los roles | BAJO | Solo lectura, RLS en DB |
| Caja | Todos los roles | BAJO | Solo lectura, RLS en DB |

**Decisión de negocio requerida:** ¿El Anexo N°6 debe restringirse a admin+contabilidad?
Sugerencia: sí, ya que es un reporte regulatorio SBS. Pendiente confirmación con el equipo.

---

## Riesgos identificados en SEC-6

| ID | Descripción | Severidad | Estado |
|----|-------------|-----------|--------|
| SEC-6-R1 | Anexo N°6 accesible a todos los roles (lectura) | BAJO-MEDIO | Documentado — decisión de negocio pendiente |
| SEC-6-R2 | Suma de porcentajes en beneficiarios sin validación DB | BAJO | Documentado como B4 |
| SEC-6-R3 | Páginas de lista accesibles por URL directa (solo lectura) | BAJO | Aceptado — RLS en DB |
| SEC-6-R4 | Reportes de aportes/caja sin guard de rol | BAJO | Aceptado — datos de lectura protegidos por RLS |

---

## Recomendaciones

### Prioridad MEDIA (para próxima sesión con usuario)

1. **Agregar guard a `reportes/anexo6/page.tsx`** — restringir a `['admin', 'contabilidad']`
   - Pequeño cambio seguro sin afectar DB ni lógica
   - Confirmar con la cooperativa quién debe ver el Anexo N°6

2. **Validación suma porcentajes beneficiarios** — agregar en `BeneficiariosSection.tsx`
   - Validación JS pura en frontend: suma de todos los porcentajes ≤ 100%
   - No requiere migración DB

### Prioridad BAJA (backlog)

3. Validación de fechas no futuras en pagos y egresos
4. Validación de plazo mínimo/máximo en créditos
5. Rate limiting en API routes (requiere Redis — SEC-2.4)

---

## Estado de la revisión

- [x] Revisión de reportes: Anexo 6, BDCC, cartera, mora, reportes hub ✅
- [x] Revisión de guards por rol ✅
- [x] Revisión de formularios críticos ✅
- [ ] Correcciones aplicadas: NINGUNA en esta fase (auditoría únicamente)
- [ ] Guard Anexo N°6 → pendiente decisión de negocio (SUGERIDO)
- [ ] Validación suma porcentajes → pendiente autorización

---

## Comandos relacionados

```bash
npm run audit:ui-roles          # 34/34 guards en operaciones de escritura
npm run check:security-guards-validations  # Este check (Fase SEC-6)
npm run smoke:demo-app          # Smoke test completo de la app
npm run smoke:report-exports    # Smoke de reportes
```
