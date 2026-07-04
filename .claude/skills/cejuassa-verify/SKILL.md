# Skill: cejuassa-verify

Activa este skill después de implementar cualquier cambio de código.
Su propósito es ejecutar verificaciones, reportar resultados y corregir errores causados por el cambio.

## Modo autónomo controlado

1. Ejecutar los comandos que correspondan (ver tabla abajo).
2. Si hay errores **causados por el cambio**, corregirlos automáticamente y re-ejecutar.
3. Repetir hasta que pase o hasta detectar un bloqueo real (error preexistente, dependencia faltante, etc.).
4. No terminar la tarea si la verificación no pasó.
5. No imprimir logs completos — solo líneas con error y el contexto mínimo.
6. Reportar el resultado final con el formato de abajo.

## Hard stops — no corregir sin permiso

- Errores en archivos críticos (`lib/supabase.ts`, `reportes/anexo6`, `pagos/utils/generarReciboPDF.ts`, API routes con service role).
- Errores que impliquen cambio de esquema o lógica financiera.
- Errores preexistentes no relacionados al cambio actual — solo reportarlos.

## Comandos a ejecutar (según corresponda)

### Siempre
```
npm run lint
```

### Si se tocaron tipos, interfaces o props
```
npx tsc --noEmit
```

### Si el cambio afecta rutas, layouts o lógica de servidor
```
npm run build
```

## Formato de reporte

### Si todo pasa
```
✓ lint     — sin errores
✓ tsc      — sin errores de tipo
✓ build    — compilación exitosa
```

### Si hay errores
```
✗ [comando] — [archivo]:[línea] — [mensaje]
```
Indicar si el error fue introducido por el cambio actual o era preexistente.

## Definition of Done
La verificación está completa cuando:
- Todos los comandos relevantes pasaron sin errores causados por el cambio.
- Si había errores preexistentes no relacionados, están documentados pero no bloquearon el Done.

## Cuándo usar este skill
Siempre después de `/cejuassa-safe-change`.
Después de cualquier edición de archivo `.tsx` o `.ts`.
Antes de hacer commit o desplegar.
