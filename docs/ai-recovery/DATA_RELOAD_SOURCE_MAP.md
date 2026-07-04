# DATA_RELOAD_SOURCE_MAP.md
# Fase 9C-3 — Mapa de fuentes para recarga de datos reales
# Fecha: 2026-06-20

> Este documento mapea las fuentes disponibles contra las tablas destino.
> NO es una autorización de carga — la recarga real requiere aprobación explícita.

---

## Fuentes detectadas

| ID | Fuente | Tipo | Ubicación | Tablas candidatas |
|---|---|---|---|---|
| F1 | Backup pre-reset (Fase 9C-1) | JSON | `backups/data-reset/20260620-1327/` | socios, creditos, pagos_recibos, aportes |
| F2 | CONVENIO MES MARZO 2026 | Excel (.xlsx) | `_client_files/raw/extracted/Archvos app/` | pagos_recibos (805 filas) |
| F3 | INGRESO DETALLADO MARZO 2026 | Excel (.xlsx) | `_client_files/raw/extracted/Archvos app/` | pagos_recibos (39 filas) |
| F4 | DSCTO Y DESEMBOLSO ABR-2026 | Excel (.xlsx) | `_client_files/raw/extracted/Archvos app/` | creditos (~32 desembolsos) |
| F5 | Anexo 6 Deudores ENE-2026 | Excel (.xlsx) | `_client_files/raw/extracted/Archvos app/` | Referencia (no importar directamente) |
| F6 | Informe de Deudores Anexo 5 | Excel (.xlsx) | `_client_files/raw/extracted/Archvos app/` | Referencia (no importar directamente) |

---

## Mapa por tabla

### 1. `socios`

**Fuente recomendada:** F1 — backup JSON `socios.json` (434 registros)

| Columna fuente (backup JSON) | Columna destino | Obligatorio | Notas |
|---|---|---|---|
| `id` | `id` | ✅ | UUID Supabase — regenerar si se inserta nuevo |
| `nro_socio` | `nro_socio` | ✅ | Identificador interno de la cooperativa |
| `dni` | `dni` | ✅ | Clave única — detectar duplicados |
| `apellidos` | `apellidos` | ✅ | |
| `nombres` | `nombres` | ✅ | |
| `estado` | `estado` | ✅ | activo / retirado / suspendido / fallecido |
| `id_convenio` | `id_convenio` | ❌ | FK → `convenios.id` — debe coincidir con convenios recargados |
| `fecha_nacimiento` | `fecha_nacimiento` | ❌ | Requerido para BDCC BD01 (SEXO/ESTCIV/DOB) |
| `direccion` | `direccion` | ❌ | |
| `genero` | `genero` | ⚠️ | Campo nuevo (Fase 8A-2). En backup: puede estar vacío. Requerido BDCC |
| `estado_civil` | `estado_civil` | ⚠️ | Campo nuevo (Fase 8A-2). En backup: puede estar vacío. Requerido BDCC |
| `created_at` | `created_at` | ❌ | Supabase lo genera automáticamente |

**Campos faltantes en el backup (no existían antes de Fase 8A-2):**
- `genero` — puede estar NULL o vacío en muchos registros
- `estado_civil` — ídem

**Transformaciones necesarias:**
- Si se recarga desde backup: verificar que `id_convenio` apunte a convenios ya insertados, o poner NULL
- Limpiar DNIs duplicados antes de insertar (constraint único)

**¿Importable automáticamente?** Sí, desde backup, con validación previa de duplicados y FK de convenios.

**Riesgos:**
- DNIs duplicados violan constraint único → el insert falla con error 23505
- `id_convenio` FK falla si convenios no están cargados primero
- `genero`/`estado_civil` vacíos → reportes BDCC incompletos (no bloquea el insert)

---

### 2. `creditos`

**Fuente recomendada:** F1 — backup JSON `creditos.json` (431 registros)
**Fuente complementaria:** F4 — Excel DSCTO DESEMBOLSO (~32 desembolsos recientes, para validar)

