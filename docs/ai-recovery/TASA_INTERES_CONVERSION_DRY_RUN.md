# TASA_INTERES_CONVERSION_DRY_RUN.md
# Dry-Run: Conversión tasa_interes decimal → porcentaje
# Generado: 2026-06-22 — Fase 9C-6C.2

> Solo lectura — no se modificó ningún dato en este reporte.

## Contexto

La app usa `r = tasa_interes / 100 / 12` en formularios y scripts de cronograma.
Esto asume que `tasa_interes` está en porcentaje (e.g., `26.82`).
La importación Fase 9C-6B guardó el valor SBS decimal (e.g., `0.2682`).
Este script corrige la unidad multiplicando por 100.

## Resumen

| Campo | Valor |
|---|---|
| Créditos detectados (tasa < 1) | **31** |
| Mezcla de formatos | ✅ No |
| Operación propuesta | `tasa_interes = tasa_interes * 100` |
| Guard | `WHERE tasa_interes > 0 AND tasa_interes < 1` |
| Cronograma_cuotas tocado | ❌ NO |
| Otros campos tocados | ❌ NO |

## Tasas únicas (antes → después)

| tasa_interes actual | tasa_interes propuesta | Créditos |
|---|---|---|
| 0.2682 | 26.82 | 31 |

## Simulación cuota mensual (ejemplo sin datos personales)

| Escenario | tasa_interes | Cuota simulada |
|---|---|---|
| Antes (decimal) | 0.2682 | S/ 223.37 |
| Después (porcentaje) | 26.82 | S/ 354.67 |
| cuota_mensual en DB | - | S/ 347.72 |

> La cuota "Después (porcentaje)" debe aproximarse a `cuota_mensual` en DB.

## SQL equivalente (para referencia)

```sql
-- Dry-run: verificar candidatos
SELECT id, tasa_interes, tasa_interes * 100 AS tasa_propuesta
FROM creditos
WHERE tasa_interes > 0 AND tasa_interes < 1;

-- Apply: actualizar (solo con autorización CONVERTIR TASA A PORCENTAJE 9C-6C.2)
UPDATE creditos
SET tasa_interes = tasa_interes * 100
WHERE tasa_interes > 0 AND tasa_interes < 1;
```

## Estado

- [ ] Dry-run ejecutado ✅
- [ ] Apply pendiente de autorización: `CONVERTIR TASA A PORCENTAJE 9C-6C.2`