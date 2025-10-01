// ARQUIVO: src/hooks/useDeviceStatusStream.ts
// PADRÃO OURO APLICADO - Hook estável para SSE sem loops infinitos

import { useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

interface DeviceStatus {
  id: string
  status: 'connected' | 'disconnected' | 'connecting' | 'error'
  last_seen?: string
  qr_code?: string
}

type DeviceStatusCallback = (status: DeviceStatus) => void

// PADRÃO OURO APLICADO - Hook estável para SSE sem loops infinitos
export function useDeviceStatusStream(onStatusUpdate: DeviceStatusCallback) {
  const { session } = useAuth()
  const abortControllerRef = useRef<AbortController | null>(null)
  const onStatusUpdateRef = useRef(onStatusUpdate)

  // Estabilizar o callback usando useRef
  useEffect(() => {
    onStatusUpdateRef.current = onStatusUpdate
  }, [onStatusUpdate])

  const connect = useCallback(async () => {
    if (!session?.access_token) return

    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    try {
      const response = await fetch('/api/devices/status-stream', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        signal,
      })

      if (!response.ok || !response.body) {
        throw new Error(`Server error: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6))
              onStatusUpdateRef.current(data)
            } catch (e) { 
              console.error('[SSE] JSON Parse Error', e) 
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error(`[SSE] Connection error on /api/devices/status-stream:`, err)
        toast.error(`Falha na conexão em tempo real: /api/devices/status-stream`)
      }
    }
  }, [session])

  useEffect(() => {
    connect()
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [connect])
}