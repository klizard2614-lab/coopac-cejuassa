# DEMO Regulatory Fields Fill Report — 2026-06-23T02-18

> ⚠️  **DATOS DE DEMOSTRACIÓN — NO OFICIALES**
> Valores temporales aplicados para pruebas funcionales con la contadora.
> NO usar para TXT SBS, BDCC final ni reporte regulatorio definitivo.

Generado: 2026-06-23T02:18:39.246Z
Fase: 9C-6I-DEMO
Modo: APPLY

## Campos completados

| Campo | Valor aplicado | Registros actualizados |
|---|---|---|
| `socios.genero` | `M` (temporal) | 782 |
| `socios.estado_civil` | `soltero` (temporal) | 782 |
| `creditos.subtipo_credito_sbs` | `por_confirmar` (temporal) | 31 |

## Campos NO modificados (confirmado)

- `creditos.tipo_credito_sbs` — mantiene valor actual (`consumo_no_revolvente`)
- DNI placeholder (`SINDNI%`) — pendiente manual, no inventado
- `pagos_recibos` — sin cambios
- `cronograma_cuotas` — sin cambios
- Montos / saldos — sin cambios
- `usuarios` / `configuracion` / `auth.users` / `_client_files` — sin cambios

## Pendientes manuales

- 1 socio(s) con DNI placeholder — requieren DNI real del socio

## Riesgos

- Los valores `M` y `soltero` son temporales — deben reemplazarse con datos reales antes de BDCC oficial.
- `subtipo_credito_sbs = 'por_confirmar'` no es un valor SBS válido — confirmar con contadora.
- No afecta montos, cronogramas ni pagos.

## Cómo revertir

1. Abrir backup: `backups/demo-data-fill/2026-06-23T02-18/socios.json`
2. Identificar registros que tenían `genero: null` y `estado_civil: null`
3. Actualizar manualmente en Supabase Dashboard:
   ```sql
   UPDATE socios SET genero = NULL WHERE genero = 'M' AND <condición de IDs>;
   UPDATE socios SET estado_civil = NULL WHERE estado_civil = 'soltero' AND <condición de IDs>;
   UPDATE creditos SET subtipo_credito_sbs = NULL WHERE subtipo_credito_sbs = 'por_confirmar';
   ```

## Errores durante apply

Ninguno.
