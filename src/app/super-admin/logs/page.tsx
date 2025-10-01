'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { Search, Filter, Download, Eye, Calendar, User, Activity } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface LogEntry {
  id: string
  admin_id: string
  action: string
  target_client_id?: string
  target_client_email?: string
  details?: any
  ip_address?: string
  user_agent?: string
  created_at: string
  admin_profile?: {
    full_name: string
    email: string
  }
}

const actionLabels: Record<string, string> = {
  'create_client': 'Cliente Criado',
  'toggle_client_status': 'Status Alterado',
  'toggle_payment_status': 'Pagamento Alterado',
  'reset_api_key': 'API Key Resetada',
  'dashboard_access': 'Acesso ao Dashboard',
  'super_admin_login': 'Login Super Admin'
}

const actionColors: Record<string, string> = {
  'create_client': 'bg-green-100 text-green-800',
  'toggle_client_status': 'bg-blue-100 text-blue-800',
  'toggle_payment_status': 'bg-yellow-100 text-yellow-800',
  'reset_api_key': 'bg-red-100 text-red-800',
  'dashboard_access': 'bg-gray-100 text-gray-800',
  'super_admin_login': 'bg-purple-100 text-purple-800'
}

export default function SuperAdminLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const itemsPerPage = 50

  const supabase = createClientComponentClient()

  useEffect(() => {
    loadLogs()
  }, [currentPage, actionFilter, dateFilter, searchTerm])

  const loadLogs = async () => {
    try {
      setLoading(true)
      console.log('[SuperAdminLogs] Loading logs...')

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Sessão expirada')
        return
      }

      // Construir query
      let query = supabase
        .from('super_admin_logs')
        .select(`
          *,
          admin_profile:profiles!admin_id(
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false })

      // Aplicar filtros
      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter)
      }

      if (dateFilter !== 'all') {
        const now = new Date()
        let startDate: Date
        
        switch (dateFilter) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            break
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            break
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1)
            break
          default:
            startDate = new Date(0)
        }
        
        query = query.gte('created_at', startDate.toISOString())
      }

      if (searchTerm) {
        query = query.or(`target_client_email.ilike.%${searchTerm}%,admin_profile.email.ilike.%${searchTerm}%,ip_address.ilike.%${searchTerm}%`)
      }

      // Paginação
      const from = (currentPage - 1) * itemsPerPage
      const to = from + itemsPerPage - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) {
        console.error('[SuperAdminLogs] Error loading logs:', error)
        toast.error('Erro ao carregar logs')
        return
      }

      setLogs(data || [])
      setTotalPages(Math.ceil((count || 0) / itemsPerPage))
      console.log('[SuperAdminLogs] Logs loaded:', data?.length || 0)
    } catch (error) {
      console.error('[SuperAdminLogs] Unexpected error:', error)
      toast.error('Erro inesperado ao carregar logs')
    } finally {
      setLoading(false)
    }
  }

  const exportLogs = async () => {
    try {
      console.log('[SuperAdminLogs] Exporting logs...')
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Sessão expirada')
        return
      }

      // Buscar todos os logs (sem paginação para export)
      let query = supabase
        .from('super_admin_logs')
        .select(`
          *,
          admin_profile:profiles!admin_id(
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false })

      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter)
      }

      if (dateFilter !== 'all') {
        const now = new Date()
        let startDate: Date
        
        switch (dateFilter) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            break
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            break
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1)
            break
          default:
            startDate = new Date(0)
        }
        
        query = query.gte('created_at', startDate.toISOString())
      }

      const { data, error } = await query

      if (error) {
        console.error('[SuperAdminLogs] Error exporting logs:', error)
        toast.error('Erro ao exportar logs')
        return
      }

      // Converter para CSV
      const csvContent = [
        'Data,Admin,Ação,Cliente Alvo,IP,Detalhes',
        ...(data || []).map(log => [
          format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR }),
          log.admin_profile?.email || 'N/A',
          actionLabels[log.action] || log.action,
          log.target_client_email || 'N/A',
          log.ip_address || 'N/A',
          JSON.stringify(log.details || {})
        ].join(','))
      ].join('\n')

      // Download do arquivo
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `super_admin_logs_${format(new Date(), 'yyyy-MM-dd')}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success('Logs exportados com sucesso!')
    } catch (error) {
      console.error('[SuperAdminLogs] Error exporting:', error)
      toast.error('Erro ao exportar logs')
    }
  }

  const formatDetails = (details: any) => {
    if (!details) return 'N/A'
    
    try {
      const parsed = typeof details === 'string' ? JSON.parse(details) : details
      return Object.entries(parsed)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ')
    } catch {
      return JSON.stringify(details)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Logs do Sistema</h1>
          <p className="text-muted-foreground mt-1">
            Auditoria completa das ações realizadas pelos super administradores
          </p>
        </div>
        <Button onClick={exportLogs} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Email, IP..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Ação</label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as ações</SelectItem>
                  {Object.entries(actionLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Período</label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo o período</SelectItem>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="week">Última semana</SelectItem>
                  <SelectItem value="month">Último mês</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Página</label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <span className="text-sm">
                  {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Registro de Atividades
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum log encontrado
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Cliente Alvo</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm">
                        {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{log.admin_profile?.full_name || 'N/A'}</div>
                            <div className="text-sm text-muted-foreground">{log.admin_profile?.email || 'N/A'}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={actionColors[log.action] || 'bg-gray-100 text-gray-800'}>
                          {actionLabels[log.action] || log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {log.target_client_email || 'N/A'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.ip_address || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate text-sm text-muted-foreground">
                          {formatDetails(log.details)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}