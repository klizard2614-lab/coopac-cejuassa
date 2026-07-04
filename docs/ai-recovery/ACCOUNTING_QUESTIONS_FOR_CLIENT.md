# Preguntas para definir reportes SBS/BDCC y Provisiones Constituidas

**Para:** Contador / Responsable de Contabilidad — CEJUASSA  
**De:** Equipo de sistemas  
**Fecha:** Junio 2026

---

## Introducción

Antes de continuar con el desarrollo del módulo de reportes para la SBS, necesitamos confirmar una serie de datos contables y regulatorios. Sin esta información, no es posible generar los archivos BDCC correctamente y podría resultar en reportes inválidos ante la SBS.

La primera entrega de archivos BDCC cubre los **trimestres de marzo y junio 2026**, con fecha límite **20 de julio de 2026**.

El reporte de datos históricos 2024/2025 (también solicitado por la SBS) se trabajará en una etapa posterior y separada. No forma parte del alcance actual.

Por favor, responder cada pregunta con el dato exacto o indicar que no se dispone de esa información.

---

## A. Provisiones Constituidas

Estas preguntas son necesarias para completar el reporte Anexo N°6 y el archivo BDCC BD01.

**A1. ¿Cuál es el valor exacto de las Provisiones Constituidas que debe reportarse?**
- ¿Es el saldo de las cuentas contables 2802 del balance general al cierre de cada mes?
- ¿O es un valor diferente?

**A2. ¿De qué cuentas contables exactas proviene ese dato?**
- Por ejemplo, en marzo 2026 se observó: Genéricas S/16,800.91 + Específicas S/295,171.84 = S/311,972.75
- ¿Cuáles son los códigos de cuenta contable de cada parte?

**A3. ¿El dato se reporta como un total único, o separado en Genérica y Específica?**
- ¿Para el reporte SBS se usa el total (S/311,972.75) o se desglosa por tipo de provisión?

**A4. ¿Las Provisiones Constituidas de un deudor deben coincidir con las Provisiones Requeridas del mismo deudor?**
- Si no coinciden, ¿cómo se distribuye la diferencia?

**A5. ¿Las provisiones genéricas corresponden solo a créditos clasificados como Normal?**
- ¿O también hay genéricas para créditos en categoría Con Problemas Potenciales (CPP)?

**A6. ¿Este dato se registra una sola vez al cierre de cada mes?**
- ¿Quién lo registra? ¿Solo el área de Contabilidad?
- ¿Puede cambiar durante el mes o es definitivo al cierre?

---

## B. Código COOPAC y reglas SBS

Estas preguntas son necesarias para generar correctamente los archivos TXT que se envían a la SBS.

**B1. ¿Cuál es el código oficial de CEJUASSA asignado por la SBS?** ⚠ OBLIGATORIO
- Este código se usa en el nombre de todos los archivos que se envían.
- Ejemplo de nombre de archivo: `CEJUASSA_BD01_202603.txt`
- ¿Aparece en algún oficio, credencial o portal de la SBS?

**B2. ¿Cuáles son las cuentas contables que deben usarse en el reporte BD01?** ⚠ OBLIGATORIO
- El reporte SBS requiere indicar las cuentas contables según la clasificación del crédito:
  - Crédito vigente
  - Crédito refinanciado
  - Crédito vencido
  - Crédito en cobranza judicial
  - Crédito en cobranza coactiva
  - Crédito sin devengue de interés (3 subcategorías)
- ¿Cuáles son los códigos de cuenta contable exactos para cada categoría?

**B3. ¿Cuál es el código SBS para el tipo y subtipo de crédito que otorga CEJUASSA?** ⚠ OBLIGATORIO
- ¿Son todos consumo? ¿O también hay microempresa, pequeña empresa u otro?
- El código SBS puede ser diferente al nombre que usa internamente la cooperativa.

**B4. ¿La tasa de interés que va en el reporte SBS es la tasa nominal anual?**
- ¿O debe ser la tasa efectiva anual (TEA)?
- La app actualmente guarda la tasa nominal anual de cada crédito.

**B5. ¿CEJUASSA tiene garantías preferidas registradas?**
- Dos de los seis archivos BDCC (BD03A y BD03B) son para garantías preferidas.
- Si no hay ninguna garantía preferida, esos archivos se envían vacíos (solo con encabezado), lo que simplifica significativamente el proceso.

**B6. ¿La codificación del archivo TXT debe ser UTF-8 o ANSI?**
- ¿Ha habido alguna comunicación previa con la SBS al respecto?

---

## C. Datos de socios

