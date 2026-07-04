import { test, Page } from '@playwright/test'
import path from 'path'

const SCREENSHOTS_DIR = path.join(process.cwd(), 'exports', 'qa-ops', 'screenshots')

async function login(page: Page) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  const email = process.env.PLAYWRIGHT_EMAIL || ''
  const pass  = process.env.PLAYWRIGHT_PASSWORD || ''
  if (email && pass) {
    await page.locator('input[type="email"], input[name="email"]').first().fill(email)
    await page.locator('input[type="password"]').first().fill(pass)
    await page.keyboard.press('Enter')
    await page.waitForURL(/\/dashboard/, { timeout: 10000 }).catch(() => {})
    await page.waitForLoadState('networkidle').catch(() => {})
  }
}

test('recrop socios lista — viewport only', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await login(page)
  await page.goto('/dashboard/socios')
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(2000)
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, '03-socios-lista.jpg'),
    type: 'jpeg', quality: 85,
    fullPage: false,   // solo el viewport visible
  })
  console.log('✅ 03-socios-lista.jpg recortada')
})

test('recrop pagos lista — viewport only', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await login(page)
  await page.goto('/dashboard/pagos')
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(2000)
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, '06-pagos-lista.jpg'),
    type: 'jpeg', quality: 85,
    fullPage: false,
  })
  console.log('✅ 06-pagos-lista.jpg recortada')
})
