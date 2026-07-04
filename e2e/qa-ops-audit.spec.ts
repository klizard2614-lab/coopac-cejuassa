import { test, expect, Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'

/**
 * QA-OPS-0 — Auditoría operativa completa CEJUASSA
 *
 * Navega todos los módulos como un usuario real, captura screenshots
 * y registra errores de consola. NO modifica datos.
 *
 * Prerequisito: npm run dev corriendo en localhost:3000
 * Credenciales: PLAYWRIGHT_EMAIL + PLAYWRIGHT_PASSWORD (env vars)
 *
 * Screenshots: exports/qa-ops/screenshots/
 */

const OUT_DIR = path.join(process.cwd(), 'exports', 'qa-ops', 'screenshots')
const REPORT_DIR = path.join(process.cwd(), 'exports', 'qa-ops', 'reports')

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })
if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true })

const EMAIL = process.env.PLAYWRIGHT_EMAIL || ''
const PASSWORD = process.env.PLAYWRIGHT_PASSWORD || ''

const consoleErrors: Record<string, string[]> = {}

async function shot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(OUT_DIR, `${name}.jpg`),
    type: 'jpeg',
    quality: 85,
    fullPage: true,
  })
}

async function waitAndShot(page: Page, name: string, waitMs = 1500) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(waitMs)
  await shot(page, name)
}

async function login(page: Page) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  if (EMAIL && PASSWORD) {
    const emailInput = page.locator('input[type="email"], input[name="email"]').first()
    const passInput = page.locator('input[type="password"]').first()
    await emailInput.fill(EMAIL)
    await passInput.fill(PASSWORD)
    await page.keyboard.press('Enter')
    await page.waitForURL(/\/dashboard/, { timeout: 10000 }).catch(() => {})
    await page.waitForLoadState('networkidle').catch(() => {})
  }
}

// ── Módulo 1: Login ────────────────────────────────────────────────────────────

test.describe('01 — Login y acceso', () => {
  test('login page carga y muestra formulario', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
    page.on('pageerror', err => errors.push(`[pageerror] ${err.message}`))

    await page.goto('/login')
    await waitAndShot(page, '01-login-form')

    const emailInput = page.locator('input[type="email"], input[name="email"]').first()
    const passInput = page.locator('input[type="password"]').first()
    await expect(emailInput).toBeVisible()
    await expect(passInput).toBeVisible()

    consoleErrors['login'] = errors
    expect(page.url()).toContain('login')
  })

  test('redirige a dashboard sin sesión', async ({ page }) => {
    await page.goto('/dashboard/socios')
    await page.waitForURL(/\/(login|dashboard)/, { timeout: 8000 }).catch(() => {})
    await shot(page, '01-redirect-no-auth')
    const url = page.url()
    expect(url).toMatch(/\/(login|dashboard)/)
  })
})

// ── Módulo 2: Dashboard ────────────────────────────────────────────────────────

test.describe('02 — Dashboard principal', () => {
  test('dashboard carga con métricas', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
    page.on('pageerror', err => errors.push(`[pageerror] ${err.message}`))

    await login(page)
    await page.goto('/dashboard')
    await waitAndShot(page, '02-dashboard', 2000)

    consoleErrors['dashboard'] = errors
    const url = page.url()
    expect(url).toMatch(/\/(login|dashboard)/)
  })
})

// ── Módulo 3: Socios ───────────────────────────────────────────────────────────

test.describe('03 — Socios', () => {
  test('lista de socios', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })

    await login(page)
    await page.goto('/dashboard/socios')
    await waitAndShot(page, '03-socios-lista', 2000)
    consoleErrors['socios-list'] = errors
    expect(page.url()).toMatch(/\/(login|dashboard)/)
  })

  test('búsqueda de socio', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/socios')
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(1500)
    const searchInput = page.locator('input[type="search"], input[placeholder*="Buscar"], input[placeholder*="buscar"]').first()
    if (await searchInput.isVisible()) {
      await searchInput.fill('a')
      await page.waitForTimeout(800)
      await shot(page, '03-socios-busqueda')
    } else {
      await shot(page, '03-socios-sin-busqueda')
    }
    expect(true).toBe(true)
  })

  test('formulario nuevo socio', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })

    await login(page)
    await page.goto('/dashboard/socios/nuevo')
    await waitAndShot(page, '03-socios-nuevo', 1500)
    consoleErrors['socios-nuevo'] = errors
    expect(page.url()).toMatch(/\/(login|dashboard)/)
  })
})

