# PAGOS_CUOTAS_10K_3C_UI_INTEGRATION_REPORT.md

> Fase 10K-3C — Integración de `app/dashboard/pagos/nuevo/page.tsx` con la RPC
> transaccional `registrar_pago_con_aplicacion` (aplicada en Supabase en
> Fase 10K-3B). **Solo cambio de código de aplicación.** No se aplicaron
> migraciones, no se tocó schema de Supabase, no se modificó ningún dato
> histórico.

---

## Flujo viejo eliminado

`app/dashboard/pagos/nuevo/page.tsx` ejecutaba, en el cliente, 3 pasos
secuenciales sin transacción real (riesgo **R-K3**):

1. `INSERT` directo en `pagos_recibos`.
2. RPC `decrementar_saldo_capital` (con *fallback* a `UPDATE` directo si la
   función no existía).
3. Búsqueda de **una sola cuota** (la más antigua pendiente/vencida/parcial)
   y suma de `monto_capital`/`monto_interes` **sin tope** — si el pago
   superaba lo que faltaba de esa cuota, el excedente se perdía
   silenciosamente (no pasaba a la siguiente cuota).

Estos 3 pasos fueron eliminados del frontend. El frontend **ya no**:
- inserta directamente en `pagos_recibos`;
- llama `decrementar_saldo_capital`;
- actualiza manualmente `cronograma_cuotas`;
- inserta directamente en `pagos_cuotas_aplicaciones`.

## Flujo nuevo

El frontend llama una única vez `registrar_pago_con_aplicacion` a través del
helper tipado `lib/pagos/registrarPagoConAplicacion.ts`. Esa RPC (aplicada en
Supabase desde Fase 10K-3B) hace, en una sola transacción de Postgres:

1. Valida entrada + rol del caller (`admin`/`tesoreria`).
2. Inserta `pagos_recibos`.
3. Si hay crédito y `monto_capital + monto_interes > 0`: aplica en cascada
   contra `cronograma_cuotas` (orden `fecha_vencimiento ASC`, tope exacto por
   cuota), inserta trazabilidad en `pagos_cuotas_aplicaciones`, y actualiza
   `saldo_capital` reutilizando `decrementar_saldo_capital`.
4. Devuelve un resumen `jsonb` con cuotas afectadas, excedente y
   advertencias.

## Cómo se llama la RPC

`lib/pagos/registrarPagoConAplicacion.ts` expone:

- `registrarPagoConAplicacion(supabase, payload)` — llama
  `supabase.rpc('registrar_pago_con_aplicacion', { ... })` con los 16
  parámetros exactos de la función SQL, y lanza `RegistrarPagoError` (con
  `codigo` tipado) si Supabase devuelve error.
- `mensajeErrorAmigable(err)` — traduce cada código de negocio
  (`recibo_duplicado`, `credito_cancelado_no_admite_pagos`,
  `credito_no_encontrado`, `monto_credito_sin_credito`, `rol_no_autorizado`,
  `sin_sesion`, etc.) a un mensaje en español para el usuario. Código
  desconocido → se muestra el mensaje crudo de la excepción.

`app/dashboard/pagos/nuevo/page.tsx` — `handleSubmit`:
1. Ejecuta las mismas validaciones de cliente que ya existían (socio, nro
   recibo, fecha, periodo, monto > 0, capital ≤ saldo disponible), más una
   nueva: si `monto_capital > 0` o `monto_interes > 0` pero no hay crédito
   seleccionado, bloquea antes de llamar la RPC (evita el error de servidor
   `monto_credito_sin_credito` con un mensaje más claro en el momento
   correcto).
2. Llama `registrarPagoConAplicacion(...)` dentro de un `try/catch`.
3. Si falla, muestra `mensajeErrorAmigable(err)` en el `InlineAlert` de
   error existente — el formulario permanece intacto, nada se registró
   (la RPC hace rollback completo si cualquier validación falla).
4. Si tiene éxito, guarda el resultado en el estado `resultado` y muestra
   una pantalla de resumen (ver siguiente sección) en vez de redirigir de
   inmediato.

## Cómo se muestran cuotas afectadas / excedente / advertencias

Al tener éxito, la pantalla reemplaza el formulario por un resumen:

