import { NextRequest, NextResponse } from 'next/server';
import { messageBillingService } from '../../../../lib/message-billing.service';

// Endpoint para processamento automático de cobrança (cron job)
// GET /api/cron/process-billing
export async function GET(request: NextRequest) {
  try {
    // Verificar se é uma chamada autorizada (cron job ou admin)
    const authHeader = request.headers.get('authorization');
    const cronSecret = request.headers.get('x-cron-secret');
    
    // Verificar se tem o secret do cron ou token de admin
    const isAuthorized = 
      cronSecret === process.env.CRON_SECRET ||
      (authHeader && authHeader.startsWith('Bearer '));

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    console.log('[CRON] Iniciando processamento automático de cobrança...');
    
    // Processar todas as mensagens pendentes
    const result = await messageBillingService.chargeAllPendingMessages(500);
    
    console.log('[CRON] Processamento concluído:', {
      success: result.success,
      message: result.message,
      creditsCharged: result.creditsCharged,
      messagesProcessed: result.messagesProcessed
    });

    return NextResponse.json({
      success: result.success,
      message: result.message,
      timestamp: new Date().toISOString(),
      data: {
        creditsCharged: result.creditsCharged,
        messagesProcessed: result.messagesProcessed
      }
    });
  } catch (error) {
    console.error('[CRON] Erro no processamento automático:', error);
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// POST /api/cron/process-billing (para execução manual)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orgId, limit = 100 } = body;

    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token de autorização necessário' },
        { status: 401 }
      );
    }

    console.log('[CRON] Processamento manual iniciado:', { orgId, limit });

    let result;
    if (orgId) {
      // Processar organização específica
      result = await messageBillingService.chargePendingMessages(orgId, limit);
    } else {
      // Processar todas as organizações
      result = await messageBillingService.chargeAllPendingMessages(limit);
    }

    console.log('[CRON] Processamento manual concluído:', result);

    return NextResponse.json({
      success: result.success,
      message: result.message,
      timestamp: new Date().toISOString(),
      data: {
        creditsCharged: result.creditsCharged,
        messagesProcessed: result.messagesProcessed
      }
    });
  } catch (error) {
    console.error('[CRON] Erro no processamento manual:', error);
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}