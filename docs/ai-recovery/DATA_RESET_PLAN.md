# DATA_RESET_PLAN.md
# Fase 9C-0 — Plan Seguro de Limpieza y Recarga de Datos
# Fecha: 2026-06-20

> ⚠️ **ESTE DOCUMENTO ES UN PLAN — NO UNA AUTORIZACIÓN.**
> Ningún borrado real debe ejecutarse hasta que el usuario lo apruebe explícitamente.
> El script SQL está en `supabase/manual/data-reset-template.sql` y está marcado como PLANTILLA.

---

## Objetivo

Limpiar los registros operativos de prueba de la base de datos CEJUASSA para recargar con datos reales del primer período operativo, sin perder acceso, configuración crítica ni estructura de la base de datos.

---

## Tablas a CONSERVAR (NO BORRAR NUNCA)

| Tabla | Razón |
|---|---|
| `usuarios` | Contiene los usuarios con acceso a la app. Borrarla = perder login. |
| `configuracion` | Configuración de la cooperativa (código COOPAC, tasas, nombre). |
| `auth.users` (Supabase Auth) | Autenticación. Borrar = perder acceso al sistema. |
| `supabase_migrations` | Historial de migraciones. No tocar nunca. |

---

## Tablas Candidatas a Limpiar (en orden seguro)

Estas tablas contienen datos operativos de prueba. El orden de borrado respeta las FK.

| Orden | Tabla | FK depende de | Razón para limpiar |
|---|---|---|---|
| 1 | `cronograma_cuotas` | `creditos.id` | Cuotas de prueba generadas |
| 2 | `ampliaciones` | `creditos.id` (probable) | Ampliaciones de prueba (tabla existe, verificar si tiene datos) |
| 3 | `auditoria` | `usuarios.id` | Log de acciones de prueba (REVISAR — puede tener valor histórico) |
| 4 | `aportes` | `socios.id`, `pagos_recibos.id` | Aportes de prueba |
| 5 | `pagos_recibos` | `socios.id`, `creditos.id` | Pagos de prueba |
| 6 | `creditos` | `socios.id` | Créditos de prueba |
| 7 | `egresos` | `socios.id` (nullable) | Gastos de prueba |
| 8 | `socios` | (raíz) | Socios de prueba |
| 9 | `convenios` | `socios.id_convenio` (nullable) | Convenios de prueba (limpiar si se recargan) |
| 10 | `cartera_mes` | Datos calculados | Si existe y tiene datos de prueba |
| 11 | `cartera_resumen_mes` | Datos calculados | Si existe y tiene datos de prueba |
| 12 | `validacion_cuadre_mes` | Datos calculados | Si existe y tiene datos de prueba |

---

## Tablas a REVISAR Antes de Borrar

| Tabla | Por qué revisar |
|---|---|
| `auditoria` | Puede tener valor de trazabilidad; confirmar con el cliente si se necesita preservar |
| `cartera_mes` | Puede contener cierres calculados; confirmar si son de prueba o reales |
| `cartera_resumen_mes` | Idem |
| `validacion_cuadre_mes` | Idem |
| `ampliaciones` | Verificar si tiene datos y cuáles son sus FK exactas |

---

## Dependencias entre Tablas (árbol de FK)

```
convenios
  └── socios (socios.id_convenio → convenios.id)
        ├── creditos (creditos.id_socio → socios.id)
        │     ├── cronograma_cuotas (id_credito → creditos.id)
        │     ├── ampliaciones (id_credito → creditos.id — verificar)
        │     └── pagos_recibos (id_credito → creditos.id)
        ├── pagos_recibos (id_socio → socios.id)
        │     └── aportes (id_recibo → pagos_recibos.id)
        ├── aportes (id_socio → socios.id)
        └── egresos (id_socio → socios.id — nullable)

usuarios (independiente — NO BORRAR)
configuracion (independiente — NO BORRAR)
auditoria (id_usuario → usuarios.id)
```

---

## Orden Seguro de Borrado

```
1. DELETE FROM cronograma_cuotas;
2. DELETE FROM ampliaciones;          -- si existe y tiene datos
3. DELETE FROM aportes;
4. DELETE FROM pagos_recibos;
5. DELETE FROM creditos;
6. DELETE FROM egresos;
7. DELETE FROM socios;
8. DELETE FROM convenios;             -- solo si se van a recargar
9. DELETE FROM cartera_mes;           -- solo si son datos de prueba
10. DELETE FROM cartera_resumen_mes;  -- solo si son datos de prueba
11. DELETE FROM validacion_cuadre_mes; -- solo si son datos de prueba
12. DELETE FROM auditoria;            -- solo con autorización explícita
```

