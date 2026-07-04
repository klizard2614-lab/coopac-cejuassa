# CEJUASSA UI Modernization Guide

> Fase UI-0/UI-1 — 2026-06-30  
> Estilo: financiero-institucional minimalista

---

## Enfoque visual elegido

**Minimalismo institucional peruano.** Un sistema de gestión cooperativa debe transmitir confianza, orden y claridad. No colores llamativos, no animaciones decorativas, no ruido visual. Solo datos legibles, jerarquía clara y consistencia.

Inspiración: sistemas bancarios y de gestión financiera institucional. Tailwind Slate palette como base neutral. Azul marino `#1E3A5F` como color institucional principal.

---

## Principios de diseño

1. **Datos primero** — el contenido es lo importante. El UI es el marco, no el cuadro.
2. **Consistencia sobre creatividad** — cada módulo debe verse igual. El usuario no debe reaprender el patrón.
3. **Feedback sin ruido** — botones con press feedback (`scale(0.97)`), hover suave, sin animaciones de entrada innecesarias.
4. **Jerarquía tipográfica clara** — una jerarquía: título de página → sección → dato → metadato.
5. **Estados visibles** — loading (skeleton), vacío (icon + mensaje), error (banner) siempre presentes.
6. **No tocar lo que funciona** — si un módulo ya tiene buena lógica, solo se mejora la capa visual.

---

## Paleta de colores (Tailwind v4 compatible)

| Token | Valor | Uso |
|---|---|---|
| `#1E3A5F` | Navy institucional | Primary buttons, sidebar, links activos, valores monetarios |
| `#162F4E` | Navy hover | Hover de primary buttons |
| `slate-800` | `#1E293B` | Texto principal |
| `slate-700` | `#334155` | Texto secundario importante |
| `slate-600` | `#475569` | Texto secundario |
| `slate-500` | `#64748B` | Labels, subtítulos |
| `slate-400` | `#94A3B8` | Texto terciario, metadatos |
| `slate-200` | `#E2E8F0` | Bordes de inputs, tablas |
| `slate-100` | `#F1F5F9` | Skeleton, hover de filas |
| `slate-50`  | `#F8FAFC` | Fondo general, header de tabla |
| `#F8FAFC`   | Background | Fondo del área de contenido |
| `green-100/800` | — | Badge activo/vigente |
| `red-100/800`   | — | Badge error/mora |
| `amber-100/800` | — | Badge advertencia |
| `gray-100/600`  | — | Badge neutral |

---

## Componentes clave (`app/dashboard/_components/ui.tsx`)

### `PageHeader`
Encabezado consistente de página con título, subtítulo opcional y slot de acción.

```tsx
<PageHeader title="Socios">
  <Link href="/dashboard/socios/nuevo" className={btnPrimary}>
    + Nuevo Socio
  </Link>
</PageHeader>
```

### `EmptyState`
Estado vacío con icono, título y descripción opcional.

```tsx
<EmptyState
  icon={Users}
  title="No hay socios registrados aún."
  description="Use el botón Nuevo Socio para comenzar."
/>
```

### `TableSkeleton`
Skeleton de N filas × M columnas para loading dentro del `<tbody>`.

```tsx
<TableSkeleton rows={6} cols={6} />
```

### `ResultCount`
Contador de resultados debajo de la tabla.

```tsx
<ResultCount count={filtered.length} singular="socio encontrado" plural="socios encontrados" />
```

---

## Reglas para botones

### Clases exportadas de `ui.tsx`

| Constante | Uso |
|---|---|
| `btnPrimary` | Acción principal de página (Nuevo, Guardar, Buscar) |
| `btnGhost` | Acciones secundarias en tabla (Ver, PDF) |
| `btnEdit` | Editar — mismo peso visual que primary pero en tabla |
| `btnDanger` | Acciones destructivas (Eliminar, si aplica) |

### Reglas invariables
- Todos los botones tienen `active:scale-[0.97] transition-transform duration-150` para press feedback.
- Los botones primarios usan `bg-[#1E3A5F] hover:bg-[#162F4E]`.
- Los botones fantasma usan `border border-slate-200 text-slate-600 hover:bg-slate-50`.
- **No usar `transition-all`** en botones (anima demasiados props).
- **No usar `hover:opacity-90`** como único hover (no da feedback de color).
- **No usar `style={{ backgroundColor: '...' }}`** — usar clases Tailwind con valor arbitrario.

---

## Reglas para tablas

```tsx
// Wrapper
<div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead>
        <tr className="border-b border-slate-200 bg-slate-50">
          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
            Columna
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {loading ? <TableSkeleton rows={6} cols={N} /> : ...}
      </tbody>
    </table>
  </div>
</div>
```

