// Helpers de formato para archivos BDCC SBS — tabulador como separador, UTF-8

export function fmtFechaBdcc(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return ''
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

export function fmtNumBdcc(n: number | null | undefined, dec = 2): string {
  if (n === null || n === undefined) return (0).toFixed(dec)
  return n.toFixed(dec)
}

export function buildTxt(rows: string[][]): string {
  return rows.map(r => r.join('\t')).join('\n')
}

export function downloadTxt(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
