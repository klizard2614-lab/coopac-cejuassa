# BUSINESS_RULES_FOUND.md

> Reglas de negocio detectadas directamente en el código fuente.

## Clasificación de cartera SBS (confirmado en código)

Basada en días de atraso de la cuota más antigua pendiente:

| Días mora | Clasificación | Tasa provisión |
|---|---|---|
| 0 – 8    | Normal     | 1%   |
| 9 – 30   | CPP        | 5%   |
| 31 – 60  | Deficiente | 25%  |
| 61 – 120 | Dudoso     | 60%  |
| +120     | Pérdida    | 100% |

Esta lógica está hardcodeada en: `dashboard/page.tsx`, `cartera/page.tsx`, `mora/page.tsx`, `reportes/anexo6/page.tsx`. Las tasas también son editables vía `Configuración > Parámetros Financieros` (tabla `configuracion`), pero la lógica de clasificación por días **no usa** esos valores — usa los hardcodeados.

## Cálculo de mora (confirmado en código)

- Una cuota está en mora si:
  - `estado === 'vencida'`  
  - O `estado IN ('pendiente', 'parcial')` Y `fecha_vencimiento < hoy`
- Los días de atraso se calculan desde la fecha de vencimiento de la cuota **más antigua** en mora de ese crédito.

## Categorías de egresos (confirmado en código)

- `retiro_socio` — Retiro de aportes de un socio
- `fondo_mortuorio` — Pago por fallecimiento
- `otro` — Cualquier otro egreso

## Canales de pago (confirmado en código)

- `caja` — Pago directo en oficina
- `convenio` — Descuento de planilla por institución empleadora

## Estados del recibo de pago (confirmado en código)

`registrado → en_correccion → validado → cerrado`

## Componentes de un pago (confirmado en código)

Un `pagos_recibos` desglosa el total en:
- `monto_aporte` — aporte a cuenta del socio
- `monto_capital` — amortización de capital del crédito
- `monto_interes` — intereses del período
- `monto_fps` — Fondo de Previsión Social
- `monto_fps_extra` — FPS extraordinario
- `monto_otros` — otros conceptos
- `monto_total` — suma de todos los anteriores
- `interes_amortizado_pagado` — campo adicional para interés amortizado (puede diferir de `monto_interes`)

## Tipos de aportes (confirmado en código)

- `aporte` — ingreso a cuenta de aportes
- `retiro_parcial` — retiro parcial de aportes
- `retiro_total` — retiro total (generalmente al retirarse como socio)

## Estados de socio (confirmado en código)

`activo`, `retirado`, `suspendido`, `fallecido`

## Estados de crédito (confirmado en código)

`vigente`, `cancelado`, `castigado`, `refinanciado`

## Período de pago (confirmado en código)

Se almacena como `YYYY-MM` (ej. `2026-06`). Usado en `pagos_recibos.periodo`.

## Formato de moneda

Soles peruanos (S/). Formato: `Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`.

## Formato de fechas

- Almacenadas en DB: `YYYY-MM-DD`
- Mostradas en UI: `DD/MM/YYYY`
- En exportaciones Excel (Anexo 6): `YYYYMMDD`

## Creación de crédito y cronograma (confirmado en `creditos/nuevo/page.tsx`)

### Fórmula de cuota mensual — Sistema Francés (cuota fija)
```
M = P · r·(1+r)^n / [(1+r)^n − 1]
donde: P = monto_aprobado, r = tasa_anual/100/12, n = plazo_meses
```

### Campos del crédito calculados en frontend antes del insert
- `monto_girado_neto` = `monto_aprobado - descuento_fps - descuento_seguro - descuento_otros`
- `cuota_mensual` = fórmula de cuota fija (round2)
- `saldo_capital` inicial = `monto_aprobado` (no `monto_girado_neto`)
- `interes_acumulado` inicial = 0
- `estado` inicial = `'vigente'`

### Descuentos al desembolso (campos en `creditos`)
- `descuento_fps` — descuento FPS al momento del desembolso
- `descuento_seguro` — descuento de seguro
- `descuento_otros` — otros descuentos

