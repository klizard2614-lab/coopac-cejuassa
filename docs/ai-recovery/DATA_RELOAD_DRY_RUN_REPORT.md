# DATA_RELOAD_DRY_RUN_REPORT.md
# Fase 9C-3 — Reporte de Dry-Run de Recarga
# Generado: 2026-06-20T23:17:08.476Z

> Este reporte fue generado por `npm run reload:dry-run`.
> NO se insertó ningún dato en la base de datos.

---

## Fuente analizada

- **Backup:** `backups/data-reset/20260620-1327`
- **Excel del cliente:** `_client_files/raw/extracted/Archvos app/` (requieren transformación manual)

---

## Conteos del backup

| Tabla | Registros en backup | DB actual |
|---|---|---|
| `socios` | 434 | 0 |
| `creditos` | 431 | 0 |
| `pagos_recibos` | 401 | 0 |
| `aportes` | 1 | 0 |
| `cronograma_cuotas` | 0 | 0 |
| `egresos` | 0 | 0 |
| `convenios` | 0 | 0 |

---

## Problemas críticos (bloquean la carga automática)

- Ninguno

---

## Advertencias (no bloquean, pero requieren atención)

- ⚠️ 434 socios sin genero (campo BDCC — completar antes de enviar a SBS)
- ⚠️ 434 socios sin estado_civil (campo BDCC)

---

## Decisión pendiente del usuario

1. **¿Recargar desde el backup (F1)?** — Contiene 434 socios y 431 créditos. ¿Son todos reales o hay mezcla de prueba?
2. **¿Cronograma de cuotas?** — Estaba en 0 en el backup. ¿Regenerar via RPC o cargar manualmente?
3. **¿Importar Excel del cliente (F2-F4)?** — Solo marzo 2026, 32 créditos. Requiere mapeo manual.

> Para autorizar la recarga real, indicar con qué fuente proceder.

---

## Confirmación

- ✅ NO se insertó ningún dato en la base de datos.
- ✅ Las tablas `usuarios` y `configuracion` siguen intactas.
- ✅ No se ejecutó ninguna migración.

*Dry-run completado 2026-06-20T23:17:08.476Z*
