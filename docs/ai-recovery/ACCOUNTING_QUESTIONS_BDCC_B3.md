# ACCOUNTING_QUESTIONS_BDCC_B3.md

> Preguntas para el contador / cliente CEJUASSA antes de implementar BDCC y resolver B3.
> Generado: Fase 7B-0 (2026-06-18)
> **B3: RESUELTO (Fase 8A-1, 2026-06-20)** — C37 = C36 por criterio contable confirmado. Ver sección "Respuestas recibidas" al final.
> Pendientes: Tipo K, créditos cancelados, tasa TPINT (Créditos); Género/estado civil (Tesorería).

---

## Bloque A — Provisiones Constituidas (B3)

1. **¿Cuál es el valor exacto mensual de Provisiones Constituidas que debe reportarse?**
   - ¿Es el saldo de las cuentas contables 2802xx del balance general al cierre del mes?
   - ¿O es otro valor diferente al que aparece en el balance?

2. **¿De qué cuenta contable exacta sale el dato?**
   - Ejemplo hallado en auditoría (marzo 2026): Genéricas S/16,800.91 (¿2802.01?) + Específicas S/295,171.84 (¿2802.02?) = S/311,972.75
   - Confirmar los códigos de cuenta exactos.

3. **¿Se registra como total único, o separado en Genérica y Específica?**
   - Para el Anexo 6 y BD01, ¿se reporta el total S/311,972.75 o se desglosado por clasificación?

4. **¿La Provisión Constituida por deudor debe ser igual a la Provisión Requerida por deudor?**
   - En el Anexo 6, ¿se asigna proporcionalmente por saldo de cada crédito, o hay una regla diferente?

5. **¿Las provisiones genéricas incluyen solo la categoría Normal, o también parte de CPP?**
   - Esto afecta si la columna Genérica va junto a Normal o si hay algún crédito CPP con provisión genérica.

6. **¿El dato debe guardarse mensualmente por periodo (AAAA-MM)?**
   - ¿O se actualiza en tiempo real y solo se consulta al cierre?
   - ¿Quién lo ingresa? ¿Solo Contabilidad?

---

## Bloque B — Código y reglas SBS para BDCC

7. **¿Cuál es el código COOPAC asignado por la SBS a CEJUASSA?**
   - Se usa en la nomenclatura de todos los archivos TXT: `{CódigoCoopac}_BD01_202603.txt`
   - ¿Aparece en el oficio SBS o en el portal de la SBS?

8. **¿Cuáles son las cuentas contables exactas para BD01?**
   - El Anexo 1 del oficio SBS requiere los campos CCVI, CCRF, CCVE, CCJU, CCCO (vigente, refinanciado, vencido, judicial, cobranza coactiva) y CCSIN, CCSID, CCSIS (sin devengue interés).
   - La app tiene hardcoded `'1411030604'` — ¿es correcto o hay cuentas diferentes por clasificación?

9. **¿Cuáles son los códigos SBS de tipo y subtipo de crédito para CEJUASSA?**
   - El campo TPCR (tipo de crédito) en BD01 debe usar el código SBS, no el nombre interno.
   - ¿Son todos "consumo" o hay otro tipo (microempresa, etc.)?

10. **¿TPINT en BD01 corresponde a la tasa nominal anual que ya guarda la app (`creditos.tasa_interes`)?**
    - ¿O debe ser la tasa efectiva anual (TEA)?

11. **¿CEJUASSA tiene garantías preferidas (BD03A/BD03B)?**
    - Si no hay ninguna garantía preferida registrada, BD03A y BD03B se envían solo con la fila de encabezado (sin datos).
    - Confirmar que efectivamente no hay garantías preferidas.

12. **¿La codificación del archivo TXT debe ser UTF-8 o ANSI (ISO 8859-1)?**
    - El oficio SBS admite ambas, pero la SBS puede tener preferencia. ¿Ha habido comunicación previa al respecto?

---

## Bloque C — Datos de socios

13. **¿Cuál es la fuente real del género de cada socio?**
    - Actualmente la app tiene hardcoded `'M'` para todos los socios en el Anexo 6.
    - ¿Está registrado el género en algún documento físico o sistema externo?
    - ¿Se puede deducir del DNI (dígito de verificación)?

14. **¿Cuál es la fuente real del estado civil de cada socio?**
    - BD01 puede requerir estado civil (casado, soltero, etc.).
    - ¿Existe en algún registro o documento?

15. **¿Se debe permitir completar o corregir estos datos manualmente desde la app?**
    - ¿O se obtendrán de RENIEC u otro sistema oficial?

---

## Bloque D — Pagos y cancelaciones

16. **Confirmar el significado de `Tipo=K` en los archivos del cliente.**
    - En los Excel auditados aparece `Tipo=K` en algunos pagos.
    - BD02-B usa `FCAN_C` (fecha cancelación). ¿`Tipo=K` indica cancelación total del crédito?

17. **¿Dónde está la data de créditos cancelados?**
    - ¿Existe un listado en algún Excel, sistema externo o papel?
    - ¿Hay créditos cancelados entre 2024 y 2026 que deban reportarse?

18. **¿Qué se considera cancelación anticipada vs. cancelación normal?**
    - ¿Un crédito se cancela cuando el saldo es 0 y se pagaron todas las cuotas?
    - ¿O existe algún tipo de cancelación parcial o restructuración?

19. **¿La primera entrega del 20/07/2026 debe cubrir solo los trimestres de 2026 (marzo y junio)?**
    - El oficio SBS también menciona el backlog 2024-2025 con fecha límite 20/08/2026.
    - ¿Se confirma que el backlog histórico es un proyecto separado y posterior?

---

## Bloque E — Desembolsos

