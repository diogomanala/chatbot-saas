import { igniter } from '@/igniter';
import { z } from 'zod';
import { messageBillingService } from '../../../lib/message-billing.service';
import { BillingMiddleware } from '../../../lib/billing-middleware';

const SendMessageSchema = z.object({
  content: z.string().min(1, 'Message content is required'),
  device_id: z.string().uuid('Valid device ID is required'),
});

export const messageController = igniter.controller({
  name: 'Message',
  description: 'Endpoints for sending messages and managing chat',
  path: '/messages',
  actions: {
    send: igniter.mutation({
      name: 'send',
      description: 'Send a message through the chatbot',
      path: '/send',
      method: 'POST',
      body: SendMessageSchema,
      handler: async ({ request, context, response }) => {
        try {
          const { content, device_id } = request.body;
          
          // Buscar o device usando cliente admin
          const { data: device, error: deviceError } = await context.supabaseAdmin
            .from('devices')
            .select('id, org_id, chatbot_id')
            .eq('id', device_id)
            .single();

          if (deviceError || !device) {
            console.error('Device not found:', deviceError);
            return response.status(404).json({ error: 'Device not found' });
          }

          // Criar a mensagem na tabela messages usando o cliente admin para contornar RLS
          const { data: message, error } = await context.supabaseAdmin
            .from('messages')
            .insert({
              content,
              message_content: content,
              device_id,
              org_id: device.org_id,
              chatbot_id: device.chatbot_id,
              phone_number: 'api-test',
              sender_phone: 'api-test',
              receiver_phone: device.session_name || 'unknown',
              direction: 'outbound',
              status: 'sent',
              tokens_used: Math.ceil(content.length / 4),
              created_at: new Date().toISOString()
            })
            .select()
            .single();
            
          if (error) {
            console.error('Failed to create message:', error);
            return response.status(500).json({ error: 'Failed to create message', details: error.message });
          }
          
          // Processar cobrança da mensagem usando o novo middleware
          if (message && message.id) {
            try {
              const billingResult = await BillingMiddleware.processCharge({
                org_id: device.org_id,
                content: content,
                message_id: message.id
              });
              
              console.log('Billing result:', billingResult);
              
              if (!billingResult.success) {
                console.warn('Billing failed:', billingResult.error);
                // Continuar mesmo com falha na cobrança para não bloquear o envio
              }
            } catch (billingError) {
              console.error('Error processing billing:', billingError);
              // Não falhar a requisição por erro de cobrança
            }
          }
          
          return response.success({
            message,
            status: 'Message sent successfully'
          });
          
        } catch (error) {
          console.error('Error in send message:', error);
          return response.status(500).json({ error: 'Internal server error' });
        }
      },
    }),
    
    list: igniter.query({
      name: 'list',
      description: 'List messages for a device',
      path: '/',
      query: z.object({
        device_id: z.string().uuid('Valid device ID is required'),
        limit: z.number().optional().default(50),
      }),
      handler: async ({ request, context, response }) => {
        try {
          const { device_id, limit } = request.query;
          
          // Listar mensagens por device_id usando cliente admin
          const { data: messages, error } = await context.supabaseAdmin
            .from('messages')
            .select('*')
            .eq('device_id', device_id)
            .order('created_at', { ascending: false })
            .limit(limit);
            
          if (error) {
            console.error('Failed to fetch messages:', error);
            return response.status(500).json({ error: 'Failed to fetch messages', details: error.message });
          }
          
          return response.success({ messages });
          
        } catch (error) {
          console.error('Error in list messages:', error);
          return response.status(500).json({ error: 'Internal server error' });
        }
      },
    }),
  },
});