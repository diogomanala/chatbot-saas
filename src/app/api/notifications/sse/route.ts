import { NextRequest } from 'next/server';
import { billingNotifications } from '@/lib/billing-notifications.service';

/**
 * SERVER-SENT EVENTS (SSE) PARA NOTIFICAÇÕES EM TEMPO REAL
 * 
 * Este endpoint estabelece uma conexão SSE para enviar
 * notificações de cobrança em tempo real para o cliente.
 * 
 * Uso no frontend:
 * const eventSource = new EventSource('/api/notifications/sse?orgId=org_123');
 * eventSource.onmessage = (event) => {
 *   const notification = JSON.parse(event.data);
 *   console.log('Nova notificação:', notification);
 * };
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get('orgId');

  if (!orgId) {
    return new Response('orgId é obrigatório', { status: 400 });
  }

  // Configurar headers para Server-Sent Events
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Criar um ReadableStream para SSE
  const stream = new ReadableStream({
    start(controller) {
      // Enviar mensagem inicial de conexão
      const initialMessage = {
        type: 'connection_established',
        data: {
          orgId,
          timestamp: new Date().toISOString(),
          message: 'Conectado ao sistema de notificações em tempo real'
        }
      };
      
      controller.enqueue(`data: ${JSON.stringify(initialMessage)}\n\n`);

      // Configurar listeners para eventos de notificação
      const handleNotification = (notification: any) => {
        if (notification.org_id === orgId) {
          const sseMessage = {
            type: 'billing_notification',
            data: notification
          };
          
          try {
            controller.enqueue(`data: ${JSON.stringify(sseMessage)}\n\n`);
          } catch (error) {
            console.error('Erro ao enviar notificação SSE:', error);
          }
        }
      };

      const handleLowBalance = (data: any) => {
        if (data.orgId === orgId) {
          const sseMessage = {
            type: 'low_balance_alert',
            data: {
              severity: 'warning',
              title: 'Saldo Baixo',
              message: `Seu saldo atual é de ${data.currentBalance} créditos`,
              currentBalance: data.currentBalance,
              threshold: data.threshold,
              timestamp: new Date().toISOString()
            }
          };
          
          try {
            controller.enqueue(`data: ${JSON.stringify(sseMessage)}\n\n`);
          } catch (error) {
            console.error('Erro ao enviar alerta de saldo baixo:', error);
          }
        }
      };

      const handleCircuitBreaker = (data: any) => {
        if (data.orgId === orgId) {
          const sseMessage = {
            type: 'circuit_breaker_alert',
            data: {
              severity: 'critical',
              title: 'Sistema de Proteção Ativado',
              message: 'O circuit breaker foi ativado devido a múltiplas falhas',
              timestamp: new Date().toISOString()
            }
          };
          
          try {
            controller.enqueue(`data: ${JSON.stringify(sseMessage)}\n\n`);
          } catch (error) {
            console.error('Erro ao enviar alerta de circuit breaker:', error);
          }
        }
      };

      const handleChargeCompleted = (data: any) => {
        if (data.usageDetails?.agentId === orgId && data.actualCost > 5) {
          const sseMessage = {
            type: 'charge_completed',
            data: {
              severity: 'info',
              title: 'Cobrança Processada',
              message: `Cobrança de ${data.actualCost} créditos realizada`,
              amount: data.actualCost,
              transactionId: data.transactionId,
              timestamp: new Date().toISOString()
            }
          };
          
          try {
            controller.enqueue(`data: ${JSON.stringify(sseMessage)}\n\n`);
          } catch (error) {
            console.error('Erro ao enviar notificação de cobrança:', error);
          }
        }
      };

      // Registrar listeners
      billingNotifications.on('low_balance_alert', handleLowBalance);
      billingNotifications.on('circuit_breaker_opened', handleCircuitBreaker);
      billingNotifications.on('charge_completed', handleChargeCompleted);

      // Enviar heartbeat a cada 30 segundos
      const heartbeatInterval = setInterval(() => {
        try {
          const heartbeat = {
            type: 'heartbeat',
            data: {
              timestamp: new Date().toISOString(),
              orgId
            }
          };
          controller.enqueue(`data: ${JSON.stringify(heartbeat)}\n\n`);
        } catch (error) {
          console.error('Erro ao enviar heartbeat:', error);
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      // Cleanup quando a conexão for fechada
      request.signal?.addEventListener('abort', () => {
        console.log(`Conexão SSE fechada para orgId: ${orgId}`);
        
        // Remover listeners
        billingNotifications.removeListener('low_balance_alert', handleLowBalance);
        billingNotifications.removeListener('circuit_breaker_opened', handleCircuitBreaker);
        billingNotifications.removeListener('charge_completed', handleChargeCompleted);
        
        // Limpar interval
        clearInterval(heartbeatInterval);
        
        // Fechar stream
        try {
          controller.close();
        } catch (error) {
          console.error('Erro ao fechar controller SSE:', error);
        }
      });

      // Enviar alertas não reconhecidos existentes
      setTimeout(async () => {
        try {
          const existingAlerts = await billingNotifications.getAlerts(orgId, 10);
          const unacknowledgedAlerts = existingAlerts.filter(alert => !alert.acknowledged);
          
          if (unacknowledgedAlerts.length > 0) {
            const summaryMessage = {
              type: 'existing_alerts',
              data: {
                severity: 'info',
                title: 'Alertas Pendentes',
                message: `Você tem ${unacknowledgedAlerts.length} alertas não reconhecidos`,
                count: unacknowledgedAlerts.length,
                alerts: unacknowledgedAlerts.slice(0, 5), // Enviar apenas os 5 mais recentes
                timestamp: new Date().toISOString()
              }
            };
            
            controller.enqueue(`data: ${JSON.stringify(summaryMessage)}\n\n`);
          }
        } catch (error) {
          console.error('Erro ao buscar alertas existentes:', error);
        }
      }, 1000);
    },

    cancel() {
      console.log(`Stream SSE cancelado para orgId: ${orgId}`);
    }
  });

  return new Response(stream, { headers });
}

// POST - Enviar notificação de teste via SSE
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orgId, message, severity = 'info' } = body;

    if (!orgId) {
      return new Response(
        JSON.stringify({ error: 'orgId é obrigatório' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Emitir evento de teste
    billingNotifications.emit('test_notification', {
      orgId,
      message: message || 'Esta é uma notificação de teste',
      severity,
      timestamp: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notificação de teste enviada via SSE'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Erro ao enviar notificação de teste:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}