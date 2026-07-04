# CURRENT_MODULES.md

> Estado de cada módulo — confirmado en código.

## Módulos completos

### Dashboard (`/dashboard`)
- KPIs: socios activos, socios con crédito, saldo cartera, créditos vigentes, mora, recaudado del mes, aportes del mes, provisiones.
- Gráficos: Ingresos vs Egresos (6 meses), Evolución aportes, Estado cartera (donut).
- Alerta de mora en tiempo real.
- Accesos rápidos a: nuevo socio, nuevo crédito, nuevo pago, ver mora, generar Anexo 6.

### Socios (`/dashboard/socios`)
- Lista con búsqueda por nombre/DNI.
- Ver detalle, Editar (`SocioForm` reutilizable), Nuevo.
- Generar PDF ficha socio (jspdf).
- Estados: activo, retirado, suspendido, fallecido.

### Créditos (`/dashboard/creditos`)
- Lista con búsqueda y filtro "Solo en mora".
- Ver detalle (cronograma de cuotas incluido), Editar, Nuevo.
- Tipos: consumo, microempresa, hipotecario, otro.
- Estados: vigente, cancelado, castigado, refinanciado.
- Componente `SocioSearch` para buscar socio al crear crédito.
- **Nuevo crédito (`/dashboard/creditos/nuevo`)** — confirmado: COMPLETO.
  - Busca socio por nombre/DNI (SocioSearch).
  - Campos: nro_pagare, fecha_desembolso, tipo_credito, monto_aprobado, tasa_interes (anual %), plazo_meses, descuento_fps, descuento_seguro, descuento_otros.
  - Calcula reactivamente: monto_girado_neto (`monto - fps - seguro - otros`) y cuota_mensual (sistema francés).
  - Muestra vista previa del cronograma completo antes de guardar.
  - Al submit: (1) inserta en `creditos`, (2) genera y hace bulk insert en `cronograma_cuotas`.
  - Todo client-side — sin RPC, sin triggers.

### Pagos / Recibos (`/dashboard/pagos`)
- Lista con filtros por período, canal y estado.
- Total del período visible en la lista.
- Ver detalle, Nuevo pago.
- Generar PDF recibo de pago (jspdf).
- Canales: caja, convenio.
- Estados de flujo: registrado, en_correccion, validado, cerrado.

### Aportes (`/dashboard/aportes`)
- Lista filtrada por mes/año con tarjetas resumen (total mes, total año, socios).
- Ver detalle individual — confirmado: muestra socio, tipo de movimiento, monto, saldo anterior/nuevo, recibo vinculado (con link a `/dashboard/pagos/[id]`), observación y metadata.
- Tipos en `aportes`: aporte, retiro_parcial, retiro_total.
- **No existe botón "Nuevo Aporte" directo** — los aportes se crean desde `pagos/nuevo` (paso 4 del submit) cuando `monto_aporte > 0`.

### Egresos (`/dashboard/egresos`)
- CRUD completo en modal (crear, editar, eliminar con confirmación).
- Tipos: retiro_socio, fondo_mortuorio, otro.
- Filtros por tipo y rango de fechas.

### Convenios (`/dashboard/convenios`)
- Vista mensual de pagos por descuento de planilla, agrupados por institución.
- Tarjetas por convenio con desglose: aporte, capital, interés, FPS.
- Tabla resumen con totales.
- Link a detalle por convenio/período.
- **Detalle (`/dashboard/convenios/[id]`)** — confirmado: muestra KPIs (total recaudado, nº socios, nº pagos, promedio), buscador por nombre/DNI, tabla con columnas Socio, DNI, Recibo, Fecha, Aporte, Capital, Interés, FPS, Total, Acciones (link a recibo). Período navegable vía query params `?mes=&anio=`.

### Cartera (`/dashboard/cartera`)
- Lista de créditos vigentes con clasificación SBS calculada en tiempo real.
- Tarjetas resumen por clasificación (Normal, CPP, Deficiente, Dudoso, Pérdida).
- Filtros: búsqueda, clasificación, convenio.
- Muestra: días mora, provisión requerida por crédito.
- **Detalle (`/dashboard/cartera/[id]`)** — confirmado: muestra datos del crédito (pagaré, fecha desembolso, monto aprobado, monto girado neto, tasa, plazo, cuota, tipo, convenio), estado actual (saldo capital, días mora, clasificación, tasa provisión, provisión requerida, provisión constituida), y cronograma completo de cuotas con columnas N°, Vencimiento, Capital, Interés, Total, Capital Pagado, Estado. Cuotas vencidas resaltadas en rojo.

### Mora (`/dashboard/mora`)
- Lista de créditos vigentes con cuotas vencidas.
- Tarjetas: créditos en mora, socios afectados, monto vencido, capital en riesgo.
- Filtros por banda de días (1-30, 31-60, 61-90, +90) y tipo de crédito.

### Reportes (`/dashboard/reportes`)
- **Anexo N°6 SBS**: 60 columnas, clasificación + provisiones, exportación Excel.
- **Reporte Aportes**: movimientos de aportes/retiros, exportación Excel.
- **Reporte Caja**: ingresos vs egresos, 2 hojas Excel, saldo del período.

### Usuarios (`/dashboard/usuarios`)
- Solo accesible a `admin` (guard client-side).
- Invitar usuario vía email (envía invitación Supabase).
- Lista con rol y estado activo.
- Editar: cambiar rol, nombre, activo/inactivo.
- Roles disponibles: admin, tesoreria, creditos, contabilidad.

### Configuración (`/dashboard/configuracion`)
- Solo accesible a `admin`.
- Datos de la cooperativa: nombre, RUC, código COOPAC, dirección, teléfono, email.
- Parámetros financieros: tasa de interés, tasa FPS, tasas de provisión por clasificación.
- Sub-sección: gestión de convenios/instituciones.
- **Convenios (`/dashboard/configuracion/convenios`)** — confirmado: CRUD completo. Guard admin (3er módulo con guard). Campos: nombre (requerido), RUC, contacto, telefono, activo. Edición inline del nombre (click en celda). Muestra contador de socios vinculados. Desactivar/Activar convenio (soft delete — no elimina, pone activo=false).
