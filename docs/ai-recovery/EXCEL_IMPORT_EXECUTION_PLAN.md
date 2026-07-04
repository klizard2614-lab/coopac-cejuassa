# EXCEL_IMPORT_EXECUTION_PLAN.md
# Plan de Ejecución de Importación desde Excel — CEJUASSA
# Fase 9C-4B

> **Fuente principal: Archivos Excel del proyecto.**
> El backup JSON NO es la fuente principal. Solo se usa como referencia de emergencia.
> `_client_files/` es solo lectura — no se modifica.

---

## Decisión de fuente

La recarga de datos usará **exclusivamente los archivos Excel del proyecto** como fuente principal:

| Tabla | Fuente | Método |
|---|---|---|
| `convenios` | Excel CONVENIO — campo `Usuario` | Derivado automáticamente |
| `socios` | Excel CONVENIO + INGRESO + DSCTO — campos `IdSocio`, `Socio`, `DNI`, `IdPers` | **Derivado automáticamente desde Excel** |
| `creditos` | Excel DSCTO Y DESEMBOLSO ABR-2026 | Directo con transformaciones |
| `pagos_recibos` | Excel INGRESO DETALLADO + CONVENIO DETALLE | Directo con transformaciones |
| `aportes` | Derivado de pagos con `Ap > 0` | Calculado (balance acumulativo por socio) |
| `cronograma_cuotas` | ❌ Sin fuente segura en Excel | No se carga — regenerar manualmente |
| `egresos` | ❌ Sin fuente Excel | No se carga — ingresar manualmente |

---

## Creación automática de socios desde Excel

**Fuentes de datos de socios disponibles en los Excel:**

| Columna | Presente en | Descripción |
|---|---|---|
| `IdSocio` | CONVENIO, INGRESO, DSCTO | Código de 7 dígitos = nro_socio |
| `Socio` | CONVENIO, INGRESO, DSCTO | Nombre completo en mayúsculas |
| `DNI` | CONVENIO, INGRESO | Número de documento de identidad |
| `IdPers` | CONVENIO, INGRESO | ID interno del sistema anterior |

**Estrategia de deduplicación:**
1. Clave primaria de deduplicación: `IdSocio` (nro_socio)
2. Enriquecimiento: si el mismo IdSocio aparece con DNI en CONVENIO o INGRESO, se asocia
3. Si DNI no disponible, se usa `null` (no IdPers, que es un ID interno no estándar)

**Separación de nombres:**
- Patrón observado en Excel: `"LECCAALBILDRO ROSA ESMERITA"` (apellidos concatenados + espacio + nombres)
- Estrategia MVP: `apellidos` = primera palabra, `nombres` = resto del string
- Esta separación es aproximada — muchos socios tendrán dos apellidos pegados en una sola palabra
- Los campos `genero`, `estado_civil`, `beneficiario_*` quedarán **vacíos** — completar en la app

**Campos que quedan pendientes para completar en la app (Módulo Socios):**
- `genero` — M/F (requerido para BDCC BD01)
- `estado_civil` — soltero/casado/conviviente/divorciado/viudo (requerido BDCC)
- `fecha_nacimiento` — no disponible en Excel
- `beneficiario_nombre`, `beneficiario_dni`, `beneficiario_parentesco` — no disponible
- `direccion` — no disponible en Excel

---

## Orden de carga (dependencias FK)

```
PASO 1: convenios
        ↓
PASO 2: socios (con id_convenio si convenio es conocido)
        ↓
PASO 3: creditos (con id_socio)
        (cronograma_cuotas: NO se inserta — regenerar manualmente)
        ↓
PASO 4: pagos_recibos (con id_socio, id_convenio)
        ↓
PASO 5: aportes (derivados de pagos con Ap > 0, con id_socio + id_recibo)
```

---

## Transformaciones clave

### Fecha serial Excel → DATE
```
Fecha como número entero (ej: 46083) → new Date((serial - 25569) * 86400000)
46083 → 2026-03-01
```

### Fecha texto DD/M/YYYY → DATE
```
"2/3/2026" → "2026-03-02"
"25/3/2026" → "2026-03-25"
```

### Nombre completo → apellidos + nombres
```
"LECCAALBILDRO ROSA ESMERITA"
  → apellidos: "LECCAALBILDRO"
  → nombres:   "ROSA ESMERITA"
```

### Estado del crédito desde saldo
```
saldo_capital > 0 → estado: 'vigente'
saldo_capital = 0 → estado: 'cancelado'
```

### id_convenio del socio desde pago
```
Usuario en pago → abreviatura del convenio
  BELEN, CHEPEN, DIRES, IREN, IRO, LAFORA, REGION, UTES
Normalizar → nombre completo → id_convenio
USUCAJ → null (pagos de caja directa)
```

---

## Campos no disponibles en Excel (defaults de import)

| Tabla | Campo | Default | Motivo |
|---|---|---|---|
| `creditos` | `tasa_interes` | `0` | No en Excel |
| `creditos` | `tipo_credito` | `'consumo'` | No en Excel |
| `creditos` | `tipo_credito_sbs` | `null` | No en Excel |
| `creditos` | `subtipo_credito_sbs` | `null` | No en Excel |
| `creditos` | `cuenta_contable_bd01` | `'1411050604'` | Default confirmado en Fase 7B-1 |
| `socios` | `estado` | `'activo'` | Default |
| `socios` | `genero` | `null` | No en Excel |
| `socios` | `estado_civil` | `null` | No en Excel |
| `pagos_recibos` | `canal_pago` | `'caja'` o `'convenio'` | Inferido de Usuario |
| `pagos_recibos` | `estado_flujo` | `'completado'` | Default |
| `pagos_recibos` | `id_credito` | `null` | No mapeable desde Excel |

---

## Límites y restricciones

- `cronograma_cuotas`: NO se inserta. Los créditos cargados tendrán 0 cuotas. Regenerar manualmente en la app o via RPC.
- `pagos_recibos.id_credito`: Se deja NULL. No es posible asociar pagos a créditos específicos automáticamente desde estos Excel.
- `aportes.saldo_anterior/saldo_nuevo`: Calculado acumulativamente por socio sobre los pagos del período.
- La importación es solo de datos de **marzo 2026** — no cubre historial previo.

---

## Autorización requerida para apply

Para ejecutar la carga real, el usuario debe ejecutar:
```bash
IMPORT_AUTH="EJECUTAR IMPORTACION EXCEL 9C-4B" npm run import:excel:mvp:apply
```

O en PowerShell:
```powershell
$env:IMPORT_AUTH="EJECUTAR IMPORTACION EXCEL 9C-4B"; npm run import:excel:mvp:apply
```

El script verificará que la variable de entorno sea exactamente `EJECUTAR IMPORTACION EXCEL 9C-4B` antes de insertar cualquier dato.

---

## Rollback

Si la importación resulta en datos incorrectos, ejecutar el reset nuevamente:
```sql
-- En Supabase Dashboard:
TRUNCATE TABLE aportes CASCADE;
TRUNCATE TABLE pagos_recibos CASCADE;
TRUNCATE TABLE cronograma_cuotas CASCADE;
TRUNCATE TABLE creditos CASCADE;
TRUNCATE TABLE socios CASCADE;
TRUNCATE TABLE convenios CASCADE;
```

O usar el script de reset existente (requiere autorización explícita del usuario).

---

*Plan creado: Fase 9C-4B, 2026-06-20*
