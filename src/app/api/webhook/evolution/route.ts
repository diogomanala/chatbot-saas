import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { SimplifiedBillingService } from '@/lib/simplified-billing.service';

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

// Função auxiliar para determinar se deve continuar automaticamente
function shouldContinueAutomatically(flow: any, nextStepId: string | null): boolean {
  console.log(`🔍 [DEBUG] shouldContinueAutomatically chamada com nextStepId: ${nextStepId}`);
  
  if (!nextStepId) {
    console.log(`🔍 [DEBUG] nextStepId é null/undefined - retornando false`);
    return false;
  }
  
  const nextNode = flow.flow_data.nodes?.find((node: any) => node.id === nextStepId);
  console.log(`🔍 [DEBUG] nextNode encontrado:`, nextNode?.type, nextNode?.id);
  
  if (!nextNode) {
    console.log(`🔍 [DEBUG] nextNode não encontrado - retornando false`);
    return false;
  }
  
  // Continuar automaticamente para nós que não requerem interação do usuário
  // NOTA: 'options' incluído para permitir continuação automática na primeira execução
  // 'input' incluído pois pode continuar automaticamente quando não aguarda entrada
  const autoExecuteTypes = ['message', 'messageNode', 'image', 'audio', 'condition', 'start', 'input', 'options'];
  const shouldContinue = autoExecuteTypes.includes(nextNode.type);
  
  console.log(`🔍 [DEBUG] Tipo do próximo nó: ${nextNode.type}, deve continuar: ${shouldContinue}`);
  
  return shouldContinue;
}