20. **¿Cuál es la fórmula exacta de descuentos al desembolsar un crédito?**
    - En los archivos del cliente se observan columnas: Monto, Descuento FPS, Seguro, Tram., AutoSeg., Girado.
    - ¿El "Girado" = Monto Aprobado − FPS − Seguro − Tram. − AutoSeg.?

21. **¿`AutoSeg` es el seguro automático (de vida o similar)?**
    - ¿Es diferente al campo `Seguro` que ya aparece en los archivos?
    - ¿Debe guardarse en un campo separado de la app?

22. **¿`Tram.` es el gasto de trámite administrativo?**
    - ¿Debe reportarse en algún campo de BD01?

23. **¿El "Saldo Capital anterior" e "Interés anterior" en los archivos del cliente representan refinanciación o cancelación de crédito previo?**
    - Esto afecta si BD04 (créditos cancelados) debe incluir esos registros.

---

## Decisiones que bloquean implementación

Las siguientes preguntas deben responderse antes de escribir una sola línea de código o SQL:

| # | Decisión | Bloquea |
|---|---|---|
| A1-A3 | Valor y cuentas de Provisiones Constituidas | BD01 campo C37, Anexo 6, tabla `provisiones_mensuales` |
| B7 | Código COOPAC SBS | Nomenclatura de TODOS los archivos TXT |
| B8 | Cuentas contables BD01 (CCVI, CCRF, etc.) | Campos NOT NULL en BD01 — sin esto el archivo es inválido |
| B9 | Tipo/subtipo crédito SBS | Campo TPCR BD01 |
| D17 | Fuente de créditos cancelados | BD02-B y BD04 |
| D19 | Alcance de la primera entrega (¿solo 2026?) | Planificación de implementación |
| C13-C14 | Género y estado civil | Campo SEXO en BD01 |

> **Regla:** no crear migraciones, no implementar exportadores, no agregar campos a la DB hasta que al menos B7 y B8 estén confirmados, y A1-A3 definidos.

---

## Respuestas recibidas de Contabilidad — Fase 7B-1 (2026-06-20)

| # | Pregunta | Respuesta recibida | Estado | Impacto en implementación |
|---|---|---|---|---|
| B7 | Código COOPAC SBS | `01270` | ✅ Confirmado | Usar en nomenclatura de archivos: `01270_BD01_202603.txt` |
| A1-A3 | Provisiones Constituidas — fuente | "Son las que te envié los % para cada situación del deudor. Se calcula del saldo de cada deudor." | ✅ Confirmado | C37 = C36 por deudor. No requiere tabla `provisiones_mensuales`. Decisión contable formal. |
| A3 | Forma de registro | "Deben ser calculadas por cada clasificación del deudor." | ✅ Confirmado | Provisiones Constituidas = calculadas con tasas SBS ya implementadas |
| A4 | Distribución por deudor | "Sí, debe ser igual." | ✅ Confirmado | C37 = C36 — B3 resuelto conceptualmente para el alcance actual |
| B9 | Tipo/subtipo crédito SBS | "Son consumos no rev. 1411030604" | ⚠ Parcial | Tipo confirmado: consumo no revolvente. El código `1411030604` parece cuenta contable, no código SBS C19/C20. Pendiente validar catálogo SBS. |
| B8 | Cuenta contable BD01 | `1411050604` | ⚠ Parcial | Valor candidato/default. Falta confirmar si aplica a todos los estados del crédito (vigente, vencido, judicial, etc.) o solo a uno. |
| C13-C14 | Género y estado civil | "Estos datos se solicitan a Tesorería para ser incluidos en el Anexo 6." | ⏳ Pendiente | Fuente operativa: Tesorería. App debe permitir captura/edición. No hardcodear. |
| B11 | Garantías preferidas | "No tiene." | ✅ Confirmado | BD03A y BD03B: generar solo con fila de encabezado (sin datos). |
| D16 | Tipo de pago K | "No tengo ese dato." | ⏳ Pendiente | Consultar a Créditos o revisar reportes de cancelaciones. BD02-B depende de esto. |
| D17 | Créditos cancelados | "Consultar a Créditos, manejan reportes." | ⏳ Pendiente | BD02-B y BD04 bloqueados hasta recibir data o regla de Créditos. |
| — | Tasa en Anexo 6 | "Consultar a Créditos ya que en reporte Anexo 6 figura 0.2682." | ⏳ Pendiente | El valor 0.2682 podría ser TEA (tasa efectiva anual ≈ 26.82%). Verificar si `creditos.tasa_interes` es nominal o efectiva y cómo mapearla. |
| — | Descuento aporte en desembolso | "También se le descuenta aportes cuando es socio nuevo." | ✅ Confirmado | Campo `aporte_descontado` necesario en desembolso para socios nuevos. Ya identificado en auditoría. |

### Resumen de estados

| Estado | Cantidad | Qué implica |
|---|---|---|
| ✅ Confirmado | 5 | Se puede usar en implementación directamente |
| ⚠ Parcial | 2 | Valor candidato registrado; validar antes de usar en archivos SBS |
| ⏳ Pendiente | 4 | Consultar a Créditos o Tesorería antes de implementar |

### Pendientes con otras áreas

- **Créditos:** Tipo K, créditos cancelados, tasa 0.2682 en Anexo 6
- **Tesorería:** Género y estado civil de socios
- **Validar con catálogo SBS:** código exacto C19/C20 para tipo consumo no revolvente

---

## Historial

| Fecha | Evento |
|---|---|
| 2026-06-18 | Documento creado (Fase 7B-0) |
| 2026-06-20 | Respuestas de Contabilidad recibidas y registradas (Fase 7B-1) |