- `InlineAlert variant="success"` con el número de pago (`id_pago`).
- Si hubo crédito vinculado: 4 `DataChip` con cuotas afectadas, cuotas
  pagadas, cuotas parciales y monto aplicado al crédito.
- Si `excedente > 0.005`: `InlineAlert variant="warning"` visible con el
  monto exacto sin aplicar y el aviso "verifica el monto ingresado". **No
  bloquea** — el pago ya se registró correctamente, solo se advierte.
- Cualquier otra advertencia devuelta por la RPC (ej. crédito sin cuotas
  pendientes) se muestra igual, cada una en su propio `InlineAlert`. La
  advertencia interna sobre `monto_aporte` (ver siguiente sección) se filtra
  de esta lista porque es un detalle de implementación, no algo que el
  usuario deba resolver.
- Dos acciones: "Registrar otro pago" (limpia el formulario y vuelve a la
  pantalla de captura) o "Ver pagos" (navega al listado, igual que el
  `router.push` que existía antes).

## Manejo de errores por código

`mensajeErrorAmigable` cubre explícitamente:

| Código | Mensaje mostrado al usuario |
|---|---|
| `recibo_duplicado` | "Ya existe un pago registrado con este número de recibo." |
| `credito_cancelado_no_admite_pagos` | "Este crédito está cancelado y no admite pagos nuevos de capital/interés." |
| `credito_no_encontrado` | "El crédito seleccionado no existe." |
| `monto_credito_sin_credito` | "Para registrar capital o interés debes tener un crédito seleccionado." |
| `rol_no_autorizado` | "Tu rol no tiene permiso para registrar pagos." |
| `sin_sesion` | "Tu sesión expiró. Vuelve a iniciar sesión e intenta de nuevo." |
| `nro_recibo_requerido` / `socio_no_encontrado` / `periodo_invalido` / `monto_invalido` | mensajes específicos equivalentes a las validaciones de cliente que ya existían |
| cualquier otro (`desconocido`) | se muestra el mensaje crudo devuelto por Postgres (fallback genérico) |

## Qué pasa con aportes

`monto_aporte` **sigue fuera** de la RPC (decisión ya tomada en 10K-3B, no
modificada en esta fase). El frontend:

1. Llama primero `registrarPagoConAplicacion` (registra el pago y aplica
   cuotas).
2. **Solo si esa llamada tiene éxito**, llama `registrar_aporte_socio` por
   separado — sin cambios respecto al código anterior, usando
   `resultadoPago.id_pago` como `p_id_recibo`.
3. Si el aporte falla después de que el pago ya se registró correctamente,
   se muestra un mensaje explícito: "Pago registrado y aplicado a cuotas
   correctamente, pero hubo un error al registrar el aporte: ...". El
   usuario ve claramente que el pago sí quedó registrado.

**No se duplica ninguna inserción**: la RPC ya no inserta `pagos_recibos` dos
veces (antes lo hacía el frontend directamente; ahora solo la RPC lo hace
una vez) y `registrar_aporte_socio` nunca tocó `pagos_recibos`, solo
`aportes` — sin riesgo de duplicado cruzado.

**Deuda diferida confirmada:** el pago (+ cuotas) y el aporte siguen siendo
dos operaciones no atómicas entre sí. Si la conexión se cae entre ambas
llamadas, el pago y las cuotas quedan aplicados pero el aporte no —
mismo riesgo residual documentado desde 10K-3B, diferido explícitamente a
10K-3D si se decide integrar `registrar_aporte_socio` dentro de la misma
transacción.

## Qué NO se tocó

- Ninguna migración SQL, ninguna tabla, ningún dato histórico.
- `app/dashboard/reportes/anexo6/page.tsx` (Anexo 6).
- Seguridad existente (RLS, policies, `auditoria`, `registrar_auditoria`).
- `AUDIT_ENABLED` sigue en `false` — SEC-4C no se integró.
- La Fase 10K-2B (apply de los 832 pagos históricos) sigue diferida, no se
  ejecutó nada de esa fase.
- Rutas, permisos de rol (`PUEDE_CREAR_PAGOS = ['admin', 'tesoreria']`, sin
  cambios) y diseño visual general de la pantalla — solo el estado de éxito
  cambió de "redirección inmediata" a "pantalla de resumen con dos botones".
- `registrar_aporte_socio` — sin cambios, se sigue llamando igual que antes.

