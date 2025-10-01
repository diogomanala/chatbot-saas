import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AlertHelpers } from '@/lib/alerts';
import { openaiService } from '@/lib/openai-service';
import { SimplifiedBillingService } from '@/lib/simplified-billing.service';
import { BILLING, DELIVERY, MIN_CHARGE_TOKENS } from '@/lib/billing-consts';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Helpers
const normalizeJidPhone = (jid: string) => jid.replace(/@s\.whatsapp\.net$/, '');
const nowIso = () => new Date().toISOString();

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  const correlationId = uuidv4();
  
  try {
    console.log(`🔗 [${correlationId}] Webhook recebido`);
    
    const body = await request.json();
    console.log(`📦 [${correlationId}] Payload:`, JSON.stringify(body, null, 2));

    // Verificar se é uma mensagem válida
    if (!body.event || !body.data) {
      console.log(`❌ [${correlationId}] Payload inválido - faltando event ou data`);
      
      await AlertHelpers.webhookError(
      'Webhook recebeu payload sem event ou data obrigatórios',
      {
        correlationId,
        payload: body,
        reason: 'Missing event or data',
        endpoint: '/api/webhook'
      }
    );
      
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Processar apenas mensagens recebidas
    if (body.event === 'messages.upsert' && body.data.message) {
      const messageData = body.data;
      const remoteJid = messageData.key?.remoteJid;
      const messageText = messageData.message?.conversation || 
                         messageData.message?.extendedTextMessage?.text;

      if (!remoteJid || !messageText) {
        console.log(`❌ [${correlationId}] Mensagem inválida - faltando remoteJid ou texto`);
        
        await AlertHelpers.webhookError(
          'Mensagem recebida sem remoteJid ou texto',
          {
            correlationId,
            remoteJid,
            messageText,
            messageData: messageData.key
          }
        );
        
        return NextResponse.json({ error: 'Invalid message data' }, { status: 400 });
      }

      console.log(`📱 [${correlationId}] Mensagem de ${remoteJid}: ${messageText}`);

      // Buscar device pelo instanceId
      const { data: device } = await supabase
        .from('devices')
        .select('id, org_id, instance_id')
        .eq('instance_id', body.instanceId)
        .single();

      if (!device) {
        console.log(`❌ [${correlationId}] Device não encontrado para instanceId: ${body.instanceId}`);
        return NextResponse.json({ error: 'Device not found' }, { status: 404 });
      }

      // Buscar qualquer chatbot ativo da organização
      const { data: activeChatbot } = await supabase
        .from('chatbots')
        .select('id')
        .eq('org_id', device.org_id)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (!activeChatbot) {
        console.log(`❌ [${correlationId}] Nenhum chatbot ativo encontrado para a organização`);
        return NextResponse.json({ error: 'No active chatbot found' }, { status: 500 });
      }

      // Salvar mensagem no banco
      const { data: savedMessage, error: saveError } = await supabase
        .from('messages')
        .insert({
          org_id: device.org_id,                // ✅ usar org_id real do device
          chatbot_id: activeChatbot.id,         // ID do chatbot ativo
          device_id: device.id,                 // ✅ usar device_id real
          phone_number: remoteJid,              // Campo obrigatório
          message_content: messageText,         // Campo obrigatório
          direction: 'inbound',
          sender_phone: remoteJid,
          receiver_phone: body.instance || device.instance_id,  // ✅ usar instance_id real
          content: messageText,
          // message_type removido - coluna não existe na tabela
          status: 'received',
          external_id: messageData.key?.id || null,
          metadata: {
            instance: body.instance,
            messageTimestamp: messageData.messageTimestamp,
            originalPayload: body
          }
        })
        .select()
        .single();

      if (saveError) {
        console.error(`❌ [${correlationId}] Erro ao salvar mensagem:`, saveError);
        
        await AlertHelpers.databaseError(
          'Falha ao Salvar Mensagem',
          saveError.message,
          {
            correlationId,
            phoneNumber: remoteJid,
            code: saveError.code,
            details: saveError.details
          }
        );
        
        return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
      }

      console.log(`✅ [${correlationId}] Mensagem salva:`, savedMessage.id);

      // Processar resposta do chatbot
      try {
        const response = await processMessage(messageText, remoteJid, body.instance, correlationId);
        
        if (response) {
          // 1) Calcular tokens com fallback e piso
          const tokensUsed = Math.max(response.tokensUsed || 0, MIN_CHARGE_TOKENS);
          
          // 2) INSERIR MENSAGEM OUTBOUND COM COBRANÇA SIMPLIFICADA
          const phone_number = normalizeJidPhone(remoteJid);
          
          // Usar sistema simplificado - inserção + cobrança em uma operação
          const billingResult = await SimplifiedBillingService.insertMessageWithBilling(
            {
              org_id: device.org_id,              // ✅ usar org_id real do device
              chatbot_id: activeChatbot.id,
              device_id: device.id,               // ✅ usar device_id real
              direction: 'outbound',
              phone_number,                       // ✅ unificado
              message_content: response.response, // ✅ campo certo
              tokens_used: tokensUsed,      // grava tokens usados
              created_at: nowIso(),
              metadata: {
                instance: body.instance,
                parent_message_id: savedMessage?.id ?? null,
                response_generated: true
              }
            },
            device.org_id,
            response.response,
            tokensUsed
          );

          if (billingResult.success) {
            console.log(`🤖 [${correlationId}] Resposta processada com cobrança simplificada:`, billingResult.billing);
          } else {
            console.error(`❌ [${correlationId}] Erro na cobrança simplificada:`, billingResult.billing?.message);
          }
        }
      } catch (error) {
        console.error(`❌ [${correlationId}] Erro ao processar resposta:`, error);
        
        await AlertHelpers.systemAlert(
          'Falha no Processamento de Resposta',
          'Erro ao processar resposta do chatbot para mensagem recebida',
          'medium',
          {
            correlationId,
            phoneNumber: remoteJid,
            originalMessage: messageText,
            error: error instanceof Error ? error.message : String(error)
          }
        );
      }
    }

    return NextResponse.json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    console.error(`❌ [${correlationId}] Erro crítico no webhook:`, error);
    
    await AlertHelpers.webhookError(
      'Falha crítica no processamento do webhook principal',
      {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        endpoint: '/api/webhook',
        env: process.env.NODE_ENV
      }
    );
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Webhook endpoint is running',
    timestamp: new Date().toISOString()
  });
}

