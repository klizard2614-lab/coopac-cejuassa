# EXCEL_IMPORT_MVP_DRY_RUN_REPORT.md
# Reporte Dry-Run Importador Excel MVP — CEJUASSA
# Generado: 2026-06-21 16:28:57 — MODO: APPLY

> Fase 9C-4B — Fuente principal: Excel del proyecto.
> NO se insertó ningún dato.

---

## Resumen ejecutivo

| Entidad | Candidatos | Estado |
|---|---|---|
| Convenios | 8 | ✅ Listos para insertar |
| Socios derivados | 782 | ✅ Derivados desde Excel |
| Socios con DNI | 781 | ✅ |
| Socios sin DNI | 1 | ⚠️ Se insertan con DNI NULL |
| Créditos vigentes | 26 | ✅ |
| Créditos cancelados | 5 | ✅ |
| Pagos | 832 | ✅ |
| Aportes calculados | 785 | ✅ |
| Issues críticos | 0 | ✅ Ninguno |
| Warnings | 5 | ⚠️ Ver detalle |

---

## Convenios detectados

| # | Nombre (abreviatura) |
|---|---|
| 1 | BELEN |
| 2 | CHEPEN |
| 3 | DIRES |
| 4 | IREN |
| 5 | IRO |
| 6 | LAFORA |
| 7 | REGION |
| 8 | UTES |

---

## Socios derivados

- **Total únicos por IdSocio:** 782
- **Con DNI disponible:** 781
- **Sin DNI:** 1 (insertarán con dni=NULL)
- **Con convenio asignado:** 770
- **Sin convenio:** 12 (pagos de caja directa)
- **Fuentes de extracción:** CONVENIO (800 filas) + INGRESO (34 filas) + DSCTO (32 filas)

**Campos automáticos (desde Excel):** nro_socio, apellidos, nombres, dni, id_convenio (parcial)

**Campos pendientes (completar en app):** genero, estado_civil, fecha_nacimiento, direccion, beneficiario_*

---

## Créditos candidatos

- **Total:** 31 créditos (solo desembolsos de marzo 2026)
- **Vigentes:** 26
- **Cancelados:** 5
- **Campo tasa_interes:** 0 (no disponible en Excel — completar manualmente)
- **Campo tipo_credito:** 'consumo' (default — completar manualmente)
- **cronograma_cuotas:** NO se carga (regenerar via app o RPC)
- **id_credito en pagos:** NULL (no mapeable automáticamente)

---

## Pagos candidatos

- **Total:** 832
  - INGRESO DETALLADO (caja): ~34
  - CONVENIO (múltiples): ~800
- **Con aporte (Ap > 0):** 785
- **Con capital (Ptmo > 0):** 370
- **id_credito:** NULL en todos (no mapeable desde Excel)

---

## Aportes derivados

- **Total:** 785 aportes calculados desde pagos con Ap > 0
- **Socios con aporte:** 777
- **Saldo calculado por socio:** acumulativo ordenado por fecha (solo período marzo 2026)
- **Nota:** saldo_anterior = 0 para todos (inicio del período — no hay historial previo)

---

## Issues críticos

✅ Ningún issue crítico.

---

## Warnings

- ⚠️ 1 socios sin DNI — se insertarán con DNI NULL
- ⚠️ tasa_interes = 0 en todos los créditos — completar manualmente
- ⚠️ id_credito en pagos_recibos = NULL — no mapeable automáticamente
- ⚠️ cronograma_cuotas NO se cargará — regenerar via RPC o manualmente
- ⚠️ genero/estado_civil de socios = NULL — completar en módulo Socios

---

## Tablas NO cargadas en este plan

| Tabla | Motivo |
|---|---|
| `cronograma_cuotas` | Sin fuente segura — regenerar manualmente via RPC C o en la app |
| `egresos` | Sin fuente Excel disponible |
| `usuarios` | 🚫 Conservado — nunca tocar |
| `configuracion` | 🚫 Conservado — nunca tocar |

---

## Confirmaciones de cumplimiento

- ✅ NO se insertó ningún dato en Supabase
- ✅ NO se modificaron archivos en _client_files/
- ✅ NO se imprimieron datos personales completos en consola
- ✅ NO se usó backup JSON como fuente
- ✅ NO se tocaron usuarios/configuracion
- ✅ NO se crearon migraciones
- ✅ NO se borró ningún dato

---

## Comando para apply

Una vez revisado este reporte y el usuario aprueba:

**PowerShell:**
```powershell
$env:IMPORT_AUTH="EJECUTAR IMPORTACION EXCEL 9C-4B"; npm run import:excel:mvp:apply
```

**Bash:**
```bash
IMPORT_AUTH="EJECUTAR IMPORTACION EXCEL 9C-4B" npm run import:excel:mvp:apply
```

---

*Reporte generado por scripts/import-excel/import-excel-mvp.mjs — 2026-06-21 16:28:57*
