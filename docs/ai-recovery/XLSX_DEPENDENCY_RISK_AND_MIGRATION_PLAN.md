# XLSX_DEPENDENCY_RISK_AND_MIGRATION_PLAN.md

> **Fase DEP-1 — Estrategia para vulnerabilidad HIGH en `xlsx`**
> Fecha: 2026-07-03
> Clasificación: SOLO USO INTERNO
> Estado: PLAN DOCUMENTADO — no se reemplaza xlsx en esta fase

---

## Vulnerabilidad identificada

```
xlsx  *
Severity: high
Prototype Pollution in xlsx → https://github.com/advisories/GHSA-4r6h-8v6p-xvw6
ReDoS in xlsx              → https://github.com/advisories/GHSA-g2qj-x888-v6rr
fix available: none (2026-07-03)
```

- **Versión actual:** `^0.18.5`
- **Fix disponible:** ❌ NO — el mantenedor no ha publicado parche
- **npm audit fix:** ❌ NO resuelve (mantenedor bloqueado)
- **npm audit fix --force:** ❌ NO usar — downgrade a Next.js 9.3.3 (destructivo)

---

## Mapa de uso actual

### En la app frontend (browser) — Solo exporta, nunca lee archivos externos

| Archivo | Uso | Lee archivos externos | Riesgo práctico |
|---------|-----|-----------------------|-----------------|
| `app/dashboard/reportes/anexo6/page.tsx` | Export Excel (XLSX.utils + writeFile) | ❌ No | BAJO |
| `app/dashboard/reportes/caja/page.tsx` | Export Excel (XLSX.utils + writeFile) | ❌ No | BAJO |
| `app/dashboard/reportes/aportes/page.tsx` | Export Excel (XLSX.utils + writeFile) | ❌ No | BAJO |

### En scripts de Node.js (solo desarrolladores, no usuarios finales)

| Script | Uso | Lee archivos externos | Riesgo práctico |
|--------|-----|-----------------------|-----------------|
| `scripts/import-excel/import-excel-mvp.mjs` | Lee Excels del cliente (`_client_files/`) | ✅ Sí | BAJO-MEDIO* |
| `scripts/import-excel/dry-run-excel-import.mjs` | Lee Excels del cliente | ✅ Sí | BAJO-MEDIO* |
| `scripts/verify-credit-fields-sources.mjs` | Lee Excels del cliente | ✅ Sí | BAJO-MEDIO* |
| `scripts/refine-credit-anexo6-match.mjs` | Lee Excel Anexo 6 generado | ✅ Sí | BAJO-MEDIO* |
| `scripts/generate-rls-audit-matrix.mjs` | Genera Excel de auditoría | ❌ No | BAJO |
| `scripts/generate-match-medio-excel.mjs` | Genera Excel de revisión | ❌ No | BAJO |
| `scripts/check-audit-log-design.mjs` | Verifica Excel existente | ✅ Sí | BAJO* |
| Otros `check-*.mjs` | Verifican Excel locales | ✅ Sí (archivos propios) | BAJO |

(*) Los archivos leídos son de `_client_files/` o `exports/` — archivos del propio proyecto,
no archivos enviados por usuarios externos a través de la web. El riesgo de Prototype
Pollution/ReDoS aplica principalmente cuando se parsean archivos de **origen desconocido**.

---

## Evaluación del riesgo práctico

### Riesgo en frontend (app web)

**BAJO.** Las 3 páginas de la app **solo exportan** — nunca parsean archivos de entrada.
La vulnerabilidad de Prototype Pollution y ReDoS se activa al parsear un archivo malicioso,
no al generar uno. El usuario nunca puede cargar un Excel a estas páginas.

### Riesgo en scripts de Node.js

**BAJO-MEDIO.** Los scripts leen archivos Excel, pero:
- Todos los archivos son del propio equipo del proyecto o generados por la app
- No se reciben archivos de usuarios externos
- Los scripts corren en el entorno del desarrollador, no en producción pública
- Si un archivo de cliente estuviese maliciosamente construido, podría activar la vulnerabilidad

**Conclusión: El riesgo práctico actual es BAJO** mientras la app no permita cargar archivos
Excel de usuarios externos. El riesgo subiría a ALTO si se agregara funcionalidad de
importación de Excel por parte de usuarios finales.

---

## Alternativas evaluadas

### Opción A: Mantener xlsx aislado (recomendada a corto plazo)

