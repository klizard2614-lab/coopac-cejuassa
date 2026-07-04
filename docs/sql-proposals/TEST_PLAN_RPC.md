# Plan de Pruebas — RPC Atómicas

> Verificaciones a realizar DESPUÉS de aplicar cada RPC en Supabase.
> Ejecutar desde Supabase Dashboard → SQL Editor o desde la app según corresponda.

---

## RPC A — `decrementar_saldo_capital`

### Antes de aplicar: verificación de fallback (CRÍTICO)

El frontend `pagos/nuevo/page.tsx` tiene un fallback que se activa con **cualquier** error de la RPC (líneas 251-267):

```typescript
if (saldoErr) {
  // fallback: lee saldo y hace update directo con Math.max(0, ...)
}
```

**Problema**: cuando RPC A está activa y lanza un error de negocio (`P0001`), el fallback ejecuta igualmente el UPDATE directo con `Math.max(0, saldo - monto)` — los errores de sobrepago o monto inválido quedan silenciados y el saldo se actualiza incorrectamente.

**Fix requerido (Fase 4B-1)**: cambiar el fallback para que solo ejecute si el código de error es `42883` (función no encontrada):

```typescript
if (saldoErr) {
  if (saldoErr.code !== '42883') {
    // Error de negocio de la RPC — propagar al usuario
    setError(`Error al actualizar saldo: ${saldoErr.message}`)
    setLoading(false)
    return
  }
  // Solo aquí ejecutar el fallback directo (función no existe)
  // ...
}
```

Este fix debe aplicarse y verificarse ANTES de desplegar RPC A.

### Pruebas SQL (post-aplicación en Supabase)

**Caso 1 — Decremento válido**
```sql
-- Preparar: asegurarse de que existe un crédito con id=1 y saldo_capital=1000
SELECT id, saldo_capital FROM creditos WHERE id = 1;

-- Ejecutar RPC
SELECT decrementar_saldo_capital(1, 500);
-- Esperado: devuelve 500

-- Verificar
SELECT saldo_capital FROM creditos WHERE id = 1;
-- Esperado: 500
```

**Caso 2 — Monto inválido (debe lanzar error, NO actualizar)**
```sql
SELECT decrementar_saldo_capital(1, 0);
-- Esperado: ERROR: monto_invalido: ...

SELECT decrementar_saldo_capital(1, -100);
-- Esperado: ERROR: monto_invalido: ...
```

**Caso 3 — Sobrepago (debe lanzar error, NO actualizar)**
```sql
-- Si saldo_capital es 500 y se intenta pagar 600:
SELECT decrementar_saldo_capital(1, 600);
-- Esperado: ERROR: sobrepago: ...

-- Verificar que el saldo NO cambió
SELECT saldo_capital FROM creditos WHERE id = 1;
-- Esperado: 500 (sin cambio)
```

**Caso 4 — Crédito no encontrado**
```sql
SELECT decrementar_saldo_capital(999999, 100);
-- Esperado: ERROR: credito_no_encontrado: ...
```

### Prueba desde la app

1. Abrir `/dashboard/pagos/nuevo`
2. Seleccionar un socio con crédito vigente
3. Ingresar `monto_capital` válido (menor que el saldo)
4. Registrar el pago
5. Verificar en Supabase que `saldo_capital` del crédito disminuyó exactamente en el monto pagado
6. Intentar pagar más del saldo disponible — verificar que el error se muestra al usuario

---

## RPC B — `registrar_aporte_socio`

### Pruebas SQL

**Caso 1 — Primer aporte del socio (sin historial)**
```sql
-- Verificar que no hay aportes previos para el socio (ej. id_socio=99)
SELECT COUNT(*) FROM aportes WHERE id_socio = 99;
-- Esperado: 0

SELECT registrar_aporte_socio(99, 1, CURRENT_DATE, 100, NULL);
-- Esperado: devuelve el id del nuevo registro

SELECT saldo_anterior, saldo_nuevo FROM aportes WHERE id_socio = 99 ORDER BY id DESC LIMIT 1;
-- Esperado: saldo_anterior=0, saldo_nuevo=100
```

**Caso 2 — Segundo aporte (acumulativo)**
```sql
SELECT registrar_aporte_socio(99, 2, CURRENT_DATE, 50, 'segundo aporte');
-- Esperado: devuelve el id del nuevo registro

SELECT saldo_anterior, saldo_nuevo FROM aportes WHERE id_socio = 99 ORDER BY id DESC LIMIT 1;
-- Esperado: saldo_anterior=100, saldo_nuevo=150
```

**Caso 3 — Monto inválido**
```sql
SELECT registrar_aporte_socio(99, 3, CURRENT_DATE, 0, NULL);
-- Esperado: ERROR: monto_invalido: ...

SELECT registrar_aporte_socio(99, 3, CURRENT_DATE, -50, NULL);
-- Esperado: ERROR: monto_invalido: ...
```

### Prueba automatizada (Fase 4B-3T ✅)

