import { test, expect } from '@playwright/test';

// Smoke test mínimo — verifica que la app responde y redirige al login
// PREREQUISITO: `npm run dev` debe estar corriendo en localhost:3000
// NO modifica datos — solo navegación de solo lectura

test('login page carga correctamente', async ({ page }) => {
  const response = await page.goto('/login');
  expect(response?.status()).toBeLessThan(500);
  await expect(page).toHaveURL(/login/);
});

test('raíz redirige a login o dashboard', async ({ page }) => {
  await page.goto('/');
  // La app siempre redirige: al login si no hay sesión, al dashboard si hay sesión
  await page.waitForURL(/\/(login|dashboard)/);
  const url = page.url();
  expect(url).toMatch(/\/(login|dashboard)/);
});

test('página de login tiene formulario de acceso', async ({ page }) => {
  await page.goto('/login');
  // Verificar que hay campos de email y contraseña
  const emailInput = page.locator('input[type="email"], input[name="email"]');
  const passInput = page.locator('input[type="password"]');
  await expect(emailInput.first()).toBeVisible();
  await expect(passInput.first()).toBeVisible();
});
