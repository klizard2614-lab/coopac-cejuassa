# COMMANDS_AND_SETUP.md

> Comandos y configuración del entorno. Confirmado en `package.json`.

## Comandos disponibles

```bash
npm run dev      # Servidor de desarrollo en http://localhost:3000
npm run build    # Build de producción (Next.js)
npm run start    # Servidor de producción (requiere build previo)
npm run lint     # ESLint con eslint.config.mjs
```

## Verificación completa (lint + typecheck + build)

```bash
npm run verify:cejuassa    # Script en scripts/verify-cejuassa.mjs
                           # lint: no bloqueante (errores preexistentes)
                           # tsc + build: bloqueantes
```

## Pruebas automáticas de RPC

```bash
# RPC B — registrar_aporte_socio
npm run test:rpc:b                         # L1: sin datos, siempre seguro
npm run test:rpc:b:happy                   # L2: happy path (requiere CEJUASSA_ALLOW_TEST_WRITES=true)
npm run test:rpc:b:happy -- --cleanup      # L2 + cleanup datos TEST
npm run test:rpc:b:auth                    # L3: auth/RLS real (requiere credenciales test)

# RPC C — crear_credito_con_cronograma
npm run test:rpc:c                         # L1: sin datos, siempre seguro (5 tests)
npm run test:rpc:c:happy                   # L2: happy path (requiere CEJUASSA_ALLOW_TEST_WRITES=true)
npm run test:rpc:c:happy -- --cleanup      # L2 + cleanup: cuotas → créditos → socio TEST
npm run test:rpc:c:auth                    # L3: auth/RLS real (requiere credenciales test)

# Configuración — Tasas de provisión
npm run test:provision:config              # L1: verifica 5 campos en configuracion (id=1) — 15/15 PASS
```
> RPC C: migraciones `000002`–`000004` aplicadas. L1 = 5/5 PASS. L2 = 13/13 PASS (validado + cleanup). `creditos/nuevo` usa RPC — R8 resuelto.

## Verificación B3 — Provisiones Constituidas

```bash
npm run check:provision:constituida    # 10 checks: campo propio, placeholder explícito, advertencia en UI,
                                       # confirmación antes de Excel, export Excel usa provision_constituida
                                       # 10/10 PASS (Fase 6A.1, 2026-06-18)
```

## Auditoría de seguridad

```bash
npm run audit:service-role    # Verifica que SUPABASE_SERVICE_ROLE_KEY esté confinado a server-side
                              # OK = key solo en lib/api/ y scripts/ locales
                              # WARNING + exit 1 = key detectada en zonas no permitidas (frontend, dashboard)
```

Variables opcionales de prueba (agregar a .env.local, nunca a producción):
```
CEJUASSA_ALLOW_TEST_WRITES=true   # habilita escritura de datos TEST en DB
CEJUASSA_TEST_EMAIL=              # usuario de Supabase Auth para test de RLS
CEJUASSA_TEST_PASSWORD=           # contraseña del usuario test
```

Nota: service role (Nivel 1 y 2) bypa RLS — no valida permisos de usuario real.
El Nivel 3 es el único que valida que la RPC sea accesible para usuarios autenticados.

## Migraciones de base de datos (Supabase CLI via npx)

```cmd
npx supabase migration list        # ver estado local vs remote — NO requiere Docker
npx supabase db push --dry-run     # previsualizar qué se aplicaría — NO requiere Docker
npx supabase db push               # aplicar migraciones pendientes (REVISAR ANTES)

npm run db:status  # supabase db diff --linked — REQUIERE Docker Desktop
npm run db:push    # supabase db push — aplica migraciones al remoto (REVISAR ANTES)
```

> CLI configurado: `npx supabase` v2.107.0 — proyecto `ljdjbhsipgkxlgnprzhm` linkeado (2026-06-17).
> Historial alineado (Fase 4D-2). Solo `20260617000001` (RPC B) está pendiente.
> Ver `docs/sql-proposals/AUTOMATION_GUIDE.md` para el flujo completo.

## Comandos NO definidos (requieren invocación directa)

```bash
npx tsc --noEmit           # Typecheck — también incluido en verify:cejuassa
```

## No existen

- Tests (`npm test` no existe — no hay jest, vitest, ni archivos `.test.ts`)
- Migraciones desde CLI del proyecto (las migraciones se hacen directamente en Supabase Dashboard)
- Scripts de seed o fixtures

## Setup inicial

1. Copiar variables de entorno:
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   ```
2. `npm install`
3. `npm run dev`

## Dependencias principales

```json
"next": "16.2.7"
"react": "19.2.4"
"@supabase/ssr": "^0.10.3"
"@supabase/supabase-js": "^2.107.0"
"jspdf": "^4.2.1"
"jspdf-autotable": "^5.0.8"
"xlsx": "^0.18.5"
"lucide-react": "^1.17.0"
"recharts": "^3.8.1"
```

## AGENTS.md — Instrucción especial

El archivo `CLAUDE.md` incluye `@AGENTS.md`, que dice:

> This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code.

Esto significa que Next.js 16 puede tener cambios respecto a Next.js 13/14. Leer los docs antes de asumir comportamientos estándar.
