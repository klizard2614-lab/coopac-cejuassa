# TOOLING_AND_SKILLS_SETUP.md

> Configuración de herramientas, skills y plugins para el proyecto CEJUASSA.
> Creado: 2026-06-30 — Fase TOOLING-0.

---

## Resumen de estado

| Herramienta | Estado | Tipo | Activación |
|---|---|---|---|
| **Frontend design** (`emil-design-eng`) | ✅ Instalada | Skill local | `/emil-design-eng` o en instrucciones |
| **Animation vocabulary** | ✅ Instalada | Skill local | `/animation-vocabulary` |
| **Review animations** | ✅ Instalada | Skill local | `/review-animations` |
| **Playwright** | ✅ Instalado | npm devDependency | `npm run test:e2e` |
| **Context7** | ⏳ Pendiente configuración MCP | MCP externo | Ver instrucciones abajo |
| **Superpowers** (`@complexthings/superpowers-agent`) | ✅ Instalado global v9.2.1 | CLI global (Git Bash) | `superpowers-agent` en Git Bash |
| **Caveman** (`@juliusbrussee/caveman-code`) | ✅ Instalado global v0.65.2 | CLI global | `caveman` en terminal |

Skills CEJUASSA propias (siempre disponibles):

| Skill | Propósito |
|---|---|
| `cejuassa-checkpoint` | Auditoría de estado del proyecto |
| `cejuassa-db-plan` | Planificación de cambios en DB |
| `cejuassa-risk-review` | Análisis de riesgo antes de cambios |
| `cejuassa-safe-change` | Cambios seguros paso a paso |
| `cejuassa-verify` | Verificación post-cambio |

---

## 1. Frontend design — `emil-design-eng`

**Qué es:** Skill de Emil Kowalski que codifica principios de UI polish, diseño de componentes, decisiones de animación y los detalles invisibles que hacen que el software se sienta bien.

**Para qué se usa en CEJUASSA:**
- Mejorar UI de tablas de socios, créditos, pagos
- Revisar responsive en móvil/tablet
- Pulir estados vacíos (cuando no hay datos)
- Mejorar formularios (nuevo crédito, nuevo pago)
- Revisar spacing, tipografía, colores

**Cómo activarlo:**
```
/emil-design-eng — mejorar la tabla de socios para mejor legibilidad
```

**Restricciones en CEJUASSA:**
- NO cambiar lógica de cálculo financiero
- NO mover ni renombrar componentes que otros archivos importan sin actualizar imports
- NO tocar `generarReciboPDF.ts` ni `generarFichaSocioPDF.ts` — solo visualmente si es seguro
- Siempre correr `/cejuassa-verify` después de cambios de UI

**Riesgo:** Bajo — cambios visuales, no lógica de negocio.

---

## 2. Playwright — Tests E2E

**Qué es:** Framework de testing end-to-end para aplicaciones web. Controla un navegador real.

**Versión instalada:** `@playwright/test@1.61.1`

**Para qué se usa en CEJUASSA:**
- Verificar que la app carga sin errores tras cambios
- Smoke tests del flujo de login
- Tests de navegación básica (no modifican datos)
- Verificación visual de páginas críticas

**Comandos disponibles:**

```bash
# Instalar navegadores (REQUERIDO la primera vez — descarga ~300MB)
npx playwright install chromium

# Correr todos los tests e2e
npm run test:e2e

# Correr con UI interactiva (ver tests en tiempo real)
npm run test:e2e:ui

# Solo el smoke test
npm run test:e2e:smoke

# Con navegador visible
npm run test:e2e:headed
```

**IMPORTANTE — Prerrequisitos:**
1. Instalar navegadores: `npx playwright install chromium` (solo la primera vez)
2. El dev server debe estar corriendo: `npm run dev`
3. Los tests apuntan a `http://localhost:3000`

**Archivos:**
- `playwright.config.ts` — configuración principal
- `e2e/smoke.spec.ts` — test smoke básico (login, redirección)

**Tests disponibles:**
- `smoke.spec.ts` — verifica login carga, redirección funciona, formulario visible

**Reglas para tests CEJUASSA:**
- Los tests e2e NUNCA modifican datos (no INSERT/UPDATE/DELETE)
- Usar variables de entorno para credenciales de test, nunca hardcodear
- Tests de autenticación: usar cuenta de test separada, no la cuenta de producción
- Si se agrega un test que modifica datos, agregarlo a un archivo `*.write.spec.ts` separado y documentarlo aquí

**Rollback:**
```bash
# Si algo falla, desinstalar playwright
npm uninstall @playwright/test
# Borrar archivos
Remove-Item playwright.config.ts
Remove-Item -Recurse e2e/
```

---

## 3. Context7 — Documentación actualizada de librerías

**Qué es:** MCP server que provee documentación up-to-date de librerías populares directamente en el contexto de Claude. Evita que Claude use documentación desactualizada de su training data.

**Para qué se usa en CEJUASSA:**
- Consultar documentación actual de Next.js 16 (App Router)
- Consultar docs de Supabase SSR / `@supabase/ssr`
- Consultar docs de Playwright 1.61
- Consultar docs de Tailwind CSS v4
- Consultar docs de React 19

**Estado:** NO configurado — requiere configuración manual de MCP.

**Cómo configurarlo:**

