import { NextRequest, NextResponse } from 'next/server';
import { messageBillingService } from '../../../../lib/message-billing.service';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/billing/process-messages
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orgId, messageId, processAll = false } = body;

    // Autenticação removida para testes locais

    let result;

    if (messageId) {
      // Processar mensagem específica
      result = await messageBillingService.chargeMessage(messageId);
    } else if (orgId) {
      // Processar mensagens pendentes de uma organização
      result = await messageBillingService.chargePendingMessages(orgId);
    } else if (processAll) {
      // Processar todas as mensagens pendentes (apenas para admins)
      result = await messageBillingService.chargeAllPendingMessages();
    } else {
      return NextResponse.json(
        { error: 'Parâmetros inválidos. Forneça messageId, orgId ou processAll=true' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: result.success,
      message: result.message,
      data: {
        creditsCharged: result.creditsCharged,
        messagesProcessed: result.messagesProcessed
      }
    });
  } catch (error) {
    console.error('[API] Erro ao processar cobrança de mensagens:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// GET /api/billing/process-messages?orgId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const days = parseInt(searchParams.get('days') || '30');

    if (!orgId) {
      return NextResponse.json(
        { error: 'orgId é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar autenticação e autorização
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token de autorização necessário' },
        { status: 401 }
      );
    }

    // Obter estatísticas de cobrança
    const stats = await messageBillingService.getBillingStats(orgId, days);

    return NextResponse.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[API] Erro ao obter estatísticas de cobrança:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}