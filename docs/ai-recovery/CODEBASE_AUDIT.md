# CODEBASE_AUDIT.md

> Auditoría completa — generada 2026-06-15. Fuente: código fuente del repositorio.

## Stack (confirmado en código)

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16.2.7 — App Router |
| UI | React 19.2.4 + TypeScript 5 |
| Estilos | Tailwind CSS v4 (PostCSS plugin `@tailwindcss/postcss`) |
| Backend / DB | Supabase (`@supabase/ssr` + `@supabase/supabase-js`) |
| Auth | Supabase Auth (email + contraseña) |
| PDF | jspdf 4.2.1 + jspdf-autotable 5.0.8 |
| Excel | xlsx 0.18.5 |
| Iconos | lucide-react 1.17.0 |
| Gráficos | recharts 3.8.1 |

## Estructura principal

```
app/
  login/page.tsx               ← pública
  dashboard/
    layout.tsx                 ← sidebar + nav (client component)
    page.tsx                   ← KPIs, charts, alertas mora
    socios/                    ← CRUD completo + PDF
    creditos/                  ← CRUD completo
    pagos/                     ← lista + nuevo + detalle + PDF recibo
    aportes/                   ← lista + detalle
    egresos/                   ← CRUD en modal (sin página de detalle separada)
    convenios/                 ← resumen mensual por institución + detalle
    cartera/                   ← clasificación SBS + provisiones
    mora/                      ← créditos vigentes con cuotas vencidas
    reportes/
      page.tsx                 ← índice de reportes
      anexo6/page.tsx          ← Reporte SBS con export Excel
      aportes/page.tsx         ← Reporte aportes con export Excel
      caja/page.tsx            ← Reporte caja (2 hojas Excel)
    usuarios/                  ← admin-only: invitar, listar, editar
    configuracion/             ← admin-only: datos coop + parámetros financieros
      convenios/page.tsx       ← CRUD de convenios/instituciones
  api/
    usuarios/invite/route.ts   ← POST — invita usuario (service role)
    usuarios/update/route.ts   ← PUT — cambia rol/activo (service role)
lib/
  supabase.ts                  ← createClient() para browser
  useRol.ts                    ← hook para obtener rol del usuario actual
components/
  AccesoDenegado.tsx           ← componente de acceso denegado
```

## Notas arquitectónicas

- **Todo el fetching de datos es client-side** (`useEffect` + Supabase). No hay server components con datos.
- El único código server-side son las 2 API routes (`/api/usuarios/*`) que usan `createServerClient` + service role.
- No existe middleware de autenticación (`middleware.ts` no encontrado — pendiente de validar).
- No existe suite de tests.
- No existe archivo `.env` en el repo (variables de entorno solo documentadas).
