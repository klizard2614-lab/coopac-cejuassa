# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start dev server on http://localhost:3000
npm run build    # Production build
npm run lint     # ESLint (eslint.config.mjs, no test suite exists)
```

## Architecture

**COOPAC CEJUASSA** is a cooperative management system (sistema de gestión cooperativa) built with Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, and Supabase as the backend.

### Auth & Roles

- Auth is handled entirely by Supabase (`@supabase/ssr`).
- `lib/supabase.ts` exports `createClient()` — a browser client used in all `'use client'` components.
- Server-side API routes (`app/api/`) use `createServerClient` from `@supabase/ssr` with the cookies from `next/headers`.
- User roles (`admin` / `operador`) live in the `usuarios` table. The `useRol` hook (`lib/useRol.ts`) fetches the current user's role client-side.
- The invite flow (`app/api/usuarios/invite/route.ts`) uses the Supabase **service role key** (`SUPABASE_SERVICE_ROLE_KEY`) — this is the only place the admin client is used.

### Route Structure

- `app/login/page.tsx` — public login page, redirects to `/dashboard` on success.
- `app/dashboard/layout.tsx` — client component sidebar with navigation; calls `supabase.auth.signOut()` for logout.
- All dashboard modules follow the pattern: `app/dashboard/<module>/page.tsx` for list views, `[id]/page.tsx` for detail, `nuevo/page.tsx` for creation, `[id]/editar/page.tsx` for editing.

### Modules

| Route | Description |
|---|---|
| `socios` | Member (socio) management |
| `creditos` | Loan management with payment schedule (`cronograma_cuotas`) |
| `pagos` | Payment receipts (`pagos_recibos`) |
| `aportes` | Member contributions |
| `egresos` | Expenses |
| `convenios` | Agreements |
| `cartera` | Portfolio |
| `mora` | Overdue loans |
| `reportes` | Reports including Anexo 6 |
| `usuarios` | User administration (admin-only) |
| `configuracion` | Cooperative settings |

### PDF Generation

- `app/dashboard/pagos/utils/generarReciboPDF.ts` — generates payment receipts using `jspdf` + `jspdf-autotable`.
- `app/dashboard/socios/utils/generarFichaSocioPDF.ts` — generates member data sheets.
- Both import `jspdf` dynamically (`await import('jspdf')`) to avoid SSR issues.

### Data Patterns

- All data fetching is done client-side via `useEffect` + Supabase queries (no `getServerSideProps` or server components with data fetching).
- Monetary values are formatted with `Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })` — currency is Peruvian Soles (S/).
- Dates from Supabase come as `YYYY-MM-DD` strings; displayed as `DD/MM/YYYY`.

### Styling

- Tailwind CSS v4 (PostCSS plugin via `@tailwindcss/postcss`).
- Primary brand colors used inline via `style` props: `#1E3A5F` (dark navy sidebar), `#1A56DB` (active/accent blue), `#F8FAFC` (background).
- Lucide React for icons.
- Recharts for dashboard charts.

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # Only used in API routes, never expose client-side
```
