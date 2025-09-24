import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cliente Supabase com service role para operações administrativas
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response('Authorization header required', { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verificar o token com Supabase
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return new Response('Invalid token', { status: 401 });
    }

    // Buscar o perfil do usuário para obter a org_id
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.org_id) {
      return new Response('Organization not found', { status: 404 });
    }

    const orgId = profile.org_id;
    console.log('📡 [SSE] Starting SSE connection for org:', orgId);

    // Configurar SSE
    const encoder = new TextEncoder();
    let isConnectionClosed = false;
    let subscription: any = null;
    let heartbeatInterval: NodeJS.Timeout | null = null;

    const stream = new ReadableStream({
      start(controller) {
        // Função para enviar dados de forma segura
        const sendData = (data: any) => {
          if (isConnectionClosed) return;
          
          try {
            const message = `data: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(message));
          } catch (error) {
            console.error('📡 [SSE] Error sending data:', error);
            cleanup();
          }
        };

        // Função de limpeza
        const cleanup = () => {
          if (isConnectionClosed) return;
          
          isConnectionClosed = true;
          console.log('📡 [SSE] Cleaning up connection for org:', orgId);
          
          if (subscription) {
            subscription.unsubscribe();
            subscription = null;
          }
          
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
          }
          
          try {
            controller.close();
          } catch (error) {
            // Controller já pode estar fechado
          }
        };

        // Enviar evento inicial de conexão
        sendData({ 
          type: 'connected', 
          orgId,
          timestamp: new Date().toISOString() 
        });

        // Configurar subscription do Supabase para mudanças em tempo real
        try {
          subscription = supabaseAdmin
            .channel(`device-status-changes-${orgId}`)
            .on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'devices',
                filter: `org_id=eq.${orgId}`
              },
              (payload) => {
                console.log('📡 [SSE] Device status changed for org:', orgId, payload.new);
                sendData({
                  type: 'device_status_update',
                  device: payload.new,
                  timestamp: new Date().toISOString()
                });
              }
            )
            .subscribe((status) => {
              console.log('📡 [SSE] Subscription status:', status);
              if (status === 'SUBSCRIBED') {
                sendData({
                  type: 'subscription_ready',
                  timestamp: new Date().toISOString()
                });
              } else if (status === 'CHANNEL_ERROR') {
                console.error('📡 [SSE] Channel error');
                cleanup();
              }
            });
        } catch (error) {
          console.error('📡 [SSE] Error setting up subscription:', error);
          cleanup();
          return;
        }

        // Heartbeat para manter a conexão viva
        heartbeatInterval = setInterval(() => {
          sendData({ 
            type: 'heartbeat', 
            timestamp: new Date().toISOString() 
          });
        }, 30000); // 30 segundos

        // Cleanup quando a conexão for fechada pelo cliente
        request.signal.addEventListener('abort', cleanup);
      },

      cancel() {
        console.log('📡 [SSE] Stream cancelled');
        isConnectionClosed = true;
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Authorization, Cache-Control',
        'X-Accel-Buffering': 'no' // Para Nginx
      }
    });

  } catch (error) {
    console.error('📡 [SSE] Error in SSE endpoint:', error);
    return new Response('Internal server error', { status: 500 });
  }
}