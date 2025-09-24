'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function MigratePage() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState('')

  const runMigration = async () => {
    setIsLoading(true)
    setResult('')

    try {
      // Primeiro, vamos verificar se a tabela intents existe
      const { data: tables, error: tablesError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'intents')

      if (tablesError) {
        setResult(`Erro ao verificar tabelas: ${tablesError.message}`)
        return
      }

      if (tables && tables.length > 0) {
        // Tabela existe, vamos verificar as colunas
        const { data: columns, error: columnsError } = await supabase
          .from('information_schema.columns')
          .select('column_name')
          .eq('table_schema', 'public')
          .eq('table_name', 'intents')

        if (columnsError) {
          setResult(`Erro ao verificar colunas: ${columnsError.message}`)
          return
        }

        const columnNames = columns?.map(c => c.column_name) || []
        setResult(`Tabela intents existe com colunas: ${columnNames.join(', ')}`)

        // Se a tabela tem action_config, precisamos migrar
        if (columnNames.includes('action_config')) {
          setResult(prev => prev + '\n\nTabela precisa ser migrada. Execute o SQL manualmente no Supabase Dashboard:')
          setResult(prev => prev + '\n\nDROP TABLE IF EXISTS intents CASCADE;')
          setResult(prev => prev + '\n\nCREATE TABLE intents (')
          setResult(prev => prev + '\n    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),')
          setResult(prev => prev + '\n    chatbot_id UUID REFERENCES chatbots(id) ON DELETE CASCADE,')
          setResult(prev => prev + '\n    name VARCHAR(100) NOT NULL,')
          setResult(prev => prev + '\n    patterns TEXT[] NOT NULL,')
          setResult(prev => prev + '\n    responses TEXT[] NOT NULL,')
          setResult(prev => prev + '\n    is_active BOOLEAN DEFAULT true,')
          setResult(prev => prev + '\n    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),')
          setResult(prev => prev + '\n    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()')
          setResult(prev => prev + '\n);')
        } else {
          setResult(prev => prev + '\n\nTabela já está no formato correto!')
        }
      } else {
        setResult('Tabela intents não existe. Será criada automaticamente.')
      }
    } catch (error) {
      setResult(`Erro: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Migração da Tabela Gatilhos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={runMigration} disabled={isLoading}>
            {isLoading ? 'Verificando...' : 'Verificar Estrutura da Tabela'}
          </Button>
          
          {result && (
            <div className="bg-gray-100 p-4 rounded-md">
              <pre className="whitespace-pre-wrap text-sm">{result}</pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}