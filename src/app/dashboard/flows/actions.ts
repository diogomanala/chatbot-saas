'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

interface FlowData {
  nodes: any[]
  edges: any[]
  viewport: any
}

interface SaveFlowResult {
  success: boolean
  error?: string
  flowId?: string
}

export async function saveFlowAction(
  flowName: string, 
  flowData: FlowData
): Promise<SaveFlowResult> {
  try {
    // Validar parâmetros de entrada
    if (!flowName || !flowName.trim()) {
      return {
        success: false,
        error: 'Nome do fluxo é obrigatório'
      }
    }

    if (!flowData || !flowData.nodes || !flowData.edges) {
      return {
        success: false,
        error: 'Dados do fluxo são obrigatórios'
      }
    }

    // Criar cliente Supabase com cookies da requisição para autenticação
    const supabase = await createClient()
    
    // Verificar autenticação do usuário
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return {
        success: false,
        error: 'Usuário não autenticado'
      }
    }

    // Buscar perfil do usuário para obter org_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || !profile.org_id) {
      return {
        success: false,
        error: 'Organização não encontrada'
      }
    }

    const orgId = profile.org_id

    // Buscar chatbot ativo para a organização
    const { data: chatbots, error: chatbotsError } = await supabase
      .from('chatbots')
      .select('id')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .limit(1)

    if (chatbotsError) {
      return {
        success: false,
        error: `Erro ao buscar chatbots: ${chatbotsError.message}`
      }
    }

    if (!chatbots || chatbots.length === 0) {
      return {
        success: false,
        error: 'Nenhum chatbot ativo encontrado para esta organização'
      }
    }

    const chatbotId = chatbots[0].id

    // Usar service client (supabaseAdmin) para bypass do RLS
    const supabaseAdmin = createServiceClient()

    // Preparar dados para inserção
    const flowDataToSave = {
      org_id: orgId,
      chatbot_id: chatbotId,
      name: flowName.trim(),
      flow_data: flowData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    console.log('💾 [SaveFlow] Salvando fluxo:', {
      name: flowName,
      orgId,
      chatbotId,
      userId: user.id,
      nodesCount: flowData.nodes?.length || 0,
      edgesCount: flowData.edges?.length || 0
    })

    // Inserir fluxo usando supabaseAdmin (bypass RLS)
    const { data: insertedFlow, error: insertError } = await supabaseAdmin
      .from('flows')
      .insert(flowDataToSave)
      .select('id')
      .single()

    if (insertError) {
      console.error('❌ [SaveFlow] Erro ao inserir fluxo:', insertError)
      return {
        success: false,
        error: `Erro ao salvar fluxo: ${insertError.message}`
      }
    }

    console.log('✅ [SaveFlow] Fluxo salvo com sucesso:', insertedFlow.id)

    // Revalidar a página para atualizar a lista de fluxos
    revalidatePath('/dashboard/flows')

    return {
      success: true,
      flowId: insertedFlow.id
    }

  } catch (error) {
    console.error('❌ [SaveFlow] Erro inesperado:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    }
  }
}