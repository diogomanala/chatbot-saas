'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Smartphone,
  Plus,
  QrCode,
  Trash2,
  RefreshCw,
  Wifi,
  WifiOff,
  Settings,
} from 'lucide-react'
import DeviceStatusMonitor from '@/components/DeviceStatusMonitor'

interface Device {
  id: string
  name: string
  session_name: string
  status: 'disconnected' | 'qr' | 'connecting' | 'connected' | 'error'
  evolution_base_url: string
  evolution_api_key: string
  last_connection: string | null
  webhook_secret: string
  metadata: any
  created_at: string
  qr_code?: string
}

export default function DevicesPage() {
  const { organization, session, loading: authLoading } = useAuth()
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newDeviceName, setNewDeviceName] = useState('')
  const [qrCodeDevice, setQrCodeDevice] = useState<Device | null>(null)

  // Função para buscar dispositivos com status em tempo real
  const fetchDevices = useCallback(async () => {
    if (!organization?.id) return

    try {
      setLoading(true)
      setError(null)
      
      // Obter o token de acesso atual do Supabase
      const { data: { user } } = await supabase.auth.getUser()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!user || !session) {
        throw new Error('Usuário não autenticado')
      }
      
      // Usar a API /devices que verifica status em tempo real
      const response = await fetch('/api/devices', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Authorization': `Bearer ${session.access_token}`,
        },
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || 'Erro ao buscar dispositivos')
      }
      
      const { devices } = await response.json()
      setDevices(devices || [])
    } catch (error: any) {
      console.error('Erro ao buscar dispositivos:', error)
      setError(error.message || 'Erro ao carregar dispositivos')
      toast.error('Erro ao carregar dispositivos')
    } finally {
      setLoading(false)
    }
  }, [organization?.id])

  // Buscar dispositivos quando a organização estiver disponível
  useEffect(() => {
    if (organization?.id) {
      fetchDevices()
    }
  }, [organization?.id, fetchDevices])

  // Detectar quando a página fica visível para atualizar os dispositivos
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && organization?.id) {
        fetchDevices()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [fetchDevices, organization?.id])

  // Nota: Removida verificação manual de status - o Supabase Realtime já cuida das atualizações em tempo real

  const createDevice = useCallback(async () => {
    if (!organization?.id || !newDeviceName.trim()) return

    setCreating(true)
    try {
      // Obter o token de acesso atual do Supabase
      const { data: { user } } = await supabase.auth.getUser()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!user || !session) {
        throw new Error('Usuário não autenticado')
      }

      const response = await fetch('/api/devices/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          name: newDeviceName.trim(),
          org_id: organization.id
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao criar dispositivo')
      }

      toast.success('Dispositivo criado com sucesso!')
      setNewDeviceName('')
      fetchDevices()
    } catch (error) {
      console.error('Erro ao criar dispositivo:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao criar dispositivo')
    } finally {
      setCreating(false)
    }
  }, [organization?.id, newDeviceName, fetchDevices])

  const deleteDevice = useCallback(async (deviceId: string) => {
    if (!confirm('Tem certeza que deseja excluir este dispositivo?')) return

    try {
      // Obter o token de acesso atual do Supabase
      const { data: { user } } = await supabase.auth.getUser()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!user || !session) {
        throw new Error('Usuário não autenticado')
      }

      const response = await fetch('/api/devices/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ deviceId })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao excluir dispositivo')
      }

      toast.success('Dispositivo excluído com sucesso!')
      fetchDevices()
    } catch (error) {
      console.error('Erro ao excluir dispositivo:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir dispositivo')
    }
  }, [fetchDevices])

  const generateQRCode = useCallback(async (device: Device) => {
    try {
      setQrCodeDevice(device)
      
      // Obter o usuário atual e a sessão do Supabase
      const { data: { user } } = await supabase.auth.getUser()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!user || !session) {
        throw new Error('Usuário não autenticado')
      }

      // Log de desenvolvimento para comprimento do token
      if (process.env.NODE_ENV === 'development') {
        console.log('[FRONT] tokenLen=', session.access_token.length)
      }

      console.info('Generating QR code for device:', device.id)

      // Usar a API original do QR code
      const response = await fetch('/api/devices/qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          deviceId: device.id,
          userId: user.id
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao gerar QR Code')
      }

      const result = await response.json()
      
      if (!result.success || !result.qrPngBase64) {
        throw new Error(result.message || 'QR Code não foi gerado corretamente')
      }

      // Construir data URL para exibição
      const qrDataUrl = `data:image/png;base64,${result.qrPngBase64}`

      // Atualizar o dispositivo com o QR code
      setQrCodeDevice(prev => prev ? {
        ...prev,
        qr_code: qrDataUrl
      } : null)

      console.info('QR code generated successfully:', {
        deviceId: device.id,
        source: result.source,
        endpoint: result.details?.endpoint
      })

    } catch (error: any) {
      console.error('Erro ao gerar QR Code:', error)
      toast.error(error.message || 'Erro ao gerar QR Code')
    }
  }, [])

  const getStatusBadge = useCallback((status: Device['status']) => {
    const variants = {
      connected: { 
        variant: 'outline' as const, 
        icon: Wifi, 
        text: 'Conectado',
        className: 'flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border-emerald-200'
      },
      connecting: { 
        variant: 'secondary' as const, 
        icon: Settings, 
        text: 'Conectando',
        className: 'flex items-center gap-1'
      },
      disconnected: { 
        variant: 'destructive' as const, 
        icon: WifiOff, 
        text: 'Desconectado',
        className: 'flex items-center gap-1'
      },
      error: { 
        variant: 'destructive' as const, 
        icon: WifiOff, 
        text: 'Erro',
        className: 'flex items-center gap-1'
      },
      qr: { 
        variant: 'outline' as const, 
        icon: QrCode, 
        text: 'QR Code',
        className: 'flex items-center gap-1'
      }
    }

    const config = variants[status] || variants.disconnected
    const Icon = config.icon

    return (
      <Badge variant={config.variant} className={config.className}>
        {status === 'connected' && (
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
        )}
        <Icon className="h-3 w-3" />
        {config.text}
      </Badge>
    )
  }, [])

  if (authLoading || loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
          <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
        </div>
        
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
                    <div className="h-3 bg-gray-200 rounded w-24 animate-pulse"></div>
                  </div>
                  <div className="h-6 bg-gray-200 rounded w-20 animate-pulse"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Dispositivos WhatsApp</h1>
          <p className="text-muted-foreground">
            Gerencie seus dispositivos WhatsApp conectados
          </p>
        </div>
        
        <Button 
          onClick={() => fetchDevices()}
          disabled={loading}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-600">
              <WifiOff className="h-4 w-4" />
              <span className="font-medium">Erro:</span>
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {devices.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Smartphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Nenhum dispositivo encontrado</h3>
            <p className="text-muted-foreground mb-6">
              Crie seu primeiro dispositivo WhatsApp para começar a usar o chatbot
            </p>
            
            <div className="flex items-center gap-2 max-w-md mx-auto">
              <Input
                placeholder="Nome do dispositivo"
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && createDevice()}
              />
              <Button 
                onClick={createDevice}
                disabled={creating || !newDeviceName.trim()}
              >
                {creating ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeiro Dispositivo
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Adicionar Novo Dispositivo
              </CardTitle>
              <CardDescription>
                Crie um novo dispositivo WhatsApp para expandir seu alcance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Nome do dispositivo"
                  value={newDeviceName}
                  onChange={(e) => setNewDeviceName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && createDevice()}
                />
                <Button 
                  onClick={createDevice}
                  disabled={creating || !newDeviceName.trim()}
                >
                  {creating ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Dispositivo
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {devices.map((device) => (
              <Card key={device.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{device.name}</h3>
                        {getStatusBadge(device.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Sessão: {device.session_name}
                      </p>
                      {device.last_connection && (
                        <p className="text-xs text-muted-foreground">
                          Última conexão: {new Date(device.last_connection).toLocaleString('pt-BR')}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {(device.status === 'disconnected' || device.status === 'error') && (
                        <Button
                          size="sm"
                          onClick={() => generateQRCode(device)}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <QrCode className="h-4 w-4 mr-2" />
                          Conectar Dispositivo
                        </Button>
                      )}
                      
                      {device.status === 'qr' && (
                        <Button
                          size="sm"
                          onClick={() => generateQRCode(device)}
                        >
                          <QrCode className="h-4 w-4 mr-2" />
                          Conectar Dispositivo
                        </Button>
                      )}
                      
                      {device.status === 'connecting' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => generateQRCode(device)}
                        >
                          <QrCode className="h-4 w-4 mr-2" />
                          Gerar QR Code
                        </Button>
                      )}
                      
                      {device.status === 'connected' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => fetchDevices()}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Atualizar
                        </Button>
                      )}
                      
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteDevice(device.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* QR Code Dialog */}
      {qrCodeDevice && (
        <Dialog open={!!qrCodeDevice} onOpenChange={() => setQrCodeDevice(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Conectar Dispositivo: {qrCodeDevice.name}</DialogTitle>
              <DialogDescription>
                Escaneie o QR Code abaixo com o WhatsApp do seu celular
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-white rounded-lg border">
                {qrCodeDevice.qr_code ? (
                  <div className="w-64 h-64">
                    <img 
                      src={qrCodeDevice.qr_code}
                      alt="QR Code para conectar WhatsApp"
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-64 h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                )}
                <p className="text-sm text-muted-foreground text-center">
                  Abra o WhatsApp no seu celular, vá em Dispositivos Conectados e escaneie este código.
                </p>
              </div>
              
              <DeviceStatusMonitor 
                deviceId={qrCodeDevice.id}
                onStatusChange={(status) => {
                  if (status === 'connected') {
                    toast.success('Dispositivo conectado com sucesso!')
                    fetchDevices()
                  }
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}