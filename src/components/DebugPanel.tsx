'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react'

interface DebugInfo {
  supabaseUrl: string | null
  supabaseKey: string | null
  sessionExists: boolean
  userExists: boolean
  errors: string[]
  timestamp: string
}

export function DebugPanel() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  const checkSupabaseStatus = async () => {
    const errors: string[] = []
    let sessionExists = false
    let userExists = false

    try {
      // Verificar variáveis de ambiente
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || null
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null

      if (!supabaseUrl) {
        errors.push('NEXT_PUBLIC_SUPABASE_URL não encontrada')
      }
      if (!supabaseKey) {
        errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY não encontrada')
      }

      // Verificar sessão
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) {
          errors.push(`Erro na sessão: ${sessionError.message}`)
        } else {
          sessionExists = !!session
          userExists = !!session?.user
        }
      } catch (error) {
        errors.push(`Erro ao verificar sessão: ${error}`)
      }

      // Teste de conectividade
      try {
        const { error: testError } = await supabase.from('profiles').select('count').limit(1)
        if (testError) {
          errors.push(`Erro de conectividade: ${testError.message}`)
        }
      } catch (error) {
        errors.push(`Erro de conectividade: ${error}`)
      }

      setDebugInfo({
        supabaseUrl,
        supabaseKey: supabaseKey ? `${supabaseKey.substring(0, 20)}...` : null,
        sessionExists,
        userExists,
        errors,
        timestamp: new Date().toLocaleTimeString()
      })
    } catch (error) {
      errors.push(`Erro geral: ${error}`)
      setDebugInfo({
        supabaseUrl: null,
        supabaseKey: null,
        sessionExists: false,
        userExists: false,
        errors,
        timestamp: new Date().toLocaleTimeString()
      })
    }
  }

  useEffect(() => {
    checkSupabaseStatus()
  }, [])

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsVisible(true)}
          variant="outline"
          size="sm"
          className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
        >
          <AlertTriangle className="h-4 w-4 mr-2" />
          Debug
        </Button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96">
      <Card className="border-red-200 bg-red-50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-red-800">Debug Panel</CardTitle>
            <div className="flex gap-2">
              <Button
                onClick={checkSupabaseStatus}
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
              <Button
                onClick={() => setIsVisible(false)}
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            </div>
          </div>
          <CardDescription className="text-xs text-red-600">
            Última verificação: {debugInfo?.timestamp}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {debugInfo?.supabaseUrl ? (
                <CheckCircle className="h-3 w-3 text-green-600" />
              ) : (
                <XCircle className="h-3 w-3 text-red-600" />
              )}
              <span>Supabase URL: {debugInfo?.supabaseUrl ? 'OK' : 'ERRO'}</span>
            </div>
            
            <div className="flex items-center gap-2">
              {debugInfo?.supabaseKey ? (
                <CheckCircle className="h-3 w-3 text-green-600" />
              ) : (
                <XCircle className="h-3 w-3 text-red-600" />
              )}
              <span>Supabase Key: {debugInfo?.supabaseKey ? 'OK' : 'ERRO'}</span>
            </div>
            
            <div className="flex items-center gap-2">
              {debugInfo?.sessionExists ? (
                <CheckCircle className="h-3 w-3 text-green-600" />
              ) : (
                <XCircle className="h-3 w-3 text-red-600" />
              )}
              <span>Sessão: {debugInfo?.sessionExists ? 'Ativa' : 'Inativa'}</span>
            </div>
            
            <div className="flex items-center gap-2">
              {debugInfo?.userExists ? (
                <CheckCircle className="h-3 w-3 text-green-600" />
              ) : (
                <XCircle className="h-3 w-3 text-red-600" />
              )}
              <span>Usuário: {debugInfo?.userExists ? 'Logado' : 'Não logado'}</span>
            </div>
          </div>

          {debugInfo?.errors && debugInfo.errors.length > 0 && (
            <div className="space-y-1">
              <div className="font-medium text-red-800">Erros encontrados:</div>
              {debugInfo.errors.map((error, index) => (
                <div key={index} className="text-red-700 bg-red-100 p-2 rounded text-xs">
                  {error}
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-red-200">
            <div className="text-red-600 text-xs">
              <strong>Dica:</strong> Se houver erros, verifique as variáveis de ambiente no Vercel.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}