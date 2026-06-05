'use client'
import { useState, useEffect } from 'react'
import { createClient } from './supabase'

export function useRol() {
  const [rol, setRol] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRol() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', user.id)
        .maybeSingle()
      setRol(data?.rol ?? null)
      setLoading(false)
    }
    fetchRol()
  }, [])

  return { rol, loading }
}
