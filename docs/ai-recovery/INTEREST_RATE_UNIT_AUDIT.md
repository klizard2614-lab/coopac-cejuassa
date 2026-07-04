# INTEREST_RATE_UNIT_AUDIT.md
# Auditoría de Unidad de tasa_interes — Fase 9C-6C.1
# Generado: 2026-06-22

> SOLO AUDITORÍA — No se modificaron datos.

---

## 1. Evidencia del formato esperado por la app

### Formulario `creditos/nuevo/page.tsx`

```
Label:       "Tasa de Interés Anual (%)"
Placeholder: "Ej: 24.00"
Fórmula:     r = tasa / 100 / 12        ← línea 137
```

Esto es inequívoco: **la app espera tasa como porcentaje entero** (`26.82`, no `0.2682`).

### Formulario `creditos/[id]/editar/page.tsx`

```
Label:       "Tasa de Interés Anual (%)"
Placeholder: "Ej: 24.00"
```

Mismo formato. Confirma: la app persiste y edita en unidad `%`.

### Dry-run script `dry-run-regenerate-cronogramas.mjs`

```js
const r = tasa / 100 / 12   ← línea 67
```

Hereda la misma fórmula del formulario — asume tasa como porcentaje.

### Vista previa en formulario (línea 361)

```js
const r = tasa / 100 / 12
```

Tres usos distintos en el proyecto, todos dividen entre 100. **La app espera porcentaje.**

---

## 2. Formato actual en DB (backup 2026-06-20)

```json
"tasa_interes": 0.2682
```

Todos los créditos importados en Fase 9C-6B tienen `tasa_interes = 0.2682`.

**Conclusión: el valor en DB está en formato decimal, no porcentaje. Hay desajuste.**

---

## 3. Impacto numérico (ejemplo S/ 1,500 a 12 meses)

### Escenario A — DB actual: `tasa_interes = 0.2682`

```
r = 0.2682 / 100 / 12 = 0.0002235  (0.02235% mensual — casi cero)
cuota mensual ≈  S/ 125.54
interés total ≈  S/ 6.47
```

### Escenario B — Valor correcto: `tasa_interes = 26.82`

```
r = 26.82 / 100 / 12 = 0.02235   (2.235% mensual — TEA 26.82% correcta)
cuota mensual ≈  S/ 143.93
interés total ≈  S/ 227.16
```

### Diferencia

| Indicador | Escenario A (actual) | Escenario B (correcto) | Δ |
|---|---|---|---|
| Tasa mensual | 0.02235% | 2.235% | ×100 |
| Cuota mensual | S/ 125.54 | S/ 143.93 | +S/ 18.39 |
| Interés total (12m) | S/ 6.47 | S/ 227.16 | +S/ 220.69 |

> **Con `0.2682` los cronogramas generarían interés 35× menor al real.**
> Los créditos parecerían casi sin interés.

---

## 4. Impacto en reportes

### Anexo 6 (`reportes/anexo6/page.tsx`, línea 544)

```tsx
{fmt(f.credito.tasa_interes)}%
```

- Con `0.2682` → mostraría `0.27%` (incorrecto)
- Con `26.82`  → mostraría `26.82%` (correcto)

### BDCC BD01 (`reportes/bdcc/page.tsx`, línea 245)

```ts
fmtNumBdcc(c.tasa_interes, 4)   // campo TPINT
```

`fmtNumBdcc` usa `n.toFixed(4)`:
- Con `0.2682` → `"0.2682"` — SBS espera `"26.8200"` (porcentaje con 4 dec)
- Con `26.82`  → `"26.8200"` (correcto)

### Cartera (`cartera/[id]/page.tsx`, línea 232)

```tsx
`${fmt(credito.tasa_interes)}%`
```

Mismo problema visual que Anexo 6.

---

## 5. Formato SBS vs. formato interno

| Contexto | Unidad esperada | Nota |
|---|---|---|
| App (formulario nuevo/editar) | Porcentaje: `26.82` | Divide entre 100 en fórmula |
| DB `creditos.tasa_interes` | **Debe ser porcentaje: `26.82`** | Actualmente `0.2682` — incorrecto |
| Anexo 6 (display UI) | Porcentaje: `26.82%` | Se muestra con `%` directo |
| BDCC campo TPINT | Porcentaje con 4 dec: `26.8200` | `fmtNumBdcc(tasa, 4)` |
| Cronograma fórmula r | Decimal mensual: `0.02235` | Calculado en código: `tasa/100/12` |

**No hay ningún módulo que espere el decimal `0.2682` directamente como entrada.**

---

## 6. Riesgo

| Riesgo | Probabilidad | Impacto |
|---|---|---|
| Cronogramas con interés ~35× menor al real | **ALTA** — ya está en DB | **CRÍTICO** — datos financieros incorrectos |
| Anexo 6 muestra 0.27% en lugar de 26.82% | **ALTA** — dato ya en DB | **ALTO** — reporte SBS incorrecto |
| BDCC TPINT = `0.2682` en lugar de `26.8200` | **ALTA** — dato ya en DB | **ALTO** — reporte regulatorio incorrecto |

---

## 7. Recomendación

**Convertir `tasa_interes = 0.2682 → 26.82` (multiplicar × 100) en TODOS los créditos ANTES de la Fase 9C-6D (apply cronogramas).**

### Orden de operaciones

1. **Fase 9C-6C.2** — UPDATE `creditos SET tasa_interes = tasa_interes * 100 WHERE tasa_interes < 1`
   - Guard: `WHERE tasa_interes < 1` para no reescalar si ya fue corregido
   - Verificar que `cuota_mensual` también se recalcule o actualice
2. **Fase 9C-6D** — Ejecutar apply de cronogramas con la tasa ya en porcentaje

### Guard para script de conversión

```sql
-- Solo aplica si tasa está en formato decimal (< 1)
UPDATE creditos
SET tasa_interes = tasa_interes * 100
WHERE tasa_interes > 0 AND tasa_interes < 1;
```

---

## 8. Archivos involucrados en esta auditoría (solo lectura)

| Archivo | Motivo |
|---|---|
| `app/dashboard/creditos/nuevo/page.tsx` | Fuente de verdad de la fórmula y label del input |
| `app/dashboard/creditos/[id]/editar/page.tsx` | Confirma mismo formato en edición |
| `app/dashboard/reportes/anexo6/page.tsx` | Uso en reporte SBS Anexo 6 |
| `app/dashboard/reportes/bdcc/page.tsx` | Uso en TPINT del reporte BDCC |
| `app/dashboard/cartera/[id]/page.tsx` | Uso en vista de cartera |
| `lib/bdcc/format.ts` | Implementación de `fmtNumBdcc` |
| `scripts/dry-run-regenerate-cronogramas.mjs` | Fórmula del dry-run (hereda `tasa/100/12`) |
| `backups/data-reset/20260620-1327/creditos.json` | Valores actuales en DB |

---

## 9. Conclusión

- **Formato esperado por la app:** porcentaje — e.g., `26.82`
- **Formato actual en DB:** decimal — e.g., `0.2682`
- **`0.2682` está MAL — debe convertirse a `26.82` antes de generar cronogramas**
- **Impacto cronogramas:** sin conversión, el interés sería 35× menor al real
- **Siguiente fase recomendada:** Fase 9C-6C.2 — script de conversión con dry-run/apply y guard `WHERE tasa_interes < 1`
