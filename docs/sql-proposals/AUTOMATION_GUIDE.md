# Guía de Automatización — Migraciones y Pruebas RPC

> Flujo recomendado para aplicar cambios de base de datos de forma segura en CEJUASSA.

---

## Estado actual (2026-06-17)

| Item | Estado |
|------|--------|
| Supabase CLI | **Disponible via `npx supabase`** (v2.107.0) |
| Proyecto linkeado | `ljdjbhsipgkxlgnprzhm` — `Finished supabase link.` ✅ |
| Carpeta `supabase/` | Creada — historial alineado con remote (Fase 4D-2 ✅) |
| Migraciones locales | 4 archivos — historial sincronizado (ver tabla abajo) |
| RPC A `decrementar_saldo_capital` | **Aplicada** en Supabase (R5 ✅) |
| RPC B `registrar_aporte_socio` | **Aplicada** en Supabase (R6 ✅) |
| RPC C `crear_credito_con_cronograma` | **Aplicada** en Supabase (Fase 4B-4C ✅) — R8 pendiente de refactor frontend |

### Estado de migraciones (actualizado 2026-06-17)

| Local | Remote | Descripción |
|-------|--------|-------------|
| `20260605112510` | `20260605112510` | Placeholder — migración remota preexistente al CLI |
| `20260617000000` | `20260617000000` | RPC A — `decrementar_saldo_capital` |
| `20260617000001` | `20260617000001` | RPC B — `registrar_aporte_socio` |
| `20260617000002` | `20260617000002` | RPC C — `crear_credito_con_cronograma` |

**Historial completamente sincronizado.** No hay migraciones pendientes.

---

## Opción A — Sin CLI (método actual): Supabase Dashboard

Este es el método que se ha usado hasta ahora y funciona bien para RPCs individuales.

### Cómo aplicar una migración manualmente

1. Abrir Supabase Dashboard → proyecto `ljdjbhsipgkxlgnprzhm`
2. Ir a **SQL Editor**
3. Copiar el contenido del archivo de migración de `supabase/migrations/`
4. Pegar y ejecutar
5. Verificar con el script de prueba correspondiente de `docs/sql-proposals/tests/`

### Para aplicar RPC B (próximo paso)

```
Archivo a copiar: supabase/migrations/20260617000001_create_registrar_aporte_socio.sql
Script de prueba: docs/sql-proposals/tests/test_rpc_b_registrar_aporte_socio.sql
```

---

## Opción B — Con Supabase CLI (flujo futuro recomendado)

### Instalación de Supabase CLI (Windows)

```cmd
# CLI disponible sin instalación global via npx (v2.107.0 confirmado)
npx supabase --version

# Login (una sola vez por máquina — abre el navegador)
npx supabase login

# Linkear el proyecto (una sola vez por directorio)
npx supabase link --project-ref ljdjbhsipgkxlgnprzhm
```

> ✅ CLI ya está linkeado en `C:\Users\Kevin\coopac-cejuassa` desde 2026-06-17.

### Ver estado de migraciones

```cmd
npx supabase migration list
# Muestra qué migraciones están en Local vs Remote
# No requiere Docker

npm run db:status
# Equivale a: supabase db diff --linked
# REQUIERE Docker Desktop — no usar sin Docker instalado
```

### Aplicar migraciones (con confirmación manual)

```bash
# NUNCA ejecutar esto automáticamente en un script CI sin revisión previa
# Ver qué se va a aplicar antes de hacerlo:
supabase db diff --linked

# Aplicar (pide confirmación implícita al ejecutar):
npm run db:push
# Equivale a: supabase db push

# IMPORTANTE: verificar que el diff solo incluye lo que se espera
# antes de ejecutar db:push
```

---

## Estructura de archivos de migración

```
supabase/
  migrations/
    20260617000000_create_decrementar_saldo_capital.sql   ← RPC A (ya aplicada, registro histórico)
    20260617000001_create_registrar_aporte_socio.sql      ← RPC B (pendiente)
    [futura] 20260617000002_create_crear_credito_con_cronograma.sql  ← RPC C
```

El prefijo de timestamp (`YYYYMMDDHHMMSS`) define el orden de aplicación.
Las RPCs usan `CREATE OR REPLACE FUNCTION` — son idempotentes (aplicar dos veces no rompe nada).

---

## Scripts de prueba SQL

Ubicados en `docs/sql-proposals/tests/`:

| Archivo | RPC | Cuándo ejecutar |
|---------|-----|-----------------|
| `test_rpc_b_registrar_aporte_socio.sql` | RPC B | Después de aplicar la migración 000001 |

Instrucciones para ejecutar:
1. Abrir el archivo y reemplazar los placeholders `ID_SOCIO_AQUI`, `ID_RECIBO_AQUI` con IDs reales del entorno de prueba
2. Copiar cada bloque al SQL Editor de Supabase Dashboard
3. Ejecutar bloque por bloque
4. Verificar que los resultados coinciden con los comentarios `-- Esperado:`
5. Ejecutar el bloque CLEANUP al final para no dejar datos de prueba

---

## Qué NO automatizar

| Acción | Por qué no automatizar |
|--------|------------------------|
| `supabase db push` en CI/CD | Modifica datos financieros reales — requiere revisión humana siempre |
| Aplicar migraciones en pre-commit hook | Riesgo de aplicar SQL no revisado en producción |
| Tests de RPC contra DB de producción | Usar DB de staging o datos de prueba aislados |
| Rollback automático | El rollback de aportes implicaría borrar registros financieros |

---

## Cuándo usar Supabase MCP

El MCP de Supabase (`mcp__3b3fd7db...`) permite inspeccionar deployments y proyectos, pero **no debe usarse para ejecutar SQL directamente en producción**.

Uso seguro del MCP:
- Verificar estado de deployments
- Revisar logs de runtime
- Consultar documentación de Supabase

No usar para:
- Aplicar migraciones
- Ejecutar SQL financiero
- Modificar datos de aportes, créditos o pagos

---

## Flujo completo recomendado para cada RPC nueva

```
1. Propuesta revisada → guardada en docs/sql-proposals/
2. Migración creada → supabase/migrations/TIMESTAMP_nombre.sql
3. Script de prueba → docs/sql-proposals/tests/test_rpc_X.sql
4. Usuario revisa el SQL en el archivo local
5. Usuario copia y aplica en Supabase Dashboard → SQL Editor
6. Usuario ejecuta script de prueba
7. Si OK → refactorizar frontend (si aplica)
8. npm run verify:cejuassa
9. Prueba desde la app
10. Marcar riesgo como resuelto en docs/ai-recovery/
```
