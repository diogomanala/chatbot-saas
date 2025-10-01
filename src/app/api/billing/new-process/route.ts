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

    console.log(`[NewBilling] Processando cobrança para organização: ${org_id}`);

    // 1. Buscar mensagens não cobradas
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id, content, direction')
      .eq('org_id', org_id)
      .not('id', 'in', 
        supabase
          .from('message_billing')
          .select('message_id')
          .eq('billing_status', BILLING.DEBITED)
      );

    if (messagesError) {
      console.error('[NewBilling] Erro ao buscar mensagens:', messagesError);
      return NextResponse.json({ error: 'Erro ao buscar mensagens' }, { status: 500 });
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ 
        message: 'Nenhuma mensagem pendente para cobrança',
        processed: 0,
        total_credits: 0
      });
    }

    console.log(`[NewBilling] Encontradas ${messages.length} mensagens para processar`);

    // 2. Calcular tokens e créditos para cada mensagem
    const billingRecords = messages.map((message: any) => {
      const tokens = estimateTokens(message.content || '');
      const credits = calculateCredits(tokens);
      
      return {
        message_id: message.id,
        org_id: org_id,
        tokens_used: tokens,
        credits_charged: credits,
        billing_status: 'pending'
      };
    });

    const totalCredits = billingRecords.reduce((sum: number, record: any) => sum + record.credits_charged, 0);
    console.log(`[NewBilling] Total de créditos a cobrar: ${totalCredits}`);

    // 3. Verificar saldo da organização
    const { data: orgCredits, error: creditsError } = await supabase
      .from('organization_credits')
      .select('id, balance')
      .eq('org_id', org_id)
      .single();

    if (creditsError) {
      // Se não existe, criar registro com saldo inicial
      const { data: newCredits, error: createError } = await supabase
        .from('organization_credits')
        .insert({ org_id: org_id, balance: 1000.0 })
        .select('id, balance')
        .single();
        
      if (createError) {
        console.error('[NewBilling] Erro ao criar saldo:', createError);
        return NextResponse.json({ error: 'Erro ao verificar saldo' }, { status: 500 });
      }
      
      orgCredits.id = newCredits.id;
      orgCredits.balance = newCredits.balance;
    }

    console.log(`[NewBilling] Saldo atual: ${orgCredits.balance} créditos`);

    if (orgCredits.balance < totalCredits) {
      return NextResponse.json({ 
        error: 'Saldo insuficiente',
        required: totalCredits,
        available: orgCredits.balance
      }, { status: 400 });
    }

    // 4. Inserir registros de cobrança
    const { error: billingError } = await supabase
      .from('message_billing')
      .insert(billingRecords);

    if (billingError) {
      console.error('[NewBilling] Erro ao inserir registros de cobrança:', billingError);
      return NextResponse.json({ error: 'Erro ao processar cobrança' }, { status: 500 });
    }

    // 5. Debitar créditos do saldo
    const newBalance = orgCredits.balance - totalCredits;
    const { error: updateError } = await supabase
      .from('organization_credits')
      .update({ balance: newBalance })
      .eq('id', orgCredits.id);

    if (updateError) {
      console.error('[NewBilling] Erro ao debitar créditos:', updateError);
      
      // Reverter inserção dos registros de cobrança
      await supabase
        .from('message_billing')
        .delete()
        .in('message_id', messages.map((m: any) => m.id))
        .eq('billing_status', 'pending');
        
      return NextResponse.json({ error: 'Erro ao debitar créditos' }, { status: 500 });
    }

    // 6. Marcar registros como cobrados
    const { error: markChargedError } = await supabase
      .from('message_billing')
      .update({ 
        billing_status: BILLING.DEBITED,
        processed_at: new Date().toISOString()
      })
      .in('message_id', messages.map((m: any) => m.id))
      .eq('billing_status', BILLING.PENDING);

    if (markChargedError) {
      console.error('[NewBilling] Erro ao marcar como cobrado:', markChargedError);
      // Não reverter aqui pois o débito já foi feito
    }

    console.log(`[NewBilling] Cobrança processada com sucesso. Novo saldo: ${newBalance}`);

    return NextResponse.json({
      success: true,
      processed: messages.length,
      total_credits: totalCredits,
      new_balance: newBalance,
      previous_balance: orgCredits.balance
    });

  } catch (error) {
    console.error('[NewBilling] Erro interno:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}