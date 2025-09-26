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

// Função auxiliar para executar um passo do fluxo
async function executeFlowStep(
  supabase: any,
  flow: any,
  currentStepId: string,
  session: any,
  userMessage: string,
  correlationId: string
): Promise<{ response: string; nextStepId: string | null }> {
  console.log(`🔧 [${correlationId}] Executando passo do fluxo:`, currentStepId);
  
  const flowData = flow.flow_data;
  const currentNode = flowData.nodes?.find((node: any) => node.id === currentStepId);
  
  if (!currentNode) {
    console.error(`❌ [${correlationId}] Nó não encontrado:`, currentStepId);
    throw new Error(`Nó ${currentStepId} não encontrado no fluxo`);
  }

  console.log(`📍 [${correlationId}] Executando nó tipo:`, currentNode.type);

  let response = '';
  let nextStepId: string | null = null;

  switch (currentNode.type) {
    case 'input':
      // Nó de entrada - apenas passa para o próximo
      const inputEdge = flowData.edges?.find((edge: any) => edge.source === currentStepId);
      nextStepId = inputEdge?.target || null;
      console.log(`➡️ [${correlationId}] Nó input, próximo passo:`, nextStepId);
      break;

    case 'messageNode':
      // Nó de mensagem - envia uma mensagem
      response = currentNode.data?.label || 'Mensagem não configurada';
      
      // Substituir variáveis na mensagem se houver
      if (session.session_variables) {
        Object.keys(session.session_variables).forEach(key => {
          response = response.replace(`{{${key}}}`, session.session_variables[key]);
        });
      }
      
      const messageEdge = flowData.edges?.find((edge: any) => edge.source === currentStepId);
      nextStepId = messageEdge?.target || null;
      console.log(`💬 [${correlationId}] Nó messageNode, resposta:`, response, 'próximo:', nextStepId);
      break;

    case 'condition':
      // Nó de condição - avalia uma condição e escolhe o caminho
      const condition = currentNode.data?.condition;
      const conditionValue = currentNode.data?.value;
      
      let conditionMet = false;
      
      if (condition === 'contains') {
        conditionMet = userMessage.toLowerCase().includes(conditionValue?.toLowerCase() || '');
      } else if (condition === 'equals') {
        conditionMet = userMessage.toLowerCase().trim() === (conditionValue?.toLowerCase().trim() || '');
      } else if (condition === 'starts_with') {
        conditionMet = userMessage.toLowerCase().startsWith(conditionValue?.toLowerCase() || '');
      }
      
      // Encontrar a edge correta baseada na condição
      const conditionEdges = flowData.edges?.filter((edge: any) => edge.source === currentStepId) || [];
      const trueEdge = conditionEdges.find((edge: any) => edge.sourceHandle === 'true');
      const falseEdge = conditionEdges.find((edge: any) => edge.sourceHandle === 'false');
      
      nextStepId = conditionMet ? (trueEdge?.target || null) : (falseEdge?.target || null);
      console.log(`🔀 [${correlationId}] Nó condition, condição atendida:`, conditionMet, 'próximo:', nextStepId);
      break;

    case 'input_capture':
      // Nó de captura de entrada - salva a resposta do usuário
      const variableName = currentNode.data?.variable_name || 'captured_input';
      
      // Atualizar variáveis da sessão
      const updatedVariables = {
        ...session.session_variables,
        [variableName]: userMessage
      };
      
      await supabase
        .from('chat_sessions')
        .update({ 
          session_variables: updatedVariables,
          updated_at: new Date().toISOString()
        })
        .eq('id', session.id);
      
      // Resposta opcional do nó
      response = currentNode.data?.response_message || '';
      
      const captureEdge = flowData.edges?.find((edge: any) => edge.source === currentStepId);
      nextStepId = captureEdge?.target || null;
      console.log(`📝 [${correlationId}] Nó input_capture, variável salva:`, variableName, '=', userMessage);
      break;

    case 'output':
      // Nó de saída - finaliza o fluxo
      response = currentNode.data?.message || 'Fluxo finalizado';
      nextStepId = null; // Fim do fluxo
      console.log(`🏁 [${correlationId}] Nó output, finalizando fluxo`);
      break;

    default:
      console.warn(`⚠️ [${correlationId}] Tipo de nó não reconhecido:`, currentNode.type);
      response = 'Erro: tipo de nó não suportado';
      nextStepId = null;
  }

  return { response, nextStepId };
}

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
          groq_model,
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
      console.log(`🔧 [${correlationId}] Modelo: ${activeChatbot.groq_model || 'gpt-3.5-turbo'}`);
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
        // --- MOTOR DE FLUXOS COMPLETO ---
        console.log(`🔄 [${correlationId}] Chatbot ${activeChatbot.id} tem fluxos ativados. Iniciando motor de fluxos...`);
        
        try {
          // 1. GERENCIAMENTO DE SESSÃO - Verificar se já existe uma sessão ativa
          const { data: existingSession, error: sessionError } = await supabaseAdmin
            .from('chat_sessions')
            .select('*')
            .eq('chatbot_id', activeChatbot.id)
            .eq('phone_number', normalizedPhone)
            .eq('status', 'active')
            .single();

          if (sessionError && sessionError.code !== 'PGRST116') {
            console.error(`❌ [${correlationId}] Erro ao buscar sessão:`, sessionError);
            throw new Error('Erro ao verificar sessão ativa');
          }

          let flowResponse = '';
          let sessionUpdated = false;

          if (!existingSession) {
            // 2. LÓGICA DE GATILHO - Não há sessão ativa, verificar trigger_keywords
            console.log(`🔍 [${correlationId}] Nenhuma sessão ativa encontrada, verificando gatilhos...`);
            
            const { data: flows, error: flowsError } = await supabaseAdmin
              .from('flows')
              .select('*')
              .eq('chatbot_id', activeChatbot.id);

            if (flowsError) {
              console.error(`❌ [${correlationId}] Erro ao buscar fluxos:`, flowsError);
              throw new Error('Erro ao buscar fluxos disponíveis');
            }

            // Verificar se a mensagem corresponde a algum trigger_keyword
            let matchedFlow = null;
            const messageTextLower = messageContent.toLowerCase().trim();

            for (const flow of flows || []) {
              if (flow.trigger_keywords && Array.isArray(flow.trigger_keywords)) {
                const hasMatch = flow.trigger_keywords.some(keyword => 
                  messageTextLower.includes(keyword.toLowerCase().trim())
                );
                
                if (hasMatch) {
                  matchedFlow = flow;
                  console.log(`✅ [${correlationId}] Gatilho encontrado para fluxo:`, flow.name);
                  break;
                }
              }
            }

            if (matchedFlow) {
              // Encontrou um fluxo correspondente - criar nova sessão
              const flowData = matchedFlow.flow_data;
              
              // Encontrar o nó "Ponto de Início" (input node)
              const startNode = flowData.nodes?.find(node => node.type === 'input');
              
              if (!startNode) {
                console.error(`❌ [${correlationId}] Nó de início não encontrado no fluxo:`, matchedFlow.name);
                throw new Error('Fluxo inválido: nó de início não encontrado');
              }

              // Criar nova sessão
              const { data: newSession, error: createSessionError } = await supabaseAdmin
                .from('chat_sessions')
                .insert({
                  id: uuidv4(),
                  org_id: deviceData.org_id,
                  chatbot_id: activeChatbot.id,
                  phone_number: normalizedPhone,
                  session_token: `session_${normalizedPhone}_${Date.now()}`,
                  active_flow_id: matchedFlow.id,
                  current_step_id: startNode.id,
                  status: 'active',
                  session_variables: {},
                  created_at: nowIso(),
                  updated_at: nowIso()
                })
                .select()
                .single();

              if (createSessionError) {
                console.error(`❌ [${correlationId}] Erro ao criar sessão:`, createSessionError);
                throw new Error('Erro ao criar nova sessão');
              }

              console.log(`🆕 [${correlationId}] Nova sessão criada:`, newSession.id);

              // Executar o primeiro passo do fluxo
              let { response, nextStepId } = await executeFlowStep(
                supabaseAdmin, 
                matchedFlow, 
                startNode.id, 
                newSession,
                messageContent,
                correlationId
              );
              
              // Se o primeiro passo é um nó input (sem resposta), executar o próximo passo automaticamente
              if (!response && nextStepId) {
                console.log(`🔄 [${correlationId}] Nó input executado, continuando para próximo passo: ${nextStepId}`);
                
                // Atualizar current_step_id primeiro
                await supabaseAdmin
                  .from('chat_sessions')
                  .update({ 
                    current_step_id: nextStepId,
                    updated_at: nowIso()
                  })
                  .eq('id', newSession.id);

                // Executar o próximo passo
                const nextStepResult = await executeFlowStep(
                  supabaseAdmin,
                  matchedFlow,
                  nextStepId,
                  { ...newSession, current_step_id: nextStepId },
                  messageContent,
                  correlationId
                );
                
                response = nextStepResult.response;
                nextStepId = nextStepResult.nextStepId;
              }
              
              flowResponse = response;

              // Atualizar current_step_id se houver próximo passo
              if (nextStepId) {
                await supabaseAdmin
                  .from('chat_sessions')
                  .update({ 
                    current_step_id: nextStepId,
                    updated_at: nowIso()
                  })
                  .eq('id', newSession.id);
              } else {
                // Fluxo concluído
                await supabaseAdmin
                  .from('chat_sessions')
                  .update({ 
                    status: 'completed',
                    updated_at: nowIso()
                  })
                  .eq('id', newSession.id);
              }

              sessionUpdated = true;
            } else {
              // Nenhum gatilho encontrado - deixar a IA geral responder
              console.log(`❌ [${correlationId}] Nenhum gatilho encontrado, passando para IA geral`);
              // Não retorna aqui, vai para o bloco da IA geral
            }

          } else {
            // 3. LÓGICA DE EXECUÇÃO DE FLUXO - Sessão ativa existe
            console.log(`📋 [${correlationId}] Sessão ativa encontrada:`, existingSession.id);
            
            // Carregar dados do fluxo ativo
            const { data: activeFlow, error: flowError } = await supabaseAdmin
              .from('flows')
              .select('*')
              .eq('id', existingSession.active_flow_id)
              .single();

            if (flowError || !activeFlow) {
              console.error(`❌ [${correlationId}] Erro ao carregar fluxo ativo:`, flowError);
              // Encerrar sessão inválida
              await supabaseAdmin
                .from('chat_sessions')
                .update({ 
                  status: 'abandoned',
                  updated_at: nowIso()
                })
                .eq('id', existingSession.id);
              throw new Error('Fluxo ativo não encontrado');
            }

            // Executar próximo passo do fluxo
            const { response, nextStepId } = await executeFlowStep(
              supabaseAdmin,
              activeFlow,
              existingSession.current_step_id,
              existingSession,
              messageContent,
              correlationId
            );

            flowResponse = response;

            // Atualizar sessão com próximo passo ou finalizar
            if (nextStepId) {
              await supabaseAdmin
                .from('chat_sessions')
                .update({ 
                  current_step_id: nextStepId,
                  updated_at: nowIso()
                })
                .eq('id', existingSession.id);
            } else {
              // Fluxo concluído
              await supabaseAdmin
                .from('chat_sessions')
                .update({ 
                  status: 'completed',
                  updated_at: nowIso()
                })
                .eq('id', existingSession.id);
            }

            sessionUpdated = true;
          }

          // Enviar resposta se houver
          if (flowResponse) {
            console.log(`📤 [${correlationId}] Enviando resposta do fluxo via Evolution API`);
            
            // Usar o número normalizado da sessão, não o remoteJid do payload
            const targetNumber = normalizedPhone;
            console.log(`🎯 [${correlationId}] Número de destino: ${targetNumber}`);
            
            // Verificar se o número existe antes de enviar
            const checkResponse = await fetch(`${EVOLUTION_API_URL}/chat/whatsappNumbers/${instance}`, {
              method: 'POST',
              headers: {
                'apikey': EVOLUTION_API_KEY,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                numbers: [targetNumber]
              })
            });

            if (checkResponse.ok) {
              const checkResult = await checkResponse.json();
              const numberExists = checkResult.find((num: any) => num.jid === targetNumber)?.exists;
              
              if (!numberExists) {
                console.log(`⚠️ [${correlationId}] Número ${targetNumber} não existe no WhatsApp, simulando envio`);
                
                // Salvar resposta como enviada mesmo sem enviar (para números de teste)
                console.log(`💾 [${correlationId}] Salvando mensagem outbound do fluxo (simulada)`);
                
                const { error: outboundError } = await supabaseAdmin
                   .from('messages')
                   .insert({
                     id: uuidv4(),
                     org_id: deviceData.org_id,
                     device_id: deviceData.id,
                     chatbot_id: activeChatbot.id,
                     phone_number: normalizedPhone,
                     message_content: flowResponse,
                     direction: 'outbound',
                     status: 'simulated', // Status especial para números de teste
                     external_id: `simulated_${Date.now()}`, // ID simulado para evitar constraint
                     created_at: nowIso(),
                     updated_at: nowIso()
                   });

                if (outboundError) {
                  console.error(`❌ [${correlationId}] Erro ao salvar mensagem outbound simulada:`, outboundError);
                } else {
                  console.log(`✅ [${correlationId}] Mensagem outbound simulada salva com sucesso`);
                }
                
                return NextResponse.json({ 
                  success: true, 
                  message: 'Mensagem processada pelo motor de fluxos (simulada)',
                  correlationId,
                  flowResponse 
                });
              }
            }
            
            // Preparar body da requisição para Evolution API
            const requestBody = {
              number: targetNumber,
              text: flowResponse
            };
            
            // Debug: Log do body completo sendo enviado
            console.log(`🔍 [${correlationId}] Body da requisição para Evolution API:`, JSON.stringify(requestBody, null, 2));
            
            const sendResponse = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instance}`, {
              method: 'POST',
              headers: {
                'apikey': EVOLUTION_API_KEY,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody)
            });

            if (!sendResponse.ok) {
              const errorText = await sendResponse.text();
              console.log(`❌ [${correlationId}] Erro ao enviar via Evolution API:`, errorText);
              throw new Error(`Evolution API error: ${sendResponse.status}`);
            }

            const sendResult = await sendResponse.json();
            console.log(`✅ [${correlationId}] Resposta do fluxo enviada via Evolution API:`, sendResult);

            // Salvar resposta enviada (outbound)
            console.log(`💾 [${correlationId}] Salvando mensagem outbound do fluxo`);
            
            const { error: outboundError } = await supabaseAdmin
              .from('messages')
              .insert({
                id: uuidv4(),
                org_id: deviceData.org_id,
                device_id: deviceData.id,
                chatbot_id: activeChatbot.id,
                phone_number: normalizedPhone,
                message_content: flowResponse,
                direction: 'outbound',
                status: 'sent',
                external_id: sendResult.key?.id || null,
                created_at: nowIso(),
                updated_at: nowIso()
              });

            if (outboundError) {
              console.error(`❌ [${correlationId}] Erro ao salvar mensagem outbound do fluxo:`, outboundError);
            } else {
              console.log(`✅ [${correlationId}] Mensagem outbound do fluxo salva`);
            }

            console.log(`🎉 [${correlationId}] Processamento do fluxo finalizado`);
            
            return NextResponse.json({ 
              success: true, 
              message: 'Message processed by flows engine',
              correlationId,
              flowsResponse: flowResponse,
              sessionUpdated
            });
          }

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
        // TODO: Adicionar coluna 'openai_model' na tabela chatbots para evitar confusão entre modelos Groq e OpenAI
        // Usando gpt-4o-mini: modelo mais barato e eficiente da OpenAI (60% mais barato que GPT-3.5 Turbo)
        const model = 'gpt-4o-mini'; // Modelo mais econômico da OpenAI com excelente performance
        
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