- Headers: `text-xs font-semibold text-slate-500 uppercase tracking-wide`
- Filas: `hover:bg-slate-50 transition-colors`
- Filas en mora: `bg-red-50 hover:bg-red-100/70`
- Montos: `text-sm font-semibold text-slate-900 whitespace-nowrap`
- Fechas: `text-sm text-slate-600 whitespace-nowrap`
- Nombres: `text-sm font-medium text-slate-900`
- Overflow: siempre `overflow-x-auto` en el wrapper de la tabla.

### Estado vacío en tabla (patrón correcto)
Usar `<EmptyState>` dentro de `<tr><td colSpan={N}>` — mantiene estructura de tabla:

```tsx
<tr>
  <td colSpan={6}>
    <EmptyState icon={Users} title="No hay socios." />
  </td>
</tr>
```

---

## Reglas para formularios

```tsx
// Input
className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white 
           focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent transition-colors"

// Select — mismas clases que input
```

- Siempre `focus:ring-[#1E3A5F]` para identificar visualmente el campo activo.
- Labels: `text-sm font-medium text-slate-700 mb-1`
- Mensajes de error: `text-xs text-red-600 mt-1`
- Grupos de campo: `flex flex-col gap-1`

---

## Reglas para cards / stat cards

```tsx
<div className="bg-white rounded-xl border border-slate-200 p-5">
  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Label</p>
  <p className="text-2xl font-bold text-[#1E3A5F]">S/ 0.00</p>
  <p className="text-xs text-slate-400 mt-1">Subtexto</p>
</div>
```

- Fondo blanco, borde `slate-200`, `rounded-xl`.
- El valor numérico principal usa `text-[#1E3A5F]` para contexto positivo, `text-red-600` para alerta.
- Sin sombras excesivas — usar `shadow-sm` solo si el card está en dashboard principal.

---

## Reglas para badges

```tsx
// Patrón universal
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
  Activo
</span>
```

| Estado | Clases |
|---|---|
| Activo / Vigente | `bg-green-100 text-green-800` |
| Cancelado / Inactivo | `bg-gray-100 text-gray-600` |
| En mora / Error | `bg-red-100 text-red-800` |
| Advertencia / Suspendido | `bg-amber-100 text-amber-800` |
| Info / Registrado | `bg-blue-100 text-blue-800` |

---

## Reglas para estados vacíos

Usar siempre `<EmptyState>` del archivo `ui.tsx`. No usar divs de texto plano.

- Elegir un icono de lucide-react relacionado al módulo (Users → socios, CreditCard → créditos, etc.)
- El texto del `title` puede ser el que ya existe en el código.
- Agregar `description` cuando hay filtros activos.
- Agregar `action` solo cuando hay una acción clara (ej: limpiar filtros).

---

## Reglas responsive básico

- Sidebar: `w-64 flex-shrink-0` — fijo en desktop. (Mobile: pendiente Fase UI-2)
- Contenido: `flex-1 overflow-auto`
- Tablas: siempre `overflow-x-auto` para scroll horizontal en pantallas pequeñas.
- Cards de stats: `grid-cols-1 md:grid-cols-3`
- Filtros: `flex flex-wrap gap-3` — se apilan en pantallas pequeñas.
- Padding de página: `p-8` estándar.

---

## PageHeader estándar

```tsx
<PageHeader title="Nombre del módulo" subtitle="Descripción opcional">
  {puedeEditar && <Link href="..." className={btnPrimary}>+ Nuevo</Link>}
</PageHeader>
```

- `title`: siempre el nombre del módulo, igual que el nav item del sidebar.
- `h1`: `text-xl font-semibold text-slate-800` — NO `text-2xl font-bold`.
- El slot de acción va a la derecha.

---

## Qué NO se debe cambiar

- **Lógica de negocio**: ningún cálculo, ninguna fórmula.
- **Reglas de rol**: `HIDDEN_FOR_ROLE`, `puedeEditar`, `puedeRegistrar` — sin tocar.
- **Rutas**: ninguna ruta de sidebar ni de página.
- **Textos regulatorios**: banners BDCC DEMO, Anexo 6 datos demo, etc.
- **PDF generation**: `generarReciboPDF`, `generarFichaSocioPDF` — solo UI.
- **Tablas Supabase**: ninguna migración, ningún cambio de esquema.
- **Variables de entorno**: nunca tocar `.env.local`.
- **Archivos críticos**: `lib/supabase.ts`, `app/api/usuarios/invite/route.ts`, `app/api/usuarios/update/route.ts`.

---

## Fases de modernización

| Fase | Scope | Estado |
|---|---|---|
| UI-0 | Guía visual, componentes compartidos (`ui.tsx`) | ✅ Completada 2026-06-30 |
| UI-1 | Modernización de páginas de lista (socios, créditos, pagos, aportes) | ✅ Completada 2026-06-30 |
| UI-2 | Páginas de detalle, formularios, mora, cartera, egresos | Pendiente |
| UI-3 | Sidebar responsive (mobile), mejora de dashboard | Pendiente |