### Generación del cronograma de cuotas — lógica completa (cliente)
Para cada cuota `i` de 1 a `plazo_meses`:
- `interes` = `round2(saldo_vigente * r)`
- `capital` = `round2(cuota_mensual - interes)` (excepto última cuota: `capital = round2(saldo_vigente)` para absorber desfase de redondeo)
- `cuota_total` = `cuota_mensual` (excepto última: `capital + interes`)
- `saldo_vigente` -= `capital`
- `fecha_vencimiento` = fecha_desembolso + i meses (sin problemas de timezone)
- `estado` inicial = `'pendiente'`
- `capital_pagado` = 0, `interes_pagado` = 0, `fecha_pago` = null

Todas las cuotas se insertan en `cronograma_cuotas` en un **solo bulk insert** después de crear el crédito.

### Flujo de submit de nuevo crédito
1. Validaciones: socio seleccionado, fecha desembolso, plazo > 0, monto > 0.
2. Insert en `creditos` → obtiene el `id` del crédito creado.
3. Genera array de N cuotas en memoria.
4. Bulk insert en `cronograma_cuotas`.
5. Si paso 4 falla: muestra error pero el crédito del paso 2 **ya fue creado** — inconsistencia sin rollback.

## Flujo completo de registro de pago (confirmado en `pagos/nuevo/page.tsx`)

Cuando el usuario hace submit en `/dashboard/pagos/nuevo`, el cliente ejecuta en secuencia:

1. **Insertar en `pagos_recibos`** — nro_recibo, id_socio, id_credito, id_convenio, fecha, periodo, canal_pago, montos, estado_flujo='registrado'.
2. **Si `monto_capital > 0`**: llamar RPC `decrementar_saldo_capital(p_id_credito, p_monto)`. Si la función RPC no existe, hace fallback: lee `saldo_capital` actual y actualiza directamente (operación NO atómica → riesgo de race condition).
3. **Marcar cuota más antigua como pagada**: busca la cuota con `estado='pendiente'` y `nro_cuota` más bajo. La actualiza a `estado='pagada'`. **Importante**: solo busca cuotas `pendiente`, no `vencida` ni `parcial`.
4. **Si `monto_aporte > 0`**: lee el último `saldo_nuevo` del socio en `aportes`, suma `monto_aporte`, inserta en `aportes` con `tipo='aporte'`. Saldo calculado en cliente (no atómico → riesgo de race condition si se registran dos pagos simultáneos).

## Marcar cuota como pagada — comportamiento específico (confirmado en código)

El sistema solo marca como pagada la cuota con `estado='pendiente'`. Si una cuota está en `estado='vencida'` o `estado='parcial'`, **el step 3 no la toca**. Esto significa que cuotas vencidas requieren actualización manual de estado para reflejar el pago.

## Tabla `convenios` — campos completos (confirmado en `configuracion/convenios/page.tsx`)

La tabla tiene más campos que los detectados inicialmente:
- `id`, `nombre` (los detectados antes)
- `ruc` — RUC de la institución empleadora
- `contacto` — nombre del responsable
- `telefono` — teléfono de contacto
- `activo` — boolean (soft delete — inactivar no borra el registro)

## Tabla `creditos` — campos adicionales (confirmado en `cartera/[id]/page.tsx`)

Campos detectados adicionalmente:
- `monto_girado_neto` — monto efectivamente entregado al socio
- `interes_acumulado` — campo para interés acumulado

## Tabla `cronograma_cuotas` — campos adicionales (confirmado en `cartera/[id]/page.tsx` y `pagos/nuevo/page.tsx`)

Campos detectados adicionalmente:
- `capital` — capital de la cuota
- `interes` — interés de la cuota
- `capital_pagado` — capital efectivamente pagado
- `interes_pagado` — interés efectivamente pagado
- `fecha_pago` — fecha en que se registró el pago (se escribe en step 3 de `pagos/nuevo`)

## Provisión vs configuración

Las tasas de provisión en `configuracion` existen como campos editables, pero el código de clasificación de cartera y el Anexo 6 usa las tasas hardcodeadas (mismo valor). Si alguien cambia las tasas en Configuración, los reportes **no reflejarán ese cambio** sin modificar el código.
