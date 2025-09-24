'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import Link from 'next/link'
import ChatInterface from '@/components/ChatInterface'
import {
  Bot,
  Plus,
  Settings,
  Trash2,
  MessageSquare,
  MessageCircle,
  Smartphone,
  Edit,
  Eye,
  Clock,
  Webhook,
  Brain,
  Building,
} from 'lucide-react'

interface Device {
  id: string
  name: string
  status: string
}

interface Chatbot {
  id: string
  name: string
  org_id: string
  groq_model: string
  temperature: number
  system_prompt: string
  default_fallback_enabled?: boolean
  company_prompt?: string | null
  business_hours?: string | null
  fallback_message?: string | null
  webhook_url?: string | null
  auto_response_enabled?: boolean
  business_context?: string | null
  response_rules?: string | null
  created_at: string
  updated_at: string
  working_hours_start?: number | null;
  working_hours_end?: number | null;
  out_of_hours_message?: string | null;
  device_id?: string | null;
  is_active?: boolean;
}

// Tipos específicos para operações do Supabase
type ChatbotInsert = {
  name: string
  org_id: string
  groq_model?: string
  temperature?: number
  system_prompt?: string
  default_fallback_enabled?: boolean
  company_prompt?: string | null
  business_hours?: string | null
  fallback_message?: string | null
  webhook_url?: string | null
  auto_response_enabled?: boolean
  business_context?: string | null
  response_rules?: string | null
}

type ChatbotUpdate = {
  name?: string
  groq_model?: string
  temperature?: number
  system_prompt?: string
  default_fallback_enabled?: boolean
  company_prompt?: string | null
  business_hours?: string | null
  fallback_message?: string | null
  webhook_url?: string | null
  auto_response_enabled?: boolean
  business_context?: string | null
  response_rules?: string | null
}

