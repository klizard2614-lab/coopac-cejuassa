# CRITICAL_FILES.md

> Archivos que NO deben modificarse sin revisión cuidadosa.

## Alta criticidad — tocar con extremo cuidado

| Archivo | Por qué es crítico |
|---|---|
| `lib/supabase.ts` | Cliente de Supabase para todo el frontend. Cambio aquí rompe todas las queries. |
| `app/api/usuarios/invite/route.ts` | Usa service role key. Único punto que puede crear usuarios en Supabase Auth. |
| `app/api/usuarios/update/route.ts` | Usa service role key. Puede cambiar roles y estado activo de cualquier usuario. |
| `app/dashboard/reportes/anexo6/page.tsx` | Genera el Anexo N°6 SBS. Tiene 60 columnas con formato regulatorio exacto. Errores en este reporte pueden tener implicancias legales. |
| `app/dashboard/pagos/utils/generarReciboPDF.ts` | Genera recibos de pago oficiales que se entregan a socios. |

## Media criticidad — verificar impacto antes de tocar

| Archivo | Por qué |
|---|---|
| `app/dashboard/layout.tsx` | Sidebar principal + logout. Afecta toda la app. |
| `app/login/page.tsx` | Único punto de entrada. Si se rompe, nadie puede entrar. |
| `lib/useRol.ts` | Usado por `Configuración` para el guard de admin. |
| `app/dashboard/configuracion/page.tsx` | Modifica parámetros financieros globales (tasas de provisión, FPS, interés). |
| `app/dashboard/creditos/nuevo/page.tsx` | Crea créditos. Errores en cálculo de cuotas o datos incorrectos son difíciles de revertir. |
| `app/dashboard/pagos/nuevo/page.tsx` | Registra pagos. Afecta saldos y cronogramas. |

## Archivos de configuración del proyecto

| Archivo | Cambiar solo si... |
|---|---|
| `next.config.ts` | Se necesita nueva configuración de Next.js (imágenes, redirecciones, etc.) |
| `tsconfig.json` | Se necesita cambiar paths o strict mode |
| `eslint.config.mjs` | Se necesita ajustar reglas de linting |
| `postcss.config.mjs` | Se necesita cambiar el pipeline de CSS |