## Riesgos residuales

1. **Aporte no atómico con el pago** (ver sección anterior) — riesgo ya
   conocido desde 10K-3B, no agravado ni resuelto en esta fase.
2. **Cambio de comportamiento visible**: un pago que cubre 2+ cuotas ahora
   muestra varias cuotas afectadas en el resumen (antes solo se veía 1 cuota
   marcada y el resto quedaba silenciosamente sin actualizar). Es la mejora
   esperada, pero Tesorería debe saber que este es el comportamiento nuevo
   correcto, no un error.
3. **Pantalla de resumen en vez de redirección automática**: cambia el flujo
   de UX (antes: submit → redirect inmediato a `/dashboard/pagos`; ahora:
   submit → pantalla de resumen → el usuario decide "Registrar otro pago" o
   "Ver pagos"). Necesario para cumplir el requisito de mostrar
   excedente/advertencias de forma visible, no bloqueante.
4. **Validación de crédito cancelado en cliente**: el `useEffect` que busca
   el crédito del socio filtra por `estado = 'vigente'`, por lo que en el
   flujo normal el frontend nunca debería enviar un crédito cancelado. El
   código `credito_cancelado_no_admite_pagos` de la RPC queda como red de
   seguridad para casos no cubiertos por ese filtro (p. ej. datos
   desincronizados en el momento del submit).

## Escenarios de prueba manual (recomendados, no ejecutados contra datos reales)

| # | Escenario | Verificación esperada en la UI |
|---|---|---|
| 1 | Pago exacto de una cuota | Resumen: 1 cuota afectada, 1 pagada, 0 parciales, excedente 0 |
| 2 | Pago parcial (menor a la cuota) | Resumen: 1 cuota afectada, 0 pagadas, 1 parcial |
| 3 | Pago que cubre varias cuotas | Resumen: N cuotas afectadas en cascada |
| 4 | Pago con sobrante tras cubrir todas las cuotas | Alerta amarilla de excedente visible, no bloquea |
| 5 | Pago sin crédito (solo aporte/FPS) | Resumen sin chips de cuotas, sin advertencia de excedente |
| 6 | Intento de pago con capital/interés y crédito cancelado | Mensaje "Este crédito está cancelado y no admite pagos nuevos..." |
| 7 | `nro_recibo` duplicado | Mensaje "Ya existe un pago registrado con este número de recibo." |
| 8 | Capital/interés > 0 sin crédito seleccionado | Bloqueado en cliente antes de llamar la RPC (mensaje de validación) |
| 9 | Pago mixto (crédito + aporte) exitoso | Resumen de cuotas + aporte registrado sin error adicional |
| 10 | Pago exitoso pero aporte falla | Resumen NO se muestra; error explícito indicando que el pago sí quedó registrado |

No se registraron pagos reales contra Supabase remoto en esta fase — la
verificación se limitó a `tsc --noEmit`, `next build` y los checks
automatizados (ver sección de checks).

## Archivos modificados

- `lib/pagos/registrarPagoConAplicacion.ts` — **nuevo**. Helper tipado:
  payload, resultado, códigos de error, `registrarPagoConAplicacion()`,
  `mensajeErrorAmigable()`.
- `app/dashboard/pagos/nuevo/page.tsx` — refactor del flujo de submit
  (elimina los 3 pasos viejos, llama la RPC + aporte por separado, agrega
  estado `resultado` y pantalla de resumen), elimina `useRouter` (ya no se
  usa `router.push` directo — la navegación queda en el botón "Ver pagos").
- `scripts/check-pagos-cuotas-10k3c-ui.mjs` — **nuevo**. Verificación
  estática de que el flujo viejo fue eliminado y el nuevo está integrado.
- `docs/ai-recovery/PAGOS_CUOTAS_10K_3C_UI_INTEGRATION_REPORT.md` — este
  documento.

## Confirmación — datos históricos

**No se modificó ningún dato en Supabase.** Esta fase es 100% cambio de
código de aplicación (frontend + un archivo helper nuevo). No se ejecutó
ninguna migración, no se llamó la RPC contra datos reales, no se tocó
`pagos_recibos`, `cronograma_cuotas`, `creditos` ni
`pagos_cuotas_aplicaciones` fuera de lo que ocurra cuando un usuario real
registre un pago nuevo desde ahora en adelante.
