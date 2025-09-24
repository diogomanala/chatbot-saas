'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  MessageSquare,
  Plus,
  Edit,
  Trash2,
  ArrowLeft,
  Bot,
  Lightbulb,
} from 'lucide-react'

interface Chatbot {id: string
  name: string
  description: string | null
  working_hours_start?: number | null;
  working_hours_end?: number | null;
  out_of_hours_message?: string | null;
}

interface Gatilho {
  id: string
  name: string
  description: string | null
  patterns: string[]
  responses: string[]
  is_active: boolean
  created_at: string
}

// Tipos específicos para operações do Supabase
type GatilhoInsert = {
  chatbot_id: string
  name: string
  description: string | null
  patterns: string[]
  responses: string[]
  is_active: boolean
}

type GatilhoUpdate = {
  name?: string
  description?: string | null
  patterns?: string[]
  responses?: string[]
  is_active?: boolean
}

export default function GatilhosPage() {
  const params = useParams()
  const router = useRouter()
  const { organization } = useAuth()
  const chatbotId = params.id as string
  
  const [chatbot, setChatbot] = useState<Chatbot | null>(null)
  const [gatilhos, setGatilhos] = useState<Gatilho[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editingGatilho, setEditingGatilho] = useState<Gatilho | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    keywords: '',
    response: '',
  })

  useEffect(() => {
    if (organization?.id && chatbotId) {
      fetchData()
    }
  }, [organization?.id, chatbotId])

  const fetchData = async () => {
    if (!organization?.id || !chatbotId) return

    try {
      const [chatbotRes, gatilhosRes] = await Promise.all([
        supabase
          .from('chatbots')
          .select('id, name, description')
          .eq('id', chatbotId)
          .eq('org_id', organization.id)
          .single(),
        
        supabase
          .from('intents')
          .select('id, name, description, patterns, responses, is_active, created_at, updated_at')
          .eq('chatbot_id', chatbotId)
          .order('created_at', { ascending: false })
      ])

      if (chatbotRes.error) {
        if (chatbotRes.error.code === 'PGRST116') {
          toast.error('Chatbot não encontrado')
          router.push('/dashboard/chatbots')
          return
        }
        throw chatbotRes.error
      }
      
      if (gatilhosRes.error) throw gatilhosRes.error

      setChatbot(chatbotRes.data)
      setGatilhos(gatilhosRes.data || [])
    } catch (error) {
      console.error('Error fetching data:', {
        message: error?.message || 'Unknown error',
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        chatbotId: params.id
      })
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({ name: '', description: '', keywords: '', response: '' })
    setEditingGatilho(null)
    setCreating(false)
    setIsDialogOpen(false)
  }

  const handleSubmit = async () => {
    if (!organization?.id || !chatbotId || !formData.name.trim() || !formData.response.trim()) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    setCreating(true)
    try {
      const patterns = formData.keywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0)

      const responses = formData.response
        .split('\n')
        .map(r => r.trim())
        .filter(r => r.length > 0)

      const data = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        patterns: patterns,
        responses: responses,
        chatbot_id: chatbotId,
        is_active: true,
      }

      if (editingGatilho) {
        // Atualizar gatilho existente
        const updateData: GatilhoUpdate = {
          name: data.name,
          description: data.description,
          patterns: data.patterns,
          responses: data.responses,
          is_active: data.is_active
        }
        
        const { error } = await supabase
          .from('intents')
          .update(updateData)
          .eq('id', editingGatilho.id)

        if (error) throw error
        toast.success('Gatilho atualizado com sucesso!')
      } else {
        // Criar novo gatilho
        const insertData: GatilhoInsert = {
          chatbot_id: data.chatbot_id,
          name: data.name,
          description: data.description,
          patterns: data.patterns,
          responses: data.responses,
          is_active: data.is_active
        }
        
        const { error } = await supabase
          .from('intents')
          .insert([insertData])

        if (error) throw error
        toast.success('Gatilho criado com sucesso!')
      }

      resetForm()
      fetchData()
      setIsDialogOpen(false)
    } catch (error) {
      console.error('Error saving gatilho:', error)
      toast.error('Erro ao salvar gatilho')
    } finally {
      setCreating(false)
    }
  }

  const deleteGatilho = async (gatilhoId: string) => {
    if (!confirm('Tem certeza que deseja excluir este gatilho?')) return

    try {
      const { error } = await supabase
        .from('intents')
        .delete()
        .eq('id', gatilhoId)

      if (error) throw error
      
      toast.success('Gatilho excluído com sucesso!')
      fetchData()
    } catch (error) {
      console.error('Error deleting gatilho:', error)
      toast.error('Erro ao excluir gatilho')
    }
  }

  const toggleGatilho = async (gatilho: Gatilho) => {
    try {
      const updateData: GatilhoUpdate = {
        is_active: !gatilho.is_active
      }
      
      const { error } = await supabase
        .from('intents')
        .update(updateData)
        .eq('id', gatilho.id)

      if (error) throw error
      
      toast.success(`Gatilho ${!gatilho.is_active ? 'ativado' : 'desativado'} com sucesso!`)
      fetchData()
    } catch (error) {
      console.error('Error toggling gatilho:', error)
      toast.error('Erro ao alterar status do gatilho')
    }
  }

  const handleEdit = (gatilho: Gatilho) => {
    setEditingGatilho(gatilho)
    setFormData({
      name: gatilho.name || '',
      description: gatilho.description || '',
      keywords: (gatilho.patterns || []).join(', '),
      response: (gatilho.responses || []).join('\n')
    })
    setIsDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Gatilhos</h2>
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!chatbot) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Chatbot não encontrado</h2>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Bot className="h-8 w-8" />
              {chatbot.name}
            </h2>
            <p className="text-muted-foreground">
              Gerencie os gatilhos e respostas automáticas
            </p>
          </div>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Gatilho
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingGatilho ? 'Editar Gatilho' : 'Criar Novo Gatilho'}
              </DialogTitle>
              <DialogDescription>
                {editingGatilho 
                  ? 'Atualize as informações do seu gatilho.'
                  : 'Configure um novo gatilho para responder automaticamente às mensagens.'
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nome do Gatilho *</label>
                <Input
                  placeholder="Ex: Saudação, Horário de Funcionamento"
                  value={formData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Descrição</label>
                <Input
                  placeholder="Descreva quando este gatilho deve ser acionado..."
                  value={formData.description}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Palavras-chave (separadas por vírgula)</label>
                <Input
                  placeholder="oi, olá, bom dia, boa tarde"
                  value={formData.keywords}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, keywords: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Digite as palavras que devem acionar este gatilho, separadas por vírgula.
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium">Mensagens de Resposta * (uma por linha)</label>
                <Textarea
                  placeholder="Olá! Como posso ajudá-lo hoje?\nOi! Em que posso te ajudar?"
                  value={formData.response}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, response: e.target.value }))}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Digite uma resposta por linha. O bot escolherá uma aleatoriamente.
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  onClick={resetForm}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={creating || !formData.name.trim() || !formData.response.trim()}
                  className="flex-1"
                >
                  {creating ? 'Salvando...' : (editingGatilho ? 'Atualizar Gatilho' : 'Criar Gatilho')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {gatilhos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum gatilho configurado</h3>
            <p className="text-muted-foreground text-center mb-4">
              Crie gatilhos para que seu chatbot responda automaticamente às mensagens dos usuários.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {gatilhos.map((gatilho) => (
            <Card key={gatilho.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      {gatilho.name}
                    </CardTitle>
                    {gatilho.description && (
                      <CardDescription>{gatilho.description}</CardDescription>
                    )}
                  </div>
                  <Badge variant={gatilho.is_active ? 'default' : 'secondary'}>
                    {gatilho.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Palavras-chave:</h4>
                    <div className="flex flex-wrap gap-1">
                      {gatilho.patterns.map((pattern, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {pattern}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium mb-2">Respostas:</h4>
                    <div className="space-y-2">
                      {gatilho.responses.map((response, index) => (
                        <p key={index} className="text-sm text-muted-foreground bg-gray-50 p-3 rounded-md">
                          {response}
                        </p>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-muted-foreground">
                      Criado em: {new Date(gatilho.created_at).toLocaleDateString('pt-BR')}
                    </span>
                    
                    <div className="flex gap-2">
                      <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(gatilho)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </Button>
                      
                      <Button
                        size="sm"
                        variant={gatilho.is_active ? 'secondary' : 'default'}
                        onClick={() => toggleGatilho(gatilho)}
                      >
                        {gatilho.is_active ? 'Desativar' : 'Ativar'}
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteGatilho(gatilho.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}