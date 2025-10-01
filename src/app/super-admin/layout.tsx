'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useEffect } from 'react'
import { Shield, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, profile, loading } = useAuth()

  useEffect(() => {
    // Log do acesso ao super admin (apenas se for super_admin)
    if (!loading && profile && profile.role === 'super_admin') {
      const logSuperAdminAccess = async () => {
        try {
          const { createSuperAdminLogger } = await import('@/lib/super-admin-logger')
          const logger = await createSuperAdminLogger(user.id)
          if (logger) {
            await logger.logLogin()
          }
        } catch (error) {
          console.error('[SuperAdminLayout] Error logging super admin access:', error)
        }
      }
      logSuperAdminAccess()
    }
  }, [user, profile, loading])

  // Mostrar loading enquanto verifica autenticação
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando permissões...</p>
        </div>
      </div>
    )
  }

  // Verificar se o usuário tem permissão
  if (!profile || profile.role !== 'super_admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h1>
          <p className="text-gray-600 mb-4">Você não tem permissão para acessar o painel Super Admin.</p>
          <p className="text-sm text-gray-500">Redirecionando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header do Super Admin */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-red-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Super Admin</h1>
                <p className="text-sm text-gray-500">Painel de Controle</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm" asChild>
                <Link href="/super-admin/logs">
                  <FileText className="h-4 w-4 mr-2" />
                  Logs
                </Link>
              </Button>
              
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{profile.full_name}</p>
                <p className="text-xs text-red-600 font-medium">Super Administrador</p>
              </div>
              <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
                <Shield className="h-4 w-4 text-red-600" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo principal */}
      <main>
        {children}
      </main>
    </div>
  )
}