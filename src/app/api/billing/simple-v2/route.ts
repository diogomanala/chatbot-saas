import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BILLING } from '@/lib/billing-consts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Função para estimar tokens baseada no conteúdo
function estimateTokens(content: string): number {
  if (!content) return 0;
  // Estimativa: ~4 caracteres por token (aproximação para português)
  return Math.ceil(content.length / 4);
}

// Função para calcular créditos baseado nos tokens
function calculateCredits(tokens: number): number {
  // 1 crédito = 1000 tokens (ajuste conforme necessário)
  return tokens / 1000;
}

export async function POST(request: NextRequest) {
  try {
    const { org_id } = await request.json();
    
    if (!org_id) {
      return NextResponse.json({ error: 'org_id é obrigatório' }, { status: 400 });
    }

    console.log(`[SimpleBillingV2] Processando cobrança para organização: ${org_id}`);

    // 1. Buscar mensagens não cobradas (sem billing_status ou com null)
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id, content, direction')
      .eq('org_id', org_id)
      .or('billing_status.is.null,billing_status.neq.charged');

    if (messagesError) {
      console.error('[SimpleBillingV2] Erro ao buscar mensagens:', messagesError);
      return NextResponse.json({ error: 'Erro ao buscar mensagens' }, { status: 500 });
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ 
        message: 'Nenhuma mensagem pendente para cobrança',
        processed: 0,
        total_credits: 0
      });
    }

    console.log(`[SimpleBillingV2] Encontradas ${messages.length} mensagens para processar`);

    // 2. Calcular total de tokens e créditos
    let totalTokens = 0;
    const messageDetails = messages.map((message: any) => {
      const tokens = estimateTokens(message.content || '');
      totalTokens += tokens;
      return {
        id: message.id,
        tokens,
        credits: calculateCredits(tokens)
      };
    });

    const totalCredits = messageDetails.reduce((sum: number, msg: any) => sum + msg.credits, 0);
    console.log(`[SimpleBillingV2] Total de tokens: ${totalTokens}, Total de créditos: ${totalCredits}`);

    // 3. Buscar saldo atual da organização na tabela credit_wallets
    const { data: wallet, error: walletError } = await supabase
      .from('credit_wallets')
      .select('id, balance')
      .eq('org_id', org_id)
      .single();

    if (walletError) {
      console.error('[SimpleBillingV2] Erro ao buscar carteira:', walletError);
      return NextResponse.json({ error: 'Carteira não encontrada' }, { status: 404 });
    }

    console.log(`[SimpleBillingV2] Saldo atual: ${wallet.balance} créditos`);

    if (wallet.balance < totalCredits) {
      return NextResponse.json({ 
        error: 'Saldo insuficiente',
        required: totalCredits,
        available: wallet.balance
      }, { status: 400 });
    }

    // 4. Debitar créditos do saldo (usando ID para evitar problemas de UUID)
    const newBalance = wallet.balance - totalCredits;
    const { error: updateError } = await supabase
      .from('credit_wallets')
      .update({ 
        balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', wallet.id);

    if (updateError) {
      console.error('[SimpleBillingV2] Erro ao debitar créditos:', updateError);
      return NextResponse.json({ error: 'Erro ao debitar créditos' }, { status: 500 });
    }

    // 5. Marcar mensagens como cobradas
    const messageIds = messages.map((m: any) => m.id);
    const { error: markChargedError } = await supabase
      .from('messages')
      .update({ 
        billing_status: BILLING.DEBITED,
        charged_at: new Date().toISOString(),
        tokens_used: 0 // Será atualizado individualmente se necessário
      })
      .in('id', messageIds);

    if (markChargedError) {
      console.error('[SimpleBillingV2] Erro ao marcar mensagens como cobradas:', markChargedError);
      
      // Reverter débito dos créditos
      await supabase
        .from('credit_wallets')
        .update({ balance: wallet.balance })
        .eq('id', wallet.id);
        
      return NextResponse.json({ error: 'Erro ao marcar mensagens como cobradas' }, { status: 500 });
    }

    // 6. Atualizar tokens individuais para cada mensagem (opcional)
    for (const msgDetail of messageDetails) {
      await supabase
        .from('messages')
        .update({ tokens_used: msgDetail.tokens })
        .eq('id', msgDetail.id);
    }

    console.log(`[SimpleBillingV2] Cobrança processada com sucesso. Novo saldo: ${newBalance}`);

    return NextResponse.json({
      success: true,
      processed: messages.length,
      total_tokens: totalTokens,
      total_credits: totalCredits,
      new_balance: newBalance,
      previous_balance: wallet.balance,
      message_details: messageDetails
    });

  } catch (error) {
    console.error('[SimpleBillingV2] Erro interno:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}