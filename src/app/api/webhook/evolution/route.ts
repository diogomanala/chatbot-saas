import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Configuração do Supabase Admin
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Configuração da Evolution API
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL!;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY!;

// Configuração da OpenAI
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

// Helpers
const normalizeJidPhone = (jid: string) => jid.replace(/@s\.whatsapp\.net$/, '');
const nowIso = () => new Date().toISOString();

export async function POST(req: NextRequest) {
  const correlationId = uuidv4();
  
  try {
    console.log(`🔗 [${correlationId}] Webhook Evolution recebido`);
    
    const body = await req.json();
    console.log(`📦 [${correlationId}] Payload completo:`, JSON.stringify(body, null, 2));

    const { event, instance, data } = body;

    if (!event || !instance) {
      console.log(`❌ [${correlationId}] Payload inválido - faltando event ou instance`);
      return NextResponse.json({ error: 'Invalid payload: missing event or instance' }, { status: 400 });
    }

    console.log(`🎯 [${correlationId}] Processando evento: ${event} para instância: ${instance}`);

    // EVENTO: CONNECTION UPDATE
    if (event === 'connection.update') {
      console.log(`🔄 [${correlationId}] Processando atualização de conexão`);
      
      const state = data?.state;
      if (!state) {
        console.log(`❌ [${correlationId}] Estado da conexão não encontrado`);
        return NextResponse.json({ error: 'Connection state not found' }, { status: 400 });
      }

      // Mapear estado: 'open' -> 'connected', 'close' -> 'disconnected'
      const mappedStatus = state === 'open' ? 'connected' : 'disconnected';
      
      console.log(`📡 [${correlationId}] Atualizando status do dispositivo ${instance} para ${mappedStatus}`);

      const { error } = await supabaseAdmin
        .from('devices')
        .update({ 
          status: mappedStatus,
          updated_at: nowIso()
        })
        .eq('instance_id', instance);

      if (error) {
        console.error(`❌ [${correlationId}] Erro ao atualizar status:`, error);
        throw new Error(`Erro ao atualizar status: ${error.message}`);
      }

      console.log(`✅ [${correlationId}] Status do dispositivo ${instance} atualizado para ${mappedStatus}`);
      return NextResponse.json({ 
        success: true, 
        message: `Status atualizado para ${mappedStatus}`,
        correlationId 
      });
    }

    // EVENTO: MESSAGES UPSERT
    if (event === 'messages.upsert') {
      console.log(`💬 [${correlationId}] Processando mensagem recebida`);
      
      const messageData = data?.message;
      if (!messageData) {
        console.log(`❌ [${correlationId}] Dados da mensagem não encontrados`);
        return NextResponse.json({ error: 'Message data not found' }, { status: 400 });
      }

      // Extrair dados da mensagem
      const messageContent = messageData.conversation || 
                           messageData.extendedTextMessage?.text || 
                           messageData.text || 
                           '';
      const remoteJid = data?.key?.remoteJid || '';
      const messageId = data?.key?.id || '';
      const fromMe = data?.key?.fromMe || false;

      console.log(`📝 [${correlationId}] Conteúdo da mensagem: "${messageContent}"`);
      console.log(`👤 [${correlationId}] De: ${remoteJid}, FromMe: ${fromMe}`);

      // Ignorar mensagens enviadas por nós
      if (fromMe) {
        console.log(`⏭️ [${correlationId}] Ignorando mensagem enviada por nós`);
        return NextResponse.json({ success: true, message: 'Message from self ignored' });
      }

      // Ignorar mensagens vazias
      if (!messageContent.trim()) {
        console.log(`⏭️ [${correlationId}] Ignorando mensagem vazia`);
        return NextResponse.json({ success: true, message: 'Empty message ignored' });
      }

      // Buscar dispositivo na base de dados
      console.log(`🔍 [${correlationId}] Buscando dispositivo com instance_id: ${instance}`);
      
      const { data: deviceData, error: deviceError } = await supabaseAdmin
        .from('devices')
        .select(`
          id,
          org_id
        `)
        .eq('instance_id', instance)
        .single();

      if (deviceError || !deviceData) {
        console.error(`❌ [${correlationId}] Dispositivo não encontrado:`, deviceError);
        return NextResponse.json({ error: 'Device not found' }, { status: 404 });
      }

      console.log(`✅ [${correlationId}] Dispositivo encontrado: ${deviceData.id}`);
      console.log(`🏢 [${correlationId}] Organização: ${deviceData.org_id}`);

      // Buscar chatbot ativo para a organização
      console.log(`🔍 [${correlationId}] Buscando chatbot ativo para org_id: ${deviceData.org_id}`);
      
      const { data: activeChatbot, error: chatbotError } = await supabaseAdmin
        .from('chatbots')
        .select(`
          id,
          name,
          system_prompt,
          model,
          flows_enabled
        `)
        .eq('org_id', deviceData.org_id)
        .eq('is_active', true)
        .single();

      if (chatbotError || !activeChatbot) {
        console.error(`❌ [${correlationId}] Chatbot ativo não encontrado para org_id ${deviceData.org_id}:`, chatbotError);
        
        // Tentar enviar mensagem de erro para o usuário
        try {
          await fetch(`${EVOLUTION_API_URL}/message/sendText/${instance}`, {
            method: 'POST',
            headers: {
              'apikey': EVOLUTION_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              number: remoteJid,
              text: 'Desculpe, não há nenhum chatbot ativo configurado para esta organização. Entre em contato com o administrador.'
            })
          });
        } catch (fallbackError) {
          console.error(`❌ [${correlationId}] Erro ao enviar mensagem de fallback:`, fallbackError);
        }

        return NextResponse.json({ error: 'No active chatbot found for organization' }, { status: 404 });
      }

      console.log(`✅ [${correlationId}] Chatbot ativo encontrado: ${activeChatbot.name} (ID: ${activeChatbot.id})`);
      console.log(`🔧 [${correlationId}] Modelo: ${activeChatbot.model || 'gpt-3.5-turbo'}`);
      console.log(`🎯 [${correlationId}] Fluxos habilitados: ${activeChatbot.flows_enabled}`);

      const normalizedPhone = normalizeJidPhone(remoteJid);

      // Salvar mensagem recebida (inbound)
      console.log(`💾 [${correlationId}] Salvando mensagem recebida`);
      
      const { data: savedMessage, error: saveError } = await supabaseAdmin
        .from('messages')
        .insert({
          id: uuidv4(),
          org_id: deviceData.org_id,
          device_id: deviceData.id,
          chatbot_id: activeChatbot.id,
          phone_number: normalizedPhone,
          message_content: messageContent,
          direction: 'inbound',
          status: 'received',
          external_id: messageId,
          created_at: nowIso(),
          updated_at: nowIso()
        })
        .select()
        .single();

      if (saveError) {
        console.error(`❌ [${correlationId}] Erro ao salvar mensagem:`, saveError);
        throw new Error(`Erro ao salvar mensagem: ${saveError.message}`);
      }

      console.log(`✅ [${correlationId}] Mensagem inbound salva: ${savedMessage.id}`);

      if (activeChatbot.flows_enabled === true) {
        // --- NOVA LÓGICA DO MOTOR DE FLUXOS ---
        console.log(`🔄 [${correlationId}] Chatbot ${activeChatbot.id} tem fluxos ativados. Iniciando motor de fluxos...`);
        
        // Aqui, futuramente, entrará a lógica para verificar a chat_session,
        // encontrar o gatilho, executar a etapa, etc.
        // Por enquanto, apenas um log é suficiente.
        
        // Resposta temporária para fluxos ativados
        const flowsMessage = 'Motor de fluxos ativado! Esta funcionalidade será implementada em breve.';
        
        try {
          // Enviar resposta via Evolution API
          console.log(`📤 [${correlationId}] Enviando resposta do motor de fluxos via Evolution API`);
          
          const sendResponse = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instance}`, {
            method: 'POST',
            headers: {
              'apikey': EVOLUTION_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              number: remoteJid,
              text: flowsMessage
            })
          });

          if (!sendResponse.ok) {
            throw new Error(`Evolution API error: ${sendResponse.status}`);
          }

          const sendResult = await sendResponse.json();
          console.log(`✅ [${correlationId}] Resposta do motor de fluxos enviada via Evolution API:`, sendResult);

          // Salvar resposta enviada (outbound)
          console.log(`💾 [${correlationId}] Salvando mensagem outbound do motor de fluxos`);
          
          const { error: outboundError } = await supabaseAdmin
            .from('messages')
            .insert({
              id: uuidv4(),
              org_id: deviceData.org_id,
              device_id: deviceData.id,
              chatbot_id: activeChatbot.id,
              phone_number: normalizedPhone,
              message_content: flowsMessage,
              direction: 'outbound',
              status: 'sent',
              external_id: sendResult.key?.id || null,
              created_at: nowIso(),
              updated_at: nowIso()
            });

          if (outboundError) {
            console.error(`❌ [${correlationId}] Erro ao salvar mensagem outbound do motor de fluxos:`, outboundError);
          } else {
            console.log(`✅ [${correlationId}] Mensagem outbound do motor de fluxos salva`);
          }

          console.log(`🎉 [${correlationId}] Processamento do motor de fluxos finalizado`);
          
          return NextResponse.json({ 
            success: true, 
            message: 'Message processed by flows engine',
            correlationId,
            flowsResponse: flowsMessage
          });

        } catch (flowsError) {
          console.error(`❌ [${correlationId}] Erro no motor de fluxos:`, flowsError);
          
          // Tentar enviar mensagem de erro
          try {
            await fetch(`${EVOLUTION_API_URL}/message/sendText/${instance}`, {
              method: 'POST',
              headers: {
                'apikey': EVOLUTION_API_KEY,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                number: remoteJid,
                text: 'Desculpe, ocorreu um erro no motor de fluxos. Tente novamente em alguns instantes.'
              })
            });
          } catch (fallbackError) {
            console.error(`❌ [${correlationId}] Erro ao enviar mensagem de fallback do motor de fluxos:`, fallbackError);
          }

          throw flowsError;
        }

      } else {
        // --- LÓGICA ANTIGA E FUNCIONAL DA IA GERAL ---
        console.log(`🧠 [${correlationId}] Chatbot ${activeChatbot.id} tem fluxos desativados. Usando IA geral.`);
        
        // Gerar resposta da IA
        console.log(`🧠 [${correlationId}] Gerando resposta da IA`);
        
        const systemPrompt = activeChatbot.system_prompt || 'Você é um assistente útil.';
        const model = activeChatbot.model || 'gpt-3.5-turbo';
        
        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: messageContent }
              ],
              max_tokens: 500,
              temperature: 0.7
            })
          });

          if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
          }

          const aiResponse = await response.json();
          const aiMessage = aiResponse.choices?.[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem.';

          console.log(`🤖 [${correlationId}] Resposta da IA gerada: "${aiMessage}"`);

          // Enviar resposta via Evolution API
          console.log(`📤 [${correlationId}] Enviando resposta via Evolution API`);
          
          const sendResponse = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instance}`, {
            method: 'POST',
            headers: {
              'apikey': EVOLUTION_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              number: remoteJid,
              text: aiMessage
            })
          });

          if (!sendResponse.ok) {
            throw new Error(`Evolution API error: ${sendResponse.status}`);
          }

          const sendResult = await sendResponse.json();
          console.log(`✅ [${correlationId}] Resposta enviada via Evolution API:`, sendResult);

          // Salvar resposta enviada (outbound)
          console.log(`💾 [${correlationId}] Salvando mensagem outbound`);
          
          const { error: outboundError } = await supabaseAdmin
            .from('messages')
            .insert({
              id: uuidv4(),
              org_id: deviceData.org_id,
              device_id: deviceData.id,
              chatbot_id: activeChatbot.id,
              phone_number: normalizedPhone,
              message_content: aiMessage,
              direction: 'outbound',
              status: 'sent',
              external_id: sendResult.key?.id || null,
              created_at: nowIso(),
              updated_at: nowIso()
            });

          if (outboundError) {
            console.error(`❌ [${correlationId}] Erro ao salvar mensagem outbound:`, outboundError);
          } else {
            console.log(`✅ [${correlationId}] Mensagem outbound salva`);
          }

          console.log(`🎉 [${correlationId}] Processamento completo da mensagem finalizado`);
          
          return NextResponse.json({ 
            success: true, 
            message: 'Message processed and response sent',
            correlationId,
            aiResponse: aiMessage
          });

        } catch (aiError) {
          console.error(`❌ [${correlationId}] Erro na IA ou envio:`, aiError);
          
          // Tentar enviar mensagem de erro
          try {
            await fetch(`${EVOLUTION_API_URL}/message/sendText/${instance}`, {
              method: 'POST',
              headers: {
                'apikey': EVOLUTION_API_KEY,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                number: remoteJid,
                text: 'Desculpe, ocorreu um erro temporário. Tente novamente em alguns instantes.'
              })
            });
          } catch (fallbackError) {
            console.error(`❌ [${correlationId}] Erro ao enviar mensagem de fallback:`, fallbackError);
          }

          throw aiError;
        }
      }
    }

    // Evento não reconhecido
    console.log(`⚠️ [${correlationId}] Evento não reconhecido: ${event}`);
    return NextResponse.json({ 
      success: true, 
      message: `Event ${event} not handled`,
      correlationId 
    });

  } catch (error) {
    console.error(`💥 [${correlationId}] Erro crítico no webhook:`, error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      correlationId,
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}