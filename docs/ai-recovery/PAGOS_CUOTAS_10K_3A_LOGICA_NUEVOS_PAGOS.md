# PAGOS_CUOTAS_10K_3A_LOGICA_NUEVOS_PAGOS.md

> Fase 10K-3A — Diseño de lógica para pagos **nuevos** contra cuotas.
> **Modo: SOLO DISEÑO.** Ningún dato fue modificado, ninguna migración fue
> aplicada. Este documento es un plan — requiere aprobación explícita del
> usuario antes de escribir o aplicar cualquier SQL (regla del skill
> `cejuassa-db-plan`).

---

## Objetivo

Diseñar la lógica funcional para que, **desde ahora**, cada pago nuevo que se
registre contra un crédito se aplique correctamente contra las cuotas de su
cronograma: en el orden correcto, con trazabilidad completa, y sin dejar
inconsistencias entre `pagos_recibos`, `cronograma_cuotas` y
`pagos_cuotas_aplicaciones`.

## Decisión de diferir pagos históricos (10K-2B)

El usuario confirmó: **los datos antiguos/importados no son prioridad**. Se
cargarán datos nuevos y el foco es que el sistema funcione bien desde este
punto en adelante.

Por tanto, en esta fase:
- **Fase 10K-2B (apply de los 832 pagos históricos) queda diferida** —no
  cancelada, simplemente no es la prioridad actual.
- Los 3 casos ambiguos históricos (pago `411****`/R-K2, 3 `match_medio`,
  crédito cancelado `1145****`) **no bloquean este diseño** y no se
  revisaron en esta fase.
- El dry-run histórico (`dry-run-pagos-cuotas-10k2a.mjs`) **no se
  re-ejecutó** — sigue vigente como referencia para cuando se retome 10K-2B.
- Todo lo diseñado aquí aplica **solo a pagos que se registren después de
  implementar esta fase**, vía el flujo normal de `pagos/nuevo`.

---

## Flujo actual (auditado en `app/dashboard/pagos/nuevo/page.tsx`)

El registro de un pago hoy ejecuta esta secuencia, **100% en el cliente**
(sin RPC transaccional que agrupe todo el proceso):

1. **INSERT en `pagos_recibos`** con el desglose completo (aporte, capital,
   interés, FPS, FPS extra, otros).
2. **Si `monto_capital > 0`:** RPC `decrementar_saldo_capital(id_credito,
   monto)` — atómica con `FOR UPDATE`. Tiene un *fallback* a un `UPDATE`
   directo solo si la RPC no existe (`42883`/`PGRST202`); cualquier otro
   error de negocio (sobrepago) se propaga.
3. **Si hay crédito vinculado:** busca **una sola cuota** — la más antigua
   en estado `pendiente`, `vencida` o `parcial` — y le suma
   `monto_capital`/`monto_interes` completos a `capital_pagado`/
   `interes_pagado`. Si el resultado cubre `capital` e `interes` de esa
   cuota, la marca `pagada` (con `fecha_pago`); si no, `parcial`.
4. **Si `monto_aporte > 0`:** RPC `registrar_aporte_socio(...)` — atómica
   con advisory lock por socio.

### Qué falta para que afecte cuotas correctamente