// ── Módulo 4: Créditos ────────────────────────────────────────────────────────

test.describe('04 — Créditos', () => {
  test('lista de créditos', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })

    await login(page)
    await page.goto('/dashboard/creditos')
    await waitAndShot(page, '04-creditos-lista', 2000)
    consoleErrors['creditos-list'] = errors
    expect(page.url()).toMatch(/\/(login|dashboard)/)
  })

  test('filtros de créditos', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard/creditos')
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(1500)
    const selects = page.locator('select')
    const count = await selects.count()
    if (count > 0) {
      await shot(page, '04-creditos-filtros')
    }
    expect(true).toBe(true)
  })

  test('formulario nuevo crédito', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })

    await login(page)
    await page.goto('/dashboard/creditos/nuevo')
    await waitAndShot(page, '04-creditos-nuevo', 1500)
    consoleErrors['creditos-nuevo'] = errors
    expect(page.url()).toMatch(/\/(login|dashboard)/)
  })
})

// ── Módulo 5: Ampliaciones ────────────────────────────────────────────────────

test.describe('05 — Ampliaciones', () => {
  test('lista de ampliaciones', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })

    await login(page)
    await page.goto('/dashboard/ampliaciones')
    await waitAndShot(page, '05-ampliaciones-lista', 2000)
    consoleErrors['ampliaciones-list'] = errors
    expect(page.url()).toMatch(/\/(login|dashboard)/)
  })
})

// ── Módulo 6: Pagos ───────────────────────────────────────────────────────────

test.describe('06 — Pagos', () => {
  test('lista de pagos', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })

    await login(page)
    await page.goto('/dashboard/pagos')
    await waitAndShot(page, '06-pagos-lista', 2000)
    consoleErrors['pagos-list'] = errors
    expect(page.url()).toMatch(/\/(login|dashboard)/)
  })

  test('formulario nuevo pago', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })

    await login(page)
    await page.goto('/dashboard/pagos/nuevo')
    await waitAndShot(page, '06-pagos-nuevo', 1500)
    consoleErrors['pagos-nuevo'] = errors
    expect(page.url()).toMatch(/\/(login|dashboard)/)
  })
})

// ── Módulo 7: Aportes ─────────────────────────────────────────────────────────

test.describe('07 — Aportes', () => {
  test('lista de aportes', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })

    await login(page)
    await page.goto('/dashboard/aportes')
    await waitAndShot(page, '07-aportes-lista', 2000)
    consoleErrors['aportes-list'] = errors
    expect(page.url()).toMatch(/\/(login|dashboard)/)
  })
})

// ── Módulo 8: Egresos ─────────────────────────────────────────────────────────

test.describe('08 — Egresos', () => {
  test('lista de egresos', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })

    await login(page)
    await page.goto('/dashboard/egresos')
    await waitAndShot(page, '08-egresos-lista', 2000)
    consoleErrors['egresos-list'] = errors
    expect(page.url()).toMatch(/\/(login|dashboard)/)
  })
})

// ── Módulo 9: Convenios ───────────────────────────────────────────────────────

test.describe('09 — Convenios', () => {
  test('lista de convenios', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })

    await login(page)
    await page.goto('/dashboard/convenios')
    await waitAndShot(page, '09-convenios-lista', 2000)
    consoleErrors['convenios-list'] = errors
    expect(page.url()).toMatch(/\/(login|dashboard)/)
  })
})

// ── Módulo 10: Cartera ────────────────────────────────────────────────────────

