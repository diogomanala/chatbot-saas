'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  MessageSquare,
  Search,
  Filter,
  User,
  Bot,
  Phone,
  Calendar,
  ArrowUpDown,
} from 'lucide-react'

interface Device {
  id: string
  name: string
}

interface Message {
  id: string
  phone_number: string
  sender_phone: string | null
  receiver_phone: string | null
  message_content: string
  content: string | null
  direction: 'inbound' | 'outbound'
  created_at: string
  device: Device
  metadata: any
}

export default function MessagesPage() {
  const { organization } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDevice, setSelectedDevice] = useState<string>('all')
  const [selectedDirection, setSelectedDirection] = useState<string>('all')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalMessages, setTotalMessages] = useState(0)
  const messagesPerPage = 20

  useEffect(() => {
    if (organization?.id) {
      fetchDevices()
      fetchMessages()
    }
  }, [organization?.id, currentPage, selectedDevice, selectedDirection, selectedType, searchTerm])

  const fetchDevices = async () => {
    if (!organization?.id) return

    try {
      const { data, error } = await supabase
        .from('devices')
        .select('id, name')
        .eq('org_id', organization.id)
        .order('name')

      if (error) throw error
      setDevices(data || [])
    } catch (error) {
      console.error('Error fetching devices:', error)
    }
  }

  const fetchMessages = async () => {
    if (!organization?.id) return

    setLoading(true)
    try {
      let query = supabase
        .from('messages')
        .select(`
          *,
          device:devices(id, name)
        `)
        .eq('org_id', organization.id)

      // Aplicar filtros
      if (selectedDevice && selectedDevice !== 'all') {
        query = query.eq('device_id', selectedDevice)
      }
      
      if (selectedDirection && selectedDirection !== 'all') {
        query = query.eq('direction', selectedDirection)
      }
      
      // Remover filtro por tipo já que não existe message_type na tabela
      // if (selectedType && selectedType !== 'all') {
      //   query = query.eq('message_type', selectedType)
      // }
      
      if (searchTerm) {
        query = query.or(`phone_number.ilike.%${searchTerm}%,sender_phone.ilike.%${searchTerm}%,receiver_phone.ilike.%${searchTerm}%,message_content.ilike.%${searchTerm}%`)
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * messagesPerPage, currentPage * messagesPerPage - 1)

      if (error) throw error
      
      setMessages(data || [])
      setTotalMessages(count || 0)
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatPhoneNumber = (number: string | null | undefined) => {
    // Verificar se o número é válido
    if (!number || typeof number !== 'string') {
      return 'Número não disponível'
    }
    
    // Remover JID do WhatsApp se presente
    let cleanNumber = number
    if (number.includes('@s.whatsapp.net')) {
      cleanNumber = number.replace('@s.whatsapp.net', '')
    }
    
    // Formatar número de telefone brasileiro
    const cleaned = cleanNumber.replace(/\D/g, '')
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
      const ddd = cleaned.substring(2, 4)
      const phone = cleaned.substring(4)
      return `+55 (${ddd}) ${phone.substring(0, phone.length - 4)}-${phone.substring(phone.length - 4)}`
    }
    
    // Se não conseguir formatar, retornar o número limpo
    return cleaned || 'Número não disponível'
  }

  const getMessageTypeIcon = (message: Message) => {
    // Como não temos message_type, vamos determinar o tipo pelo conteúdo
    const content = message.message_content || message.content || ''
    
    // Verificar se é uma imagem, áudio, vídeo ou documento baseado no conteúdo
    if (content.includes('http') && (content.includes('.jpg') || content.includes('.png') || content.includes('.jpeg') || content.includes('.gif'))) {
      return '🖼️'
    }
    if (content.includes('http') && (content.includes('.mp3') || content.includes('.wav') || content.includes('.ogg'))) {
      return '🎵'
    }
    if (content.includes('http') && (content.includes('.mp4') || content.includes('.avi') || content.includes('.mov'))) {
      return '🎥'
    }
    if (content.includes('http') && (content.includes('.pdf') || content.includes('.doc') || content.includes('.docx'))) {
      return '📄'
    }
    
    return '💬'
  }

  const totalPages = Math.ceil(totalMessages / messagesPerPage)

  if (loading && messages.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Mensagens</h2>
            <p className="text-muted-foreground">Visualize todas as conversas</p>
          </div>
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Mensagens</h2>
          <p className="text-muted-foreground">
            {totalMessages} mensagens encontradas
          </p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="text-sm font-medium mb-2 block">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Número ou mensagem..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Dispositivo</label>
              <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os dispositivos</SelectItem>
                  {devices.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Direção</label>
              <Select value={selectedDirection} onValueChange={setSelectedDirection}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as direções</SelectItem>
                  <SelectItem value="inbound">Recebidas</SelectItem>
                  <SelectItem value="outbound">Enviadas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Tipo</label>
              {/* Filtro por tipo removido - campo não existe na tabela */}
            </div>
            
            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm('')
                  setSelectedDevice('all')
                  setSelectedDirection('all')
                  setSelectedType('all')
                  setCurrentPage(1)
                }}
                className="w-full"
              >
                Limpar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Mensagens */}
      {messages.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma mensagem encontrada</h3>
            <p className="text-muted-foreground text-center">
              {searchTerm || selectedDevice || selectedDirection || selectedType
                ? 'Tente ajustar os filtros para encontrar mensagens.'
                : 'As mensagens aparecerão aqui quando você começar a receber conversas.'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {messages.map((message) => (
            <Card key={message.id}>
              <CardContent className="p-4">
                <div className="flex items-start space-x-4">
                  <Avatar>
                    <AvatarFallback>
                      {message.direction === 'inbound' ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Phone className="h-4 w-4" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">
                          {formatPhoneNumber(message.phone_number || message.sender_phone || message.receiver_phone || '')}
                        </span>
                        
                        <Badge variant={message.direction === 'inbound' ? 'secondary' : 'default'}>
                          {message.direction === 'inbound' ? 'Recebida' : 'Enviada'}
                        </Badge>
                        
                        <span className="text-xs text-muted-foreground">
                          {getMessageTypeIcon(message)} Mensagem
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(message.created_at).toLocaleString('pt-BR')}
                      </div>
                    </div>
                    
                    <div className="text-sm text-muted-foreground mb-2">
                      Dispositivo: {message.device?.name || 'Desconhecido'}
                    </div>
                    
                    <div className="bg-gray-50 p-3 rounded-md">
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {message.message_content || message.content || 'Sem conteúdo'}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages} ({totalMessages} mensagens)
          </div>
          
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}