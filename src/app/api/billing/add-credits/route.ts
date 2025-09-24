import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/billing/add-credits
 * Adiciona créditos ao saldo de uma organização
 */
export async function POST(request: NextRequest) {
  try {
    const { org_id, credits } = await request.json();
    
    if (!org_id || !credits) {
      return NextResponse.json({ 
        success: false,
        error: 'org_id e credits são obrigatórios' 
      }, { status: 400 });
    }

    if (credits <= 0) {
      return NextResponse.json({ 
        success: false,
        error: 'Credits deve ser maior que zero' 
      }, { status: 400 });
    }

    console.log(`[AddCredits] Adicionando ${credits} créditos para org: ${org_id}`);

    // Usar a função SQL add_credits
    const { data, error } = await supabase.rpc('add_credits', {
      p_org_id: org_id,
      p_amount: credits
    });

    if (error) {
      console.error('[AddCredits] Erro na função SQL:', error);
      return NextResponse.json({ 
        success: false,
        error: 'Erro ao adicionar créditos',
        details: error.message 
      }, { status: 500 });
    }

    const result = data;

    console.log(`[AddCredits] Créditos adicionados com sucesso. Novo saldo: ${result.new_balance}`);

    return NextResponse.json({
      success: result.success,
      org_id: result.org_id,
      credits_added: result.credits_added,
      new_balance: result.new_balance
    });

  } catch (error) {
    console.error('[AddCredits] Erro interno:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Erro interno do servidor' 
    }, { status: 500 });
  }
}