| Gap | Detalle | Impacto |
|---|---|---|
| **No hay cascada** | Solo se actualiza **una** cuota, aunque el pago alcance para cubrir varias. El excedente **se pierde silenciosamente** — no se aplica a la siguiente cuota ni se reporta. | Alto — un socio que paga 2-3 meses de una vez solo ve 1 cuota marcada, el resto queda `pendiente` aunque el dinero ya se cobró. |
| **No hay tope por cuota** | `capitalPagadoNuevo`/`interesPagadoNuevo` no se limitan al `capital`/`interes` de la cuota. Si el pago supera lo que falta de esa cuota, los campos quedan **por encima** del monto real de la cuota (ej. `capital_pagado = 500` en una cuota de `capital = 300`). | Alto — mismo origen que el riesgo `R-K2` documentado en 10K-2A: si el monto es mayor al esperado, la cuota queda con datos incoherentes en vez de generar cascada o alerta. |
| **`pagos_cuotas_aplicaciones` no se usa** | La tabla de trazabilidad existe (creada y migrada en Fase 10K-1) pero **el flujo de pago nuevo nunca inserta en ella**. No hay forma de saber, mirando una cuota, qué pago(s) específico(s) la pagaron. | Medio-alto — sin esta tabla, un futuro reporte o auditoría no puede reconstruir el historial de aplicaciones; y 10K-2B (cuando se retome) tendría que reconciliar contra un histórico sin trazabilidad para los pagos nuevos también. |
| **Sin manejo de crédito cancelado / sin cuotas** | Si `credito` existe pero no tiene cuotas pendientes (cronograma agotado o crédito cancelado sin cronograma), el `.maybeSingle()` devuelve `null` y el bloque simplemente no hace nada — sin aviso al usuario. | Medio — el pago queda registrado pero el capital "aplicado" no llegó a ninguna cuota, sin que nadie lo note. |
| **Dos escrituras no atómicas** | El paso 2 (saldo_capital) y el paso 3 (cuota) son dos llamadas separadas desde el cliente. Si la conexión se cae entre ambas, el saldo del crédito baja pero la cuota no se actualiza (o viceversa). | Medio — inconsistencia parcial ya posible hoy, se resolvería con una sola RPC transaccional. |
| **Sin distinción pago histórico vs. nuevo** | No existe ningún campo o bandera que distinga "este pago se registró por el flujo normal (ya aplicado en tiempo real)" de "este pago viene de la importación histórica (pendiente de decisión 10K-2B)". | Bajo pero necesario resolver antes de implementar — ver sección "Qué no se tocará". |

**Conclusión de la auditoría:** el sistema hoy **sí intenta** aplicar el pago
a una cuota, pero de forma parcial e incompleta (sin cascada, sin tope, sin
trazabilidad, sin atomicidad). No es un flujo roto para el caso simple (pago
exacto de una cuota, sin excedente) pero falla silenciosamente en los casos
más comunes de la vida real (pagos que no calzan exacto con la cuota).

---

## Flujo propuesto

Reemplazar los pasos 2 y 3 actuales (y añadir el registro de trazabilidad)
por **una sola llamada RPC transaccional** que reciba el pago ya insertado
(o los datos para insertarlo) y haga todo el trabajo de aplicación en el
servidor, dentro de una transacción con row locks.

```
1. Insertar pagos_recibos (igual que hoy, desde el cliente)
2. Si hay id_credito Y (monto_capital + monto_interes) > 0:
     supabase.rpc('aplicar_pago_a_cuotas', { p_id_pago, p_id_credito, p_created_by })
     → La RPC hace TODO esto en una sola transacción:
        a. Lock del crédito (FOR UPDATE)
        b. Trae las cuotas pendientes/vencidas/parciales ordenadas por
           fecha_vencimiento ASC
        c. Cascada: aplica el monto disponible cuota por cuota
        d. Por cada cuota tocada: UPDATE cronograma_cuotas
           (capital_pagado, interes_pagado, estado, fecha_pago si corresponde)
        e. Por cada cuota tocada: INSERT en pagos_cuotas_aplicaciones
        f. Actualiza saldo_capital del crédito (reemplaza a
           decrementar_saldo_capital, o la RPC la llama internamente)
        g. Si sobra monto después de cubrir todas las cuotas disponibles:
           lo retorna como "excedente" — NO se pierde ni se inventa una cuota
     → Devuelve un resumen (cuotas tocadas, estados finales, excedente)
        para que el frontend lo muestre al usuario (ej. alerta si hay
        excedente sin aplicar)
3. Si monto_aporte > 0: RPC registrar_aporte_socio (sin cambios — ya es correcta)
```