// Função para processar mensagem e gerar resposta
async function processMessage(message: string, phoneNumber: string, instanceId: string, correlationId: string) {
  try {
    // Gerar resposta usando OpenAI service que já retorna tokens
    const response = await generateAIResponse(message, phoneNumber, correlationId);
    
    if (response) {
      // Enviar resposta via Evolution API (sem mexer em billing)
      const sent = await sendMessage(phoneNumber, response.response, instanceId, correlationId);
      if (!sent) {
        await AlertHelpers.apiFailure(
          'Evolution API',
          'Não foi possível enviar resposta via Evolution API',
          {
            correlationId,
            phoneNumber,
            response: response.response,
            instanceId
          }
        );
      }
      return response;
    }
    
    return null;
  } catch (error) {
    console.error(`❌ [${correlationId}] Erro ao processar mensagem:`, error);
    return null;
  }
}

async function generateAIResponse(message: string, phoneNumber: string, correlationId: string) {
  try {
    // Buscar chatbot ativo da organização
    const { data: activeChatbot } = await supabase
      .from('chatbots')
      .select('id, org_id')
      .eq('org_id', '3108d984-ed2d-44f3-a742-ca223129c5fa')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!activeChatbot) {
      console.error(`❌ [${correlationId}] Nenhum chatbot ativo encontrado`);
      
      await AlertHelpers.systemAlert(
        'Chatbot Não Encontrado',
        'Nenhum chatbot ativo encontrado para processar a mensagem',
        'critical',
        {
          correlationId,
          phoneNumber,
          orgId: '3108d984-ed2d-44f3-a742-ca223129c5fa',
          endpoint: '/api/webhook'
        }
      );
      
      return null;
    }

    // Usar o OpenAI service que já retorna { response, tokensUsed }
    const response = await openaiService.generateResponse(
      activeChatbot.id,
      activeChatbot.org_id,
      message,
      [], // Histórico vazio por enquanto
      correlationId // Usar correlationId como messageId
    );

    if (!response) {
      console.error(`❌ [${correlationId}] Falha ao gerar resposta com OpenAI`);
      
      await AlertHelpers.apiFailure(
        'OpenAI API',
        'Falha ao gerar resposta ou créditos insuficientes',
        {
          correlationId,
          phoneNumber,
          chatbotId: activeChatbot.id,
          orgId: activeChatbot.org_id
        }
      );
      
      return null;
    }

    console.log(`✅ [${correlationId}] Resposta gerada com OpenAI: ${response.tokensUsed} tokens`);
    return response; // Retorna { response, tokensUsed }
    
  } catch (error) {
    console.error(`❌ [${correlationId}] Erro ao gerar resposta AI:`, error);
    
    await AlertHelpers.apiFailure(
      'OpenAI Service',
      'Falha ao conectar ou processar resposta do OpenAI Service',
      {
        correlationId,
        phoneNumber,
        error: error instanceof Error ? error.message : String(error)
      }
    );
    
    return null;
  }
}

async function sendMessage(phoneNumber: string, message: string, instanceId: string, correlationId: string) {
  try {
    const evolutionApiUrl = process.env.EVOLUTION_API_URL;
    const evolutionApiKey = process.env.EVOLUTION_API_KEY;
    
    if (!evolutionApiUrl || !evolutionApiKey) {
      console.error(`❌ [${correlationId}] Configurações da Evolution API não encontradas`);
      
      await AlertHelpers.systemAlert(
        'Configuração da Evolution API Faltando',
        'Variáveis de ambiente da Evolution API não estão configuradas',
        'critical',
        {
          correlationId,
          phoneNumber,
          missing_vars: [
            !evolutionApiUrl ? 'EVOLUTION_API_URL' : null,
            !evolutionApiKey ? 'EVOLUTION_API_KEY' : null
          ].filter(Boolean),
          endpoint: '/api/webhook'
        }
      );
      
      return false;
    }

    const response = await fetch(`${evolutionApiUrl}/message/sendText/${instanceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey
      },
      body: JSON.stringify({
        number: phoneNumber.replace('@s.whatsapp.net', ''),
        text: message
      })
    });

    if (response.ok) {
      console.log(`✅ [${correlationId}] Mensagem enviada com sucesso`);
      return true;
    } else {
      console.error(`❌ [${correlationId}] Erro ao enviar mensagem:`, response.status);
      
      await AlertHelpers.apiFailure(
        'Evolution API',
        `Evolution API retornou erro ${response.status}`,
        {
          correlationId,
          phoneNumber,
          message,
          instanceId,
          status: response.status,
          statusText: response.statusText
        }
      );
      
      return false;
    }
  } catch (error) {
    console.error(`❌ [${correlationId}] Erro ao enviar mensagem:`, error);
    
    await AlertHelpers.apiFailure(
      'Evolution API',
      'Falha ao conectar com Evolution API para envio de mensagem',
      {
        correlationId,
        phoneNumber,
        message,
        instanceId,
        error: error instanceof Error ? error.message : String(error)
      }
    );
    
    return false;
  }
}