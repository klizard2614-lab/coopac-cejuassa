# PAGOS_CUOTAS_10K_2A_REVISION_MANUAL.md

> Fase 10K-2A.1 — Paquete de revisión manual para Tesorería/Créditos.
> **Modo: SOLO DOCUMENTACIÓN.** Ningún dato fue modificado. Este documento y el
> Excel adjunto sirven para que Tesorería y Créditos tomen una decisión sobre los
> casos que bloquean el apply real de pagos contra cuotas (Fase 10K-2B).
> No requiere conocimientos técnicos para leerse.

---

## Resumen en lenguaje simple

El sistema tiene **832 pagos** registrados. De esos, **26 pagos** ya están
vinculados a un crédito y tienen un monto claro que podría aplicarse a las
cuotas del cronograma (las "cuotas por pagar" de cada crédito).

Se hizo una **simulación** (no un cambio real) de qué pasaría si esos 26 pagos
se aplicaran a las cuotas correspondientes:

- **8 cuotas** quedarían completamente **pagadas**.
- **26 cuotas** quedarían **parcialmente pagadas** (abono, no el total).
- En total se tocarían **33 cuotas distintas**.
- El monto total que se aplicaría es **S/ 8,870.70**.

Nada de esto ha ocurrido todavía. La tabla donde quedaría registrado
(`pagos_cuotas_aplicaciones`) sigue **vacía (0 filas)**.

Antes de aplicar esto de verdad, hay **3 situaciones dudosas** que Tesorería y
Créditos deben revisar y decidir, porque si se aplican mal podrían dejar
cuotas marcadas como pagadas sin que el socio realmente las haya pagado, o
dejar pagos reales sin aplicar.

---

## Qué significa "aplicar pagos a cuotas"

Cada crédito tiene un cronograma de cuotas (como un calendario de pagos
mensuales). Hoy en día, el sistema sabe que un socio hizo un pago (recibo),
pero **no siempre sabe a cuál cuota específica del calendario corresponde ese
pago**.

"Aplicar pagos a cuotas" significa: tomar cada pago registrado y marcarlo
contra la cuota (o cuotas) del calendario que corresponde, actualizando su
estado a "pagada" o "parcial" según el monto.

## Qué pasaría si se aprueba (Fase 10K-2B, apply real)

- Se escribiría una fila por cada aplicación en una tabla de trazabilidad
  nueva (`pagos_cuotas_aplicaciones`), que sirve como comprobante de que "el
  pago X se aplicó a la cuota Y por tal monto".
- Se actualizaría el cronograma de cuotas: quedarían marcadas como "pagadas"
  o "parciales" según corresponda, con su fecha de pago.
- **No se tocarían** los saldos de capital de los créditos, ni Anexo 6, ni
  ningún otro reporte — esta fase solo afecta el detalle de cuotas.
- Los **3 casos descritos abajo quedarían excluidos** del apply hasta que se
  resuelvan, para no arriesgar información incorrecta.

## Qué casos necesitan respuesta antes de aprobar

Hay 3 situaciones que no se pueden resolver automáticamente porque requieren
el criterio de alguien que conoce el caso real (no solo lo que dice la base
de datos):

1. **Un pago con un monto mucho más alto de lo normal** (pago 411\*\*\*\*).
2. **Un pago sobre un crédito que ya está cancelado** y no tiene calendario
   de cuotas (pago 1145\*\*\*\*).
3. **3 pagos que no se sabe con certeza a qué crédito pertenecen**
   (`match_medio`, pendientes desde antes).

---

## Caso 1 — Pago 411\*\*\*\*, monto excesivo (R-K2)

| Dato | Valor |
|---|---|
| Pago (enmascarado) | `411****` |
| Crédito (enmascarado) | `1138****` |
| Monto aplicable (capital + interés) | **S/ 1,896.96** |
| Monto normal de una cuota de este crédito | S/ 285.59 |
| Efecto si se aplica tal cual | Cubriría ~6 cuotas completas + 1 parcial |
| Riesgo documentado | `R-K2` en `RISKS_AND_BUGS.md` |

