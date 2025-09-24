import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BILLING } from '@/lib/billing-consts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/billing/process
 * Processa cobrança de uma mensagem específica usando as funções SQL
 */
export async function POST(request: NextRequest) {
  try {
    const { message_id, org_id, content } = await request.json();
    
    if (!message_id || !org_id || !content) {
      return NextResponse.json({ 
        error: 'message_id, org_id e content são obrigatórios' 
      }, { status: 400 });
    }

    console.log(`[Billing] Processando cobrança - Message: ${message_id}, Org: ${org_id}`);

    // Usar a função SQL process_message_billing
    const { data, error } = await supabase.rpc('process_message_billing', {
      p_message_id: message_id,
      p_org_id: org_id,
      p_content: content
    });

    if (error) {
      console.error('[Billing] Erro na função SQL:', error);
      return NextResponse.json({ 
        error: 'Erro ao processar cobrança',
        details: error.message 
      }, { status: 500 });
    }

    const result = data;
    
    if (!result.success) {
      console.log(`[Billing] Cobrança falhou: ${result.error}`);
      return NextResponse.json({
        success: false,
        error: result.error,
        current_balance: result.current_balance,
        required: result.required
      }, { status: result.error === 'Insufficient credits' ? 402 : 400 });
    }

    console.log(`[Billing] Cobrança processada com sucesso:`, {
      billing_id: result.billing_id,
      tokens_used: result.tokens_used,
      credits_charged: result.credits_charged,
      new_balance: result.new_balance
    });

    return NextResponse.json({
      success: true,
      billing_id: result.billing_id,
      tokens_used: result.tokens_used,
      credits_charged: result.credits_charged,
      previous_balance: result.previous_balance,
      new_balance: result.new_balance
    });

  } catch (error) {
    console.error('[Billing] Erro interno:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor' 
    }, { status: 500 });
  }
}

/**
 * GET /api/billing/process?org_id=xxx
 * Processa todas as mensagens pendentes de uma organização
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

    console.log(`[Billing] Processando todas as mensagens pendentes para org: ${org_id}`);

    // Buscar mensagens não cobradas
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id, message_content, direction')
      .eq('org_id', org_id)
      .is('billing_status', null)
      .eq('direction', 'outbound') // Só cobrar mensagens do bot
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('[Billing] Erro ao buscar mensagens:', messagesError);
      return NextResponse.json({ 
        error: 'Erro ao buscar mensagens pendentes' 
      }, { status: 500 });
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhuma mensagem pendente encontrada',
        processed: 0,
        total_charged: 0
      });
    }

    console.log(`[Billing] Encontradas ${messages.length} mensagens para processar`);

    const results: Array<{message_id: any; success: any; tokens_used: any; credits_charged: any}> = [];
    let totalProcessed = 0;
    let totalCharged = 0;
    const errors: Array<{message_id: any; error: string}> = [];

    // Processar cada mensagem individualmente
    for (const message of messages) {
      try {
        const { data, error } = await supabase.rpc('process_message_billing', {
          p_message_id: message.id,
          p_org_id: org_id,
          p_content: message.message_content || ''
        });

        if (error) {
          errors.push({
            message_id: message.id,
            error: error.message
          });
          continue;
        }

        const result = data;
        
        if (result.success) {
          totalProcessed++;
          totalCharged += result.credits_charged;
          
          // Marcar mensagem como cobrada
          await supabase
            .from('messages')
            .update({ 
              billing_status: BILLING.DEBITED,
              tokens_used: result.tokens_used,
              processed_at: new Date().toISOString()
            })
            .eq('id', message.id);
        } else {
          errors.push({
            message_id: message.id,
            error: result.error
          });
        }

        results.push({
          message_id: message.id,
          success: result.success,
          tokens_used: result.tokens_used,
          credits_charged: result.credits_charged
        });

      } catch (error) {
        errors.push({
          message_id: message.id,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    }

    console.log(`[Billing] Processamento concluído: ${totalProcessed}/${messages.length} mensagens processadas`);

    return NextResponse.json({
      success: true,
      processed: totalProcessed,
      total_messages: messages.length,
      total_charged: totalCharged,
      errors: errors.length > 0 ? errors : undefined,
      results
    });

  } catch (error) {
    console.error('[Billing] Erro interno:', error);
    return NextResponse.json({ 
      error: 'Erro interno do servidor' 
    }, { status: 500 });
  }
}