**Por qué reemplazar en vez de extender el flujo actual:** el problema
central (falta de cascada + falta de tope + falta de atomicidad) requiere
"ver todas las cuotas pendientes a la vez" y "escribir todo o nada", que es
exactamente lo que una función de base de datos hace bien y un flujo
cliente-secuencial no puede garantizar.

---

## Reglas de negocio propuestas

1. **Orden de aplicación:** cuotas del crédito en estado `pendiente`,
   `vencida` o `parcial`, ordenadas por `fecha_vencimiento ASC` (la más
   antigua primero). Mismo criterio que el algoritmo de cascada ya validado
   y probado en el dry-run 10K-0/10K-2A — no se reinventa, se reutiliza.
2. **Monto aplicable:** `monto_capital + monto_interes` del pago (excluye
   `monto_aporte`, `monto_fps`, `monto_fps_extra`, `monto_otros` — esos
   siguen su propio camino: aporte vía `registrar_aporte_socio`, FPS/otros
   no tocan cuotas).
3. **Prioridad interés/capital dentro de una cuota:** se aplican
   proporcionalmente al ratio `capital/(capital+interes)` del monto
   disponible cuando el pago no alcanza a cubrir la cuota completa (mismo
   criterio ya usado en el dry-run). Si el pago sí alcanza, se cubre
   exactamente lo que falta de cada componente (sin redondeos que dejen
   residuo).
4. **Pago no cubre la cuota completa:** la cuota queda `parcial`,
   `capital_pagado`/`interes_pagado` se incrementan (nunca se sobreescriben)
   y **no** se toca `fecha_pago`. El monto se agota ahí — no pasa a la
   siguiente cuota.
5. **Pago cubre una cuota y sobra:** la cuota queda `pagada` con
   `fecha_pago = fecha del pago`, y el excedente se aplica en cascada a la
   siguiente cuota pendiente del mismo crédito (repite la regla 4/5 sobre
   ella).
