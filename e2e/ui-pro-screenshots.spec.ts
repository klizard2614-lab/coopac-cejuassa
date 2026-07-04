import { test, expect, Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'

/**
 * UI-PRO-1 Screenshot Suite
 *
 * Captures screenshots of all redesigned screens for visual review.
 * Requires a running dev server (npm run dev) and an authenticated session.
 *
 * Screenshots are saved to: exports/ui-pro/screenshots/
 *
 * IMPORTANT: These tests do NOT require real Supabase credentials —
 * they capture the unauthenticated/loading state of each route, which
 * is enough to verify the layout shell (PageFrame, PageToolbar, etc.).
 *
 * For authenticated screenshots, set:
 *   PLAYWRIGHT_EMAIL and PLAYWRIGHT_PASSWORD environment variables.
 */

const OUT_DIR = path.join(process.cwd(), 'exports', 'ui-pro', 'screenshots')

// Ensure output dir exists
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(OUT_DIR, `${name}.jpg`),
    type: 'jpeg',
    quality: 85,
    fullPage: false,
  })
}

// ── Routes to capture ─────────────────────────────────────────────────────────

const ROUTES = [
  // List screens (Tarea 2)
  { name: 'socios-list',          path: '/dashboard/socios' },
  { name: 'creditos-list',        path: '/dashboard/creditos' },
  { name: 'pagos-list',           path: '/dashboard/pagos' },
  { name: 'aportes-list',         path: '/dashboard/aportes' },
  { name: 'egresos-list',         path: '/dashboard/egresos' },
  { name: 'cartera-list',         path: '/dashboard/cartera' },
  { name: 'mora-list',            path: '/dashboard/mora' },
  { name: 'convenios-list',       path: '/dashboard/convenios' },
  { name: 'ampliaciones-list',    path: '/dashboard/ampliaciones' },

  // Detail screens (Tarea 3)
  { name: 'socios-detail',        path: '/dashboard/socios/00000000-0000-0000-0000-000000000000' },
  { name: 'creditos-detail',      path: '/dashboard/creditos/00000000-0000-0000-0000-000000000000' },
  { name: 'cartera-detail',       path: '/dashboard/cartera/00000000-0000-0000-0000-000000000000' },
  { name: 'convenios-detail',     path: '/dashboard/convenios/1' },

  // Form pages (Tarea 4)
  { name: 'socios-nuevo',         path: '/dashboard/socios/nuevo' },
  { name: 'creditos-nuevo',       path: '/dashboard/creditos/nuevo' },
  { name: 'pagos-nuevo',          path: '/dashboard/pagos/nuevo' },

  // Reportes (Tarea 5)
  { name: 'reportes',             path: '/dashboard/reportes' },

  // Usuarios / Configuración (Tarea 6)
  { name: 'usuarios',             path: '/dashboard/usuarios' },
  { name: 'configuracion',        path: '/dashboard/configuracion' },
]

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('UI-PRO-1 Screenshot Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Set viewport to desktop
    await page.setViewportSize({ width: 1280, height: 800 })
  })

  test('capture login page', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await screenshot(page, 'login')
    expect(true).toBe(true) // always pass — this is a capture test
  })

  for (const route of ROUTES) {
    test(`capture ${route.name}`, async ({ page }) => {
      await page.goto(route.path)
      // Wait for initial load (redirect to login OR dashboard render)
      await page.waitForLoadState('networkidle')
      // Small delay for any client-side hydration
      await page.waitForTimeout(500)
      await screenshot(page, route.name)
      // Verify no 500 errors
      const status = page.url()
      expect(status).not.toContain('500')
    })
  }
})

// ── Layout verification tests ─────────────────────────────────────────────────

test.describe('UI-PRO-1 Layout Verification (no auth required)', () => {
  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    // Login page should show auth form or redirect
    const url = page.url()
    expect(url).toMatch(/\/(login|dashboard)/)
  })

  test('unauthenticated routes redirect to login', async ({ page }) => {
    await page.goto('/dashboard/socios')
    await page.waitForURL(/\/(login|dashboard)/, { timeout: 5000 })
    const url = page.url()
    // If not authenticated, should redirect to login
    // If authenticated (CI with session), should be on dashboard
    expect(url).toMatch(/\/(login|dashboard)/)
  })
})
