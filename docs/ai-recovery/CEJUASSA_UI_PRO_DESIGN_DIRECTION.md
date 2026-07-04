# CEJUASSA UI — Dirección Visual Profesional

> Documento de referencia visual para Claude Code y desarrolladores.
> UI-PRO-0B (2026-07-02): rediseño ejecutivo del dashboard.
> UI-PRO-1 (2026-07-02): rediseño de todas las pantallas secundarias — listas, detalles, formularios.

---

## Fase UI-PRO-1 — Pantallas secundarias (2026-07-02)

**Alcance:** Todas las pantallas del sistema excepto el dashboard principal y el reporte Anexo 6 (regulatorio SBS).

**Componentes nuevos en ui.tsx (añadidos en UI-PRO-1):**

| Componente       | Tipo    | Uso                                                          |
|------------------|---------|--------------------------------------------------------------|
| `PageFrame`      | Layout  | Wrapper de página: `min-h-full bg-slate-50 p-6`              |
| `PageToolbar`    | Layout  | Encabezado de página: título, subtítulo, acciones, meta      |
| `FilterBar`      | Layout  | Barra de filtros y búsqueda                                  |
| `DataTableShell` | Tabla   | Wrapper blanco redondeado con borde para tablas              |
| `DataTableHeader`| Tabla   | `<thead>` con `bg-slate-50 border-b border-slate-200`        |
| `DataTableEmpty` | Tabla   | Estado vacío dentro de `<tbody>` (colspan)                   |
| `DetailHero`     | Detalle | Hero de pantalla de detalle: título, subtítulo, badge, accs  |
| `DetailSection`  | Detalle | Sección nombrada con título y acción opcional                 |
| `FieldGrid`      | Detalle | Grid de campos (cols 2, 3 o 4)                               |
| `FieldItem`      | Detalle | Par etiqueta/valor, soporta `mono`, `accent`, `span`         |
| `FormPanel`      | Form    | Wrapper de formulario con espacio y fondo                    |
| `FormSection`    | Form    | Sección de formulario con título y descripción opcional      |
| `ActionStrip`    | Form    | Barra de acciones al pie: botones alineados a la derecha     |
| `InlineAlert`    | Shared  | Alerta inline: `info`, `warning`, `danger`, `success`        |
| `FinancialValue` | Shared  | Valor monetario grande, con variantes `large`, `danger`      |
| `RiskBadge`      | Shared  | Badge de clasificación SBS (Normal → Pérdida)               |
| `CompactStat`    | Shared  | Stat compacto para sidebars o resúmenes                      |
| `RecordMeta`     | Shared  | Texto de metadatos/conteo al pie de tabla (`text-xs muted`)  |

**Pantallas migradas (UI-PRO-1):**

| Pantalla | Tipo | Estado |
|---|---|---|
| `socios/page.tsx` | Lista | OK |
| `creditos/page.tsx` | Lista | OK |
| `pagos/page.tsx` | Lista | OK |
| `aportes/page.tsx` | Lista | OK |
| `egresos/page.tsx` | Lista | OK |
| `cartera/page.tsx` | Lista | OK |
| `mora/page.tsx` | Lista | OK |
| `convenios/page.tsx` | Lista | OK |
| `ampliaciones/page.tsx` | Lista | OK |
| `socios/[id]/page.tsx` | Detalle | OK |
| `creditos/[id]/page.tsx` | Detalle | OK |
| `cartera/[id]/page.tsx` | Detalle | OK |
| `convenios/[id]/page.tsx` | Detalle | OK |
| `aportes/[id]/page.tsx` | Detalle | OK |
| `socios/nuevo/page.tsx` | Form | OK |
| `socios/[id]/editar/page.tsx` | Form | OK |
| `socios/_components/SocioForm.tsx` | Form component | OK |
| `creditos/nuevo/page.tsx` | Form | OK |
| `creditos/[id]/editar/page.tsx` | Form | OK |
| `pagos/nuevo/page.tsx` | Form | OK |
| `reportes/page.tsx` | Reportes | OK |
| `usuarios/page.tsx` | Admin | OK |
| `configuracion/page.tsx` | Admin | OK |

**Excluido (regulatorio, NO modificar):**
- `reportes/anexo6/page.tsx` — reporte SBS regulatorio

**Verificación:** `npm run check:ui-pro-redesign` (24/24 OK)

**Reglas de migración aplicadas:**
- `gray-*` → `slate-*` en todos los textos, bordes y fondos
- Botones primarios: `btnPrimary` constante (no `style={{ backgroundColor }}`)
- Botones secundarios/cancelar: `btnGhost` constante
- Errores de formulario: `<InlineAlert variant="danger">` (no `div.bg-red-50`)
- Valores monetarios: clase `tabular-nums` siempre
- Estados de carga: `<div className="min-h-full bg-slate-50 p-8 text-sm text-slate-400">`
- Selects: `selectCls` importado de ui.tsx (no `inputCls` para selects)

---

---

## Fase UI-PRO-0B — Dashboard ejecutivo (2026-07-02)

