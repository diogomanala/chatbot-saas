import { NextRequest, NextResponse } from 'next/server';
import { messageCounterService } from '@/lib/message-counter.service';
import { billingService } from '@/lib/billing.service';

/**
 * POST /api/process-messages
 * Processa mensagens pendentes e debita créditos automaticamente
 * Implementa a sugestão do usuário de contar mensagens e aplicar fórmula
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { orgId, processAll = false } = body;
    
    console.log('[API] Iniciando processamento de mensagens:', { orgId, processAll });
    
    if (processAll) {
      // Processar todas as organizações
      console.log('[API] Processando todas as organizações...');
      await messageCounterService.processAllOrganizations();
      
      return NextResponse.json({
        success: true,
        message: 'Processamento global iniciado com sucesso',
        timestamp: new Date().toISOString()
      });
    }
    
    if (!orgId) {
      return NextResponse.json(
        {
          success: false,
          error: 'orgId é obrigatório quando processAll=false'
        },
        { status: 400 }
      );
    }
    
    // Processar organização específica
    console.log(`[API] Processando organização: ${orgId}`);
    const result = await messageCounterService.processMessageCountAndDebit(orgId);
    
    // Obter saldo atualizado
    const balanceResult = await billingService.getBalance(orgId);
    
    return NextResponse.json({
      success: result.success,
      message: result.message,
      data: {
        messagesProcessed: result.messagesProcessed || 0,
        creditsDebited: result.creditsDebited || 0,
        currentBalance: result.currentBalance || balanceResult.balance || 0,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('[API] Erro no processamento de mensagens:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno no processamento',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/process-messages?orgId=xxx
 * Obtém estatísticas de mensagens para uma organização
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    
    if (!orgId) {
      return NextResponse.json(
        {
          success: false,
          error: 'orgId é obrigatório'
        },
        { status: 400 }
      );
    }
    
    console.log(`[API] Obtendo estatísticas para org: ${orgId}`);
    
    // Obter estatísticas de mensagens
    const stats = await messageCounterService.getMessageStats(orgId);
    
    // Obter saldo atual
    const balanceResult = await billingService.getBalance(orgId);
    
    return NextResponse.json({
      success: true,
      data: {
        messageStats: stats,
        currentBalance: balanceResult.balance || 0,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('[API] Erro ao obter estatísticas:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno ao obter estatísticas',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}