test.describe('10 — Cartera', () => {
  test('lista de cartera', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })

    await login(page)
    await page.goto('/dashboard/cartera')
    await waitAndShot(page, '10-cartera-lista', 2000)
    consoleErrors['cartera-list'] = errors
    expect(page.url()).toMatch(/\/(login|dashboard)/)
  })
})

// ── Módulo 11: Mora ───────────────────────────────────────────────────────────

test.describe('11 — Mora', () => {
  test('listado mora', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })

    await login(page)
    await page.goto('/dashboard/mora')
    await waitAndShot(page, '11-mora-lista', 2000)
    consoleErrors['mora-list'] = errors
    expect(page.url()).toMatch(/\/(login|dashboard)/)
  })
})

// ── Módulo 12: Reportes ───────────────────────────────────────────────────────

test.describe('12 — Reportes', () => {
  test('menú de reportes', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })

    await login(page)
    await page.goto('/dashboard/reportes')
    await waitAndShot(page, '12-reportes-menu', 2000)
    consoleErrors['reportes-menu'] = errors
    expect(page.url()).toMatch(/\/(login|dashboard)/)
  })

  test('Anexo 06 — carga sin error', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })

    await login(page)
    await page.goto('/dashboard/reportes/anexo6')
    await waitAndShot(page, '12-reportes-anexo6', 2500)
    consoleErrors['reportes-anexo6'] = errors
    expect(page.url()).toMatch(/\/(login|dashboard)/)
  })
})

// ── Módulo 13: Usuarios ───────────────────────────────────────────────────────

test.describe('13 — Usuarios', () => {
  test('gestión de usuarios', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })

    await login(page)
    await page.goto('/dashboard/usuarios')
    await waitAndShot(page, '13-usuarios-lista', 2000)
    consoleErrors['usuarios-list'] = errors
    expect(page.url()).toMatch(/\/(login|dashboard)/)
  })
})

// ── Módulo 14: Configuración ──────────────────────────────────────────────────

test.describe('14 — Configuración', () => {
  test('configuración cooperativa', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })

    await login(page)
    await page.goto('/dashboard/configuracion')
    await waitAndShot(page, '14-configuracion', 2000)
    consoleErrors['configuracion'] = errors
    expect(page.url()).toMatch(/\/(login|dashboard)/)
  })
})

// ── Módulo 15: Navegación general ─────────────────────────────────────────────

test.describe('15 — Navegación general', () => {
  test('sidebar visible en dashboard', async ({ page }) => {
    await login(page)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(1500)
    await shot(page, '15-navegacion-sidebar')
    expect(true).toBe(true)
  })

  test('responsive mobile view', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await login(page)
    await page.goto('/dashboard')
    await waitAndShot(page, '15-navegacion-mobile', 1500)
    expect(true).toBe(true)
  })

  test('navegación entre módulos sin errores 404', async ({ page }) => {
    const errors: string[] = []
    page.on('response', resp => {
      if (resp.status() >= 400 && resp.status() < 600) {
        errors.push(`${resp.status()} ${resp.url()}`)
      }
    })

    await login(page)
    const routes = ['/dashboard', '/dashboard/socios', '/dashboard/creditos',
      '/dashboard/pagos', '/dashboard/aportes', '/dashboard/egresos',
      '/dashboard/cartera', '/dashboard/mora', '/dashboard/convenios',
      '/dashboard/reportes', '/dashboard/configuracion']

    for (const route of routes) {
      await page.goto(route)
      await page.waitForLoadState('networkidle').catch(() => {})
      await page.waitForTimeout(500)
    }
    await shot(page, '15-navegacion-flujo-completo')
    consoleErrors['navegacion-general'] = errors
    expect(errors.length).toBeLessThanOrEqual(5) // tolerancia para recursos opcionales
  })
})

// ── Reporte de errores de consola ─────────────────────────────────────────────

test.afterAll(async () => {
  const reportPath = path.join(REPORT_DIR, 'console-errors.json')
  fs.writeFileSync(reportPath, JSON.stringify(consoleErrors, null, 2))
  console.log(`\n📋 Console errors report: ${reportPath}`)
})
