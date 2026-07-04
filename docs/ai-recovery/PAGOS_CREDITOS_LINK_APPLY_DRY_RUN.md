# PAGOS_CREDITOS_LINK_APPLY_DRY_RUN.md

**Fase:** 9C-6F — Apply controlado link pagos → créditos
**Modo:** DRY-RUN (SOLO LECTURA — ningún dato fue modificado)
**Generado:** 2026-06-22T19:34:57.633Z

## Resultado del preflight

| Check | Resultado |
|---|---|
| Preview JSON existe | ✅ |
| match_alto en preview | 28 ✅ |
| match_alto en DB | 28 ✅ |
| Conteos DB = preview | ✅ |
| Todos los pagos tienen id_credito = NULL | ✅ |
| Todos los créditos propuestos existen | ✅ |
| Set de apply = solo match_alto | ✅ |

## Plan de apply

- **Tabla afectada:** `pagos_recibos`
- **Campo a actualizar:** `id_credito`
- **Filas a actualizar:** 28
- **Categoría:** `match_alto` únicamente

## Tablas NO modificadas (confirmado)

- `cronograma_cuotas` — NO modificada
- `creditos` — NO modificada
- `socios` — NO modificada
- `usuarios` — NO modificada
- `configuracion` — NO modificada
- `auth.users` — NO modificada

## Muestra enmascarada (10 de 28)

| pago_masked | socio_masked | fecha | grupo | credito_masked | razon |
|---|---|---|---|---|---|
| 411**** | 3335**** | 2026-03-04 | E | 1138**** | socio + único crédito en rango fecha (vigente) |
| 438**** | 3357**** | 2026-03-25 | D | 1157**** | socio + único crédito en rango fecha (vigente) |
| 440**** | 3359**** | 2026-03-25 | D | 1158**** | socio + único crédito en rango fecha (vigente) |
| 441**** | 3360**** | 2026-03-25 | D | 1156**** | socio + único crédito en rango fecha (vigente) |
| 443**** | 3361**** | 2026-03-25 | D | 1137**** | socio + único crédito en rango fecha (vigente) |
| 472**** | 3389**** | 2026-03-25 | D | 1150**** | socio + único crédito en rango fecha (vigente) |
| 508**** | 3425**** | 2026-03-25 | D | 1153**** | socio + único crédito en rango fecha (vigente) |
| 555**** | 3470**** | 2026-03-25 | D | 1134**** | socio + único crédito en rango fecha (vigente) |
| 571**** | 3485**** | 2026-03-25 | D | 1151**** | socio + único crédito en rango fecha (vigente) |
| 676**** | 3581**** | 2026-03-26 | D | 1139**** | socio + único crédito en rango fecha (vigente) |

## Conteos de pagos sin modificar

| Categoría | Cantidad |
|---|---|
| match_medio (NO aplicados) | 3 |
| ambiguo (NO aplicados) | 0 |
| no_aplica_credito (NO aplicados) | 417 |
| sin_match (NO aplicados) | 384 |

## Riesgos

- Los 3 match_medio requieren revisión manual antes de aplicar en una fase posterior.
- Los 0 ambiguos requieren revisión manual del área de Créditos.
- Esta fase NO recalcula saldos, cuotas ni estados — eso es responsabilidad de fases posteriores.

## Autorización requerida

Para ejecutar el apply, enviar exactamente:

```
VINCULAR 28 PAGOS 9C-6F
```

Luego ejecutar:
```bash
npm run pagos:link-creditos:apply
```