---

## Plan de Backup (ANTES de cualquier borrado)

### ✅ Fase 9C-1 COMPLETADA (2026-06-20)

Backup local verificable creado con script automático:

```bash
npm run backup:operational-data   # exporta todas las tablas operativas a JSON
npm run check:operational-backup  # verifica 27/27 checks PASS
```

**Backup generado:** `backups/data-reset/20260620-1327/`

| Tabla | Registros respaldados |
|---|---|
| `socios` | 434 |
| `creditos` | 431 |
| `pagos_recibos` | 401 |
| `aportes` | 1 |
| `cronograma_cuotas` | 0 |
| `egresos` | 0 |
| `convenios` | 0 |
| `ampliaciones` | 0 |
| **Total** | **1267** |

Ver `BACKUP_MANIFEST.md` en la raíz del proyecto para el manifiesto completo.

**Verificación adicional (Supabase Dashboard):**
1. Ir a Supabase Dashboard → Project → Database → Backups.
2. Verificar que existe un backup automático reciente.
3. Si no: ir a **Backups → Create backup** para forzar uno manual.

---

## Plan de Recarga

Ver `docs/ai-recovery/DATA_RELOAD_CHECKLIST.md` para el orden completo.

Resumen de pasos:
1. Verificar `configuracion` (código COOPAC, tasas SBS, nombre).
2. Cargar `convenios` (si aplica).
3. Cargar `socios` con todos los campos (incluyendo género, estado civil, beneficiario).
4. Cargar `creditos` con todos los campos SBS/BDCC.
5. El cronograma se genera automáticamente al crear cada crédito desde la app.
6. Cargar `pagos_recibos` y `aportes` históricos si aplica.
7. Cargar `egresos` históricos si aplica.

---

## Validaciones Después de Recargar

Ejecutar después de cargar datos reales:
- `npm run verify:cejuassa` — lint/tsc/build
- `npm run check:monday-readiness` — estado general del MVP
- `npm run smoke:bdcc` — verificar generadores BDCC
- Revisar Anexo 6 para el período actual
- Verificar cartera y clasificación de deudores

---

## Riesgos

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| Borrar en orden incorrecto (viola FK) | Media | Alto | Usar la plantilla SQL que respeta el orden |
| Perder configuración de tasas | Baja | Muy alto | `configuracion` está en lista de NO BORRAR |
| Perder usuarios de acceso | Baja | Crítico | `usuarios` y `auth.users` en lista de NO BORRAR |
| Datos reales mezclados con pruebas | Media | Medio | Ejecutar `plan:data-reset` primero para ver conteos |
| Backup no disponible antes del reset | Media | Muy alto | Verificar backup en Supabase Dashboard antes de ejecutar |
| Ampliaciones con FK desconocida | Media | Medio | Verificar tabla en Supabase Dashboard antes de borrar |

---

## Comandos que NO deben ejecutarse sin autorización explícita

```sql
-- PELIGROSO — requiere autorización
TRUNCATE TABLE socios CASCADE;
DELETE FROM socios;
DELETE FROM creditos;
-- Ver supabase/manual/data-reset-template.sql para la plantilla completa
```

```bash
# NO ejecutar automáticamente
# El template SQL es SOLO REFERENCIA — no hay comando npm que lo ejecute
```

---

---

## ✅ Fase 9C-2 COMPLETADA (2026-06-20)

Limpieza real ejecutada vía Supabase MCP con autorización explícita del usuario.

| Tabla | Antes | Después |
|---|---|---|
| `socios` | 434 | **0** |
| `creditos` | 431 | **0** |
| `pagos_recibos` | 401 | **0** |
| `aportes` | 1 | **0** |
| `cronograma_cuotas` | 0 | **0** |
| `egresos` | 0 | **0** |
| `convenios` | 0 | **0** |
| `ampliaciones` | 0 | **0** |
| `usuarios` *(conservada)* | 2 | **2** |
| `configuracion` *(conservada)* | 1 | **1** |

**Backup pre-reset:** `backups/data-reset/20260620-1327/` (1267 registros)
**Validaciones post-limpieza:** `plan:data-reset` 0/0 · `check:data-reset-plan` 18/18 PASS · `verify:cejuassa` tsc OK + build 28/28 OK

*Plan creado 2026-06-20. Fase 9C-1 completada 2026-06-20. Fase 9C-2 completada 2026-06-20. Base lista para recarga de datos reales. Ver `DATA_RELOAD_CHECKLIST.md`.*