**Qué puede haber pasado:** o el socio realmente hizo un prepago grande (pagó
varios meses de una vez, algo normal en algunas cooperativas), o hubo un
error al digitar el monto al importar los datos desde Excel (por ejemplo, un
dígito de más: S/189.69 → S/1,896.96 sería un error clásico de "dígito
extra").

**Recomendación:** verificar contra el recibo físico o el registro original
antes de aplicar. Es el caso de mayor riesgo si se aprueba sin revisar,
porque marcaría 6-7 cuotas como pagadas que tal vez no lo estén.

**Decisión requerida:** Aprobar (aplicar el monto tal cual) / Excluir (dejar
sin aplicar) / Corregir (el monto real es otro, indicar cuál).

---

## Caso 2 — 3 pagos con `match_medio` pendiente

Estos 3 pagos **todavía no tienen crédito asignado** en el sistema (a
diferencia de los 26 anteriores, que sí). Por eso este dry-run ni siquiera
los incluyó en la simulación — están un paso antes.

| # | Pago | Socio | Crédito propuesto | Monto | Motivo de la duda |
|---|---|---|---|---|---|
| 1 | `412****` | `3336****` | `1147****` | S/ 500.00 | Fecha de pago fuera del rango esperado del crédito |
| 2 | `413****` | `3336****` | `1147****` | S/ 150.00 | Fecha de pago fuera del rango esperado del crédito |
| 3 | `422****` | `3344****` | `1159****` | S/ 100.00 | Fecha de pago fuera del rango esperado del crédito; es solo interés |

Origen: Fase 9C-6G. Detalle completo (con las mismas 4 opciones de decisión
que se usan aquí) en `docs/ai-recovery/PAGOS_MATCH_MEDIO_REVIEW.md` y
`exports/data-corrections/revision_pagos_match_medio.xlsx`.

**Por qué importa para 10K-2B:** si Créditos decide que alguno de estos 3
pagos SÍ debe vincularse a un crédito, ese pago pasaría a formar parte del
universo de pagos aplicables a cuotas, y **este dry-run (10K-2A) debería
regenerarse** con el nuevo universo antes de aprobar el apply real.

**Decisión requerida (por cada uno de los 3):** Aprobar vínculo al crédito
propuesto / Excluir (no vincular, dejar sin crédito) / Corregir (indicar cuál
es el crédito real, si existe otro no importado).

---

## Caso 3 — Pago 1145\*\*\*\* sobre crédito cancelado sin cronograma

| Dato | Valor |
|---|---|
| Pago (enmascarado) | vinculado al crédito `1145****` |
| Estado del crédito | Cancelado |
| Cronograma de cuotas de ese crédito | No existe (no se generó al importar, porque el crédito ya estaba cancelado) |
| Efecto | El pago no tiene dónde aplicarse — no hay cuotas contra las cuales aplicarlo |

**Qué puede haber pasado:** el crédito fue cancelado antes de que se
generaran cuotas en el sistema (esto es normal para créditos ya cerrados al
momento de la importación de datos). El pago existe y es real, pero no hay un
"casillero" en el calendario donde marcarlo.

**Recomendación:** si el crédito ya fue liquidado y contabilizado por otra
vía, lo razonable es dejar este pago marcado como "no aplicable
permanentemente" (no bloquea nada, simplemente no se puede vincular a una
cuota que no existe). La alternativa — generar un cronograma retroactivo para
un crédito cancelado — es más compleja y probablemente no vale la pena.

**Decisión requerida:** Aprobar (marcar como "no aplicable permanentemente",
sin generar cronograma) / Excluir (dejarlo pendiente sin decisión, revisar
más adelante) / Corregir (generar cronograma retroactivo para este crédito).

---

## Preguntas exactas para Tesorería/Créditos

**Para Tesorería (pago 411\*\*\*\*):**
1. ¿El recibo físico del pago `411****` confirma un monto de S/1,896.96, o el
   monto real es distinto (por ejemplo, S/189.69)?
