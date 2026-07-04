# Skill: cejuassa-risk-review

Activa este skill para revisar seguridad, roles, lógica financiera o reportes regulatorios antes de implementar.

## Modo autónomo controlado

1. Leer solo los archivos mínimos necesarios para el análisis.
2. Producir el reporte en el formato obligatorio de abajo.
3. No implementar nada — este skill es solo análisis.
4. No imprimir archivos completos ni logs.
5. Terminar con una recomendación clara: proceder / proceder con cautela / bloquear.

## Hard stops — siempre bloquear si

- El cambio toca `SUPABASE_SERVICE_ROLE_KEY` sin justificación explícita.
- El cambio modifica lógica de cálculo de cuotas, intereses o provisiones SBS.
- El cambio elimina o altera guards de rol existentes.
- El cambio introduce operaciones no atómicas en tablas financieras sin plan de compensación.

## Cuándo activarlo
- Cambios en pagos (`pagos/nuevo`, `pagos_recibos`)
- Cambios en créditos (`creditos/nuevo`, `creditos/[id]/editar`, `cronograma_cuotas`)
- Cambios en aportes o saldo de socios
- Cambios en reportes SBS (Anexo N°6)
- Cambios en roles o guards de usuario
- Cualquier uso de `SUPABASE_SERVICE_ROLE_KEY`
- Nuevas API routes (`app/api/`)

## Formato de respuesta obligatorio

### Riesgos identificados
Listar cada riesgo con:
- Descripción del riesgo
- Probabilidad: alta / media / baja
- Impacto si ocurre

### Archivos involucrados
Listar cada archivo que se lee o modifica, con el motivo.

### Impacto en datos
- ¿Qué tablas de Supabase se afectan?
- ¿Hay riesgo de inconsistencia entre tablas?
- ¿La operación es atómica o de múltiples pasos?

### Plan de rollback
Describir cómo deshacer el cambio si falla en producción.
Si no hay rollback posible, indicarlo explícitamente.

### Verificación necesaria
- Casos de prueba a ejecutar manualmente.
- Datos a verificar en Supabase Dashboard.
- Módulos que podrían verse afectados indirectamente.

### Recomendación final
`PROCEDER` / `PROCEDER CON CAUTELA` / `BLOQUEAR` — con una línea de justificación.

## Riesgos ya conocidos (referencia rápida)
Ver `docs/ai-recovery/RISKS_AND_BUGS.md` para el listado completo.
Los más críticos son R5, R6 (race conditions en pagos) y R8 (crédito sin cronograma si falla el bulk insert).
