# MONDAY_DEMO_SCRIPT.md

> Guía de demo de 10 minutos — COOPAC CEJUASSA App
> Para mostrar a Gerencia / Contabilidad el lunes

---

## Antes de empezar (2 min antes)

1. Tener `npm run dev` corriendo → `http://localhost:3000`
2. Tener sesión iniciada como admin
3. Tener un socio de prueba con al menos un crédito vigente y pagos registrados
4. Abrir una carpeta de descargas visible en el escritorio para mostrar los TXT

---

## Demo paso a paso

### Minuto 0–1 — Inicio y Dashboard

**Mostrar:** `http://localhost:3000/dashboard`

- "Esta es la pantalla principal del sistema. Muestra el resumen de cartera, créditos vigentes, total de socios y provisiones del mes."
- Señalar los números del dashboard (socios activos, créditos, provisiones).

---

### Minuto 1–3 — Socios y campos SBS

**Mostrar:** `/dashboard/socios` → seleccionar un socio → "Editar"

- "Aquí registramos los datos de cada socio. Hemos agregado dos campos que la SBS requiere para el reporte BDCC: **Género** y **Estado Civil**."
- Mostrar los selects de Género (Masculino / Femenino / Otro) y Estado Civil (soltero / casado / conviviente / divorciado / viudo).
- "Tesorería puede ir actualizando estos campos. Son necesarios para que el archivo BD01 quede completo."
- Guardar un cambio si se puede.

---

### Minuto 3–5 — Créditos y campos SBS/BDCC

**Mostrar:** `/dashboard/creditos` → seleccionar un crédito → "Editar"

- "En los créditos también agregamos los campos que la SBS necesita: N° de Expediente, Tipo de Crédito SBS, Subtipo, y la Cuenta Contable para el reporte BD01."
- Mostrar los campos en el formulario.
- "Estos datos los puede llenar el área de Créditos. El sistema guarda exactamente lo que ingresen aquí."

---

### Minuto 5–6 — Pagos y tipo de pago

**Mostrar:** `/dashboard/pagos/nuevo` (no hacer submit — solo mostrar)

- "En el registro de pagos, ahora hay un campo **Tipo de Pago**: A para amortización normal, K para cancelación. El valor por defecto es A."
- "Cuando el área de Créditos confirme qué pagos fueron cancelaciones totales, se puede cambiar a K."

---

### Minuto 6–7 — Anexo 6 SBS

**Mostrar:** `/dashboard/reportes/anexo6`

- "El Anexo 6 ya estaba implementado. Aquí aparece la clasificación de cartera y las provisiones."
- "Hemos resuelto el punto de Contabilidad: las Provisiones Constituidas ahora se calculan igual a las Requeridas por deudor, que es el criterio que confirmó el contador."
- Mostrar la nota azul informativa.
- Descargar el Excel si hay datos disponibles.

---

### Minuto 7–10 — BDCC SBS (parte principal)

**Mostrar:** `/dashboard/reportes` → clic en "Generar →" de la tarjeta BDCC SBS

**En `/dashboard/reportes/bdcc`:**

- "Este es el nuevo módulo BDCC. La SBS nos pidió entregar 6 archivos TXT antes del 20 de julio."
- Señalar el código COOPAC **01270** en el encabezado.
- Señalar el aviso "Borrador revisable" — "Los archivos son para revisión interna, no para envío directo todavía."

**Seleccionar período:**
- Seleccionar mes/año que tenga datos (ej. Junio 2026 o el período con créditos vigentes).

**Descargar BD01:**
- Clic en "Descargar BD01.txt"
- Mostrar el archivo descargado: `01270_BD01_202606.txt`
- Abrir en editor de texto — mostrar la primera línea (mnemónicos SBS) y las filas de datos
- "Cada fila es un crédito vigente. Los campos incluyen datos del socio, del crédito, clasificación, días de mora y provisiones."
- Señalar las advertencias que aparecen: "Estas son las cosas que necesitamos confirmar con Créditos y Contabilidad antes del envío."

**Descargar BD02-A:**
- Clic en "Descargar BD02A.txt"
- "Este archivo tiene las cuotas que se pagaron en el período seleccionado."

**Descargar BD03A y BD03B:**
- Descargar ambos rápido.
- "Estos archivos son de garantías. El contador confirmó que CEJUASSA no tiene garantías preferidas, entonces van con solo el encabezado — que es lo correcto."

**Mostrar BD02-B y BD04 bloqueados:**
- Señalar los badges grises "Pendiente de información de Créditos".
- "Estos dos archivos son de créditos cancelados. Para generarlos necesitamos el listado de créditos que se han cancelado. Cuando Créditos nos dé esa información, lo implementamos."

**Mostrar bloque de advertencias permanentes:**
- "Todo lo que queda pendiente de validación está listado aquí. No es que el sistema esté incompleto — es que hay datos que solo el equipo puede confirmar."

---

## Cierre (30 segundos)

- "La app ya genera los 4 archivos que podemos generar con la información actual."
- "El paso siguiente es que Tesorería ingrese el género y estado civil de los socios, y que Créditos confirme la tasa TPINT y los códigos de tipo de crédito."
- "Con eso, los archivos quedan listos para revisión final de Contabilidad antes del 20 de julio."

---

## Si preguntan sobre el histórico 2024/2025

- "El historial de 2024 y 2025 es un proyecto separado que requiere importación masiva de datos. Lo hemos dejado fuera del alcance de esta entrega para no retrasar el sistema actual."

## Si preguntan "¿está listo para enviar a la SBS?"

- "Todavía no. Los archivos están generados pero necesitan revisión interna. Hay 3 campos que hay que confirmar con Créditos y 2 con Contabilidad antes de poder enviar con seguridad."

## Si preguntan "¿cuándo estará completo?"

- "Para el 20 de julio necesitamos solo resolver los pendientes de datos — no hay más desarrollo grande por hacer. El sistema ya genera los archivos."
