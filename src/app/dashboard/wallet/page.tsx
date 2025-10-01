'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { BILLING } from '@/lib/billing-consts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { addCreditsAction } from './actions'
import {
  Wallet,
  Plus,
  TrendingUp,
  TrendingDown,
  Calendar,
  CreditCard,
  DollarSign,
  History,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
} from 'lucide-react'

interface CreditWallet {
  id: string
  balance: number
  created_at: string
  updated_at: string
}

interface MessageBilling {
  id: string
  org_id: string
  device_id: string | null
  direction: 'inbound' | 'outbound'
  tokens_used: number
  cost_credits: number | null
  charged_at: string | null
  billing_status: 'debited'
  created_at: string
  metadata: any
}

interface UsageEvent {
  id: string
  org_id: string
  agent_id: string | null
  channel: 'web' | 'whatsapp'
  input_tokens: number
  output_tokens: number
  cost_credits: number
  message_id: string | null
  meta: any
  created_at: string
}

export default function WalletPage() {
  const { organization } = useAuth()
  const [wallet, setWallet] = useState<CreditWallet | null>(null)
  const [usageEvents, setUsageEvents] = useState<UsageEvent[]>([])
  const [messageBilling, setMessageBilling] = useState<MessageBilling[]>([])
  const [loading, setLoading] = useState(true)
  const [addingCredits, setAddingCredits] = useState(false)
  const [creditAmount, setCreditAmount] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState('30') // dias
  const [currentPage, setCurrentPage] = useState(1)
  const [totalEntries, setTotalEntries] = useState(0)
  const entriesPerPage = 20

  useEffect(() => {
    if (organization?.id) {
      fetchWalletData()
      fetchUsageEvents()
      fetchMessageBilling()
    }
  }, [organization?.id, currentPage, selectedPeriod])

  const fetchWalletData = async () => {
    if (!organization?.id) return

    try {
      const { data, error } = await supabase
        .from('credit_wallets')
        .select('*')
        .eq('org_id', organization.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      setWallet(data)
    } catch (error) {
      console.error('Error fetching wallet:', error)
    }
  }

  const fetchUsageEvents = async () => {
    if (!organization?.id) return

    try {
      const daysAgo = new Date()
      daysAgo.setDate(daysAgo.getDate() - parseInt(selectedPeriod))

      const query = supabase
        .from('usage_events')
        .select('*')
        .eq('org_id', organization.id)
        .gte('created_at', daysAgo.toISOString())

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      
      setUsageEvents(data || [])
    } catch (error) {
      console.error('Error fetching usage events:', error)
    }
  }

  const fetchMessageBilling = async () => {
    if (!organization?.id) return

    setLoading(true)
    try {
      const daysAgo = new Date()
      daysAgo.setDate(daysAgo.getDate() - parseInt(selectedPeriod))

      const query = supabase
        .from('messages')
        .select('id, org_id, device_id, direction, tokens_used, cost_credits, charged_at, billing_status, created_at, metadata')
        .eq('org_id', organization.id)
        .gte('created_at', daysAgo.toISOString())
        .eq('billing_status', 'debited')

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage - 1)

      if (error) throw error
      
      setMessageBilling(data || [])
      setTotalEntries(count || 0)
    } catch (error) {
      console.error('Error fetching message billing:', error)
    } finally {
      setLoading(false)
    }
  }

  const addCredits = async () => {
    if (!creditAmount || parseFloat(creditAmount) <= 0) {
      toast.error('Digite um valor válido')
      return
    }

    setAddingCredits(true)
    try {
      const amount = parseFloat(creditAmount)
      
      // Usar Server Action para adicionar créditos (garante autenticação correta)
      const result = await addCreditsAction(
        amount,
        `Adição manual de ${amount} créditos via dashboard`
      )

      if (result.success) {
        toast.success(result.message || `${amount} créditos adicionados com sucesso!`)
        setCreditAmount('')
        
        // Atualizar dados da carteira e histórico
        await fetchWalletData()
        await fetchUsageEvents()
        await fetchMessageBilling()
        
        // Fechar o modal (se necessário, pode ser controlado por estado)
        // setModalOpen(false) - se você tiver controle de estado do modal
      } else {
        throw new Error(result.error || 'Falha ao adicionar créditos')
      }
    } catch (error) {
      console.error('Error adding credits:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erro ao adicionar créditos'
      toast.error(errorMessage)
    } finally {
      setAddingCredits(false)
    }
  }

  // Função removida: processPendingMessages
  // O débito agora é automático em tempo real

  const getOperationIcon = (type: string) => {
    return type === 'credit' ? (
      <ArrowUpRight className="h-4 w-4 text-green-600" />
    ) : (
      <ArrowDownLeft className="h-4 w-4 text-red-600" />
    )
  }

  const getOperationColor = (type: string) => {
    return type === 'credit' ? 'text-green-600' : 'text-red-600'
  }

  const totalPages = Math.ceil(totalEntries / entriesPerPage)

  // Calcular estatísticas do período baseado em mensagens
  const periodStats = messageBilling.reduce(
    (acc, message) => {
      if (message.billing_status === 'debited' && message.cost_credits) {
        acc.totalDebits += message.cost_credits
        acc.totalMessages += 1
        acc.totalTokens += message.tokens_used || 0
      }
      return acc
    },
    { totalCredits: 0, totalDebits: 0, totalMessages: 0, totalTokens: 0 }
  )

  if (loading && usageEvents.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Carteira</h2>
            <p className="text-muted-foreground">Gerencie seus créditos</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
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
          <h2 className="text-3xl font-bold tracking-tight">Carteira</h2>
          <p className="text-muted-foreground">
            Gerencie seus créditos e histórico de uso
          </p>
        </div>
        
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Créditos
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Créditos</DialogTitle>
              <DialogDescription>
                Adicione créditos à sua carteira para continuar usando a plataforma.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Quantidade de Créditos</label>
                <Input
                  type="number"
                  placeholder="Ex: 100"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  min="1"
                  step="1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Cada crédito permite enviar uma mensagem via WhatsApp.
                </p>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Pacotes Sugeridos:</h4>
                <div className="grid grid-cols-3 gap-2">
                  {[100, 500, 1000].map((amount) => (
                    <Button
                      key={amount}
                      variant="outline"
                      size="sm"
                      onClick={() => setCreditAmount(amount.toString())}
                      className="text-blue-700 border-blue-200 hover:bg-blue-100"
                    >
                      {amount}
                    </Button>
                  ))}
                </div>
              </div>
              
              <Button 
                onClick={addCredits} 
                disabled={addingCredits || !creditAmount || parseFloat(creditAmount) <= 0}
                className="w-full"
              >
                {addingCredits ? 'Adicionando...' : `Adicionar ${creditAmount || '0'} Créditos`}
              </Button>
            </div>
          </DialogContent>
          </Dialog>
          
          {/* Botão 'Processar Pendentes' removido - débito automático em tempo real */}
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Atual</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{wallet?.balance || 0}</div>
            <p className="text-xs text-muted-foreground">
              Créditos disponíveis
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensagens Processadas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{periodStats.totalMessages}</div>
            <p className="text-xs text-muted-foreground">
              Débito automático em tempo real
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Créditos Utilizados</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">-{periodStats.totalDebits}</div>
            <p className="text-xs text-muted-foreground">
              {periodStats.totalMessages} mensagens • {periodStats.totalTokens} tokens
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Líquido</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              periodStats.totalCredits - periodStats.totalDebits >= 0 
                ? 'text-green-600' 
                : 'text-red-600'
            }`}>
              {periodStats.totalCredits - periodStats.totalDebits >= 0 ? '+' : ''}
              {periodStats.totalCredits - periodStats.totalDebits}
            </div>
            <p className="text-xs text-muted-foreground">
              Últimos {selectedPeriod} dias
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Aviso de Créditos Baixos */}
      {wallet && wallet.balance < 20 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Créditos Baixos
            </CardTitle>
            <CardDescription className="text-red-600">
              Você tem apenas {wallet.balance} créditos restantes. 
              Adicione mais créditos para continuar enviando mensagens.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Histórico */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de Mensagens
              </CardTitle>
              <CardDescription>
                {totalEntries} mensagens nos últimos {selectedPeriod} dias • 
                {messageBilling.filter(m => m.billing_status === 'debited').length} processadas
              </CardDescription>
            </div>
            
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="365">Último ano</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {messageBilling.length === 0 ? (
            <div className="text-center py-8">
              <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma mensagem encontrada</h3>
              <p className="text-muted-foreground">
                As mensagens aparecerão aqui quando você usar a plataforma.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messageBilling.map((message) => {
                const getBillingStatusBadge = (status: string) => {
                  switch (status) {
                    case 'debited':
                      return <Badge variant="default" className="bg-green-100 text-green-800">Cobrado</Badge>
                    case 'no_charge':
                      return <Badge variant="outline" className="text-gray-600">Sem Cobrança</Badge>
                    default:
                      return <Badge variant="outline">{status}</Badge>
                  }
                }

                const getDirectionIcon = (direction: string) => {
                  return direction === 'outbound' ? (
                    <ArrowDownLeft className="h-4 w-4 text-red-600" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-blue-600" />
                  )
                }

                return (
                  <div key={message.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getDirectionIcon(message.direction)}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">
                            Mensagem {message.direction === 'outbound' ? 'enviada' : 'recebida'}
                            {message.id && ` (ID: ${message.id.substring(0, 8)}...)`}
                          </p>
                          {getBillingStatusBadge(message.billing_status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(message.created_at).toLocaleString('pt-BR')} • 
                          Tokens: {message.tokens_used || 0}
                          {message.charged_at && ` • Cobrado em: ${new Date(message.charged_at).toLocaleString('pt-BR')}`}
                        </p>
                      </div>
                    </div>
                    
                    <div className={`text-right ${
                      message.billing_status === 'debited' && message.cost_credits 
                        ? 'text-red-600' 
                        : 'text-gray-400'
                    }`}>
                      <p className="font-bold">
                        {message.cost_credits ? `-${message.cost_credits}` : '0'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Processado
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages} ({totalEntries} mensagens processadas)
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