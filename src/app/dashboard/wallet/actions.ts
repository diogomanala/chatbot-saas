'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

export async function addCreditsAction(amount: number, description?: string) {
  try {
    // Criar cliente Supabase com cookies da requisição
    const supabase = await createClient()
    
    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return {
        success: false,
        error: 'Usuário não autenticado'
      }
    }

    // Buscar organização do usuário através do profile
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

    // Validar quantidade
    if (!amount || amount <= 0) {
      return {
        success: false,
        error: 'Quantidade de créditos deve ser maior que zero'
      }
    }

    // Usar service client para operações administrativas
    const serviceSupabase = createServiceClient()
    
    // ETAPA 1: Ler o saldo atual da carteira
    const { data: wallet, error: fetchError } = await serviceSupabase
      .from('credit_wallets')
      .select('balance')
      .eq('org_id', profile.org_id)
      .single()

    if (fetchError) {
      console.error('Error fetching wallet balance:', fetchError)
      return {
        success: false,
        error: 'Erro ao buscar saldo da carteira'
      }
    }

    // ETAPA 2: Calcular o novo saldo
    const currentBalance = wallet?.balance || 0
    const newBalance = currentBalance + amount

    // ETAPA 3: Escrever o novo saldo calculado
    const { error: updateError } = await serviceSupabase
      .from('credit_wallets')
      .update({ 
        balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('org_id', profile.org_id)

    if (updateError) {
      console.error('Error updating wallet balance:', updateError)
      return {
        success: false,
        error: 'Erro ao atualizar saldo da carteira'
      }
    }

    // Registrar transação no histórico
    const { error: transactionError } = await serviceSupabase
      .from('credit_transactions')
      .insert({
        org_id: profile.org_id,
        type: 'credit',
        amount: amount,
        description: description || `Adição de ${amount} créditos`,
        metadata: {
          user_id: user.id,
          user_email: user.email,
          timestamp: new Date().toISOString()
        }
      })

    if (transactionError) {
      console.error('Error recording transaction:', transactionError)
      // Não falhar a operação por erro de log
    }

    // Revalidar a página para atualizar os dados
    revalidatePath('/dashboard/wallet')

    return {
      success: true,
      message: `${amount} créditos adicionados com sucesso!`,
      creditsAdded: amount,
      newBalance: newBalance || 0
    }

  } catch (error) {
    console.error('Error in addCreditsAction:', error)
    return {
      success: false,
      error: 'Erro interno do servidor'
    }
  }
}