```bash
npm run test:rpc:b                         # T1+T2: valida monto=0 y monto<0 (sin datos)
npm run test:rpc:b -- --run-happy          # + T3: happy path con datos reales (S/1)
npm run test:rpc:b -- --run-happy --cleanup  # + limpia aportes TEST_RPC_B_AUTO
```

### Prueba desde la app (post integración en Fase 4B-3)

1. Abrir `/dashboard/pagos/nuevo`
2. Seleccionar socio
3. Ingresar `monto_aporte > 0`
4. Registrar el pago
5. Verificar en `/dashboard/aportes` que el saldo acumulado es correcto

---

## RPC C — `crear_credito_con_cronograma`

### Prueba automatizada (Fase 4B-4D ✅)

```bash
npm run test:rpc:c                         # T1+T2+T3+T4: L1 sin datos — 5/5 PASS
npm run test:rpc:c:happy                   # T5: happy path (requiere CEJUASSA_ALLOW_TEST_WRITES=true)
npm run test:rpc:c:happy -- --cleanup      # + limpia cronograma_cuotas → creditos → socios TEST
```

> ✅ Hotfix aplicado (Fase 4B-4D.1): migración `20260617000003` corrige el cast ENUM. T3 ahora falla por FK real (correcto). L2 happy path disponible con `CEJUASSA_ALLOW_TEST_WRITES=true`.

### Pruebas SQL

**Caso 1 — Crédito válido con cronograma**
```sql
SELECT crear_credito_con_cronograma(
  '{
    "id_socio": 1,
    "nro_pagare": "TEST-001",
    "fecha_desembolso": "2026-06-17",
    "monto_aprobado": 1000,
    "monto_girado_neto": 1000,
    "tasa_interes": 24,
    "plazo_meses": 3,
    "cuota_mensual": 350,
    "tipo_credito": "consumo",
    "interes_acumulado": 0
  }'::JSONB,
  '[
    {"nro_cuota":1,"fecha_vencimiento":"2026-07-17","capital":316.67,"interes":20,"cuota_total":336.67,"estado":"pendiente"},
    {"nro_cuota":2,"fecha_vencimiento":"2026-08-17","capital":323.01,"interes":13.33,"cuota_total":336.34,"estado":"pendiente"},
    {"nro_cuota":3,"fecha_vencimiento":"2026-09-17","capital":329.49,"interes":6.67,"cuota_total":336.16,"estado":"pendiente"}
  ]'::JSONB
);
-- Esperado: devuelve el id del crédito creado

-- Verificar
SELECT id, nro_pagare, saldo_capital FROM creditos WHERE nro_pagare = 'TEST-001';
SELECT id_credito, nro_cuota, estado FROM cronograma_cuotas WHERE id_credito = <id_retornado>;
-- Esperado: 3 cuotas con estado 'pendiente'
```

**Caso 2 — Cuotas con longitud incorrecta**
```sql
SELECT crear_credito_con_cronograma(
  '{"id_socio":1,"nro_pagare":"TEST-002","fecha_desembolso":"2026-06-17","monto_aprobado":1000,"monto_girado_neto":1000,"tasa_interes":24,"plazo_meses":3,"cuota_mensual":350,"tipo_credito":"consumo","interes_acumulado":0}'::JSONB,
  '[{"nro_cuota":1,"fecha_vencimiento":"2026-07-17","capital":500,"interes":20,"cuota_total":520,"estado":"pendiente"}]'::JSONB
);
-- Esperado: ERROR: longitud_cuotas_incorrecta: se esperaban 3 cuotas, se recibieron 1
-- Verificar que no se creó el crédito TEST-002
SELECT COUNT(*) FROM creditos WHERE nro_pagare = 'TEST-002';
-- Esperado: 0 (rollback automático)
```

**Caso 3 — p_cuotas no es array**
```sql
SELECT crear_credito_con_cronograma(
  '{"id_socio":1,"nro_pagare":"TEST-003","plazo_meses":2}'::JSONB,
  '{"error":"no soy array"}'::JSONB
);
-- Esperado: ERROR: cuotas_no_es_array: ...
```

### Prueba desde la app (post integración en Fase 4B-4)

1. Abrir `/dashboard/creditos/nuevo`
2. Completar el formulario con datos válidos
3. Enviar
4. Verificar que el crédito aparece en la lista con su cronograma completo
5. Abrir el crédito y verificar que las cuotas son las correctas
6. Simular un fallo: conectar con bad payload y verificar que no queda crédito sin cuotas

---

## Limpieza de datos de prueba

```sql
-- Limpiar después de las pruebas SQL manuales
DELETE FROM cronograma_cuotas WHERE id_credito IN (
  SELECT id FROM creditos WHERE nro_pagare LIKE 'TEST-%'
);
DELETE FROM creditos WHERE nro_pagare LIKE 'TEST-%';
DELETE FROM aportes WHERE id_socio = 99 AND observacion IN ('segundo aporte', NULL);
```
