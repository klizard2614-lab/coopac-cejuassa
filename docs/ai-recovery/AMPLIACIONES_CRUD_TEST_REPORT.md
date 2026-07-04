# AMPLIACIONES_CRUD_TEST_REPORT.md

> Fase 10D-1A — Prueba CRUD controlada de la tabla `ampliaciones`.
> Ejecutado: 2026-06-23
> Script: `scripts/test-ampliaciones-crud.mjs --apply`

---

## Crédito usado (datos enmascarados)

| Campo | Valor |
|---|---|
| ID crédito | 1131 |
| nro_pagare (enmascarado) | `201***` |
| monto_aprobado usado | 10000 |
| plazo_meses usado | 45 |
| saldo_capital usado | (valor real del crédito) |

---

## Resultados CRUD

| Operación | Resultado |
|---|---|
| INSERT | ✅ OK — id=1, nro_pagare_nuevo=TEST_PAGARE_10D_1A, monto=10000 |
| UPDATE | ✅ OK — observacion actualizada, monto_nuevo=10100 |
| DELETE | ✅ OK |
| Limpieza final | ✅ OK — sin registros huérfanos |

---

## Confirmación de no-modificación de tablas críticas

| Tabla | Estado |
|---|---|
| `creditos` | ✅ NO MODIFICADA (solo SELECT para selección) |
| `cronograma_cuotas` | ✅ NO TOCADA |
| `pagos_recibos` | ✅ NO TOCADA |
| `socios` | ✅ NO TOCADA |
| `usuarios` | ✅ NO TOCADA |
| `configuracion` | ✅ NO TOCADA |
| `auth.users` | ✅ NO TOCADA |

---

## Post-apply checks

| Check | Resultado |
|---|---|
| `ampliaciones:crud:dry-run` post-apply | ✅ 4 OK / 0 FAIL |
| `check:ampliaciones-crud` | ✅ 22/22 PASSED |
| `smoke:demo-app` | ✅ 28/28 PASSED |
| `verify:cejuassa` (BUILD + TypeCheck) | ✅ OK |

---

## Estado del módulo

- [x] Módulo ampliaciones operativo
- [x] CRUD completo contra Supabase verificado
- [x] Sin efectos colaterales en otras tablas
- [x] Registro temporal eliminado — sin persistencia de datos test

---

## Notas

- El autoincremento de `id` en la tabla `ampliaciones` funcionó correctamente (id=1 asignado al primer registro).
- RLS de Supabase permite INSERT/UPDATE/DELETE con service role key — consistente con el resto del sistema.
- El módulo queda **OPERATIVO** para uso en producción.
