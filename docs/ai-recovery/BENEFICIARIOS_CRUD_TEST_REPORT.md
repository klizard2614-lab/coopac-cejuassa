# BENEFICIARIOS_CRUD_TEST_REPORT.md

> Fase 10C.2 — Prueba CRUD controlada de beneficiarios múltiples.
> Ejecutado: 2026-06-23. Estado: COMPLETADO ✅

## Metadatos

| Campo | Valor |
|---|---|
| Fase | 10C.2 |
| Script | `scripts/test-beneficiarios-crud.mjs` |
| Tabla tocada | `socio_beneficiarios` (única) |
| Otras tablas | NINGUNA modificada |
| Migraciones creadas | NINGUNA |
| Fecha ejecución | 2026-06-23 |

## Socio usado en la prueba

| Campo | Valor |
|---|---|
| ID | 3329 |
| nro_socio (enmascarado) | 000*** |
| apellidos (enmascarado) | CAL*** |
| nombres (enmascarado) | HER*** |
| Estado | activo |
| Beneficiario ID asignado | 1 (auto-increment) |

_Datos enmascarados: solo primeros 3 caracteres visibles._

## Resultados CRUD

| Operación | Estado | Detalle |
|---|---|---|
| INSERT | ✅ OK | id=1, nombres=TEST BENEFICIARIO BORRAR, porcentaje=100, es_principal=false |
| Verificación INSERT | ✅ OK | SELECT post-insert confirmó parentesco=PRUEBA, es_principal=false |
| UPDATE | ✅ OK | parentesco=PRUEBA_EDITADA, es_principal=true, porcentaje=50 |
| Verificación UPDATE | ✅ OK | SELECT post-update confirmó datos exactos |
| DELETE | ✅ OK | Registro eliminado correctamente |
| Limpieza final | ✅ OK | Sin registros con observacion `TEST CRUD 10C.2 - BORRAR` |

## Checks de seguridad

| Check | Estado |
|---|---|
| Solo toca `socio_beneficiarios` | ✅ |
| No modifica `socios` | ✅ (solo SELECT de lectura) |
| No toca `creditos` | ✅ |
| No toca `pagos_recibos` | ✅ |
| No toca `cronograma_cuotas` | ✅ |
| No toca `usuarios` | ✅ |
| No toca `configuracion` | ✅ |
| No toca `auth.users` | ✅ |
| No crea migraciones | ✅ |
| No toca `_client_files` | ✅ |
| Elimina registro temporal | ✅ |

## Verificaciones post-apply

| Comando | Resultado |
|---|---|
| `beneficiarios:crud:dry-run` | ✅ 4/4 OK, sin huérfanos |
| `check:beneficiarios-crud` | ✅ 22/22 checks OK |
| `smoke:demo-app` | ✅ 28 pasaron / 0 fallaron |
| `verify:cejuassa` | ✅ TYPECHECK OK / BUILD OK |

## Riesgos encontrados

- **Ningún riesgo bloqueante.** RLS permite operaciones con service role sin restricciones.
- **Porcentaje total**: La tabla no tiene constraint de suma de porcentajes por socio (suma puede superar 100%). Consideración para Fase 10D.
- **ID auto-increment**: El beneficiario temporal recibió id=1, lo que confirma que la tabla estaba vacía. El ID no se reutilizará (secuencia Postgres).

## Estado del módulo

- ✅ Tabla `socio_beneficiarios` operativa en Supabase
- ✅ INSERT funciona (con todos los campos requeridos)
- ✅ UPDATE funciona (parcial, solo campos indicados)
- ✅ DELETE funciona
- ✅ RLS no bloquea operaciones con service role
- ✅ `BeneficiariosSection.tsx` puede operar normalmente contra la tabla real
- ✅ Tabla queda vacía al finalizar la prueba

## Próxima fase recomendada

**Fase 10D** — Mejoras al módulo de beneficiarios:
- Validación de suma de porcentajes (= 100% entre todos los beneficiarios del socio)
- Límite de beneficiarios por socio (ej. máximo 5)
- Exportación de beneficiarios en reportes de socios
- O bien: avanzar a otro módulo pendiente
