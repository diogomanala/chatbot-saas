'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Users, 
  MessageSquare, 
  Smartphone, 
  CreditCard,
  TrendingUp,
  Activity,
  AlertCircle,
  RefreshCw,
  Plus,
  Settings,
  BarChart3
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface DashboardStats {
  devices: number
  chatbots: number
  totalMessages: number
  credits: number
  activeChatbots: number
}

export default function Dashboard() {
  const { user, profile, organization, creditWallet, loading: authLoading } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async () => {
    if (!user || !profile?.org_id) {
      console.log('❌ No user or org_id available for stats')
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      console.log('🔄 Fetching dashboard stats for org:', profile.org_id)
      
      // Buscar dispositivos
      const { data: devicesData, error: devicesError } = await supabase
        .from('devices')
        .select('id, status')
        .eq('org_id', profile.org_id)

      if (devicesError) {
        console.error('❌ Error fetching devices:', devicesError)
        throw new Error('Erro ao buscar dispositivos')
      }

      // Buscar chatbots
      const { data: chatbotsData, error: chatbotsError } = await supabase
        .from('chatbots')
        .select('id, is_active')
        .eq('org_id', profile.org_id)

      if (chatbotsError) {
        console.error('❌ Error fetching chatbots:', chatbotsError)
        throw new Error('Erro ao buscar chatbots')
      }

      // Buscar mensagens
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('id')
        .eq('org_id', profile.org_id)

      if (messagesError) {
        console.error('❌ Error fetching messages:', messagesError)
        throw new Error('Erro ao buscar mensagens')
      }

      // Calcular estatísticas
      const devices = devicesData?.length || 0
      const chatbots = chatbotsData?.length || 0
      const activeChatbots = chatbotsData?.filter(bot => bot.is_active)?.length || 0
      const totalMessages = messagesData?.length || 0
      const credits = creditWallet?.balance || 0

      const statsData = {
        devices,
        chatbots,
        totalMessages,
        credits,
        activeChatbots
      }

      console.log('✅ Dashboard stats calculated:', statsData)
      setStats(statsData)
    } catch (error) {
      console.error('❌ Error fetching dashboard stats:', error)
      setError('Falha ao carregar estatísticas')
      
      // Fallback para dados básicos do contexto
      if (creditWallet) {
        setStats({
          devices: 0,
          chatbots: 0,
          totalMessages: 0,
          credits: creditWallet.balance || 0,
          activeChatbots: 0
        })
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading && user && profile?.org_id) {
      fetchStats()
    }
  }, [user, profile?.org_id, authLoading, creditWallet])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="animate-pulse max-w-7xl mx-auto">
          <div className="h-8 bg-slate-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-slate-200 rounded-xl"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-slate-200 rounded-xl"></div>
            <div className="h-64 bg-slate-200 rounded-xl"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <AlertCircle className="mx-auto h-12 w-12 text-slate-400" />
            <h3 className="mt-4 text-lg font-medium text-slate-900">Dados não disponíveis</h3>
            <p className="mt-2 text-sm text-slate-500">
              Não foi possível carregar os dados do usuário.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Dashboard</h1>
          <p className="text-slate-600">Visão geral do seu SaaS Chatbot</p>
        </div>

        {/* Error Alert */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-red-800">
                    Erro ao Carregar Estatísticas
                  </h3>
                  <p className="text-sm text-red-700 mt-1">
                    {error}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchStats}
                  disabled={loading}
                  className="ml-4 border-red-300 text-red-700 hover:bg-red-100"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Tentar Novamente
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {loading ? (
            [...Array(4)].map((_, i) => (
              <Card key={i} className="bg-white/70 backdrop-blur-sm border-slate-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="h-4 bg-slate-200 rounded w-1/2 animate-pulse"></div>
                  <div className="h-4 w-4 bg-slate-200 rounded animate-pulse"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-slate-200 rounded w-1/3 mb-2 animate-pulse"></div>
                  <div className="h-3 bg-slate-200 rounded w-2/3 animate-pulse"></div>
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <Card className="bg-white/70 backdrop-blur-sm border-slate-200 hover:shadow-lg transition-all duration-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Dispositivos</CardTitle>
                  <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                    <Smartphone className="h-4 w-4 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900">{stats?.devices || 0}</div>
                  <p className="text-xs text-slate-500">
                    Dispositivos conectados
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white/70 backdrop-blur-sm border-slate-200 hover:shadow-lg transition-all duration-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Chatbots</CardTitle>
                  <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                    <Users className="h-4 w-4 text-emerald-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900">{stats?.chatbots || 0}</div>
                  <p className="text-xs text-slate-500">
                    {stats?.activeChatbots || 0} ativos
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white/70 backdrop-blur-sm border-slate-200 hover:shadow-lg transition-all duration-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Mensagens</CardTitle>
                  <div className="p-2 bg-violet-50 rounded-lg border border-violet-100">
                    <MessageSquare className="h-4 w-4 text-violet-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900">{stats?.totalMessages || 0}</div>
                  <p className="text-xs text-slate-500">
                    Total de mensagens
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white/70 backdrop-blur-sm border-slate-200 hover:shadow-lg transition-all duration-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">Créditos</CardTitle>
                  <div className="p-2 bg-amber-50 rounded-lg border border-amber-100">
                    <CreditCard className="h-4 w-4 text-amber-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900">{stats?.credits || creditWallet?.balance || 0}</div>
                  <p className="text-xs text-slate-500">
                    Saldo disponível
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center text-slate-900">
                <div className="p-2 bg-blue-50 rounded-lg border border-blue-100 mr-3">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                Ações Rápidas
              </CardTitle>
              <CardDescription className="text-slate-600">
                Acesse rapidamente as principais funcionalidades
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <Link href="/dashboard/devices">
                  <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center space-y-1 border-slate-200 hover:bg-slate-50 group">
                    <div className="p-1.5 bg-blue-50 rounded-lg border border-blue-100 group-hover:bg-blue-100 transition-colors">
                      <Plus className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="text-xs">Novo Dispositivo</span>
                  </Button>
                </Link>
                <Link href="/dashboard/chatbots">
                  <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center space-y-1 border-slate-200 hover:bg-slate-50 group">
                    <div className="p-1.5 bg-emerald-50 rounded-lg border border-emerald-100 group-hover:bg-emerald-100 transition-colors">
                      <Users className="h-4 w-4 text-emerald-600" />
                    </div>
                    <span className="text-xs">Gerenciar Chatbots</span>
                  </Button>
                </Link>
                <Link href="/dashboard/messages">
                  <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center space-y-1 border-slate-200 hover:bg-slate-50 group">
                    <div className="p-1.5 bg-violet-50 rounded-lg border border-violet-100 group-hover:bg-violet-100 transition-colors">
                      <BarChart3 className="h-4 w-4 text-violet-600" />
                    </div>
                    <span className="text-xs">Ver Mensagens</span>
                  </Button>
                </Link>
                <Link href="/dashboard/wallet">
                  <Button variant="outline" className="w-full h-20 flex flex-col items-center justify-center space-y-1 border-slate-200 hover:bg-slate-50 group">
                    <div className="p-1.5 bg-amber-50 rounded-lg border border-amber-100 group-hover:bg-amber-100 transition-colors">
                      <CreditCard className="h-4 w-4 text-amber-600" />
                    </div>
                    <span className="text-xs">Comprar Créditos</span>
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Organization Info */}
          {organization && (
            <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center text-slate-900">
                  <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100 mr-3">
                    <Activity className="h-5 w-5 text-emerald-600" />
                  </div>
                  Informações da Organização
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Nome</p>
                    <p className="text-lg font-semibold text-slate-900">{organization.name}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                       <p className="text-sm font-medium text-slate-500">Plano</p>
                       <Badge variant="outline" className="mt-1 border-blue-200 text-blue-700 bg-blue-50">
                         {organization.plan || 'Business'}
                       </Badge>
                     </div>
                     <div>
                       <p className="text-sm font-medium text-slate-500">Status</p>
                       <Badge 
                         variant="outline"
                         className="mt-1 flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border-emerald-200"
                       >
                         <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                         Ativo
                       </Badge>
                     </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}