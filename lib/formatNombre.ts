/**
 * Convierte una cadena en MAYÚSCULAS a Title Case preservando Ñ/ñ y tildes.
 * Solo actúa si la cadena está completamente en mayúsculas.
 */
function toTitleCase(str: string): string {
  const allUpper = str === str.toUpperCase() && /[A-ZÁÉÍÓÚÜÑ]/.test(str)
  if (!allUpper) return str
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Formatea apellidos y nombres para display visual.
 * - Trim + normaliza espacios múltiples
 * - Convierte mayúsculas sostenidas a Title Case (CHAVEZ ÑIQUE → Chavez Ñique)
 * - Preserva Ñ/ñ y tildes
 * - Retorna "Apellidos, Nombres"
 * - NO inserta espacios internos que no existan en los datos
 */
export function formatNombrePersona(
  apellidos: string | null | undefined,
  nombres: string | null | undefined
): string {
  const ap = toTitleCase((apellidos ?? '').trim().replace(/\s+/g, ' '))
  const nm = toTitleCase((nombres ?? '').trim().replace(/\s+/g, ' '))
  if (!ap && !nm) return '—'
  if (!nm) return ap
  if (!ap) return nm
  return `${ap}, ${nm}`
}
