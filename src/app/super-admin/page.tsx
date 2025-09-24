'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Search, Settings, Users, Activity } from 'lucide-react'
import { toast } from 'sonner'

type Client = {
  id: string
  full_name: string
  email: string
  org_name: string
  status: 'active' | 'inactive'
  payment_status: 'paid' | 'overdue'
  evolution_instance_id?: string
  api_requests_today: number
  created_at: string
}

export default function SuperAdminPanel() {
  const { user, profile } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [paymentFilter, setPaymentFilter] = useState<string>('all')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newClient, setNewClient] = useState({
    full_name: '',
    email: '',
    password: '',
    org_name: ''
  })

  // Middleware já cuida da verificação de permissões
  // useEffect removido para evitar redirecionamentos desnecessários

  // Carregar lista de clientes
  const loadClients = async () => {
    try {
      setLoading(true)
      console.log('[SuperAdmin] Loading clients list')
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Sessão expirada')
        return
      }

      const response = await fetch('/api/super-admin/clients', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao carregar clientes')
      }

      const { clients: clientsData } = await response.json()
      setClients(clientsData)
      console.log('[SuperAdmin] Loaded', clientsData.length, 'clients')
    } catch (error) {
      console.error('[SuperAdmin] Error loading clients:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar clientes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (profile?.role === 'super_admin') {
      loadClients()
    }
  }, [profile])

  // Filtrar clientes
  const filteredClients = clients.filter(client => {
    const matchesSearch = (client.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (client.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (client.org_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || client.status === statusFilter
    const matchesPayment = paymentFilter === 'all' || client.payment_status === paymentFilter
    
    return matchesSearch && matchesStatus && matchesPayment
  })

  // Criar novo cliente
  const handleCreateClient = async () => {
    try {
      if (!newClient.full_name || !newClient.email || !newClient.password || !newClient.org_name) {
        toast.error('Todos os campos são obrigatórios')
        return
      }

      console.log('[SuperAdmin] Creating new client:', newClient.email)
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Sessão expirada')
        return
      }

      const response = await fetch('/api/super-admin/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(newClient)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao criar cliente')
      }

      const result = await response.json()
      console.log('[SuperAdmin] Client created:', result.client)
      
      toast.success('Cliente criado com sucesso!')
      setIsCreateDialogOpen(false)
      setNewClient({ full_name: '', email: '', password: '', org_name: '' })
      loadClients()
    } catch (error) {
      console.error('[SuperAdmin] Error creating client:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao criar cliente')
    }
  }

  // Alternar status do cliente
  const toggleClientStatus = async (clientId: string, currentStatus: string) => {
    try {
      console.log('[SuperAdmin] Toggling client status:', clientId, 'from', currentStatus)
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Sessão expirada')
        return
      }

      const response = await fetch('/api/super-admin/clients', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          client_id: clientId,
          action: 'toggle_status',
          value: currentStatus
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao alterar status')
      }

      const result = await response.json()
      const newStatus = result.new_status
      
      console.log('[SuperAdmin] Client status updated to:', newStatus)
      toast.success(`Cliente ${newStatus === 'active' ? 'ativado' : 'desativado'} com sucesso!`)
      loadClients()
    } catch (error) {
      console.error('[SuperAdmin] Error toggling client status:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao alterar status')
    }
  }

  // Alternar status de pagamento
  const togglePaymentStatus = async (clientId: string, currentStatus: string) => {
    try {
      console.log('[SuperAdmin] Toggling payment status:', clientId, 'from', currentStatus)
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Sessão expirada')
        return
      }

      const response = await fetch('/api/super-admin/clients', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          client_id: clientId,
          action: 'toggle_payment',
          value: currentStatus
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao alterar status de pagamento')
      }

      const result = await response.json()
      const newStatus = result.new_payment_status
      
      console.log('[SuperAdmin] Payment status updated to:', newStatus)
      toast.success(`Status de pagamento alterado para ${newStatus === 'paid' ? 'adimplente' : 'inadimplente'}!`)
      loadClients()
    } catch (error) {
      console.error('[SuperAdmin] Error toggling payment status:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao alterar status de pagamento')
    }
  }

  // Resetar chave de API
  const resetApiKey = async (clientId: string) => {
    try {
      console.log('[SuperAdmin] Resetting API key for client:', clientId)
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Sessão expirada')
        return
      }

      const response = await fetch('/api/super-admin/clients', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          client_id: clientId,
          action: 'reset_api_key'
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao resetar chave de API')
      }

      const result = await response.json()
      console.log('[SuperAdmin] API key reset for client:', clientId)
      
      toast.success('Chave de API resetada com sucesso!')
    } catch (error) {
      console.error('[SuperAdmin] Error resetting API key:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao resetar chave de API')
    }
  }

  if (!profile || profile.role !== 'super_admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h1>
          <p className="text-gray-600">Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Painel Super Admin</h1>
          <p className="text-gray-600">Gerenciamento completo de clientes e instâncias</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clients.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {clients.filter(c => c.status === 'active').length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Adimplentes</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {clients.filter(c => c.payment_status === 'paid').length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Requests Hoje</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {clients.reduce((sum, c) => sum + c.api_requests_today, 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Actions */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Gerenciar Clientes</CardTitle>
            <CardDescription>
              Visualize e gerencie todos os clientes do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, email ou organização..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Pagamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="paid">Adimplente</SelectItem>
                  <SelectItem value="overdue">Inadimplente</SelectItem>
                </SelectContent>
              </Select>
              
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Cliente
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Novo Cliente</DialogTitle>
                    <DialogDescription>
                      Adicione um novo cliente com instância Evolution API dedicada
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="full_name">Nome Completo</Label>
                      <Input
                        id="full_name"
                        value={newClient.full_name}
                        onChange={(e) => setNewClient({...newClient, full_name: e.target.value})}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newClient.email}
                        onChange={(e) => setNewClient({...newClient, email: e.target.value})}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="password">Senha</Label>
                      <Input
                        id="password"
                        type="password"
                        value={newClient.password}
                        onChange={(e) => setNewClient({...newClient, password: e.target.value})}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="org_name">Nome da Organização</Label>
                      <Input
                        id="org_name"
                        value={newClient.org_name}
                        onChange={(e) => setNewClient({...newClient, org_name: e.target.value})}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateClient}>
                      Criar Cliente
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Clients Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Organização</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Requests/Dia</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        Carregando clientes...
                      </TableCell>
                    </TableRow>
                  ) : filteredClients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        Nenhum cliente encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredClients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{client.full_name}</div>
                            <div className="text-sm text-muted-foreground">{client.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>{client.org_name}</TableCell>
                        <TableCell>
                          <Badge variant={client.status === 'active' ? 'default' : 'secondary'}>
                            {client.status === 'active' ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={client.payment_status === 'paid' ? 'default' : 'destructive'}>
                            {client.payment_status === 'paid' ? 'Adimplente' : 'Inadimplente'}
                          </Badge>
                        </TableCell>
                        <TableCell>{client.api_requests_today.toLocaleString()}</TableCell>
                        <TableCell>
                          {new Date(client.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={client.status === 'active' ? 'destructive' : 'default'}
                              onClick={() => toggleClientStatus(client.id, client.status)}
                            >
                              {client.status === 'active' ? 'Desativar' : 'Ativar'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}