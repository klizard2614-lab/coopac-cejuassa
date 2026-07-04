# Skill: cejuassa-db-plan

Activa este skill para cualquier cambio en Supabase: nuevas tablas, columnas, RPC, triggers, políticas RLS o funciones SQL.

## Modo autónomo controlado

1. Leer `docs/ai-recovery/DATABASE_AND_AUTH.md` antes de proponer cualquier SQL.
2. Producir el plan completo en el formato obligatorio de abajo.
3. **NUNCA aplicar SQL sin aprobación explícita del usuario** — este skill solo genera el plan.
4. No imprimir tablas completas de la base de datos — solo los campos relevantes al cambio.
5. Terminar con una línea que indique qué debe aprobar el usuario antes de continuar.

## Hard stop absoluto

**NUNCA ejecutar SQL directamente.** Este skill es solo planificación.
El usuario decide si y cuándo aplicarlo en Supabase Dashboard.

## Cuándo activarlo
- Agregar o modificar tablas o columnas.
- Crear funciones RPC (ej. `decrementar_saldo_capital`).
- Crear triggers (ej. para atomizar inserts de aportes).
- Configurar o modificar políticas RLS.
- Crear índices.

## Formato de entrega obligatorio

### Objetivo
Una línea describiendo qué se quiere lograr y por qué.

### Tablas afectadas
Lista de tablas que se leen o modifican, con el tipo de operación (INSERT, UPDATE, SELECT, CREATE, ALTER).

### SQL propuesto
Bloque SQL completo y ejecutable.
Si son varios pasos, numerarlos y explicar el orden.

### Riesgos
- ¿Puede fallar silenciosamente?
- ¿Afecta datos existentes?
- ¿Es compatible con el código actual?
- ¿Requiere downtime?

### Rollback
SQL exacto para deshacer el cambio si algo sale mal.
Si el rollback implica pérdida de datos, indicarlo explícitamente.

### Casos de prueba
Lista de verificaciones manuales a hacer después de aplicar:
- Qué consultar.
- Qué resultado esperar.
- Qué módulo de la app probar.

### Acción requerida del usuario
Indicar exactamente qué debe aprobar el usuario antes de que se pueda continuar.

## Contexto del proyecto
- Proyecto Supabase: `ljdjbhsipgkxlgnprzhm`
- Las funciones RPC se llaman desde el cliente con `supabase.rpc('nombre_funcion', { param })`
- Los triggers no existen actualmente — toda la lógica vive en el frontend
- Ver `docs/ai-recovery/DATABASE_AND_AUTH.md` para el esquema completo de tablas