| Columna fuente (backup JSON) | Columna destino | Obligatorio | Notas |
|---|---|---|---|
| `id` | `id` | ✅ | UUID — regenerar o usar backup |
| `nro_pagare` | `nro_pagare` | ✅ | Número de pagaré — clave de negocio |
| `id_socio` | `id_socio` | ✅ | FK → `socios.id` — debe existir el socio |
| `monto_aprobado` | `monto_aprobado` | ✅ | |
| `monto_girado_neto` | `monto_girado_neto` | ✅ | |
| `descuento_fps` | `descuento_fps` | ❌ | |
| `descuento_seguro` | `descuento_seguro` | ❌ | |
| `descuento_otros` | `descuento_otros` | ❌ | |
| `saldo_capital` | `saldo_capital` | ✅ | Saldo actual — crítico para cálculos |
| `cuota_mensual` | `cuota_mensual` | ✅ | |
| `tasa_interes` | `tasa_interes` | ✅ | |
| `plazo_meses` | `plazo_meses` | ✅ | |
| `tipo_credito` | `tipo_credito` | ✅ | ENUM: consumo / microempresa / hipotecario / otro |
| `estado` | `estado` | ✅ | vigente / cancelado / vencido |
| `fecha_desembolso` | `fecha_desembolso` | ✅ | |
| `interes_acumulado` | `interes_acumulado` | ❌ | |
| `nro_expediente` | `nro_expediente` | ❌ | Campo nuevo (Fase 8A-2) — puede estar vacío |
| `tipo_credito_sbs` | `tipo_credito_sbs` | ❌ | Campo nuevo — puede estar vacío |
| `subtipo_credito_sbs` | `subtipo_credito_sbs` | ❌ | Campo nuevo — puede estar vacío |
| `cuenta_contable_bd01` | `cuenta_contable_bd01` | ❌ | Campo nuevo — puede estar vacío |
| `aporte_descontado` | `aporte_descontado` | ❌ | Campo nuevo — puede estar vacío |
| `tramite` | `tramite` | ❌ | Campo nuevo — puede estar vacío |

**Transformaciones necesarias:**
- `id_socio` en el backup usa el UUID del socio en la DB pre-reset → debe remapearse al UUID del socio recargado
- Si se recarga socios con los mismos UUIDs del backup, no hay problema de remapeo
- `tipo_credito` debe ser uno de los ENUMs válidos

**¿Importable automáticamente?** Sí, desde backup, **después de cargar socios**. Requiere que los UUIDs de socios coincidan.

**Riesgos:**
- FK `id_socio` falla si los socios se insertaron con UUIDs nuevos (Supabase auto-genera)
- `cronograma_cuotas` está en 0 — si se recarga créditos desde backup sin cronograma, los créditos quedan sin cuotas
- Solución: o también cargar `cronograma_cuotas` desde backup, o regenerar via RPC `crear_credito_con_cronograma` (pero esto recalcularía el cronograma, no restaura el histórico de pagos)

---

### 3. `pagos_recibos`

**Fuente recomendada:** F1 — backup JSON `pagos_recibos.json` (401 registros)
**Fuentes complementarias:** F2 (convenios, 805 filas) + F3 (caja, 39 filas) — solo para período mar-2026

| Columna fuente (backup JSON) | Columna destino | Obligatorio | Notas |
|---|---|---|---|
| `id` | `id` | ✅ | UUID |
| `nro_recibo` | `nro_recibo` | ✅ | Número correlativo del recibo |
| `id_socio` | `id_socio` | ✅ | FK → `socios.id` |
| `id_credito` | `id_credito` | ✅ | FK → `creditos.id` |
| `id_convenio` | `id_convenio` | ❌ | FK → `convenios.id` (nullable) |
| `fecha` | `fecha` | ✅ | |
| `periodo` | `periodo` | ✅ | Formato YYYY-MM |
| `canal_pago` | `canal_pago` | ❌ | |
| `estado_flujo` | `estado_flujo` | ❌ | |
| `monto_aporte` | `monto_aporte` | ✅ | |
| `monto_capital` | `monto_capital` | ✅ | |
| `monto_interes` | `monto_interes` | ✅ | |
| `monto_fps` | `monto_fps` | ❌ | |
| `monto_fps_extra` | `monto_fps_extra` | ❌ | |
| `monto_otros` | `monto_otros` | ❌ | |
| `monto_total` | `monto_total` | ✅ | |
| `tipo_pago` | `tipo_pago` | ❌ | Campo nuevo (Fase 8A-2) — A/K |

**Transformaciones necesarias:**
- FK `id_socio`, `id_credito`, `id_convenio` deben remapearse si los UUIDs cambian
- `periodo` debe estar en formato `YYYY-MM` (verificar)

