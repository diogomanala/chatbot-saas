import { NextRequest, NextResponse } from 'next/server';
import { billingNotifications } from '@/lib/billing-notifications.service';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * API PARA GERENCIAMENTO DE NOTIFICAÇÕES EM TEMPO REAL
 * 
 * Endpoints:
 * GET /api/notifications - Listar alertas
 * POST /api/notifications/preferences - Atualizar preferências
 * POST /api/notifications/acknowledge - Confirmar alerta
 * GET /api/notifications/stats - Estatísticas
 * GET /api/notifications/ws - WebSocket connection
 */

// GET - Listar alertas da organização
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const type = searchParams.get('type');
    const severity = searchParams.get('severity');
    const acknowledged = searchParams.get('acknowledged');
    const action = searchParams.get('action');

    if (!orgId) {
      return NextResponse.json(
        { error: 'orgId é obrigatório' },
        { status: 400 }
      );
    }

    // Rota para estatísticas
    if (action === 'stats') {
      const days = parseInt(searchParams.get('days') || '30');
      
      const { data: stats, error } = await supabase
        .rpc('get_alert_statistics', {
          p_org_id: orgId,
          p_days: days
        });

      if (error) {
        console.error('Erro ao buscar estatísticas:', error);
        return NextResponse.json(
          { error: 'Erro ao buscar estatísticas' },
          { status: 500 }
        );
      }

      const { data: unacknowledged, error: unackError } = await supabase
        .rpc('get_unacknowledged_alerts_by_severity', {
          p_org_id: orgId
        });

      if (unackError) {
        console.error('Erro ao buscar alertas não reconhecidos:', unackError);
      }

      return NextResponse.json({
        success: true,
        statistics: stats[0] || {
          total_alerts: 0,
          critical_alerts: 0,
          warning_alerts: 0,
          info_alerts: 0,
          acknowledged_alerts: 0,
          avg_acknowledgment_time_hours: 0
        },
        unacknowledged_by_severity: unacknowledged || []
      });
    }

    // Construir query para alertas
    let query = supabase
      .from('billing_alerts')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Aplicar filtros opcionais
    if (type) {
      query = query.eq('type', type);
    }
    if (severity) {
      query = query.eq('severity', severity);
    }
    if (acknowledged !== null && acknowledged !== undefined) {
      query = query.eq('acknowledged', acknowledged === 'true');
    }

    const { data: alerts, error } = await query;

    if (error) {
      console.error('Erro ao buscar alertas:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar alertas' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      alerts: alerts || [],
      total: alerts?.length || 0
    });

  } catch (error) {
    console.error('Erro na API de notificações:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Gerenciar preferências e ações
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, orgId } = body;

    if (!orgId) {
      return NextResponse.json(
        { error: 'orgId é obrigatório' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'update_preferences':
        return await updatePreferences(body);
      
      case 'acknowledge_alert':
        return await acknowledgeAlert(body);
      
      case 'acknowledge_multiple':
        return await acknowledgeMultipleAlerts(body);
      
      case 'test_notification':
        return await testNotification(body);
      
      default:
        return NextResponse.json(
          { error: 'Ação não reconhecida' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Erro na API de notificações POST:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Atualizar preferências de notificação
async function updatePreferences(body: any) {
  const { orgId, preferences } = body;

  try {
    await billingNotifications.updateNotificationPreferences(orgId, preferences);
    
    return NextResponse.json({
      success: true,
      message: 'Preferências atualizadas com sucesso'
    });
  } catch (error) {
    console.error('Erro ao atualizar preferências:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar preferências' },
      { status: 500 }
    );
  }
}

// Confirmar um alerta específico
async function acknowledgeAlert(body: any) {
  const { alertId, acknowledgedBy } = body;

  if (!alertId) {
    return NextResponse.json(
      { error: 'alertId é obrigatório' },
      { status: 400 }
    );
  }

  try {
    const { error } = await supabase
      .from('billing_alerts')
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: acknowledgedBy || 'system'
      })
      .eq('id', alertId);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Alerta confirmado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao confirmar alerta:', error);
    return NextResponse.json(
      { error: 'Erro ao confirmar alerta' },
      { status: 500 }
    );
  }
}

// Confirmar múltiplos alertas
async function acknowledgeMultipleAlerts(body: any) {
  const { alertIds, acknowledgedBy, orgId } = body;

  if (!alertIds || !Array.isArray(alertIds)) {
    return NextResponse.json(
      { error: 'alertIds deve ser um array' },
      { status: 400 }
    );
  }

  try {
    let query = supabase
      .from('billing_alerts')
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: acknowledgedBy || 'system'
      });

    if (alertIds.length > 0) {
      query = query.in('id', alertIds);
    } else {
      // Se não especificar IDs, confirmar todos os não confirmados da org
      query = query.eq('org_id', orgId).eq('acknowledged', false);
    }

    const { error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `${count || 0} alertas confirmados com sucesso`
    });
  } catch (error) {
    console.error('Erro ao confirmar múltiplos alertas:', error);
    return NextResponse.json(
      { error: 'Erro ao confirmar alertas' },
      { status: 500 }
    );
  }
}

// Testar notificação
async function testNotification(body: any) {
  const { orgId, channel, message } = body;

  try {
    // Criar um alerta de teste
    const testAlert = {
      id: `test_${Date.now()}`,
      org_id: orgId,
      type: 'low_balance' as const,
      severity: 'info' as const,
      title: 'Teste de Notificação',
      message: message || 'Esta é uma notificação de teste do sistema de cobrança.',
      data: { test: true, channel },
      created_at: new Date(),
      acknowledged: false
    };

    // Simular envio através do sistema de notificações
    // (Em produção, isso acionaria os webhooks/emails reais)
    console.log('Enviando notificação de teste:', testAlert);

    return NextResponse.json({
      success: true,
      message: 'Notificação de teste enviada com sucesso',
      testAlert
    });
  } catch (error) {
    console.error('Erro ao enviar notificação de teste:', error);
    return NextResponse.json(
      { error: 'Erro ao enviar notificação de teste' },
      { status: 500 }
    );
  }
}

// PUT - Atualizar alerta específico
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { alertId, updates } = body;

    if (!alertId) {
      return NextResponse.json(
        { error: 'alertId é obrigatório' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('billing_alerts')
      .update(updates)
      .eq('id', alertId);

    if (error) {
      console.error('Erro ao atualizar alerta:', error);
      return NextResponse.json(
        { error: 'Erro ao atualizar alerta' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Alerta atualizado com sucesso'
    });

  } catch (error) {
    console.error('Erro na API PUT de notificações:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Remover alertas antigos
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const alertId = searchParams.get('alertId');
    const cleanup = searchParams.get('cleanup');

    if (cleanup === 'true') {
      // Executar limpeza automática
      const { data, error } = await supabase.rpc('cleanup_old_alerts');
      
      if (error) {
        console.error('Erro na limpeza automática:', error);
        return NextResponse.json(
          { error: 'Erro na limpeza automática' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `${data || 0} alertas removidos na limpeza automática`
      });
    }

    if (alertId) {
      // Remover alerta específico
      const { error } = await supabase
        .from('billing_alerts')
        .delete()
        .eq('id', alertId);

      if (error) {
        console.error('Erro ao remover alerta:', error);
        return NextResponse.json(
          { error: 'Erro ao remover alerta' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Alerta removido com sucesso'
      });
    }

    return NextResponse.json(
      { error: 'Parâmetros insuficientes para remoção' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Erro na API DELETE de notificações:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}