import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/credits/add
 * Adiciona créditos ao saldo de uma organização
 * Endpoint protegido que requer autenticação
 */
export async function POST(request: NextRequest) {
  try {
    // Criar cliente Supabase com autenticação do usuário
    const supabase = await createClient();

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ 
        success: false,
        error: 'Usuário não autenticado' 
      }, { status: 401 });
    }

    // Buscar organização do usuário
    const { data: userOrg, error: orgError } = await supabase
      .from('user_organizations')
      .select('org_id')
      .eq('user_id', user.id)
      .single();

    if (orgError || !userOrg) {
      return NextResponse.json({ 
        success: false,
        error: 'Organização não encontrada para o usuário' 
      }, { status: 403 });
    }

    const { amount, description } = await request.json();
    const org_id = userOrg.org_id; // Usar org_id do usuário autenticado
    
    // Validações
    if (!amount) {
      return NextResponse.json({ 
        success: false,
        error: 'Quantidade de créditos é obrigatória' 
      }, { status: 400 });
    }

    const quantity = parseFloat(amount);
    if (isNaN(quantity) || quantity <= 0) {
      return NextResponse.json({ 
        success: false,
        error: 'Quantidade deve ser um número positivo' 
      }, { status: 400 });
    }

    console.log(`[Credits/Add] Adicionando ${quantity} créditos para org: ${org_id} (usuário: ${user.email})`);
    console.log(`[Credits/Add] Descrição: ${description || 'N/A'}`);

    // Criar cliente com service role para operações administrativas
    const adminSupabase = createServiceClient();

    // Usar a função SQL add_credits_to_wallet
    const { data, error } = await (adminSupabase as any).rpc('add_credits_to_wallet', {
      p_org_id: org_id,
      p_amount: quantity
    });

    if (error) {
      console.error('[Credits/Add] Erro na função SQL:', error);
      return NextResponse.json({ 
        success: false,
        error: 'Erro ao adicionar créditos',
        details: error.message 
      }, { status: 500 });
    }

    const result = data;

    console.log(`[Credits/Add] Créditos adicionados com sucesso. Novo saldo: ${result}`);

    // Registrar a transação no histórico se necessário
    if (description) {
      try {
        await adminSupabase
          .from('transactions')
          .insert({
            org_id: org_id,
            type: 'credit',
            amount: quantity,
            description: description,
            metadata: {
              added_via: 'dashboard',
              user_id: user.id,
              user_email: user.email,
              timestamp: new Date().toISOString()
            },
            created_at: new Date().toISOString()
          });
      } catch (transactionError) {
        console.warn('[Credits/Add] Erro ao registrar transação:', transactionError);
        // Não falhar a operação principal por causa do histórico
      }
    }

    return NextResponse.json({
      success: true,
      org_id: org_id,
      credits_added: quantity,
      new_balance: result,
      message: `${quantity} créditos adicionados com sucesso!`
    });

  } catch (error) {
    console.error('[Credits/Add] Erro interno:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Erro interno do servidor' 
    }, { status: 500 });
  }
}