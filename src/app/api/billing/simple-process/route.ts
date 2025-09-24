import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BILLING } from '@/lib/billing-consts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Função para estimar tokens (4 caracteres = 1 token + 50 tokens de sistema)
function estimateTokens(content: string): number {
  const contentTokens = Math.ceil(content.length / 4);
  const systemTokens = 50;
  return contentTokens + systemTokens;
}

// Função para calcular créditos (1 token = 0.001 créditos)
function calculateCredits(tokens: number): number {
  return tokens * 0.001;
}

export async function POST(request: NextRequest) {
  try {
    const { org_id } = await request.json();
    
    if (!org_id) {
      return NextResponse.json({ error: 'org_id é obrigatório' }, { status: 400 });
    }

    console.log(`[SimpleBilling] Processando cobrança para organização: ${org_id}`);

    // 1. Buscar mensagens não cobradas da organização
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select(`
        id,
        org_id,
        chatbot_id,
        message_content,
        tokens_used,
        billing_status,
        direction,
        created_at
      `)
      .is('billing_status', null)
      .eq('org_id', org_id)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('[SimpleBilling] Erro ao buscar mensagens:', messagesError);
      return NextResponse.json({ error: 'Erro ao buscar mensagens' }, { status: 500 });
    }

    if (!messages || messages.length === 0) {
      console.log('[SimpleBilling] Nenhuma mensagem pendente encontrada');
      return NextResponse.json({ 
        message: 'Nenhuma mensagem pendente para processar',
        processed: 0,
        totalCredits: 0
      });
    }

    console.log(`[SimpleBilling] Encontradas ${messages.length} mensagens para processar`);

    // 2. Calcular tokens e créditos totais
    let totalTokens = 0;
    const messageUpdates = messages.map((message: any) => {
      // Só cobrar mensagens do bot (outbound)
      if (message.direction === 'outbound') {
        const tokens = estimateTokens(message.message_content || '');
        totalTokens += tokens;
        return {
          id: message.id,
          tokens,
          credits: calculateCredits(tokens)
        };
      }
      return {
        id: message.id,
        tokens: 0,
        credits: 0
      };
    });

    const totalCredits = calculateCredits(totalTokens);
    console.log(`[SimpleBilling] Total de tokens: ${totalTokens}, Total de créditos: ${totalCredits}`);

    // 3. Verificar saldo atual da organização
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', org_id)
      .single();

    if (orgError) {
       console.error('[SimpleBilling] Erro ao buscar organização:', orgError);
       return NextResponse.json({ error: 'Erro ao buscar dados da organização' }, { status: 500 });
     }
 
     const { data: wallet, error: walletError } = await supabase
        .from('credit_wallets')
        .select('id, balance')
        .eq('org_id', org_id)
        .single();
 
     if (walletError) {
       console.error('[SimpleBilling] Erro ao buscar carteira:', walletError);
       return NextResponse.json({ error: 'Erro ao buscar carteira de créditos' }, { status: 500 });
     }

    const currentCredits = wallet.balance || 0;
    console.log(`[SimpleBilling] Saldo atual: ${currentCredits} créditos`);

    if (currentCredits < totalCredits) {
      console.log('[SimpleBilling] Saldo insuficiente para processar todas as mensagens');
      return NextResponse.json({ 
        error: 'Saldo insuficiente',
        required: totalCredits,
        available: currentCredits
      }, { status: 400 });
    }

    // 4. Debitar créditos da carteira
    const newBalance = currentCredits - totalCredits;
    const { error: updateOrgError } = await supabase
          .from('credit_wallets')
          .update({ 
            balance: newBalance,
            updated_at: new Date().toISOString()
          })
          .eq('id', wallet.id);

    if (updateOrgError) {
      console.error('[SimpleBilling] Erro ao debitar créditos:', updateOrgError);
      return NextResponse.json({ error: 'Erro ao debitar créditos' }, { status: 500 });
    }

    console.log(`[SimpleBilling] Créditos debitados. Novo saldo: ${newBalance}`);

    // 5. Marcar mensagens como cobradas
    const messageIds = messages.map((m: any) => m.id);
    const { error: updateMessagesError } = await supabase
      .from('messages')
      .update({ 
        billing_status: BILLING.DEBITED,
        processed_at: new Date().toISOString()
      })
      .in('id', messageIds);

    if (updateMessagesError) {
      console.error('[SimpleBilling] Erro ao marcar mensagens como cobradas:', updateMessagesError);
      // Reverter débito dos créditos
      await supabase
            .from('credit_wallets')
            .update({ balance: currentCredits })
            .eq('id', wallet.id);
      
      return NextResponse.json({ error: 'Erro ao marcar mensagens como cobradas' }, { status: 500 });
    }

    console.log(`[SimpleBilling] ${messages.length} mensagens marcadas como cobradas`);

    // 6. Registrar transação de débito
    const { error: transactionError } = await supabase
      .from('credit_transactions')
      .insert({
        org_id,
        amount: -totalCredits,
        type: 'debit',
        description: `Cobrança de ${messages.length} mensagens (${totalTokens} tokens)`,
        created_at: new Date().toISOString()
      });

    if (transactionError) {
      console.error('[SimpleBilling] Erro ao registrar transação:', transactionError);
      // Não falha o processo, apenas loga o erro
    }

    return NextResponse.json({
      success: true,
      processed: messages.length,
      totalTokens,
      totalCredits,
      previousBalance: currentCredits,
      newBalance,
      messageDetails: messageUpdates
    });

  } catch (error) {
    console.error('[SimpleBilling] Erro inesperado:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// Endpoint GET para processar todas as organizações
export async function GET() {
  try {
    console.log('[SimpleBilling] Iniciando processamento de todas as organizações');

    // Buscar todas as organizações que têm mensagens pendentes
    const { data: orgsWithPendingMessages, error: orgsError } = await supabase
      .from('messages')
      .select('org_id')
      .or('billing_status.is.null,billing_status.eq.pending')
      .not('org_id', 'is', null);

    if (orgsError) {
      console.error('[SimpleBilling] Erro ao buscar organizações:', orgsError);
      return NextResponse.json({ error: 'Erro ao buscar organizações' }, { status: 500 });
    }

    const uniqueOrgIds = [...new Set(orgsWithPendingMessages?.map((m: any) => m.org_id) || [])];
    console.log(`[SimpleBilling] Encontradas ${uniqueOrgIds.length} organizações com mensagens pendentes`);

    const results: Array<any> = [];
    let totalProcessed = 0;
    let totalCreditsDebited = 0;

    for (const orgId of uniqueOrgIds) {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/billing/simple-process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ org_id: orgId })
        });

        const result = await response.json();
        results.push({ org_id: orgId, ...result });
        
        if (result.success) {
          totalProcessed += result.processed || 0;
          totalCreditsDebited += result.totalCredits || 0;
        }
      } catch (error) {
        console.error(`[SimpleBilling] Erro ao processar organização ${orgId}:`, error);
        results.push({ org_id: orgId, error: 'Erro no processamento' });
      }
    }

    return NextResponse.json({
      success: true,
      organizationsProcessed: uniqueOrgIds.length,
      totalMessagesProcessed: totalProcessed,
      totalCreditsDebited,
      results
    });

  } catch (error) {
    console.error('[SimpleBilling] Erro inesperado no processamento geral:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}