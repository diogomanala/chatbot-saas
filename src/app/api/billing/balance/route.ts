import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/billing/balance?org_id=xxx
 * Verifica o saldo de créditos de uma organização
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const org_id = searchParams.get('org_id');
    
    if (!org_id) {
      return NextResponse.json({ 
        error: 'org_id é obrigatório' 
      }, { status: 400 });
    }

    console.log(`[Balance] Verificando saldo para org: ${org_id}`);

    // Usar a função SQL get_billing_stats
    const { data, error } = await supabase.rpc('get_billing_stats', {
      p_org_id: org_id
    });

    if (error) {
      console.error('[Balance] Erro na função SQL:', error);
      return NextResponse.json({ 
        error: 'Erro ao verificar saldo',
        details: error.message 
      }, { status: 500 });
    }

    const stats = data;

    console.log(`[Balance] Saldo atual: ${stats.current_balance} créditos`);

    return NextResponse.json({
      success: true,
      org_id: stats.org_id,
      current_balance: stats.current_balance,
      total_charged: stats.total_charged,
      total_messages: stats.total_messages,
      total_tokens: stats.total_tokens,
      average_tokens_per_message: stats.average_tokens_per_message
    });

  } catch (error) {
    console.error('[Balance] Erro interno:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor' 
    }, { status: 500 });
  }
}

/**
 * POST /api/billing/balance
 * Adiciona créditos ao saldo de uma organização
 */
export async function POST(request: NextRequest) {
  try {
    const { org_id, amount } = await request.json();
    
    if (!org_id || !amount) {
      return NextResponse.json({ 
        error: 'org_id e amount são obrigatórios' 
      }, { status: 400 });
    }

    if (amount <= 0) {
      return NextResponse.json({ 
        error: 'Amount deve ser maior que zero' 
      }, { status: 400 });
    }

    console.log(`[Balance] Adicionando ${amount} créditos para org: ${org_id}`);

    // Usar a função SQL add_credits
    const { data, error } = await supabase.rpc('add_credits', {
      p_org_id: org_id,
      p_amount: amount
    });

    if (error) {
      console.error('[Balance] Erro na função SQL:', error);
      return NextResponse.json({ 
        error: 'Erro ao adicionar créditos',
        details: error.message 
      }, { status: 500 });
    }

    const result = data;

    console.log(`[Balance] Créditos adicionados com sucesso. Novo saldo: ${result.new_balance}`);

    return NextResponse.json({
      success: result.success,
      org_id: result.org_id,
      credits_added: result.credits_added,
      new_balance: result.new_balance
    });

  } catch (error) {
    console.error('[Balance] Erro interno:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor' 
    }, { status: 500 });
  }
}