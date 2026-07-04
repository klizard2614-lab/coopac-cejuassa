'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { formatNombrePersona } from '@/lib/formatNombre'

type Socio = {
  id: string
  nro_socio: string
  dni: string
  apellidos: string
  nombres: string
}

type Props = {
  value: string
  onChange: (id: string, label: string) => void
}

const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent'

export default function SocioSearch({ value, onChange }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Socio[]>([])
  const [selectedLabel, setSelectedLabel] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Fetch socios when query changes
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([])
      return
    }
    const q = query.trim()
    setLoading(true)
    createClient()
      .from('socios')
      .select('id, nro_socio, dni, apellidos, nombres')
      .or(`apellidos.ilike.%${q}%,nombres.ilike.%${q}%,dni.ilike.%${q}%`)
      .limit(10)
      .then(({ data }) => {
        setResults((data as Socio[]) ?? [])
        setLoading(false)
      })
  }, [query])

  function select(s: Socio) {
    const label = `${formatNombrePersona(s.apellidos, s.nombres)} — DNI: ${s.dni} | Nº ${s.nro_socio}`
    setSelectedLabel(label)
    setQuery('')
    setResults([])
    setOpen(false)
    onChange(s.id, label)
  }

  function clear() {
    setSelectedLabel('')
    setQuery('')
    setResults([])
    onChange('', '')
  }

  return (
    <div ref={ref} className="relative">
      {value && selectedLabel ? (
        <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white">
          <span className="text-sm text-gray-900 flex-1">{selectedLabel}</span>
          <button
            type="button"
            onClick={clear}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none flex-shrink-0"
            title="Quitar selección"
          >
            &times;
          </button>
        </div>
      ) : (
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder="Escribe nombre, apellido o DNI del socio..."
          className={inputCls}
        />
      )}

      {open && (query.length >= 2) && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
          {loading ? (
            <div className="px-4 py-3 text-sm text-gray-400">Buscando...</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400">No se encontraron socios</div>
          ) : (
            <ul className="max-h-52 overflow-y-auto divide-y divide-gray-50">
              {results.map(s => (
                <li
                  key={s.id}
                  onMouseDown={() => select(s)}
                  className="px-4 py-2.5 cursor-pointer hover:bg-blue-50 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-800">{formatNombrePersona(s.apellidos, s.nombres)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">DNI: {s.dni} · Nº Socio: {s.nro_socio}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