1. Abrir `%APPDATA%\Claude\claude_desktop_config.json`
2. Agregar bajo `mcpServers`:

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    }
  }
}
```

3. Reiniciar Claude Code Desktop.

**Cómo usarlo una vez configurado:**
```
use context7 — cómo usar createServerClient en Next.js 16 App Router
```

**Riesgo de configuración:** Bajo — solo modifica config global de Claude Desktop, no el proyecto.

**Rollback:** Eliminar la entrada `context7` de `claude_desktop_config.json`.

---

## 4. Superpowers — `@complexthings/superpowers-agent`

**Estado:** ✅ Instalado globalmente (v9.2.1, 2026-06-30)

**Qué es:** Sistema de skills para AI coding agents — 34 skills organizadas en categorías: architecture, collaboration, debugging, problem-solving, research, testing, meta. Funciona como CLI desde Git Bash.

**IMPORTANTE — Solo funciona desde Git Bash en Windows (no PowerShell):**
```bash
superpowers-agent find-skills          # Listar 34 skills disponibles
superpowers-agent use-skill <nombre>   # Cargar una skill
superpowers-agent version              # Ver versión (9.2.1)
```

**Skills más útiles para CEJUASSA:**
- `debugging/systematic-debugging` — bugs difíciles de trazar
- `debugging/root-cause-tracing` — encontrar causa raíz de errores
- `collaboration/writing-plans` — antes de implementar features complejos
- `collaboration/requesting-code-review` — antes de merge de cambios importantes
- `problem-solving/when-stuck` — cuando hay bloqueos en la implementación

**Restricciones:**
- Superpowers ORIENTA el proceso; la ejecución pasa siempre por los skills CEJUASSA
- NO reemplaza `/cejuassa-risk-review` para cambios en lógica financiera

---

## 5. Caveman — `@juliusbrussee/caveman-code`

**Estado:** ✅ Instalado globalmente (v0.65.2, 2026-06-30)

**Qué es:** Asistente de código AI con CLI propio. Tiene herramientas de read, bash, edit, write y soporte para extensiones y plugins. Se ejecuta desde la terminal como `caveman`.

**Comandos principales:**
```bash
caveman                          # Iniciar asistente interactivo
caveman @archivo.ts "pregunta"   # Consultar sobre un archivo específico
caveman install <source>         # Instalar extensión
caveman plugin install owner/name # Instalar plugin
caveman plugin search <query>    # Buscar plugins
caveman list                     # Listar extensiones instaladas
caveman config                   # Configurar extensiones (TUI)
```

**Para qué se usará en CEJUASSA:**
- Análisis rápido de archivos individuales desde la terminal
- Debugging de lógica de cálculo (cronogramas, intereses)
- Consultas rápidas sobre código sin abrir una sesión completa de Claude Code
- Como complemento al flujo principal cuando se necesita iterar rápido

**Restricciones en CEJUASSA:**
- NO usar para modificar lógica financiera sin pasar por `/cejuassa-risk-review` primero
- NO dejar logs de debug (`console.log`) en código de producción

**Cómo verificar que funciona:**
```bash
caveman --version   # debe mostrar 0.65.2
```

---

## Flujo recomendado de trabajo

### Para cambios de UI/frontend:
```
1. /cejuassa-risk-review — verificar que el cambio es solo visual
2. /emil-design-eng — obtener guía de diseño
3. Implementar cambio
4. npm run test:e2e:smoke — verificar que nada se rompió
5. /cejuassa-verify — verificación final
```

### Para cambios de lógica:
```
1. /cejuassa-risk-review — análisis de riesgo obligatorio
2. /cejuassa-db-plan — plan de cambio en DB si aplica
3. /cejuassa-safe-change — implementación paso a paso
4. npm run verify:cejuassa — checks del proyecto
5. npm run smoke:demo-app — smoke de la app
6. /cejuassa-checkpoint — checkpoint final
```

### Para consultar documentación de librerías:
```
Con Context7 configurado:
→ "use context7 — [pregunta sobre librería]"

Sin Context7 (actual):
→ Siempre pedir a Claude que verifique en node_modules/next/dist/docs/
→ Ver AGENTS.md: "Read the relevant guide before writing any code"
```

---

## Comandos nuevos disponibles

```bash
npm run test:e2e              # Todos los tests e2e (requiere dev server + browsers)
npm run test:e2e:ui           # UI interactiva de Playwright
npm run test:e2e:smoke        # Solo smoke test
npm run test:e2e:headed       # Con navegador visible
npm run audit:tooling-setup   # Auditar que el tooling esté correctamente configurado
```

---

## Checklist de primera vez con Playwright

- [ ] `npx playwright install chromium` (instalar navegadores, ~300MB)
- [ ] `npm run dev` (arrancar dev server)
- [ ] `npm run test:e2e:smoke` (verificar que los 3 smoke tests pasan)
- [ ] Si los tests fallan, revisar que `http://localhost:3000` está accesible

---

## Archivos tocados en TOOLING-0

| Archivo | Cambio |
|---|---|
| `package.json` | Agregados scripts: `test:e2e`, `test:e2e:ui`, `test:e2e:smoke`, `test:e2e:headed`, `audit:tooling-setup` |
| `playwright.config.ts` | Creado — config mínima apuntando a localhost:3000 |
| `e2e/smoke.spec.ts` | Creado — 3 smoke tests básicos (login, redirección, formulario) |
| `scripts/audit-tooling-setup.mjs` | Creado — script de auditoría |
| `docs/ai-recovery/TOOLING_AND_SKILLS_SETUP.md` | Este archivo |
| `package.json` → `devDependencies` | Agregado `@playwright/test@^1.61.1` |

**NO tocados:** DB, Supabase, migraciones, lógica financiera, socios, créditos, pagos, cronogramas, aportes, reportes.