const GROQ_MODELS = [
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Recomendado)' },
  { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (Rápido)' },
  { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
  { value: 'gemma2-9b-it', label: 'Gemma 2 9B' }
]

const PROMPT_EXAMPLES = [
  {
    name: 'Atendimento ao Cliente',
    prompt: 'Você é um assistente de atendimento ao cliente profissional e prestativo. Responda sempre de forma educada, clara e objetiva. Ajude os clientes com suas dúvidas sobre produtos, pedidos e serviços. Se não souber uma informação específica, oriente o cliente a entrar em contato com nossa equipe especializada.'
  },
  {
    name: 'Vendas e Produtos',
    prompt: 'Você é um consultor de vendas especializado em nossos produtos. Seu objetivo é ajudar os clientes a encontrar a melhor solução para suas necessidades, apresentando os benefícios dos produtos de forma clara e convincente. Seja sempre honesto sobre limitações e faça perguntas para entender melhor as necessidades do cliente.'
  },
  {
    name: 'Suporte Técnico',
    prompt: 'Você é um especialista em suporte técnico. Ajude os usuários a resolver problemas técnicos de forma didática e passo a passo. Use linguagem simples e evite jargões técnicos desnecessários. Sempre confirme se o problema foi resolvido antes de encerrar o atendimento.'
  },
  {
    name: 'Agendamento de Consultas',
    prompt: 'Você é um assistente para agendamento de consultas e serviços. Seja cordial e eficiente ao ajudar os clientes a marcar, remarcar ou cancelar agendamentos. Sempre confirme os dados do agendamento e forneça informações sobre preparação, se necessário.'
  },
  {
    name: 'Educacional',
    prompt: 'Você é um assistente educacional que ajuda estudantes com dúvidas acadêmicas. Explique conceitos de forma clara e didática, use exemplos práticos e incentive o aprendizado. Adapte sua linguagem ao nível de conhecimento do estudante.'
  }
]

export default function ChatbotsPage() {
  const { organization } = useAuth()
  const [chatbots, setChatbots] = useState<Chatbot[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editingBot, setEditingBot] = useState<Chatbot | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [testingBot, setTestingBot] = useState<Chatbot | null>(null)

  
  const [formData, setFormData] = useState({
    name: '',
    device_id: null as string | null,
    system_prompt: 'Você é um assistente útil e amigável para suporte via WhatsApp.',
    groq_model: 'llama-3.3-70b-versatile',
    temperature: 0.7,
    webhook_url: '',
    default_fallback_enabled: true,
    is_active: true
  })

  useEffect(() => {
    if (organization?.id) {
      fetchData()
    }
  }, [organization?.id])



  const createDemoChatbot = async () => {
    if (!organization?.id) return

    try {
      const demoChatbot = {
        name: 'Assistente de Demonstração',
        groq_model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        system_prompt: 'Você é um assistente virtual amigável e prestativo. Responda de forma clara e educada, sempre tentando ajudar o usuário da melhor forma possível.'
      }

      const response = await fetch('/api/chatbots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(demoChatbot)
      })

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro na resposta:', errorText);
        throw new Error('Erro ao criar chatbot de demonstração');
      }

      toast.success('Chatbot de demonstração criado com sucesso!')
      return true
    } catch (error) {
      console.error('Error creating demo chatbot:', error)
      return false
    }
  }

  const fetchData = async () => {
    if (!organization?.id) {
      console.log('Organization ID not available:', organization)
      return
    }

    console.log('Fetching data for organization:', organization.id)
    setLoading(true)

    try {
      // Obter o token de acesso atual do Supabase
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        console.error('Sessão não encontrada')
        setLoading(false)
        return
      }

      console.log('Making API requests...')
      const [chatbotsRes, devicesRes] = await Promise.all([
        fetch('/api/chatbots', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }).then(res => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          return res.json();
        }),
        
        fetch('/api/devices', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }).then(res => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          return res.json();
        })
      ])

      console.log('Chatbots response:', chatbotsRes)
      console.log('Devices response:', devicesRes)

      if (chatbotsRes.error) {
        console.error('Chatbots API error:', chatbotsRes.error)
        throw new Error(chatbotsRes.error)
      }
      if (devicesRes.error) {
        console.error('Devices API error:', devicesRes.error)
        throw new Error(devicesRes.error)
      }

      const chatbots = chatbotsRes.chatbots || []
      
      // Se não há chatbots, criar um de demonstração
      if (chatbots.length === 0) {
        const demoCreated = await createDemoChatbot()
        if (demoCreated) {
          // Recarregar os dados após criar o chatbot de demo
          const updatedRes = await fetch('/api/chatbots', {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json'
            }
          }).then(res => {
            if (!res.ok) {
              throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.json();
          })
          
          setChatbots(updatedRes.chatbots || [])
        } else {
          setChatbots([])
        }
      } else {
        setChatbots(chatbots)
      }
      
      console.log('Setting data - Chatbots:', chatbots.length, 'Devices:', devicesRes.devices?.length || 0)
      setDevices(devicesRes.devices || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }



  const resetForm = () => {
    setFormData({
      name: '',
      device_id: null,
      system_prompt: 'Você é um assistente útil e amigável para suporte via WhatsApp.',
      groq_model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      webhook_url: '',
      default_fallback_enabled: true,
      is_active: true
    })
  }

  const validateForm = () => {
    const errors: string[] = []
    
    if (!formData.name.trim()) {
      errors.push('Nome do chatbot é obrigatório')
    }
    
    if (!formData.system_prompt.trim()) {
      errors.push('Prompt do sistema é obrigatório')
    }
    
    if (formData.system_prompt.length < 10) {
      errors.push('Prompt do sistema deve ter pelo menos 10 caracteres')
    }
    
    if (formData.temperature < 0 || formData.temperature > 2) {
      errors.push('Temperatura deve estar entre 0 e 2')
    }
    
    return errors
  }

  const handleSubmit = async () => {
    if (!organization?.id) return

    const validationErrors = validateForm()
    if (validationErrors.length > 0) {
      validationErrors.forEach(error => toast.error(error))
      return
    }

    setCreating(true)
    
    try {
      // Obter o token de acesso atual do Supabase uma única vez
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Sessão não encontrada')
      }

      // Se está criando um chatbot ativo, desativar todos os outros primeiro
    if (formData.is_active) {
      console.log('[ChatbotManager] Ativando chatbot via criação');
      
      try {
        const deactivateResponse = await fetch('/api/chatbots/deactivate-all', {
          method: 'POST',
          credentials: 'include',
          headers: { 
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json' 
          }
        });
        
        if (!deactivateResponse.ok) {
          console.warn('Aviso: Não foi possível desativar outros chatbots');
        }
      } catch (error) {
        console.warn('Aviso: Erro ao desativar outros chatbots:', error);
      }
    }

      const chatbotData = {
        name: formData.name.trim(),
        system_prompt: formData.system_prompt.trim(),
        groq_model: formData.groq_model,
        temperature: formData.temperature,
        default_fallback_enabled: formData.default_fallback_enabled,
        webhook_url: formData.webhook_url,
        device_id: formData.device_id,
        is_active: formData.is_active
      }

      if (editingBot) {
        // Atualizar chatbot existente
        const response = await fetch(`/api/chatbots?id=${editingBot.id}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify(chatbotData)
        })

        if (!response.ok) {
          const errorText = await response.text();
          let error;
          try {
            error = JSON.parse(errorText);
          } catch {
            error = { error: errorText };
          }
          throw new Error(error.error || 'Erro ao atualizar chatbot');
        }

        toast.success('Chatbot atualizado com sucesso!')
      } else {
        // Obter o token de acesso atual do Supabase para criação
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          throw new Error('Sessão não encontrada')
        }

        // Criar novo chatbot
        const response = await fetch('/api/chatbots', {
          method: 'POST',
          credentials: 'include',
          headers: { 
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify(chatbotData)
        })

        if (!response.ok) {
          const errorText = await response.text();
          let error;
          try {
            error = JSON.parse(errorText);
          } catch {
            error = { error: errorText };
          }
          throw new Error(error.error || 'Erro ao criar chatbot');
        }

        toast.success('Chatbot criado com sucesso!')
      }

      // Sucesso - resetar tudo e fechar dialog
      setEditingBot(null)
      resetForm()
      setDialogOpen(false)
      fetchData()
      
    } catch (error) {
      console.error('Erro ao salvar chatbot:', error)
      toast.error('Erro ao salvar chatbot')
    } finally {
      // SEMPRE resetar creating, independente de sucesso ou erro
      setCreating(false)
    }
  }

  const deleteChatbot = async (chatbotId: string) => {
    if (!confirm('Tem certeza que deseja excluir este chatbot?')) return

    try {
      const response = await fetch(`/api/chatbots?id=${chatbotId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (!response.ok) {
        const errorText = await response.text();
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText };
        }
        throw new Error(error.error || 'Erro ao excluir chatbot');
      }
      
      toast.success('Chatbot excluído com sucesso!')
      fetchData()
    } catch (error) {
      console.error('Error deleting chatbot:', error)
      toast.error('Erro ao excluir chatbot')
    }
  }

  const toggleChatbot = async (chatbot: Chatbot) => {
    try {
      // Obter o token de acesso atual do Supabase
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Sessão não encontrada')
      }

      const newActiveState = !chatbot.is_active;
      
      // Se está ativando um chatbot, desativar todos os outros primeiro
      if (newActiveState) {
        console.log('[ChatbotManager] Ativando chatbot:', chatbot.id);
        
        try {
          const deactivateResponse = await fetch('/api/chatbots/deactivate-all', {
            method: 'POST',
            credentials: 'include',
            headers: { 
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json' 
            }
          });
          
          if (!deactivateResponse.ok) {
            console.warn('Aviso: Não foi possível desativar outros chatbots');
          }
        } catch (error) {
          console.warn('Aviso: Erro ao desativar outros chatbots:', error);
        }
      }
      
      const updateData = {
        is_active: newActiveState
      }
      
      const response = await fetch(`/api/chatbots?id=${chatbot.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(updateData)
      })

      if (!response.ok) {
        const errorText = await response.text();
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText };
        }
        throw new Error(error.error || 'Erro ao alterar status do chatbot');
      }
      
      toast.success(`Chatbot ${newActiveState ? 'ativado' : 'desativado'} com sucesso!`)
      fetchData()
    } catch (error) {
      console.error('Error toggling chatbot:', error)
      toast.error('Erro ao alterar status do chatbot')
    }
  }

  const startEdit = (chatbot: Chatbot) => {
    setEditingBot(chatbot)
    setCreating(false)
    setFormData({
      name: chatbot.name,
      device_id: chatbot.device_id || null,
      system_prompt: chatbot.system_prompt,
      groq_model: chatbot.groq_model,
      temperature: chatbot.temperature,
      webhook_url: chatbot.webhook_url || '',
      default_fallback_enabled: chatbot.default_fallback_enabled || false,
      is_active: chatbot.is_active || false
    })
    setDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Chatbots</h2>
            <p className="text-muted-foreground">Gerencie seus chatbots</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
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
          <h2 className="text-3xl font-bold tracking-tight">Chatbots</h2>
          <p className="text-muted-foreground">
            Gerencie seus chatbots e suas configurações
          </p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={(open) => {
                 setDialogOpen(open)
                 if (!open) {
                   setEditingBot(null)
                   resetForm()
                   setCreating(false)
                 }
               }}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setCreating(false)
              setEditingBot(null)
              resetForm()
              setDialogOpen(true)
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Chatbot
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingBot ? 'Editar Chatbot' : 'Criar Novo Chatbot'}
              </DialogTitle>
              <DialogDescription>
                {editingBot 
                  ? 'Atualize as informações do seu chatbot.'
                  : 'Configure um novo chatbot para sua organização.'
                }
              </DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic" className="flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  Básico
                </TabsTrigger>
                <TabsTrigger value="ai" className="flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  IA
                </TabsTrigger>
                <TabsTrigger value="business" className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Negócio
                </TabsTrigger>
                <TabsTrigger value="integrations" className="flex items-center gap-2">
                  <Webhook className="h-4 w-4" />
                  Integrações
                </TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nome do Chatbot *</Label>
                    <Input
                      id="name"
                      placeholder="Ex: Atendimento Principal"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className={!formData.name.trim() ? 'border-red-300' : ''}
                    />
                    {!formData.name.trim() && (
                      <p className="text-xs text-red-500 mt-1">Campo obrigatório</p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="device">Dispositivo</Label>
                    <Select
                      value={formData.device_id || 'none'}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, device_id: value === 'none' ? null : value as string }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um dispositivo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum dispositivo</SelectItem>
                        {devices.map((device) => (
                          <SelectItem key={device.id} value={device.id}>
                            {device.name} ({device.status === 'connected' ? '🟢 Conectado' : device.status === 'error' ? '🔴 Erro' : '🟡 ' + device.status})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => {
                      // Permite múltiplos chatbots ativos simultaneamente
                      setFormData(prev => ({ ...prev, is_active: checked }))
                    }}
                  />
                  <Label htmlFor="is_active" className="text-sm font-medium">
                    Chatbot Ativo
                  </Label>
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="system_prompt">Prompt do Sistema *</Label>
                    <Select onValueChange={(value) => {
                      const example = PROMPT_EXAMPLES.find(ex => ex.name === value)
                      if (example) {
                        setFormData(prev => ({ ...prev, system_prompt: example.prompt }))
                      }
                    }}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Usar exemplo" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROMPT_EXAMPLES.map((example) => (
                          <SelectItem key={example.name} value={example.name}>
                            {example.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea
                    id="system_prompt"
                    placeholder="Você é um assistente útil e amigável para suporte via WhatsApp."
                    value={formData.system_prompt}
                    onChange={(e) => setFormData(prev => ({ ...prev, system_prompt: e.target.value }))}
                    rows={4}
                    className={formData.system_prompt.length < 10 ? 'border-red-300' : ''}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.system_prompt.length}/500 caracteres (mínimo 10)
                  </p>
                  {formData.system_prompt.length < 10 && formData.system_prompt.length > 0 && (
                    <p className="text-xs text-red-500">Mínimo de 10 caracteres necessário</p>
                  )}
                </div>


              </TabsContent>

              <TabsContent value="ai" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="groq_model">Modelo de IA</Label>
                  <Select 
                    value={formData.groq_model} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, groq_model: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      {GROQ_MODELS.map((model) => (
                        <SelectItem key={model.value} value={model.value}>
                          {model.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Temperatura ({formData.temperature})</Label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={formData.temperature}
                    onChange={(e) => setFormData(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Mais focado (0)</span>
                    <span>Balanceado (1)</span>
                    <span>Mais criativo (2)</span>
                  </div>
                  {(formData.temperature < 0 || formData.temperature > 2) && (
                    <p className="text-xs text-red-500 mt-1">Temperatura deve estar entre 0 e 2</p>
                  )}
                </div>






              </TabsContent>

              <TabsContent value="business" className="space-y-4 mt-4">
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Configurações de Negócio</h4>
                  <p className="text-sm text-muted-foreground">
                    Configure aspectos específicos do seu negócio aqui.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="integrations" className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="webhook_url">URL do Webhook</Label>
                  <Input
                    id="webhook_url"
                    placeholder="https://sua-api.com/webhook"
                    value={formData.webhook_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, webhook_url: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    URL para receber notificações de mensagens
                  </p>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Integrações Disponíveis</h4>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4" />
                      <span>WhatsApp Business API</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Webhook className="h-4 w-4" />
                      <span>Webhooks Personalizados</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      <span>APIs Externas</span>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            
            <div className="mt-6">
              <Button 
                onClick={handleSubmit} 
                disabled={creating || !formData.name.trim() || formData.system_prompt.length < 10}
                className="w-full"
              >
                {creating ? 'Salvando...' : (editingBot ? 'Atualizar Chatbot' : 'Criar Chatbot')}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                * Campos obrigatórios
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Informação de Onboarding sobre Chatbot Exclusivo */}
      {chatbots.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900 mb-1">💡 Dica: Chatbot Exclusivo</h4>
                <p className="text-sm text-blue-700 mb-2">
                  Apenas <strong>um chatbot pode estar ativo</strong> por vez para garantir treinamento exclusivo e respostas consistentes.
                </p>
                <div className="text-xs text-blue-600 space-y-1">
                  <div className="flex items-center gap-1">
                    <span className="w-1 h-1 bg-blue-400 rounded-full"></span>
                    <span>Desative outros chatbots antes de ativar um novo</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-1 h-1 bg-blue-400 rounded-full"></span>
                    <span>Teste sempre antes de ativar em produção</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-1 h-1 bg-blue-400 rounded-full"></span>
                    <span>Configure gatilhos específicos para melhor performance</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {chatbots.length === 0 ? (
        <div className="space-y-6">
          {/* Tutorial/Onboarding */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Bem-vindo ao SaaS Chatbot!
              </CardTitle>
              <CardDescription>
                Siga estes passos simples para criar seu primeiro chatbot inteligente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
                    1
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Conecte um Dispositivo</h4>
                    <p className="text-sm text-muted-foreground">
                      Configure um dispositivo WhatsApp para enviar e receber mensagens
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
                    2
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Crie seu Chatbot</h4>
                    <p className="text-sm text-muted-foreground">
                      Defina a personalidade e comportamento do seu assistente virtual
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
                    3
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Teste e Ative</h4>
                    <p className="text-sm text-muted-foreground">
                      Teste as respostas e ative o chatbot para começar a atender
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
               <Bot className="h-12 w-12 text-muted-foreground mb-4" />
               <h3 className="text-lg font-semibold mb-2">Nenhum chatbot encontrado</h3>
               <p className="text-muted-foreground text-center mb-6">
                 Crie seu primeiro chatbot para começar a automatizar conversas.
               </p>
               <Dialog>
                 <DialogTrigger asChild>
                   <Button size="lg">
                     <Plus className="h-4 w-4 mr-2" />
                     Criar Primeiro Chatbot
                   </Button>
                 </DialogTrigger>
                 <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingBot ? 'Editar Chatbot' : 'Criar Novo Chatbot'}</DialogTitle>
                     <DialogDescription>
                       {editingBot ? 'Atualize as configurações do seu chatbot' : 'Configure seu assistente virtual inteligente'}
                     </DialogDescription>
                   </DialogHeader>
                   
                   <div className="space-y-6">
                     <div className="grid grid-cols-2 gap-4">
                       <div>
                         <Label htmlFor="name">Nome do Chatbot *</Label>
                         <Input
                           id="name"
                           placeholder="Ex: Atendimento Loja"
                           value={formData.name}
                           onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                           className={!formData.name.trim() ? 'border-red-300' : ''}
                         />
                         {!formData.name.trim() && (
                           <p className="text-xs text-red-500 mt-1">Campo obrigatório</p>
                         )}
                       </div>
                       
                       <div>
                         <Label htmlFor="device">Dispositivo WhatsApp</Label>
                         <Select 
                           value={formData.device_id || ''} 
                           onValueChange={(value) => setFormData(prev => ({ ...prev, device_id: value as string | null }))}
                         >
                           <SelectTrigger>
                             <SelectValue placeholder="Selecione um dispositivo" />
                           </SelectTrigger>
                           <SelectContent>
                             {devices.map((device) => (
                               <SelectItem key={device.id} value={device.id}>
                                 <div className="flex items-center gap-2">
                                   <Smartphone className="h-4 w-4" />
                                   {device.name}
                                   <Badge variant={device.status === 'connected' ? 'default' : 'secondary'}>
                                     {device.status === 'connected' ? 'Conectado' : 'Desconectado'}
                                   </Badge>
                                 </div>
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                         {devices.length === 0 && (
                           <p className="text-xs text-muted-foreground mt-1">
                             Nenhum dispositivo encontrado. Configure um dispositivo primeiro.
                           </p>
                         )}
                       </div>
                     </div>
                     
                     <div>
                       <div className="flex items-center justify-between mb-2">
                         <Label htmlFor="system_prompt">Prompt do Sistema *</Label>
                         <Select onValueChange={(value) => {
                           const example = PROMPT_EXAMPLES.find(ex => ex.name === value)
                           if (example) {
                             setFormData(prev => ({ ...prev, system_prompt: example.prompt }))
                           }
                         }}>
                           <SelectTrigger className="w-48">
                             <SelectValue placeholder="Usar exemplo" />
                           </SelectTrigger>
                           <SelectContent>
                             {PROMPT_EXAMPLES.map((example) => (
                               <SelectItem key={example.name} value={example.name}>
                                 {example.name}
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>
                       <Textarea
                         id="system_prompt"
                         placeholder="Descreva como o chatbot deve se comportar..."
                         value={formData.system_prompt}
                         onChange={(e) => setFormData(prev => ({ ...prev, system_prompt: e.target.value }))}
                         rows={4}
                         className={formData.system_prompt.length < 10 ? 'border-red-300' : ''}
                       />
                       <p className="text-xs text-muted-foreground mt-1">
                         {formData.system_prompt.length}/500 caracteres (mínimo 10)
                       </p>
                       {formData.system_prompt.length < 10 && formData.system_prompt.length > 0 && (
                         <p className="text-xs text-red-500">Mínimo de 10 caracteres necessário</p>
                       )}
                     </div>
                     
                     <div className="grid grid-cols-2 gap-4">
                       <div>
                         <Label htmlFor="model">Modelo de IA</Label>
                         <Select 
                           value={formData.groq_model} 
                           onValueChange={(value) => setFormData(prev => ({ ...prev, groq_model: value }))}
                         >
                           <SelectTrigger>
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             {GROQ_MODELS.map((model) => (
                               <SelectItem key={model.value} value={model.value}>
                                 {model.label}
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>
                       
                       <div>
                         <Label htmlFor="temperature">Criatividade: {formData.temperature}</Label>
                         <input
                           id="temperature"
                           type="range"
                           min="0"
                           max="2"
                           step="0.1"
                           value={formData.temperature}
                           onChange={(e) => setFormData(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                           className="w-full"
                         />
                         <div className="flex justify-between text-xs text-muted-foreground">
                           <span>Mais focado (0)</span>
                           <span>Balanceado (1)</span>
                           <span>Mais criativo (2)</span>
                         </div>
                         {(formData.temperature < 0 || formData.temperature > 2) && (
                           <p className="text-xs text-red-500 mt-1">Temperatura deve estar entre 0 e 2</p>
                         )}
                       </div>
                     </div>
                     

                     
                     <div className="grid grid-cols-2 gap-4">

                       
                       <div>
                         <Label htmlFor="webhook_url">Webhook URL (Opcional)</Label>
                         <Input
                           id="webhook_url"
                           placeholder="https://..."
                           value={formData.webhook_url}
                           onChange={(e) => setFormData(prev => ({ ...prev, webhook_url: e.target.value }))}
                         />
                       </div>
                     </div>
                     

                     

                   </div>
                   
                   <div className="flex gap-2 pt-4">
                     <Button 
                       variant="outline" 
                       onClick={() => {
                         setEditingBot(null)
                         resetForm()
                       }}
                       className="flex-1"
                     >
                       Cancelar
                     </Button>
                     <Button 
                       onClick={handleSubmit}
                       disabled={creating || !formData.name.trim() || !formData.system_prompt.trim() || formData.system_prompt.length < 10}
                       className="flex-1"
                     >
                       {creating ? 'Salvando...' : 'Salvar'}
                     </Button>
                   </div>
                   <p className="text-xs text-muted-foreground text-center mt-2">
                     * Campos obrigatórios
                   </p>
                 </DialogContent>
               </Dialog>
             </CardContent>
           </Card>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {chatbots
            .sort((a, b) => {
              // Chatbot ativo sempre no topo
              if (a.is_active && !b.is_active) return -1;
              if (!a.is_active && b.is_active) return 1;
              // Se ambos têm o mesmo status, ordenar por data de criação (mais recente primeiro)
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            })
            .map((chatbot) => (
            <Card key={chatbot.id} className={`${!chatbot.is_active ? 'opacity-75 border-muted' : 'border-primary/20'}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className={`flex items-center gap-2 ${!chatbot.is_active ? 'text-muted-foreground' : ''}`}>
                    <Bot className={`h-5 w-5 ${chatbot.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
                    {chatbot.name}
                  </CardTitle>
                  <Badge 
                    variant={chatbot.is_active ? 'default' : 'secondary'}
                    className={chatbot.is_active ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}
                  >
                    {chatbot.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                <CardDescription className={!chatbot.is_active ? 'text-muted-foreground/70' : ''}>
                  Modelo: {chatbot.groq_model} | Temp: {chatbot.temperature}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className={`text-sm ${!chatbot.is_active ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>
                    <div className="truncate">{chatbot.system_prompt}</div>
                  </div>
                  
                  <div className={`text-sm ${!chatbot.is_active ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>
                    Criado em: {new Date(chatbot.created_at).toLocaleDateString('pt-BR')}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit(chatbot)}
                      className="flex-1"
                      disabled={!chatbot.is_active}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTestingBot(chatbot)}
                      disabled={!chatbot.is_active}
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Testar
                    </Button>
                    
                    <Link href={chatbot.is_active ? `/dashboard/chatbots/${chatbot.id}/intents` : '#'} className={!chatbot.is_active ? 'pointer-events-none' : ''}>
                    <Button size="sm" variant="outline" className="flex-1" disabled={!chatbot.is_active}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Gatilhos
                    </Button>
                  </Link>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={chatbot.is_active ? 'secondary' : 'default'}
                      onClick={() => toggleChatbot(chatbot)}
                      className={`flex-1 ${chatbot.is_active ? 'bg-orange-100 text-orange-800 hover:bg-orange-200 border-orange-200' : 'bg-green-100 text-green-800 hover:bg-green-200 border-green-200'}`}
                    >
                      {chatbot.is_active ? 'Desativar' : 'Ativar'}
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteChatbot(chatbot.id)}
                      disabled={!chatbot.is_active}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Modal de Teste de Chat */}
      <Dialog open={!!testingBot} onOpenChange={() => setTestingBot(null)}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>Testar Chatbot: {testingBot?.name}</DialogTitle>
            <DialogDescription>
              Teste a funcionalidade do seu chatbot em tempo real
            </DialogDescription>
          </DialogHeader>
          {testingBot && (
             <div className="flex-1 overflow-hidden">
               <ChatInterface chatbotId={testingBot.id} chatbotName={testingBot.name} />
             </div>
           )}
        </DialogContent>
      </Dialog>
    </div>
  )
}