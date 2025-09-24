'use client'

import { useState, useEffect, useRef } from 'react'
import { CheckCircle, XCircle, QrCode, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface DeviceStatusMonitorProps {
  deviceId: string
  onStatusChange?: (status: string) => void
}

export default function DeviceStatusMonitor({ deviceId, onStatusChange }: DeviceStatusMonitorProps) {
  const [status, setStatus] = useState<string>('checking')
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastCheck, setLastCheck] = useState<Date | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const checkStatus = async () => {
    try {
      setError(null)
      
      // Cancelar requisição anterior se existir
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      
      // Criar novo AbortController
      abortControllerRef.current = new AbortController()
      
      // Obter o token de acesso atual do Supabase
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        console.log('Sessão não encontrada para verificar status')
        return
      }
      
      const response = await fetch(`/api/devices/status?device_id=${deviceId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        signal: abortControllerRef.current.signal
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.status !== status) {
        setStatus(data.status)
        onStatusChange?.(data.status)
        
        // Se conectou, recarregar a página após 2 segundos
        if (data.status === 'connected') {
          setTimeout(() => {
            window.location.reload()
          }, 2000)
        }
      }
      
      setLastCheck(new Date())
    } catch (error) {
      // Ignorar erros de abort
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      
      console.error('Erro ao verificar status:', error)
      setError(error instanceof Error ? error.message : 'Erro desconhecido')
    }
  }

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (isMonitoring) {
      // Verificar imediatamente
      checkStatus()
      
      // Depois verificar a cada 5 segundos (reduzido de 3s para evitar sobrecarga)
      interval = setInterval(checkStatus, 5000)
    }

    return () => {
      if (interval) {
        clearInterval(interval)
      }
      // Cancelar requisição pendente ao desmontar
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [isMonitoring, deviceId])

  // Iniciar monitoramento automaticamente
  useEffect(() => {
    setIsMonitoring(true)
    
    // Cleanup ao desmontar o componente
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'disconnected':
        return <XCircle className="h-5 w-5 text-red-500" />
      case 'qr':
        return <QrCode className="h-5 w-5 text-blue-500" />
      case 'checking':
        return <Loader2 className="h-5 w-5 text-gray-500 animate-spin" />
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-500" />
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return 'Conectado'
      case 'disconnected':
        return 'Desconectado'
      case 'qr':
        return 'Aguardando QR Code'
      case 'checking':
        return 'Verificando...'
      default:
        return 'Status desconhecido'
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'disconnected':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'qr':
        return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'checking':
        return 'text-gray-600 bg-gray-50 border-gray-200'
      default:
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Status do Dispositivo</h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={isMonitoring ? "destructive" : "default"}
            onClick={() => setIsMonitoring(!isMonitoring)}
          >
            {isMonitoring ? 'Parar' : 'Iniciar'} Monitoramento
          </Button>
        </div>
      </div>

      <div className={`p-4 rounded-lg border-2 ${getStatusColor()}`}>
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div className="flex-1">
            <p className="font-medium">{getStatusText()}</p>
            {lastCheck && (
              <p className="text-sm opacity-75">
                Última verificação: {lastCheck.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <p className="text-sm text-red-700">Erro: {error}</p>
          </div>
        </div>
      )}

      <div className="text-xs text-gray-500 space-y-1">
        <p>• Evolution API: Conectado</p>
        <p>• Verificação automática a cada 3 segundos</p>
        <p>• Device ID: {deviceId}</p>
      </div>
    </div>
  )
}