2. Si el monto es correcto: ¿corresponde a un prepago intencional de varias
   cuotas por parte del socio?
3. ¿Pueden confirmar 2-3 pagos más al azar (de los 26 aplicables) para
   validar que el campo "monto aplicado a cuota" en el sistema coincide con
   el recibo físico? (riesgo general `R-K`, no bloqueante pero recomendado)

**Para Créditos (3 pagos `match_medio`):**
4. Para los pagos `412****` y `413****` del socio `3336****`: ¿el crédito
   `1147****` es el correcto, a pesar de que la fecha de pago no calza con el
   calendario esperado del crédito?
5. Para el pago `422****` del socio `3344****`: ¿el crédito `1159****` es el
   correcto? ¿Este pago de solo interés corresponde a un período anterior o
   a un adelanto?
6. ¿Alguno de estos 3 socios tiene un crédito anterior que no fue importado a
   la base de datos?

**Para Créditos (crédito cancelado 1145\*\*\*\*):**
7. ¿El crédito `1145****` ya fue liquidado y contabilizado por otra vía? ¿Es
   correcto dejar su pago sin aplicar a ninguna cuota?

---

## Recomendación por cada caso

| Caso | Recomendación |
|---|---|
| Pago 411\*\*\*\* (R-K2) | Verificar contra recibo físico antes de aprobar. No aplicar el monto tal cual sin confirmación de Tesorería. |
| 3 pagos `match_medio` | Resolver primero en `PAGOS_MATCH_MEDIO_REVIEW.md` (proceso ya existente desde Fase 9C-6G). Solo después re-ejecutar el dry-run 10K-2A si algo cambia. |
| Crédito cancelado 1145\*\*\*\* | Marcar como "no aplicable permanentemente" salvo que Créditos indique lo contrario. Bajo riesgo si se deja pendiente — no bloquea otros pagos. |

---

## Decisión requerida: aprobar, excluir o corregir

Para cada uno de los 3 casos, Tesorería/Créditos debe marcar una de estas
tres opciones en la hoja `decisiones_requeridas` del Excel adjunto:

- **Aprobar** — aplicar la propuesta tal cual está descrita.
- **Excluir** — no aplicar este caso; queda pendiente sin tocarse.
- **Corregir** — aplicar con un valor distinto al propuesto (indicar cuál en
  observaciones).

---

## Qué NO se hizo en esta fase

- **NO** se modificó `cronograma_cuotas`.
- **NO** se insertó nada en `pagos_cuotas_aplicaciones` (sigue en 0 filas).
- **NO** se modificó `saldo_capital` ni ningún campo de `creditos`.
- **NO** se tocó `pagos_recibos`, `aportes`, `egresos` ni `socios`.
- **NO** se tocó Anexo 6.
- **NO** se tocó seguridad (RLS, policies, auditoría, usuarios).
- Esta fase **solo generó documentos y un Excel de revisión**.

---

## Archivos de esta fase

- Este documento: `docs/ai-recovery/PAGOS_CUOTAS_10K_2A_REVISION_MANUAL.md`
- Excel de revisión: `exports/pagos-cuotas-dryrun/10k_2a_casos_para_revision_manual.xlsx`
- Script de verificación: `scripts/check-pagos-cuotas-10k2a-revision-manual.mjs`
  (`npm run check:pagos-cuotas-10k2a-revision`)
- Fuente de datos: `docs/ai-recovery/PAGOS_CUOTAS_10K_2A_DRY_RUN_REPORT.md`,
  `docs/ai-recovery/pagos_cuotas_10k2a_dryrun_preview.json`,
  `scripts/dry-run-pagos-cuotas-10k2a.mjs`

## Siguiente paso

Una vez completada la hoja `decisiones_requeridas` por Tesorería/Créditos,
entregar el Excel al equipo técnico. Solo después de tener las 3 decisiones
se debe solicitar la autorización explícita `APLICAR PAGOS A CUOTAS 10K-2`
para diseñar el script de apply real (Fase 10K-2B).

**10K-2B sigue bloqueada hasta entonces.**
