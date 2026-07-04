# PENDING_WORK.md

> Lo que falta o está incompleto — detectado desde el código.

## Pendientes confirmados en código

### 1. No existe middleware de autenticación
- No se encontró `middleware.ts` en la raíz del proyecto.
- Cualquier URL `/dashboard/*` podría cargarse sin sesión activa antes del primer `useEffect`.
- El login redirige a `/dashboard` pero no hay protección de ruta a nivel de Next.js.
- **Impacto**: usuario sin sesión puede ver el skeleton del dashboard por un momento, aunque Supabase rechaza las queries.

### 2. Aportes no tienen formulario de creación directo
- No existe `app/dashboard/aportes/nuevo/page.tsx`.
- **CONFIRMADO**: Los aportes se crean en el paso 4 del `handleSubmit` de `pagos/nuevo/page.tsx`, cuando `monto_aporte > 0`. No hay trigger en Supabase (la lógica vive completamente en el cliente).
- El saldo del socio se calcula leyendo el último aporte del socio y sumando el nuevo monto — ver riesgo de race condition en RISKS_AND_BUGS.md.

### 3. ~~Módulo de Aportes — detalle individual~~ ✅ VALIDADO
- `app/dashboard/aportes/[id]/page.tsx` — completo y funcional.

### 4. ~~Módulo Convenios — detalle individual~~ ✅ VALIDADO
- `app/dashboard/convenios/[id]/page.tsx` — completo y funcional.

### 5. ~~Módulo Cartera — detalle individual~~ ✅ VALIDADO
- `app/dashboard/cartera/[id]/page.tsx` — completo y funcional.

### 6. Guards de rol en la mayoría de módulos
- Solo `Configuración` y `Usuarios` verifican el rol antes de mostrar contenido.
- El resto de módulos (Socios, Créditos, Pagos, Egresos, etc.) no tienen guard de rol.
- Si se requieren permisos granulares por módulo (ej. solo `creditos` puede acceder a Créditos), esto falta.

### 7. Bug menor: `useMemo` async en Aportes
- En `app/dashboard/aportes/page.tsx` línea 99: `const totalAnio = useMemo(async () => 0, [])` — useMemo no debe ser async.
- El valor `totalAnio` nunca se usa directamente (se trabaja con `sumaAnio` por separado). No es bloqueante.

### 8. Sin typecheck script
- `package.json` no define un script `typecheck`. Para verificar tipos: `npx tsc --noEmit`.

## Pendientes de validar (no confirmados en código)

- ~~Si existen triggers en Supabase para auto-crear aportes~~ → **RESUELTO**: la lógica vive en `pagos/nuevo/page.tsx` paso 4, sin triggers.
- ~~Estado del módulo `Configuración > Convenios`~~ → **RESUELTO**: CRUD completo, confirmado.
- Si las RLS (Row Level Security) de Supabase están configuradas.
- ~~Si existe lógica para generar el cronograma de cuotas automáticamente~~ → **RESUELTO**: el cronograma se genera completamente en el cliente dentro de `creditos/nuevo/page.tsx`, sin triggers ni RPC.
- Si el RPC `decrementar_saldo_capital` existe en Supabase (usado en `pagos/nuevo` con fallback directo si falla).
