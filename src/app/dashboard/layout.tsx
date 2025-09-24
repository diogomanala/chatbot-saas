'use client'

import { useAuth } from '@/contexts/AuthContext'
import { Sidebar } from '@/components/Sidebar'
import { Badge } from '@/components/ui/badge'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, profile, organization, loading } = useAuth()
  const [creditBalance, setCreditBalance] = useState<number | null>(null)

  useEffect(() => {
    if (organization?.id) {
      // Buscar saldo de créditos
      const fetchCredits = async () => {
        const { data } = await supabase
          .from('credit_wallets')
          .select('balance')
          .eq('org_id', organization.id)
          .single()
        
        if (data) {
          setCreditBalance((data as any).balance)
        }
      }

      fetchCredits()
    }
  }, [organization?.id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Erro de Autenticação
          </h2>
          <p className="text-gray-600 mb-4">
            Usuário não encontrado. Faça login novamente.
          </p>
          <button 
            onClick={() => window.location.href = '/signin'}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Fazer Login
          </button>
        </div>
      </div>
    )
  }

  // Permitir acesso ao dashboard mesmo sem perfil ou organização completos
  // O AuthContext agora cria perfis temporários quando necessário
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Configurando seu perfil...
          </h2>
          <p className="text-gray-600 mb-4">
            Aguarde enquanto configuramos seu perfil.
          </p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-500">
            Se o problema persistir, entre em contato com o suporte.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Bem-vindo, {profile.full_name || 'Usuário'}
              </h1>
              <p className="text-sm text-gray-600">
                {organization?.name || 'Carregando organização...'}
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {creditBalance !== null && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Créditos:</span>
                  <Badge 
                    variant={creditBalance < 20 ? 'destructive' : 'secondary'}
                    className="text-sm"
                  >
                    {creditBalance}
                  </Badge>
                </div>
              )}
              
              <Badge 
                variant="outline" 
                className="text-xs bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-blue-200 font-medium px-3 py-1"
              >
                ✨ Business
              </Badge>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}