**¿Importable automáticamente?** Sí, desde backup, **después de cargar socios y créditos**.

**Riesgos:**
- FK falla si socios/créditos tienen UUIDs distintos
- Los recibos del backup actualizaron `cronograma_cuotas` y `saldo_capital` en su momento — si se recarga el backup, los saldos ya estarían reflejados en `creditos.saldo_capital`, lo que es consistente

---

### 4. `aportes`

**Fuente recomendada:** F1 — backup JSON `aportes.json` (1 registro)

| Columna fuente | Columna destino | Obligatorio | Notas |
|---|---|---|---|
| `id_socio` | `id_socio` | ✅ | FK → `socios.id` |
| `id_recibo` | `id_recibo` | ✅ | FK → `pagos_recibos.id` |
| `fecha` | `fecha` | ✅ | |
| `tipo` | `tipo` | ✅ | ENUM: aporte / retiro_parcial / retiro_total |
| `monto` | `monto` | ✅ | |
| `saldo_anterior` | `saldo_anterior` | ✅ | |
| `saldo_nuevo` | `saldo_nuevo` | ✅ | |
| `observacion` | `observacion` | ❌ | |
| `created_by` | `created_by` | ❌ | UUID del usuario que creó el registro |

**¿Importable automáticamente?** Sí, desde backup, **después de cargar socios y pagos_recibos**.

---

### 5. `cronograma_cuotas`

**Fuente recomendada:** F1 — backup JSON `cronograma_cuotas.json` (0 registros — vacío en el backup)

**Situación especial:**
El cronograma estaba en 0 ANTES del reset. Las cuotas no estaban siendo generadas por la app (o se importaron desde fuera).
Para los créditos recargados, hay dos opciones:
- **Opción A:** Recargar cronograma desde el backup de cronograma_cuotas (si existiera) — N/A (estaba vacío)
- **Opción B:** Regenerar cronograma via RPC `crear_credito_con_cronograma` para cada crédito — genera cuotas según fórmula francesa, pero NO restaura el histórico de pagos sobre cuotas
- **Opción C:** Cargar cronograma histórico manualmente si el cliente tiene los datos

**Recomendación:** Confirmar con el cliente si el cronograma histórico está disponible. Sin cronograma, los módulos de mora y cartera no funcionan correctamente.

---

### 6. `convenios`, `egresos`

**Fuente recomendada:** F1 — backup JSON (ambos en 0 en el backup)

Sin datos históricos — se cargarán cuando el cliente los ingrese manualmente desde la app.

---

## Orden de recarga recomendado

```
1. VERIFICAR   configuracion (ya existe — código COOPAC 01270, tasas SBS)
2. CARGAR      convenios (si aplica — actualmente 0, cargar desde app)
3. CARGAR      socios (desde backup JSON — con DNI único)
4. CARGAR      creditos (desde backup JSON — FK id_socio debe coincidir)
5. CARGAR      cronograma_cuotas (ver Opción A/B/C arriba — decisión pendiente)
6. CARGAR      pagos_recibos (desde backup JSON — FK id_socio + id_credito)
7. CARGAR      aportes (desde backup JSON — FK id_socio + id_recibo)
8. CARGAR      egresos (manual desde app — actualmente 0)
9. VALIDAR     npm run plan:data-reset, smoke:bdcc, verify:cejuassa
```

---

## Decisión crítica pendiente

**¿Recargar desde el backup (F1) o desde los Excel del cliente (F2-F4)?**

| Criterio | Backup JSON (F1) | Excel del cliente (F2-F4) |
|---|---|---|
| Completitud | ✅ 434 socios, 431 créditos | ❌ Solo marzo 2026, ~32 créditos |
| Limpieza | ⚠️ Datos de prueba mezclados con reales | ✅ Datos reales del período |
| Relaciones FK | ✅ Ya vinculadas | ❌ Requiere mapeo manual |
| Complejidad | Baja (script directo) | Alta (transformación + mapeo) |
| Riesgo | Recargar datos de prueba | Datos incompletos |

**Recomendación:** Recargar desde el backup (F1) si los 434 socios son todos reales. Si hay mezcla de datos de prueba, identificar cuáles son reales y filtrarlos antes de recargar.

**Esta decisión requiere autorización del usuario antes de proceder.**

---

*Documento generado 2026-06-20. No se insertó ningún dato. Usar `npm run reload:dry-run` para validar.*
