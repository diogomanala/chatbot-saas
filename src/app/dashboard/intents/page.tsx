'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  Zap,
  Plus,
  Edit,
  Trash2,
  Bot,
  MessageSquare,
  Search,
  Filter,
} from 'lucide-react'

interface Intent {
  id: string
  chatbot_id: string
  name: string
  patterns: string[]
  responses: string[]
  is_active: boolean
  created_at: string
  updated_at?: string
  chatbot_name?: string
}

interface Chatbot {id: string
  name: string
  working_hours_start?: number | null;
  working_hours_end?: number | null;
  out_of_hours_message?: string | null;
}

export default function GatilhosPage() {
  const { organization } = useAuth()
  const [gatilhos, setGatilhos] = useState<Intent[]>([])
  const [chatbots, setChatbots] = useState<Chatbot[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedChatbot, setSelectedChatbot] = useState<string>('all')
  const [isCreating, setIsCreating] = useState(false)
  const [editingGatilho, setEditingGatilho] = useState<Intent | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    pattern: '',
    response_template: '',
    chatbot_id: '',
    action: 'respond'
  })

  useEffect(() => {
    if (organization?.id) {
      fetchGatilhos()
      fetchChatbots()
    }
  }, [organization?.id])

  const fetchGatilhos = async () => {
    if (!organization?.id) return

    try {
      const { data, error } = await supabase
        .from('intents')
        .select(`
          *,
          chatbots(name)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      const gatilhosWithChatbotName = (data as any[]).map(gatilho => ({
        ...gatilho,
        chatbot_name: gatilho.chatbots?.name || 'Chatbot não encontrado'
      }))

      setGatilhos(gatilhosWithChatbotName)
    } catch (error) {
      console.error('Error fetching gatilhos:', error)
      toast.error('Erro ao carregar gatilhos')
    } finally {
      setLoading(false)
    }
  }

  const fetchChatbots = async () => {
    if (!organization?.id) return

    try {
      const { data, error } = await supabase
        .from('chatbots')
        .select('id, name')
        .eq('org_id', organization.id)

      if (error) throw error
      setChatbots(data || [])
    } catch (error) {
      console.error('Error fetching chatbots:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)

    try {
      // Validação dos campos obrigatórios
      if (!formData.chatbot_id) {
        toast.error('Por favor, selecione um chatbot')
        setIsCreating(false)
        return
      }
      
      if (!formData.name.trim()) {
        toast.error('Por favor, insira um nome para o gatilho')
        setIsCreating(false)
        return
      }
      
      if (!formData.pattern.trim()) {
        toast.error('Por favor, insira pelo menos uma palavra-chave')
        setIsCreating(false)
        return
      }
      
      if (!formData.response_template.trim()) {
        toast.error('Por favor, insira uma resposta')
        setIsCreating(false)
        return
      }

      const gatilhoData = {
        chatbot_id: formData.chatbot_id,
        name: formData.name.trim(),
        patterns: [formData.pattern.trim()],
        responses: [formData.response_template.trim()],
        is_active: true
      }

      if (editingGatilho) {
        const { error } = await supabase
          .from('intents')
          .update(gatilhoData)
          .eq('id', editingGatilho.id)
        
        if (error) {
          console.error('Error updating gatilho:', error)
          alert(`Erro ao atualizar gatilho: ${error.message || error.details || JSON.stringify(error)}`)
          return
        }
      } else {
        const { error } = await supabase
          .from('intents')
          .insert([gatilhoData])
        
        if (error) {
          console.error('Error saving gatilho:', error)
          alert(`Erro ao salvar gatilho: ${error.message || error.details || JSON.stringify(error)}`)
          return
        }
      }

      toast.success(editingGatilho ? 'Gatilho atualizado!' : 'Gatilho criado!')
      setFormData({ name: '', pattern: '', response_template: '', chatbot_id: '', action: 'respond' })
      setEditingGatilho(null)
      setIsDialogOpen(false)
      fetchGatilhos()
    } catch (error: any) {
      console.error('Error saving gatilho:', error)
      toast.error(error.message || 'Erro ao salvar gatilho')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (gatilhoId: string) => {
    if (!confirm('Tem certeza que deseja excluir este gatilho?')) return

    try {
      const { error } = await supabase
        .from('intents')
        .delete()
        .eq('id', gatilhoId)

      if (error) throw error

      toast.success('Gatilho excluído!')
      fetchGatilhos()
    } catch (error: any) {
      console.error('Error deleting gatilho:', error)
      toast.error('Erro ao excluir gatilho')
    }
  }

  const handleEdit = (gatilho: Intent) => {
    setEditingGatilho(gatilho)
    setFormData({
      name: gatilho.name,
      pattern: gatilho.patterns ? gatilho.patterns.join(', ') : '',
      response_template: gatilho.responses ? gatilho.responses.join('\n') : '',
      chatbot_id: gatilho.chatbot_id,
      action: 'respond'
    })
    setIsDialogOpen(true)
  }

  const filteredGatilhos = gatilhos.filter(gatilho => {
    const matchesSearch = gatilho.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          gatilho.patterns?.some(pattern => pattern.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          gatilho.responses?.some(response => response.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesChatbot = selectedChatbot === 'all' || gatilho.chatbot_id === selectedChatbot
    return matchesSearch && matchesChatbot
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Gatilhos</h2>
            <p className="text-muted-foreground">Gerencie todos os gatilhos dos seus chatbots</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
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
          <h2 className="text-3xl font-bold tracking-tight">Gatilhos</h2>
          <p className="text-muted-foreground">
            Gerencie todos os gatilhos dos seus chatbots
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingGatilho(null)
              setFormData({ name: '', pattern: '', response_template: '', chatbot_id: '', action: 'respond' })
              setIsDialogOpen(true)
            }}>
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
                Configure as palavras-chave e respostas do seu gatilho
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome</label>
                  <Input
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value || '' })}
                    placeholder="Ex: Saudação"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Chatbot</label>
                  <Select
                    value={formData.chatbot_id || ''}
                    onValueChange={(value) => setFormData({ ...formData, chatbot_id: value || '' })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um chatbot" />
                    </SelectTrigger>
                    <SelectContent>
                      {chatbots.map((chatbot) => (
                        <SelectItem key={chatbot.id} value={chatbot.id}>
                          {chatbot.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              

              
              <div className="space-y-2">
                <label className="text-sm font-medium">Padrão</label>
                <Input
                  value={formData.pattern || ''}
                  onChange={(e) => setFormData({ ...formData, pattern: e.target.value || '' })}
                  placeholder="Ex: olá, oi, bom dia"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Resposta</label>
                <Textarea
                  value={formData.response_template || ''}
                  onChange={(e) => setFormData({ ...formData, response_template: e.target.value || '' })}
                  placeholder="Olá! Como posso ajudá-lo hoje?"
                  rows={4}
                  required
                />
              </div>
              
              <div className="flex items-center justify-between">
                
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingGatilho(null)
                      setFormData({ name: '', pattern: '', response_template: '', chatbot_id: '', action: 'respond' })
                      setIsDialogOpen(false)
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isCreating}>
                    {isCreating ? 'Salvando...' : (editingGatilho ? 'Atualizar' : 'Salvar')}
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros */}
      <div className="flex space-x-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar gatilhos..."
              value={searchTerm || ''}
              onChange={(e) => setSearchTerm(e.target.value || '')}
              className="pl-10"
            />
          </div>
        </div>
        
        <Select value={selectedChatbot || 'all'} onValueChange={(value) => setSelectedChatbot(value || 'all')}>
          <SelectTrigger className="w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os chatbots</SelectItem>
            {chatbots.map((chatbot) => (
              <SelectItem key={chatbot.id} value={chatbot.id}>
                {chatbot.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista de Gatilhos */}
      {filteredGatilhos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Zap className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || selectedChatbot !== 'all' ? 'Nenhum gatilho encontrado' : 'Nenhum gatilho criado'}
            </h3>
            <p className="text-gray-500 text-center mb-4">
              {searchTerm || selectedChatbot !== 'all' 
                ? 'Tente ajustar os filtros de busca'
                : 'Crie seu primeiro gatilho para começar a automatizar conversas'
              }
            </p>
            {!searchTerm && selectedChatbot === 'all' && (
              <Button onClick={() => {
                    setFormData({ name: '', pattern: '', response_template: '', chatbot_id: '', action: 'respond' })
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeiro Gatilho
                  </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredGatilhos.map((gatilho) => (
            <Card key={gatilho.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{gatilho.name}</CardTitle>
                  <div className="flex items-center space-x-2">

                  </div>
                </div>
                <CardDescription>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Bot className="h-4 w-4" />
                    {gatilho.chatbot_name}
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Padrões:</p>
                     <div className="flex flex-wrap gap-1">
                       {gatilho.patterns?.map((pattern, index) => (
                         <Badge key={index} variant="outline" className="text-xs">
                           {pattern}
                         </Badge>
                       ))}
                     </div>
                  </div>
                  
                  <div>
                       <p className="text-xs font-medium text-gray-500 mb-1">Respostas:</p>
                       <div className="space-y-1">
                         {gatilho.responses?.map((response, index) => (
                           <p key={index} className="text-sm text-gray-700 line-clamp-2">
                             {response}
                           </p>
                         ))}
                       </div>
                     </div>
                  
                  <div className="flex justify-between items-center pt-2">
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(gatilho)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(gatilho.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <Link href={`/dashboard/chatbots/${gatilho.chatbot_id}/intents`}>
                      <Button size="sm" variant="ghost">
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Ver no Bot
                      </Button>
                    </Link>
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