const PREFIX = '[CEJUASSA API]'

/**
 * Retorna una Response de error con mensaje público genérico.
 * El error interno (si existe) se registra solo en el servidor.
 */
export function apiError(
  status: number,
  publicMessage: string,
  internalError?: unknown
): Response {
  if (internalError) {
    const msg = internalError instanceof Error ? internalError.message : String(internalError)
    console.error(`${PREFIX} [${status}] ${publicMessage}:`, msg)
  }
  return Response.json({ error: publicMessage }, { status })
}

export function apiSuccess(data: Record<string, unknown> = {}): Response {
  return Response.json({ success: true, ...data })
}