| Criterio | Evaluación |
|----------|-----------|
| Esfuerzo | ✅ Ninguno |
| Riesgo de rotura | ✅ Ninguno |
| Seguridad app web | ✅ BAJO (solo exporta) |
| Seguridad scripts | ⚠️ BAJO-MEDIO (archivos propios) |
| Deuda técnica | ❌ Se acumula hasta que exista fix |

**Condiciones que mantendrían esta opción válida:**
- No agregar importación de Excel por usuarios finales
- Monitorear actualizaciones del paquete (`npm audit` periódico)

### Opción B: Migrar a ExcelJS (recomendada a largo plazo)

| Criterio | Evaluación |
|----------|-----------|
| Esfuerzo | ❌ ALTO — API diferente, refactor completo de 3 páginas + 8 scripts |
| Riesgo de rotura | ❌ MEDIO-ALTO — Anexo N°6 tiene 60 columnas + formato de hoja específico |
| Seguridad | ✅ ALTO — ExcelJS tiene mejor historial de seguridad |
| Mantenimiento futuro | ✅ Mejor — más activo en npm |

**Riesgos de migrar a ExcelJS:**
- `ExcelJS` tiene API de streaming diferente — no es drop-in replacement
- `XLSX.utils.aoa_to_sheet` + `book_append_sheet` → equivalente en ExcelJS es más verboso
- Riesgo de regresión en Anexo N°6 (hoja específica `MMMYYYY sin CEROS`, 60 columnas)
- Requiere tests completos de cada exportación antes de migrar

### Opción C: Reemplazo progresivo por módulo

1. Primero migrar reportes simples: aportes, caja (menos columnas, formato básico)
2. Después migrar Anexo N°6 (más crítico, confirmar con contadora cada columna)
3. Por último migrar scripts de importación (verificar que ExcelJS lee los mismos datos)

---

## Plan por fases (DEP-1A → DEP-1C)

### DEP-1A — Corto plazo (sin cambios, mantener xlsx)

- [x] Documentar el riesgo y el uso actual
- [x] Confirmar que ninguna página del frontend acepta archivos externos
- [ ] Agregar `npm audit` al checklist de pre-producción (ver runbook SEC-5)
- [ ] Monitorear: si `xlsx` publica fix, aplicar con `npm update xlsx`

### DEP-1B — Medio plazo (migrar scripts no críticos)

Cuando sea conveniente (sin urgencia):
- Migrar `generate-rls-audit-matrix.mjs`, `generate-audit-log-scope-matrix.mjs` a ExcelJS
  (solo generan, no leen)
- Migrar `generate-match-medio-excel.mjs` a ExcelJS
- Mantener xlsx para scripts de importación y páginas de la app por ahora

### DEP-1C — Largo plazo (migrar app frontend)

Solo si:
- ExcelJS tiene fix de compatibilidad o mejor API
- Se quiere agregar importación de Excel por usuarios finales
- El equipo aprueba el esfuerzo de testing del Anexo N°6

**Tests necesarios antes de DEP-1C:**
- Anexo N°6: verificar 60 columnas exactas
- Nombre de hoja: `MMMYYYY sin CEROS` exacto
- Caja: 2 hojas (Ingresos, Egresos)
- Aportes: formato y encabezados
- Comparar Excel generado por xlsx vs ExcelJS columna por columna

---

## Decisión final recomendada

**Para el estado actual del sistema:** Mantener `xlsx` en modo aislado (DEP-1A).

El riesgo práctico es bajo y el esfuerzo de migración es desproporcionado frente al
beneficio de seguridad. La vulnerabilidad se activaría solo si se parsearan archivos
de usuarios externos, lo que no ocurre actualmente.

**Trigger para escalar a DEP-1B o DEP-1C:**
- Si se agrega funcionalidad de importación de Excel por usuarios finales → escalar a URGENTE
- Si `xlsx` publica fix → aplicar inmediatamente con `npm update xlsx`
- Si ExcelJS consolida una API compatible → evaluar migración progresiva

---

## Archivos que NO se reemplazan en esta fase

- `app/dashboard/reportes/anexo6/page.tsx` — ⚠️ No tocar (reporte regulatorio)
- `app/dashboard/reportes/caja/page.tsx` — sin cambios
- `app/dashboard/reportes/aportes/page.tsx` — sin cambios
- Todos los scripts de importación — sin cambios