**Problema resuelto:** UI-PRO-0 pasó checks técnicos pero visualmente era una plantilla SaaS genérica: grid de 8 MetricCards idénticas, tres ChartCards iguales, SectionHeaders con uppercase, `#1A56DB` en todos los íconos y gráficos.

**Cambios estructurales (no solo componentes):**

| Antes (UI-PRO-0) | Después (UI-PRO-0B) |
|---|---|
| Grid lineal de MetricCards | Panel ejecutivo asimétrico (7/5 columnas) |
| 8 cards idénticas | ExecutiveMetricPanel + RiskPanel con jerarquía visual real |
| SectionHeader x6 (`uppercase tracking-widest`) | Eliminado — jerarquía por composición |
| ChartCard x3 igual ancho | FinanceChartPanel asimétrico (7/5), más área para aportes |
| Fondo `#F8FAFC` (blanco casi puro) | Fondo `#F1F5F9` (slate-100, ligeramente más warm) |
| `#1A56DB` en todos los íconos y gráficos | Paleta PALETTE: institutional + teal + slate-300 |
| AccesoRapido chips genéricos | AccionRapida texto plano, sin chips |
| Donut sin paddingAngle | Donut con paddingAngle=2, stroke separador |
| Barras ingresos azul saturado | Barras: institutional navy + slate-300 para egresos |
| Aportes área azul genérico | Aportes área teal (#0F766E) |

**Nuevos componentes en ui.tsx:**
- `ExecutiveMetricPanel` — panel cartera con borde institucional izquierdo, saldo 4xl, sub-métricas en fila
- `RiskPanel` — panel mora con estado visual fuerte (rojo/verde), enlace directo a mora
- `CompactKpi` — 4 KPIs en una sola fila dividida, sin cards individuales
- `FinanceChartPanel` — wrapper de gráfico con título editorial (no uppercase genérico)
- `PeriodBadge` — badge de período actual en header
- `OperationalAlert` — indicador de estado operativo con dot animado
- `DividerLabel` — separador con label (para uso futuro)

**Componentes legacy conservados:** MetricCard, ChartCard, SectionHeader, etc. (usados en otras páginas).

---

## Personalidad visual

**Software financiero interno para cooperativa peruana.** No una startup SaaS.

- Serio, claro, denso en información
- Institucional pero no anticuado
- Minimalista pero no vacío
- Confiable: la estética transmite rigor, no creatividad decorativa

**Lo que NO es CEJUASSA:**
- Dashboard con gradientes de marca
- Cards con iconos grandes y texto pequeño
- Gráficos tipo Excel (cuadrículas agresivas, leyendas enormes, colores aleatorios)
- "Dark mode por default" — es un sistema de uso diario en oficina

---

## Paleta de colores

| Token                | Valor     | Uso                                         |
|----------------------|-----------|---------------------------------------------|
| `--brand-primary`    | `#1E3A5F` | Sidebar, nav activa (fondo)                 |
| `--brand-accent`     | `#1A56DB` | Botones primarios, íconos activos, gráficos |
| `--surface`          | `#F8FAFC` | Fondo general del dashboard                 |
| `--card-bg`          | `#FFFFFF` | Cards, tablas, charts                       |
| `--border`           | `#E2E8F0` | Bordes de card y tabla (`slate-200`)        |
| `--text-primary`     | `#1E293B` | Títulos y valores KPI (`slate-800`)         |
| `--text-secondary`   | `#64748B` | Labels, subtítulos (`slate-500`)            |
| `--text-muted`       | `#94A3B8` | Ejes de gráficos, timestamps (`slate-400`) |
| `--semantic-danger`  | `#EF4444` | Mora, alertas críticas                      |
| `--semantic-warning` | `#F59E0B` | Advertencias, estados intermedios           |
| `--semantic-success` | `#16A34A` | Estado OK, sin mora                         |
| `--semantic-neutral` | `#94A3B8` | Egresos, valores secundarios en gráficos    |

**Regla:** máximo 2 colores por pantalla (brand accent + 1 semántico). No usar colores decorativos.

---

## Reglas de tipografía

- Títulos de página: `text-xl font-semibold text-slate-800`
- Subtítulos de sección: `text-xs font-semibold uppercase tracking-widest text-slate-400`
- Valores KPI: `text-2xl font-semibold tracking-tight tabular-nums`
- Labels de card: `text-sm text-slate-500`
- Texto de tabla: `text-sm text-slate-700`
- Texto muted/metadata: `text-xs text-slate-400`
- **Siempre `tabular-nums`** en valores monetarios y conteos

---

## Reglas de cards (MetricCard)

- Fondo blanco, borde `border-slate-200`, sin sombra
- Padding `p-5`, border-radius `rounded-xl`
- Ícono: 32×32px, fondo `bg-blue-50`, color `text-[#1A56DB]`
- Estado `danger`: fondo `bg-red-50`, borde `border-red-200`, ícono rojo
- No usar más de 4 MetricCards por fila
- No usar cards decorativas (sin valor = sin card)

---

## Reglas de tablas

- Header: `text-xs font-semibold text-slate-500 uppercase tracking-wide`
- Filas: `text-sm text-slate-700`, borde `border-b border-slate-100`
- Hover: `hover:bg-slate-50`
- Sin bordes externos fuertes
- Números alineados a la derecha con `tabular-nums`
- Badges de estado: `StatusBadge` del sistema UI

---

## Reglas de formularios

- Input: `border-slate-200 rounded-lg`, focus con `ring-[#1A56DB]`
- Labels: `text-sm font-medium text-slate-700` encima del input
- Errores: texto rojo debajo del input, no modal
- Botón primario: `bg-[#1E3A5F] hover:bg-[#162F4E]`, sin gradiente
- Botón ghost: borde `border-slate-200`, sin fondo

---

## Reglas de gráficos (Recharts)

### Qué hacer

- Fondo blanco o transparente
- Ejes con `axisLine={false}` y `tickLine={false}`
- `CartesianGrid` con `vertical={false}` y `stroke="#F1F5F9"` (muy sutil)
- Tooltips custom minimalistas: fondo blanco, borde `border-slate-200`, sin sombra exagerada
- Altura consistente: 240px para gráficos principales
- Usar `ResponsiveContainer width="100%"`
- Dots en AreaChart: `r=3`, sin stroke (`strokeWidth: 0`)
- Colores semánticos coherentes con la paleta (no aleatorios)
- `tabular-nums` en labels y tooltips

### Qué evitar

- `CartesianGrid` con líneas verticales activas
- `axisLine={true}` o `tickLine={true}` (ruido visual)
- Colores saturados tipo Excel (`#FF6600`, `#00CC00`, etc.)
- Leyendas dentro del gráfico cuando hay pocos datos
- Gradientes opacos (máx. 12% opacidad en fill del AreaChart)
- `shadow-sm` en el wrapper del chart (el border ya es suficiente)
- Múltiples gráficos con colores que compiten entre sí

### Paleta de gráficos

| Dato          | Color     | Uso                                  |
|---------------|-----------|--------------------------------------|
| Principal     | `#1A56DB` | Ingresos, aportes, barras primarias  |
| Secundario    | `#94A3B8` | Egresos, barras secundarias/neutras  |
| Vigente       | `#1A56DB` | Estado de cartera vigente            |
| Cancelado     | `#22C55E` | Estado cancelado (positivo)          |
| Castigado     | `#EF4444` | Estado de riesgo                     |
| Refinanciado  | `#F59E0B` | Estado intermedio                    |

---

## Componentes del sistema UI (`app/dashboard/_components/ui.tsx`)

| Componente      | Uso                                              |
|-----------------|--------------------------------------------------|
| `MetricCard`    | KPI cards con valor, label, icono, estado danger |
| `SectionHeader` | Encabezado de sección (uppercase, muted)         |
| `ChartCard`     | Wrapper para gráficos Recharts                   |
| `EmptyChartState` | Estado vacío elegante para charts              |
| `StatusBadge`   | Badge semántico para estados (success/warning/danger/neutral/info) |
| `TrendIndicator` | Indicador ▲▼ con porcentaje de variación       |
| `MiniStat`      | Stat compacto inline con label y valor           |
| `PageHeader`    | Encabezado de página con título y acción         |
| `EmptyState`    | Estado vacío de tabla/lista                      |
| `TableSkeleton` | Skeleton para tablas en carga                    |
| `ResultCount`   | Contador de resultados                           |

---

## Qué evitar para no parecer IA genérica

1. **No usar gradientes en cards o botones** — plano es más profesional
2. **No poner iconos decorativos grandes** sin información real detrás
3. **No repetir el mismo card 8 veces** sin jerarquía visual
4. **No usar colores "de marca" en datos** — los colores son semánticos
5. **No escribir "Dashboard" como si fuera un producto** — es una herramienta
6. **No animar cosas que el usuario ve 100 veces por día** (tablas, listas)
7. **No usar `shadow-lg`** en componentes de datos — solo `border`
8. **No centrar todo** — los datos se leen de izquierda a derecha
9. **No usar `text-4xl` para KPIs** — `text-2xl` es suficiente y más denso
10. **No mezclar más de 2 tamaños de fuente por sección**

---

## Ejemplo de jerarquía correcta

```
[SOCIOS]                          ← SectionHeader (xs uppercase muted)
┌──────────────────┐ ┌──────────────────┐
│ 782              │ │ 26               │  ← MetricCard (2xl semibold)
│ Socios activos   │ │ Con crédito      │  ← label (sm muted)
└──────────────────┘ └──────────────────┘

[EVOLUCIÓN HISTÓRICA — ÚLTIMOS 6 MESES]   ← SectionHeader
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ INGRESOS VS...   │ │ EVOLUCIÓN DE...  │ │ ESTADO DE...     │  ← ChartCard titles (xs uppercase muted)
│ [BarChart]       │ │ [AreaChart]      │ │ [PieChart]       │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

---

*Creado: 2026-07-02 — Fase UI-PRO-0*