async function executeFlowStep(
  supabase: any,
  flow: any,
  currentStepId: string,
  session: any,
  userMessage: string,
  correlationId: string,
  instance: string
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
    case 'start':
    case 'input':
      const inputPrompt = currentNode.data?.prompt || currentNode.data?.label;
      const inputVariable = currentNode.data?.variable_name;
      
      // Para nós de início (start), sempre avançar para o próximo passo
      if (currentNode.type === 'start') {
        const startEdge = flowData.edges?.find((edge: any) => edge.source === currentStepId);
        nextStepId = startEdge?.target || null;
        console.log(`🚀 [${correlationId}] Nó start, próximo passo:`, nextStepId);
        response = ''; // Nó de início não envia resposta
        break;
      }
      
      if (inputPrompt && (!userMessage || userMessage === '')) {
        response = inputPrompt;
        nextStepId = null;
        console.log(`📝 [${correlationId}] Nó input, enviando prompt:`, inputPrompt);
      } else if (inputVariable && userMessage) {
        const updatedVariables = {
          ...session.session_variables,
          [inputVariable]: userMessage
        };
        
        await supabase
          .from('chat_sessions')
          .update({ 
            session_variables: updatedVariables,
            updated_at: new Date().toISOString()
          })
          .eq('id', session.id);
        
        response = currentNode.data?.confirmation_message || 'Dados capturados com sucesso';
        
        const inputEdge = flowData.edges?.find((edge: any) => edge.source === currentStepId);
        nextStepId = inputEdge?.target || null;
        console.log(`✅ [${correlationId}] Nó input, dados capturados:`, inputVariable, '=', userMessage, 'próximo:', nextStepId);
      } else {
        // Nó input sem prompt e sem userMessage - continuar para próximo passo
        response = ''; // Resposta vazia para não enviar mensagem
        const inputEdge = flowData.edges?.find((edge: any) => edge.source === currentStepId);
        nextStepId = inputEdge?.target || null;
        console.log(`➡️ [${correlationId}] Nó input, próximo passo:`, nextStepId);
      }
      break;

    case 'message':
    case 'messageNode':
      response = currentNode.data?.message || currentNode.data?.label || 'Mensagem não configurada';
      
      if (session.session_variables) {
        Object.keys(session.session_variables).forEach(key => {
          response = response.replace(`{{${key}}}`, session.session_variables[key]);
        });
      }
      
      const messageEdge = flowData.edges?.find((edge: any) => edge.source === currentStepId);
      nextStepId = messageEdge?.target || null;
      console.log(`💬 [${correlationId}] Nó message, resposta:`, response, 'próximo:', nextStepId);
      break;

    case 'options':
      const questionText = currentNode.data?.question || currentNode.data?.message || currentNode.data?.label || 'Escolha uma opção:';
      const options = currentNode.data?.options || [];
      
      if (!options || options.length === 0) {
        console.log(`⚠️ [${correlationId}] Nó de opções sem opções configuradas, usando label como resposta`);
        response = questionText;
        
        const connectedEdges = flowData.edges?.filter((edge: any) => edge.source === currentStepId) || [];
        nextStepId = connectedEdges[0]?.target || null;
        
        console.log(`➡️ [${correlationId}] Nó options sem configuração, próximo passo:`, nextStepId);
        break;
      }
      
      if (!session.waiting_for_input) {
        console.log(`🔘 [${correlationId}] Primeira execução do nó options - preparando pergunta com lista numerada`);
        
        let numberedListMessage = questionText + '\n\n';
        options.forEach((option: any, index: number) => {
          const optionText = typeof option === 'string' ? option : option.text || `Opção ${index + 1}`;
          numberedListMessage += `${index + 1}. ${optionText}\n`;
        });
        
        console.log(`📝 [${correlationId}] Lista numerada preparada para envio`);
        
        response = numberedListMessage.trim();
        
        await supabase
          .from('chat_sessions')
          .update({ 
            waiting_for_input: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', session.id);
          
        console.log(`⏳ [${correlationId}] waiting_for_input definido como true, aguardando resposta`);
        nextStepId = null;
        
      } else {
        console.log(`🔘 [${correlationId}] Processando resposta para nó options:`, userMessage);
        
        let selectedOptionIndex = -1;
        
        const userInput = userMessage.trim();
        const numberMatch = userInput.match(/^(\d+)$/);
        
        if (numberMatch) {
          const selectedNumber = parseInt(numberMatch[1], 10);
          if (selectedNumber >= 1 && selectedNumber <= options.length) {
            selectedOptionIndex = selectedNumber - 1;
            console.log(`🔢 [${correlationId}] Usuário selecionou opção por número: ${selectedNumber} (índice ${selectedOptionIndex})`);
          }
        }
        
        if (selectedOptionIndex === -1) {
          for (let i = 0; i < options.length; i++) {
            const option = options[i];
            const optionText = typeof option === 'string' ? option : option.text;
            
            if (userMessage.toLowerCase().includes(optionText.toLowerCase()) ||
                userMessage.toLowerCase().trim() === optionText.toLowerCase().trim()) {
              selectedOptionIndex = i;
              console.log(`📝 [${correlationId}] Usuário selecionou opção por texto: "${optionText}" (índice ${selectedOptionIndex})`);
              break;
            }
          }
        }
        
        if (selectedOptionIndex >= 0) {
          const selectedOption = options[selectedOptionIndex];
          const selectedOptionText = typeof selectedOption === 'string' ? selectedOption : selectedOption.text;
          
          const optionEdges = flowData.edges?.filter((edge: any) => edge.source === currentStepId) || [];
          
          const matchingEdge = optionEdges.find((edge: any) => 
            edge.sourceHandle === `option-${selectedOptionIndex}` || 
            edge.sourceHandle === `option_${selectedOptionIndex}` || 
            edge.sourceHandle === selectedOption.id ||
            edge.sourceHandle === selectedOptionIndex.toString()
          );
          
          nextStepId = matchingEdge?.target || optionEdges[selectedOptionIndex]?.target || null;
          
          // Não enviar mensagem de confirmação, apenas avançar para o próximo nó
          response = '';
          console.log(`✅ [${correlationId}] Opção selecionada:`, selectedOptionText, 'próximo:', nextStepId);
          
          await supabase
            .from('chat_sessions')
            .update({ 
              waiting_for_input: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', session.id);
            
          console.log(`✅ [${correlationId}] waiting_for_input resetado para false após resposta válida`);
          
        } else {
          response = `Opção inválida. ${questionText}`;
          nextStepId = null;
          console.log(`❌ [${correlationId}] Opção inválida, mantendo no mesmo nó`);
        }
      }
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

      const messageContent = messageData.conversation || 
                           messageData.extendedTextMessage?.text || 
                           messageData.text || 
                           '';
      const remoteJid = data?.key?.remoteJid || '';
      const messageId = data?.key?.id || '';
      const fromMe = data?.key?.fromMe || false;

      console.log(`📝 [${correlationId}] Conteúdo da mensagem: "${messageContent}"`);
      console.log(`👤 [${correlationId}] De: ${remoteJid}, FromMe: ${fromMe}`);

      if (fromMe) {
        console.log(`⏭️ [${correlationId}] Ignorando mensagem enviada por nós`);
        return NextResponse.json({ success: true, message: 'Message from self ignored' });
      }

      if (!messageContent.trim()) {
        console.log(`⏭️ [${correlationId}] Ignorando mensagem vazia`);
        return NextResponse.json({ success: true, message: 'Empty message ignored' });
      }

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

      console.log(`💾 [${correlationId}] Salvando mensagem recebida`);
      
      // Primeiro, verificar se a mensagem já existe
      const { data: existingMessage } = await supabaseAdmin
        .from('messages')
        .select('id')
        .eq('external_id', messageId)
        .single();

      let savedMessage;
      
      if (existingMessage) {
        console.log(`🔄 [${correlationId}] Mensagem já existe, atualizando: ${existingMessage.id}`);
        const { data: updatedMessage, error: updateError } = await supabaseAdmin
          .from('messages')
          .update({
            message_content: messageContent,
            status: 'received',
            updated_at: nowIso()
          })
          .eq('external_id', messageId)
          .select()
          .single();
          
        if (updateError) {
          console.error(`❌ [${correlationId}] Erro ao atualizar mensagem:`, updateError);
          throw new Error(`Erro ao atualizar mensagem: ${updateError.message}`);
        }
        savedMessage = updatedMessage;
      } else {
        const { data: newMessage, error: saveError } = await supabaseAdmin
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
        savedMessage = newMessage;
      }

      console.log(`✅ [${correlationId}] Mensagem inbound salva: ${savedMessage.id}`);

      if (activeChatbot.flows_enabled === true) {
        console.log(`🔄 [${correlationId}] Chatbot ${activeChatbot.id} tem fluxos ativados. Iniciando motor de fluxos...`);
        
        try {
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

          if (existingSession && existingSession.waiting_for_input === true) {
            console.log(`📥 [${correlationId}] PRIORIDADE: Sessão ativa aguardando resposta encontrada:`, existingSession.id);
            console.log(`⏳ [${correlationId}] Processando resposta do usuário para o passo:`, existingSession.current_step_id);
            
            const { data: activeFlow, error: flowError } = await supabaseAdmin
              .from('flows')
              .select('*')
              .eq('id', existingSession.active_flow_id)
              .single();

            if (flowError || !activeFlow) {
              console.error(`❌ [${correlationId}] Fluxo ativo não encontrado:`, flowError);
              throw new Error('Fluxo ativo não encontrado');
            }

            const { response, nextStepId } = await executeFlowStep(
              supabaseAdmin,
              activeFlow,
              existingSession.current_step_id,
              existingSession,
              messageContent,
              correlationId,
              instance
            );

            flowResponse = response;

            if (nextStepId) {
              await supabaseAdmin
                .from('chat_sessions')
                .update({
                  current_step_id: nextStepId,
                  updated_at: nowIso()
                })
                .eq('id', existingSession.id);

              sessionUpdated = true;
            }

            // Só enviar resposta se não for uma string vazia
            if (flowResponse && flowResponse.trim() !== '') {
              console.log(`📤 [${correlationId}] Enviando resposta do fluxo via Evolution API`);
              
              const targetNumber = normalizedPhone;
              
              await fetch(`${EVOLUTION_API_URL}/message/sendText/${instance}`, {
                method: 'POST',
                headers: {
                  'apikey': EVOLUTION_API_KEY,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  number: targetNumber,
                  text: flowResponse
                })
              });

              // Calcular tokens e inserir mensagem com cobrança
              const tokensUsed = Math.max(Math.ceil(flowResponse.length * 0.75), 50); // Mínimo 50 tokens
              
              const billingResult = await SimplifiedBillingService.insertMessageWithBilling(
                {
                  id: uuidv4(),
                  org_id: deviceData.org_id,
                  device_id: deviceData.id,
                  chatbot_id: activeChatbot.id,
                  phone_number: normalizedPhone,
                  message_content: flowResponse,
                  direction: 'outbound',
                  status: 'sent',
                  external_id: `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  tokens_used: tokensUsed,
                  created_at: nowIso(),
                  updated_at: nowIso()
                },
                deviceData.org_id,
                flowResponse,
                tokensUsed
              );

              if (billingResult.success) {
                console.log(`✅ [${correlationId}] Resposta do fluxo enviada e salva com cobrança: ${tokensUsed} tokens`);
              } else {
                console.error(`❌ [${correlationId}] Erro na cobrança da resposta do fluxo:`, billingResult.billing?.message);
              }
            } else {
              console.log(`🔇 [${correlationId}] Resposta vazia - não enviando mensagem`);
            }

            return NextResponse.json({
              success: true,
              message: 'Flow response processed',
              correlationId,
              sessionUpdated
            });
          }

          // Se não há sessão ativa ou não está aguardando input, iniciar novo fluxo
          console.log(`🆕 [${correlationId}] Nenhuma sessão ativa aguardando input. Iniciando novo fluxo...`);
          
          // Buscar fluxos disponíveis para este chatbot
          const { data: availableFlows, error: flowsError } = await supabaseAdmin
            .from('flows')
            .select('*')
            .eq('org_id', deviceData.org_id)
            .order('created_at', { ascending: false });

          if (flowsError || !availableFlows || availableFlows.length === 0) {
            console.log(`❌ [${correlationId}] Nenhum fluxo encontrado para iniciar`);
            // Continuar para IA se não há fluxos
          } else {
            // Usar o primeiro fluxo disponível (mais recente)
            const selectedFlow = availableFlows[0];
            console.log(`🎯 [${correlationId}] Iniciando fluxo: ${selectedFlow.name} (ID: ${selectedFlow.id})`);

            // Encontrar o nó de início do fluxo
            const startNode = selectedFlow.flow_data?.nodes?.find((node: any) => node.type === 'input');
            
            if (!startNode) {
              console.error(`❌ [${correlationId}] Fluxo ${selectedFlow.id} não tem nó de início`);
              // Continuar para IA se fluxo inválido
            } else {
              // Criar nova sessão
              const { data: newSession, error: sessionCreateError } = await supabaseAdmin
                .from('chat_sessions')
                .insert({
                  id: uuidv4(),
                  org_id: deviceData.org_id,
                  chatbot_id: activeChatbot.id,
                  phone_number: normalizedPhone,
                  session_token: `session_${normalizedPhone}_${Date.now()}`,
                  active_flow_id: selectedFlow.id,
                  current_step_id: startNode.id,
                  status: 'active',
                  waiting_for_input: false,
                  session_variables: {
                    phone_number: normalizedPhone,
                    instance_id: instance
                  },
                  created_at: nowIso(),
                  updated_at: nowIso()
                })
                .select()
                .single();

              if (sessionCreateError) {
                console.error(`❌ [${correlationId}] Erro ao criar sessão:`, sessionCreateError);
                // Continuar para IA se erro na sessão
              } else {
                console.log(`✅ [${correlationId}] Nova sessão criada: ${newSession.id}`);

                // Executar primeiro passo do fluxo
                const { response, nextStepId } = await executeFlowStep(
                  supabaseAdmin,
                  selectedFlow,
                  startNode.id,
                  newSession,
                  messageContent,
                  correlationId,
                  instance
                );

                let flowResponse = response;

                // Atualizar sessão com próximo passo
                if (nextStepId) {
                  await supabaseAdmin
                    .from('chat_sessions')
                    .update({
                      current_step_id: nextStepId,
                      updated_at: nowIso()
                    })
                    .eq('id', newSession.id);
                }

                // Continuar executando passos automaticamente se necessário
                let currentStepId = nextStepId;
                let sessionToUpdate = { ...newSession };
                
                while (currentStepId && shouldContinueAutomatically(selectedFlow, currentStepId)) {
                  console.log(`🔄 [${correlationId}] Continuando automaticamente para passo: ${currentStepId}`);
                  
                  const stepResult = await executeFlowStep(
                    supabaseAdmin,
                    selectedFlow,
                    currentStepId,
                    sessionToUpdate,
                    '',
                    correlationId,
                    instance
                  );

                  if (stepResult.response && stepResult.response.trim() !== '') {
                    flowResponse = stepResult.response;
                  }

                  if (stepResult.nextStepId) {
                    await supabaseAdmin
                      .from('chat_sessions')
                      .update({
                        current_step_id: stepResult.nextStepId,
                        updated_at: nowIso()
                      })
                      .eq('id', newSession.id);
                    
                    sessionToUpdate.current_step_id = stepResult.nextStepId;
                  }

                  currentStepId = stepResult.nextStepId;
                }

                // Só enviar resposta se não for uma string vazia
                if (flowResponse && flowResponse.trim() !== '') {
                  console.log(`📤 [${correlationId}] Enviando resposta do novo fluxo via Evolution API`);
                  
                  await fetch(`${EVOLUTION_API_URL}/message/sendText/${instance}`, {
                    method: 'POST',
                    headers: {
                      'apikey': EVOLUTION_API_KEY,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      number: normalizedPhone,
                      text: flowResponse
                    })
                  });

                  // Calcular tokens e inserir mensagem com cobrança
                  const tokensUsed = Math.max(Math.ceil(flowResponse.length * 0.75), 50);
                  
                  const billingResult = await SimplifiedBillingService.insertMessageWithBilling(
                    {
                      id: uuidv4(),
                      org_id: deviceData.org_id,
                      device_id: deviceData.id,
                      chatbot_id: activeChatbot.id,
                      phone_number: normalizedPhone,
                      message_content: flowResponse,
                      direction: 'outbound',
                      status: 'sent',
                      external_id: `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                      tokens_used: tokensUsed,
                      created_at: nowIso(),
                      updated_at: nowIso()
                    },
                    deviceData.org_id,
                    flowResponse,
                    tokensUsed
                  );

                  if (billingResult.success) {
                    console.log(`✅ [${correlationId}] Resposta do novo fluxo enviada e salva com cobrança: ${tokensUsed} tokens`);
                  } else {
                    console.error(`❌ [${correlationId}] Erro na cobrança da resposta do novo fluxo:`, billingResult.billing?.message);
                  }

                  return NextResponse.json({
                    success: true,
                    message: 'New flow started and response sent',
                    correlationId
                  });
                } else {
                  console.log(`🔇 [${correlationId}] Resposta vazia do novo fluxo - não enviando mensagem`);
                }
              }
            }
          }

        } catch (flowsError) {
          console.error(`❌ [${correlationId}] Erro no motor de fluxos:`, flowsError);
          
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
        console.log(`🧠 [${correlationId}] Chatbot ${activeChatbot.id} tem fluxos desativados. Usando IA geral.`);
        
        console.log(`🧠 [${correlationId}] Gerando resposta da IA`);
        
        const systemPrompt = activeChatbot.system_prompt || 'Você é um assistente útil.';
        const model = 'gpt-4o-mini';
        
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
              temperature: 0.7,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ [${correlationId}] Erro na API da OpenAI:`, errorText);
            throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
          }

          const aiResponse = await response.json();
          const aiMessage = aiResponse.choices[0]?.message?.content || 'Desculpe, não consegui gerar uma resposta.';

          console.log(`🤖 [${correlationId}] Resposta da IA gerada:`, aiMessage);

          await fetch(`${EVOLUTION_API_URL}/message/sendText/${instance}`, {
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

          // Calcular tokens e inserir mensagem com cobrança
          const tokensUsed = Math.max(Math.ceil(aiMessage.length * 0.75), 50); // Mínimo 50 tokens
          
          const billingResult = await SimplifiedBillingService.insertMessageWithBilling(
            {
              id: uuidv4(),
              org_id: deviceData.org_id,
              device_id: deviceData.id,
              chatbot_id: activeChatbot.id,
              phone_number: normalizedPhone,
              message_content: aiMessage,
              direction: 'outbound',
              status: 'sent',
              external_id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              tokens_used: tokensUsed,
              created_at: nowIso(),
              updated_at: nowIso()
            },
            deviceData.org_id,
            aiMessage,
            tokensUsed
          );

          if (billingResult.success) {
            console.log(`✅ [${correlationId}] Resposta da IA enviada e salva com cobrança: ${tokensUsed} tokens`);
          } else {
            console.error(`❌ [${correlationId}] Erro na cobrança da resposta da IA:`, billingResult.billing?.message);
          }

          return NextResponse.json({
            success: true,
            message: 'AI response sent',
            correlationId
          });

        } catch (aiError) {
          console.error(`❌ [${correlationId}] Erro na IA geral:`, aiError);

          try {
            await fetch(`${EVOLUTION_API_URL}/message/sendText/${instance}`, {
              method: 'POST',
              headers: {
                'apikey': EVOLUTION_API_KEY,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                number: remoteJid,
                text: 'Desculpe, ocorreu um erro interno. Tente novamente em alguns instantes.'
              })
            });
          } catch (fallbackError) {
            console.error(`❌ [${correlationId}] Erro ao enviar mensagem de fallback da IA:`, fallbackError);
          }

          throw aiError;
        }
      }
    }

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