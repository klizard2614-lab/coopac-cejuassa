# Preguntas mínimas para continuar con reportes SBS/BDCC — CEJUASSA

**Para:** Contador / Responsable de Contabilidad — CEJUASSA  
**De:** Equipo de sistemas  
**Fecha:** Junio 2026

---

## Introducción

Para continuar con el desarrollo de los reportes que la SBS requiere, necesitamos confirmar algunos datos que solo la cooperativa puede proporcionar. Sin estas respuestas, los reportes podrían generarse con información incorrecta o incompleta, lo que representaría un riesgo ante la SBS.

La primera entrega cubre los **trimestres de marzo y junio 2026**, con fecha límite **20 de julio de 2026**.

---

## Preguntas obligatorias

### 1. Código COOPAC asignado por la SBS
¿Cuál es el código oficial que la SBS asignó a CEJUASSA?

Este código se usa en el nombre de todos los archivos que se envían a la SBS.
> Puede aparecer en algún oficio recibido de la SBS, en el portal institucional o en comunicaciones anteriores con el supervisor.

---

### 2. Provisiones Constituidas — fuente del dato
¿De dónde sale el valor de las Provisiones Constituidas que se reporta cada mes?

- ¿Es el saldo de las cuentas contables del balance general al cierre del mes (cuentas 2802)?
- ¿O se calcula de otra forma?

> En el Cuadre del Balance de marzo 2026 se observó: Genéricas S/16,800.91 + Específicas S/295,171.84 = Total S/311,972.75. ¿Es correcto usar ese total?

---

### 3. Provisiones Constituidas — cómo se registran
¿Cómo se deben ingresar las Provisiones Constituidas en el sistema?

Marcar la opción que corresponde:

- [ ] Como un **total único** por mes (ej: S/311,972.75)
- [ ] **Separadas** en Genéricas y Específicas
- [ ] **Por clasificación** de cartera (Normal, CPP, Deficiente, Dudoso, Pérdida)

¿Quién ingresa este dato? ¿Solo Contabilidad?

---

### 4. Provisiones Constituidas — distribución por deudor
En el Anexo 6, ¿las Provisiones Constituidas de cada deudor deben coincidir exactamente con las Provisiones Requeridas de ese mismo deudor?

- [ ] Sí, deben ser iguales
- [ ] No, se usa una regla diferente → ¿cuál?

---

### 5. Tipo y subtipo de crédito SBS
¿Cuál es el código oficial SBS para el tipo de crédito que otorga CEJUASSA?

> El código interno que usa la cooperativa puede ser diferente al que exige la SBS. Por ejemplo: ¿son todos créditos de "Consumo no revolvente"? ¿Hay también microempresa u otro tipo?

Si cuenta con el Manual de Contabilidad o el Catálogo SBS con los códigos, indicar el número.

---

### 6. Cuentas contables para el reporte BD01
El reporte SBS requiere indicar la cuenta contable según el estado de cada crédito. ¿Cuáles son los códigos exactos?

| Estado del crédito | Código de cuenta contable |
|---|---|
| Vigente | |
| Refinanciado | |
| Vencido | |
| En cobranza judicial | |
| En cobranza coactiva | |
| Sin devengue de interés — Normal | |
| Sin devengue de interés — CPP | |
| Sin devengue de interés — Deficiente/Dudoso/Pérdida | |

> Actualmente el sistema usa el código `1411030604` para todos los casos. ¿Es correcto o varía según el estado?

---

### 7. Género y estado civil de socios
El reporte SBS requiere el género y estado civil de cada socio. Actualmente el sistema no tiene esos datos registrados.

**a) Género:**
- [ ] Está en las fichas de afiliación físicas
- [ ] Está en otro sistema
- [ ] No está disponible — se ingresaría manualmente

**b) Estado civil:**
- [ ] Está en las fichas de afiliación físicas
- [ ] Está en otro sistema
- [ ] No está disponible — se ingresaría manualmente

¿Se autoriza ingresar o corregir estos datos directamente en el sistema?

---

### 8. Garantías preferidas
¿CEJUASSA tiene garantías preferidas registradas (hipotecas, prendas u otras garantías formales que respalden los créditos)?

- [ ] Sí → indicar cuántas aproximadamente y de qué tipo
- [ ] No → en ese caso, dos de los seis archivos SBS se envían sin datos (solo encabezado)

---

### 9. Significado del tipo de pago "K"
En los archivos de pagos aparece el código **Tipo = K** en algunos registros.

¿Qué indica exactamente?

- [ ] Es una cancelación total anticipada del crédito
- [ ] Es otro tipo de movimiento → ¿cuál?

---

### 10. Créditos cancelados
Para los reportes SBS se necesita información sobre créditos que ya fueron cancelados (pagados en su totalidad).

- ¿Existe un listado de créditos cancelados? ¿En qué formato está (Excel, papel, sistema)?
- ¿Hay créditos cancelados entre enero y junio de 2026?

---

## Datos opcionales (si los tienen disponibles)

Estas respuestas no bloquean el inicio del trabajo, pero ayudarán a completar los reportes:

- **Codificación de archivos TXT:** ¿La SBS indicó si los archivos deben enviarse en UTF-8 o ANSI? ¿Hubo alguna comunicación previa?
- **Tasa de interés para reporte SBS:** ¿El reporte SBS usa la tasa nominal anual o la tasa efectiva anual (TEA)?
- **Fórmula de desembolso:** ¿El monto girado al socio se calcula como: Monto aprobado − FPS − Seguro − Trámite − AutoSeg.? ¿Hay algún descuento adicional?

---

## Alcance

La **primera entrega** cubre los trimestres de marzo y junio 2026.

El reporte histórico de los años 2024 y 2025 —también solicitado por la SBS— se trabajará en una etapa posterior y separada. No forma parte del trabajo actual.

---

## Cierre

Con estas respuestas podremos continuar con el desarrollo de los reportes y validaciones necesarios para cumplir con los plazos de la SBS.

Si alguna pregunta no aplica o no se cuenta con el dato, indicarlo para evaluar alternativas.

---

*Ante cualquier consulta, comunicarse con el equipo de sistemas.*

---

## Respuestas recibidas — 2026-06-20

| Pregunta | Respuesta | Estado |
|---|---|---|
| 1. Código COOPAC SBS | `01270` | ✅ Confirmado |
| 2. Fuente de Provisiones Constituidas | Calculadas del saldo de cada deudor con las tasas por clasificación | ✅ Confirmado |
| 3. Cómo se registran | Por cada clasificación del deudor | ✅ Confirmado |
| 4. ¿Igual a Provisiones Requeridas? | Sí, deben ser iguales | ✅ Confirmado |
| 5. Tipo/subtipo crédito SBS | Consumo no revolvente. Código mencionado: 1411030604 | ⚠ Parcial — validar catálogo SBS |
| 6. Cuentas contables BD01 | `1411050604` | ⚠ Parcial — falta confirmar por estado |
| 7. Género y estado civil | Solicitar a Tesorería | ⏳ Pendiente |
| 8. Garantías preferidas | No tiene | ✅ Confirmado |
| 9. Tipo de pago K | No disponible — consultar a Créditos | ⏳ Pendiente |
| 10. Créditos cancelados | Consultar a Créditos | ⏳ Pendiente |

**Pendientes adicionales identificados:**
- Tasa 0.2682 en Anexo 6 — consultar a Créditos si es TEA o tasa nominal
- Descuento de aporte al desembolso para socios nuevos — confirmado por Contabilidad