**C1. ¿Cuál es la fuente del dato de género de cada socio?** ⚠ OBLIGATORIO
- El reporte BD01 requiere el género de cada deudor.
- Actualmente el sistema no tiene este dato registrado para cada socio.
- ¿Está en algún documento físico, ficha de afiliación o sistema externo?
- ¿Se puede ingresar manualmente en el sistema?

**C2. ¿Cuál es la fuente del dato de estado civil de cada socio?** ⚠ OBLIGATORIO
- ¿Está disponible en algún registro?
- ¿Se debe ingresar manualmente?

**C3. ¿Se autoriza que el personal ingrese o corrija estos datos en el sistema?**
- ¿O deben provenir de una fuente oficial como RENIEC?

---

## D. Pagos y cancelaciones

**D1. En los archivos Excel del cliente, algunos pagos aparecen con `Tipo = K`. ¿Qué significa exactamente?** ⚠ OBLIGATORIO
- ¿Indica que ese pago es una cancelación total del crédito?
- ¿O puede ser otro tipo de movimiento?

**D2. ¿Dónde se encuentran registrados los créditos cancelados?** ⚠ OBLIGATORIO
- ¿Existe un listado en Excel, en algún sistema o en papel?
- ¿Hay créditos cancelados entre 2024 y 2026 que deba incluirse en el reporte?

**D3. ¿Qué se considera una cancelación anticipada?**
- ¿Cuando el socio paga el saldo total antes del plazo?
- ¿Existe algún proceso o documento específico para esto?

**D4. Confirmar: ¿la primera entrega del 20 de julio 2026 cubre solo los trimestres de marzo 2026 y junio 2026?**
- El oficio SBS también menciona un reporte histórico 2024/2025 con fecha límite 20 de agosto 2026.
- ¿Confirmamos que el histórico se trabaja después, como etapa separada?

---

## E. Desembolsos de crédito

**E1. Al desembolsar un crédito, ¿cuál es la fórmula exacta para calcular el monto girado al socio?**
- En los archivos se observan las siguientes columnas de descuento: FPS, Seguro, Trámite (Tram.), Seguro Automático (AutoSeg.).
- ¿El monto girado = Monto aprobado − FPS − Seguro − Trámite − AutoSeg.?
- ¿Hay algún otro descuento que no esté listado?

**E2. ¿"AutoSeg" es el seguro automático de vida u otro tipo de seguro?**
- ¿Es diferente al campo "Seguro" que ya aparece en los archivos?

**E3. ¿"Tram." es el gasto administrativo de trámite del crédito?**
- ¿Debe reportarse en algún campo del reporte SBS?

**E4. En algunos créditos del Excel del cliente aparece "Saldo capital anterior" e "Interés anterior". ¿Qué representan?**
- ¿Indica que ese crédito es una refinanciación de uno anterior?
- ¿O que se canceló un crédito previo para dar lugar a uno nuevo?
- Esto afecta qué créditos deben aparecer en el reporte de cancelaciones.

---

## F. Alcance actual vs. futuro

**F1. Confirmar que la primera entrega del 20/07/2026 incluye solamente:**
- Trimestre marzo 2026 (3 meses: enero, febrero, marzo)
- Trimestre junio 2026 (3 meses: abril, mayo, junio)

**F2. Confirmar que el reporte histórico 2024/2025 (backlog) se trabajará en una etapa posterior separada.**
- Fecha límite del backlog según el oficio SBS: 20/08/2026
- ¿Se confirma esta separación de etapas?

---

## Respuestas mínimas necesarias para iniciar implementación

Las siguientes preguntas son **indispensables**. Sin estas respuestas no es posible generar ningún archivo BDCC válido:

| # | Pregunta | Por qué bloquea |
|---|---|---|
| B1 | Código COOPAC SBS | Se usa en el nombre de todos los archivos. Sin él no se puede generar nada. |
| B2 | Cuentas contables BD01 | Campos obligatorios en el reporte BD01. No pueden quedar vacíos. |
| B3 | Tipo/subtipo crédito SBS | Campo obligatorio en BD01. |
| A1-A3 | Valor y cuenta de Provisiones Constituidas | Campo obligatorio en BD01 y Anexo N°6. |
| C1-C2 | Género y estado civil de socios | Campo requerido en BD01. |
| D1 | Significado de Tipo=K | Determina qué pagos son cancelaciones en BD02. |
| D2 | Datos de créditos cancelados | Necesario para los archivos BD02-B y BD04. |

Una vez recibidas estas respuestas, el equipo de sistemas puede continuar con el desarrollo y proponer los cambios necesarios para revisión y aprobación antes de aplicarlos.

---

*Si alguna pregunta no aplica o no hay dato disponible, indicarlo para evaluar alternativas.*