6. **Sobra monto después de cubrir todas las cuotas pendientes:** **no se
   inventa una cuota ni se aplica a un crédito distinto.** La RPC devuelve
   el excedente como dato explícito (`p_excedente` en el resultado) y el
   frontend debe mostrarlo como advertencia visible ("Este pago tiene S/X
   sin aplicar a ninguna cuota — verificar el monto"). No se descarta
   silenciosamente.
7. **Crédito cancelado / sin cuotas pendientes:** si el crédito no tiene
   ninguna cuota en `pendiente`/`vencida`/`parcial` (todas pagadas, o
   cronograma inexistente), la RPC no aplica nada a cuotas y retorna el
   monto completo como excedente con un motivo explícito
   (`'sin_cuotas_pendientes'`). El pago **igual se registra** en
   `pagos_recibos` (eso no cambia) pero el frontend debe alertar que no se
   aplicó a ninguna cuota.
8. **Cuota ya pagada:** nunca se selecciona (el filtro
   `estado IN ('pendiente','vencida','parcial')` la excluye por diseño). No
   es un caso de error, es el comportamiento esperado.
9. **Campos exactos que se actualizan por cuota tocada:**
   `cronograma_cuotas.capital_pagado` (incremento), `interes_pagado`
   (incremento), `estado` (`pagada`/`parcial`), `fecha_pago` (solo si queda
   `pagada`, valor = fecha del pago). Nunca se tocan `capital`, `interes`,
   `cuota_total`, `nro_cuota`, `fecha_vencimiento` — son inmutables una vez
   generado el cronograma.
10. **Estado final de la cuota:** `pagada` si
    `capital_pagado >= capital AND interes_pagado >= interes` (con tolerancia
    de redondeo de 0.01, igual que el dry-run); `parcial` en cualquier otro
    caso donde `capital_pagado > 0 OR interes_pagado > 0`.
11. **Trazabilidad:** cada cuota tocada por este pago genera exactamente una
    fila en `pagos_cuotas_aplicaciones` (id_pago, id_cuota, id_credito,
    capital_aplicado, interes_aplicado, fecha_aplicacion = fecha del pago,
    created_by = usuario que registró el pago).
12. **Pago sin crédito (`id_credito IS NULL`):** la RPC de aplicación **no
    se llama en absoluto**. El pago queda solo en `pagos_recibos` (y en
    `aportes` si corresponde) — comportamiento idéntico al actual, sin
    cambios.
13. **Pago mixto (crédito + aporte/FPS en el mismo recibo):** cada
    componente sigue su propio camino en paralelo — capital/interés a la
    RPC de cuotas, aporte a `registrar_aporte_socio`, FPS/FPS extra/otros no
    generan ninguna escritura adicional (ya es así hoy, no cambia).

---

## Arquitectura recomendada

| Opción | Descripción | Riesgo |
|---|---|---|
| **A. Frontend** (estado actual) | El cliente hace varias llamadas secuenciales (insert pago → update saldo → update cuota). | **Alto.** Sin atomicidad real entre pasos (el fallback del paso 2 ya lo demuestra); requiere reimplementar la cascada completa en TypeScript, duplicando lógica que ya existe en SQL (dry-run); expone la lógica de negocio financiera al bundle del cliente; cualquier error de red a mitad de camino dejar datos a medio aplicar. |
| **B. API route** (`app/api/pagos/aplicar/route.ts`) | Un endpoint Next.js que recibe el pago y ejecuta los mismos pasos, pero desde el servidor. | **Medio.** Mejor que A porque el código no viaja al cliente, pero **sigue sin ser atómico** frente a Postgres: si el servidor Next.js falla entre dos `UPDATE`, la DB queda igual de inconsistente que con el flujo actual. Solo tiene sentido si además usa una transacción explícita vía `postgres-js`/conexión directa, lo cual añade una dependencia nueva no usada hoy en el proyecto (todo pasa por `supabase-js`, que no expone transacciones multi-statement al cliente). |
| **C. RPC transaccional en Supabase** ✅ **Recomendada** | Una función `plpgsql` (`aplicar_pago_a_cuotas`) que hace lock + cascada + updates + inserts de trazabilidad todo dentro de la transacción implícita de la función. | **Bajo.** Es el mismo patrón ya usado y probado en el proyecto para los otros 3 casos críticos: `decrementar_saldo_capital` (R5), `registrar_aporte_socio` (R6), `crear_credito_con_cronograma` (R8). PostgreSQL garantiza todo-o-nada dentro de la función; row lock (`FOR UPDATE`) evita carreras entre pagos simultáneos del mismo crédito. |

**Recomendación: Opción C — RPC transaccional `aplicar_pago_a_cuotas`.**
Consistente con el patrón de diseño que el proyecto ya adoptó para toda
lógica financiera crítica (todas las RPCs existentes documentadas en
`AI_HANDOFF.md` siguen este mismo modelo). Evita introducir una arquitectura
nueva (API routes con transacciones manuales) solo para este caso.

---

## SQL / RPC propuesto (alto nivel — NO aplicar sin aprobación)

> Este es un boceto de diseño, no el SQL final ejecutable. El SQL completo y
> probado se produciría en la fase de implementación (10K-3B) siguiendo el
> formato obligatorio del skill `cejuassa-db-plan` (con riesgos, rollback y
> casos de prueba detallados en ese momento).

```sql
-- Firma propuesta
CREATE OR REPLACE FUNCTION aplicar_pago_a_cuotas(
  p_id_pago      BIGINT,   -- pagos_recibos.id ya insertado
  p_id_credito   BIGINT,
  p_monto_capital NUMERIC,
  p_monto_interes NUMERIC,
  p_fecha        DATE,
  p_created_by   UUID DEFAULT NULL
)
RETURNS JSONB   -- { cuotas_tocadas: [...], excedente: NUMERIC, motivo_excedente: TEXT|NULL }
LANGUAGE plpgsql
AS $$
DECLARE
  v_monto_disponible NUMERIC := p_monto_capital + p_monto_interes;
  v_ratio_capital    NUMERIC;
  v_cuota            RECORD;
  v_capital_faltante NUMERIC;
  v_interes_faltante NUMERIC;
  v_saldo_cuota      NUMERIC;
  v_capital_aplicar  NUMERIC;
  v_interes_aplicar  NUMERIC;
  v_cuotas_tocadas   JSONB := '[]'::JSONB;
BEGIN
  IF v_monto_disponible <= 0 THEN
    RETURN jsonb_build_object('cuotas_tocadas', '[]'::JSONB, 'excedente', 0, 'motivo_excedente', NULL);
  END IF;

  v_ratio_capital := p_monto_capital / v_monto_disponible;

  -- Lock del crédito para evitar carreras entre pagos simultáneos
  PERFORM 1 FROM creditos WHERE id = p_id_credito FOR UPDATE;

  FOR v_cuota IN
    SELECT id, capital, interes, capital_pagado, interes_pagado
      FROM cronograma_cuotas
     WHERE id_credito = p_id_credito
       AND estado IN ('pendiente', 'vencida', 'parcial')
     ORDER BY fecha_vencimiento ASC
     FOR UPDATE
  LOOP
    EXIT WHEN v_monto_disponible <= 0.005;

    v_capital_faltante := v_cuota.capital - COALESCE(v_cuota.capital_pagado, 0);
    v_interes_faltante := v_cuota.interes - COALESCE(v_cuota.interes_pagado, 0);
    v_saldo_cuota      := v_capital_faltante + v_interes_faltante;

    IF v_saldo_cuota <= 0.005 THEN CONTINUE; END IF;

    IF v_monto_disponible >= v_saldo_cuota THEN
      v_capital_aplicar := v_capital_faltante;
      v_interes_aplicar := v_interes_faltante;
      v_monto_disponible := v_monto_disponible - v_saldo_cuota;

      UPDATE cronograma_cuotas
         SET capital_pagado = COALESCE(capital_pagado,0) + v_capital_aplicar,
             interes_pagado = COALESCE(interes_pagado,0) + v_interes_aplicar,
             estado = 'pagada',
             fecha_pago = p_fecha
       WHERE id = v_cuota.id;
    ELSE
      v_capital_aplicar := LEAST(v_monto_disponible * v_ratio_capital, v_capital_faltante);
      v_interes_aplicar := LEAST(v_monto_disponible - v_capital_aplicar, v_interes_faltante);
      v_monto_disponible := 0;

      UPDATE cronograma_cuotas
         SET capital_pagado = COALESCE(capital_pagado,0) + v_capital_aplicar,
             interes_pagado = COALESCE(interes_pagado,0) + v_interes_aplicar,
             estado = 'parcial'
       WHERE id = v_cuota.id;
    END IF;

    INSERT INTO pagos_cuotas_aplicaciones
      (id_pago, id_cuota, id_credito, capital_aplicado, interes_aplicado, fecha_aplicacion, created_by)
    VALUES
      (p_id_pago, v_cuota.id, p_id_credito, v_capital_aplicar, v_interes_aplicar, p_fecha, p_created_by);

    v_cuotas_tocadas := v_cuotas_tocadas || jsonb_build_object(
      'id_cuota', v_cuota.id,
      'capital_aplicado', v_capital_aplicar,
      'interes_aplicado', v_interes_aplicar
    );
  END LOOP;

  -- Actualizar saldo_capital (sustituye la llamada separada a decrementar_saldo_capital)
  IF p_monto_capital > 0 THEN
    PERFORM decrementar_saldo_capital(p_id_credito, p_monto_capital);
  END IF;

  RETURN jsonb_build_object(
    'cuotas_tocadas', v_cuotas_tocadas,
    'excedente', v_monto_disponible,
    'motivo_excedente', CASE WHEN v_monto_disponible > 0.005 THEN 'sin_cuota_pendiente_donde_aplicar' ELSE NULL END
  );
END;
$$;
```

**Notas de diseño pendientes de resolver en 10K-3B (implementación):**
- Definir si `decrementar_saldo_capital` se llama desde dentro de esta RPC
  (como en el boceto) o se mantiene como llamada separada del frontend — la
  opción integrada es más segura (una sola transacción) pero requiere
  revisar el manejo de errores de sobrepago dentro de la función.
- Definir el manejo de errores: ¿la función debe lanzar excepción si
  `p_id_credito` no tiene ningún crédito válido, o simplemente no hacer
  nada? (Recomendado: excepción — consistente con `decrementar_saldo_capital`).
- Decidir si se agrega un flag `origen` (`'pago_nuevo'` vs `'importado'`) en
  `pagos_cuotas_aplicaciones` o `pagos_recibos` para distinguir aplicaciones
  hechas por este flujo nuevo de las que eventualmente se hagan en 10K-2B —
  evita colisiones de trazabilidad cuando ambas fases convivan.

---

## Riesgos

1. **Row lock en cascada sobre múltiples cuotas** — el `FOR UPDATE` dentro
   del loop bloquea fila por fila; si dos pagos del mismo crédito se
   registran casi simultáneamente, el segundo espera hasta que el primero
   termine su transacción. Comportamiento esperado y deseable (evita
   condiciones de carrera), pero puede generar una espera perceptible si
   hay pagos masivos concurrentes sobre el mismo crédito (escenario poco
   común en este proyecto: cooperativa pequeña, sin lotes masivos).
2. **Migración de comportamiento visible al usuario** — hoy el usuario que
   registra un pago que cubre 2 cuotas ve solo 1 cuota actualizada (bug
   actual). Con el nuevo flujo verá 2+ cuotas actualizadas y, si sobra
   dinero, una alerta de excedente. Esto es una mejora, pero el frontend
   debe explicarlo bien para no generar confusión ("¿por qué ahora se
   actualizan más cuotas que antes?").
3. **Excedente sin aplicar requiere decisión operativa** — si un pago no
   alcanza a cubrir ninguna cuota o sobra después de cubrir todas, el
   usuario que registra el pago necesita saber qué hacer (¿es un error de
   monto? ¿el socio realmente prepagó de más?). Esta fase solo diseña que
   el excedente se **reporte**, no qué acción tomar con él — eso queda para
   que el usuario/Tesorería decida caso por caso, igual que en 10K-2A.
4. **Convivencia con 10K-2B diferida** — cuando eventualmente se retome
   10K-2B (apply histórico), los pagos nuevos ya aplicados por esta RPC
   estarán mezclados con los históricos en `pagos_cuotas_aplicaciones`. El
   diseño de 10K-2B deberá filtrar explícitamente los pagos ya aplicados
   (por fecha de creación de la fila, o por el flag `origen` sugerido
   arriba) para no duplicar aplicaciones.
5. **Reutilización del algoritmo de cascada** — el boceto reimplementa en
   SQL la misma lógica ya validada en JavaScript
   (`dry-run-pagos-cuotas-10k2a.mjs`). Existe riesgo de que una diferencia
   sutil entre ambas implementaciones (por ejemplo, en el manejo de
   redondeo) produzca resultados distintos si algún día se comparan. Mitigar
   en 10K-3B con pruebas unitarias que repliquen los mismos escenarios en
   ambos lenguajes.
6. **Dependencia de `decrementar_saldo_capital` dentro de la nueva RPC** — si
   se integra como llamada interna (`PERFORM decrementar_saldo_capital(...)`),
   cualquier cambio futuro a esa función afecta también a
   `aplicar_pago_a_cuotas`. Aceptable porque ambas viven en el mismo dominio
   (pagos de crédito), pero debe documentarse la dependencia.

## Rollback

Como esta fase es **solo diseño**, no hay nada que revertir todavía. Para
cuando se implemente (10K-3B), el rollback de la RPC sería simplemente:

```sql
DROP FUNCTION IF EXISTS aplicar_pago_a_cuotas(BIGINT, BIGINT, NUMERIC, NUMERIC, DATE, UUID);
```

Y revertir el frontend (`pagos/nuevo/page.tsx`) a la versión actual del
paso 2/3 (llamadas directas), que seguiría funcionando igual que hoy porque
no se elimina nada existente, solo se reemplaza qué llama el frontend.

## Plan por fases

| Fase | Contenido | Estado |
|---|---|---|
| **10K-3A** (esta fase) | Diseño de la lógica, arquitectura y reglas de negocio. Documento + matriz + check. | ✅ Completada |
| **10K-3B** | SQL final y probado de `aplicar_pago_a_cuotas` (formato completo del skill `cejuassa-db-plan`: SQL ejecutable, riesgos, rollback exacto, casos de prueba). **Requiere aprobación explícita del usuario antes de aplicar en Supabase.** | Pendiente de autorización |
| **10K-3C** | Refactor de `app/dashboard/pagos/nuevo/page.tsx` para llamar a la nueva RPC en vez de los pasos 2/3 actuales. Incluye UI para mostrar excedente si lo hay. | Pendiente — depende de 10K-3B aplicada |
| **10K-3D** | Pruebas controladas apply+revert sobre un pago de prueba (mismo patrón que se usó para ampliaciones en 10J-1: crear pago de prueba, verificar cuotas/trazabilidad, revertir, confirmar estado limpio). | Pendiente — depende de 10K-3C |
| **10K-2B** (diferida) | Apply real de los 832 pagos históricos, retomando el dry-run ya generado. Se retomará cuando el usuario lo priorice — no bloquea 10K-3B/C/D. | Diferida, no cancelada |

## Qué no se tocará en esta fase

- **NO** se modificó ningún dato en `pagos_recibos`, `cronograma_cuotas`,
  `creditos`, `pagos_cuotas_aplicaciones`, `socios`, `aportes` ni `egresos`.
- **NO** se aplicó ninguna migración ni se creó la función
  `aplicar_pago_a_cuotas` en Supabase — el SQL de esta fase es un boceto de
  diseño, no un script ejecutado.
- **NO** se tocó Anexo 6 (`reportes/anexo6/page.tsx`).
- **NO** se tocó seguridad (RLS, policies, `auditoria`, `usuarios`).
- **NO** se aplicaron los pagos históricos ni se revisaron los 3 casos
  ambiguos de 10K-2A — quedan exactamente donde estaban.
- **NO** se modificó `app/dashboard/pagos/nuevo/page.tsx` — el flujo actual
  sigue funcionando exactamente igual que antes de esta fase.

---

## Archivos de esta fase

- Este documento: `docs/ai-recovery/PAGOS_CUOTAS_10K_3A_LOGICA_NUEVOS_PAGOS.md`
- Matriz: `exports/pagos-cuotas-dryrun/10k_3a_matriz_logica_pagos_nuevos.xlsx`
- Script de verificación: `scripts/check-pagos-cuotas-10k3a-logica.mjs`
  (`npm run check:pagos-cuotas-10k3a`)

## Próximo paso

Para avanzar a la implementación real (10K-3B), el usuario debe aprobar
explícitamente el diseño de este documento (arquitectura RPC + reglas de
negocio) y luego solicitar el SQL final ejecutable siguiendo el formato
obligatorio del skill `cejuassa-db-plan`. **No se aplicará ningún SQL sin esa
aprobación explícita.**
