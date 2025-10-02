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
// Função auxiliar para determinar se deve continuar automaticamente
function shouldContinueAutomatically(flow: any, nextStepId: string | null): boolean {
  if (!nextStepId) return false;
  
  const nextNode = flow.flow_data.nodes?.find((node: any) => node.id === nextStepId);
  if (!nextNode) return false;
  
  // Continuar automaticamente para nós que não requerem interação do usuário
  const autoExecuteTypes = ['message', 'messageNode', 'options', 'image', 'audio', 'condition'];
  return autoExecuteTypes.includes(nextNode.type);
}

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
      // Nó de entrada - pode capturar dados ou apenas passar para o próximo
      const inputPrompt = currentNode.data?.prompt || currentNode.data?.label;
      const inputVariable = currentNode.data?.variable_name;
      
      // Se há um prompt e não temos resposta ainda, enviar o prompt
      if (inputPrompt && (!userMessage || userMessage === '')) {
        response = inputPrompt;
        nextStepId = null; // Aguardar resposta do usuário
        console.log(`📝 [${correlationId}] Nó input, enviando prompt:`, inputPrompt);
      } else if (inputVariable && userMessage) {
        // Capturar a resposta do usuário na variável
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
        
        // Avançar para o próximo nó
        const inputEdge = flowData.edges?.find((edge: any) => edge.source === currentStepId);
        nextStepId = inputEdge?.target || null;
        console.log(`✅ [${correlationId}] Nó input, dados capturados:`, inputVariable, '=', userMessage, 'próximo:', nextStepId);
      } else {
        // Apenas passar para o próximo nó (nó de início)
        const inputEdge = flowData.edges?.find((edge: any) => edge.source === currentStepId);
        nextStepId = inputEdge?.target || null;
        console.log(`➡️ [${correlationId}] Nó input, próximo passo:`, nextStepId);
      }
      break;

    case 'message':
    case 'messageNode':
      // Nó de mensagem - envia uma mensagem
      // Prioriza o campo 'message' sobre 'label'
      response = currentNode.data?.message || currentNode.data?.label || 'Mensagem não configurada';
      
      // Substituir variáveis na mensagem se houver
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
      // Nó de opções - envia mensagem com botões
      const questionText = currentNode.data?.question || currentNode.data?.message || currentNode.data?.label || 'Escolha uma opção:';
      const options = currentNode.data?.options || [];
      
      // Verificar se o nó tem opções configuradas
      if (!options || options.length === 0) {
        console.log(`⚠️ [${correlationId}] Nó de opções sem opções configuradas, usando label como resposta`);
        response = questionText;
        
        // Buscar próximo nó conectado
        const connectedEdges = flowData.edges?.filter((edge: any) => edge.source === currentStepId) || [];
        nextStepId = connectedEdges[0]?.target || null;
        
        console.log(`➡️ [${correlationId}] Nó options sem configuração, próximo passo:`, nextStepId);
        break;
      }
      
      // Se é a primeira vez executando este nó (sem resposta do usuário ainda)
      if (!userMessage || userMessage === '') {
        // Criar botões para a Evolution API
        const buttons = options.map((option: any, index: number) => ({
          id: `option_${index}`,
          text: option.text || `Opção ${index + 1}`
        }));
        
        // Enviar mensagem com botões via Evolution API
        try {
          // Normalizar o número de telefone removendo @s.whatsapp.net
          const targetNumber = session.phone_number.split('@')[0];
          
          const evolutionResponse = await fetch(`${EVOLUTION_API_URL}/message/sendButtons/${session.instance_id}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({
              number: targetNumber,
              text: questionText,
              buttons: buttons
            })
          });

          if (!evolutionResponse.ok) {
            console.error(`❌ [${correlationId}] Erro ao enviar botões:`, await evolutionResponse.text());
          } else {
            console.log(`✅ [${correlationId}] Botões enviados com sucesso`);
          }
        } catch (error) {
          console.error(`❌ [${correlationId}] Erro na requisição de botões:`, error);
        }
        
        response = questionText;
        
        // Para nós de opções, não avançamos automaticamente - aguardamos resposta do usuário
        nextStepId = null;
        console.log(`🔘 [${correlationId}] Nó options, botões enviados`);
      } else {
        // Processar resposta do usuário para nó de opções
        console.log(`🔘 [${correlationId}] Processando resposta para nó options:`, userMessage);
        
        // Encontrar qual opção foi selecionada
        let selectedOptionIndex = -1;
        
        // Verificar se a resposta corresponde a alguma opção
        for (let i = 0; i < options.length; i++) {
          const option = options[i];
          // Tratar opção como string ou objeto
          const optionText = typeof option === 'string' ? option : option.text;
          
          if (userMessage.toLowerCase().includes(optionText.toLowerCase()) ||
              userMessage.toLowerCase().trim() === optionText.toLowerCase().trim()) {
            selectedOptionIndex = i;
            break;
          }
        }
        
        // Se encontrou uma opção válida, navegar para o próximo nó
        if (selectedOptionIndex >= 0) {
          const selectedOption = options[selectedOptionIndex];
          const selectedOptionText = typeof selectedOption === 'string' ? selectedOption : selectedOption.text;
          
          // Encontrar a edge correspondente a esta opção
          const optionEdges = flowData.edges?.filter((edge: any) => edge.source === currentStepId) || [];
          
          // Procurar por edge com sourceHandle correspondente ao índice da opção
          const matchingEdge = optionEdges.find((edge: any) => 
            edge.sourceHandle === `option-${selectedOptionIndex}` || 
            edge.sourceHandle === `option_${selectedOptionIndex}` || 
            edge.sourceHandle === selectedOption.id ||
            edge.sourceHandle === selectedOptionIndex.toString()
          );
          
          // Se não encontrou edge específica, usar a primeira edge disponível
          nextStepId = matchingEdge?.target || optionEdges[selectedOptionIndex]?.target || null;
          
          response = `Você selecionou: ${selectedOptionText}`;
          console.log(`✅ [${correlationId}] Opção selecionada:`, selectedOptionText, 'próximo:', nextStepId);
        } else {
          // Resposta inválida - reenviar as opções
          response = `Opção inválida. ${questionText}`;
          nextStepId = null; // Manter no mesmo nó
          console.log(`❌ [${correlationId}] Opção inválida, mantendo no mesmo nó`);
        }
      }
      break;

    case 'condition':
      // Nó de condição - avalia uma condição e escolhe o caminho
      const condition = currentNode.data?.condition;
      const conditionValue = currentNode.data?.value;
      
      let conditionMet = false;
      
      // Verificar se é uma resposta de botão
      if (currentNode.data?.conditions) {
        // Lógica para múltiplas condições (respostas de botões)
        const conditions = currentNode.data.conditions;
        for (const cond of conditions) {
          if (userMessage.toLowerCase().includes(cond.value.toLowerCase())) {
            conditionMet = true;
            // Encontrar a edge correspondente a esta condição
            const conditionEdges = flowData.edges?.filter((edge: any) => edge.source === currentStepId) || [];
            const matchingEdge = conditionEdges.find((edge: any) => edge.sourceHandle === cond.id);
            nextStepId = matchingEdge?.target || null;
            break;
          }
        }
      } else {
        // Lógica de condição simples
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
      }
      
      console.log(`🔀 [${correlationId}] Nó condition, condição atendida:`, conditionMet, 'próximo:', nextStepId);
      break;

    case 'image':
      // Nó de imagem - envia uma imagem
      const imageUrl = currentNode.data?.imageUrl;
      const imageCaption = currentNode.data?.caption || '';
      
      if (imageUrl) {
        try {
          // Normalizar o número de telefone removendo @s.whatsapp.net
          const targetNumber = session.phone_number.split('@')[0];
          
          const evolutionResponse = await fetch(`${EVOLUTION_API_URL}/message/sendMedia/${session.instance_id}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({
              number: targetNumber,
              mediatype: 'image',
              media: imageUrl,
              caption: imageCaption
            })
          });

          if (!evolutionResponse.ok) {
            console.error(`❌ [${correlationId}] Erro ao enviar imagem:`, await evolutionResponse.text());
            response = 'Erro ao enviar imagem';
          } else {
            console.log(`✅ [${correlationId}] Imagem enviada com sucesso`);
            response = imageCaption || 'Imagem enviada';
          }
        } catch (error) {
          console.error(`❌ [${correlationId}] Erro na requisição de imagem:`, error);
          response = 'Erro ao enviar imagem';
        }
      } else {
        response = 'URL da imagem não configurada';
      }
      
      const imageEdge = flowData.edges?.find((edge: any) => edge.source === currentStepId);
      nextStepId = imageEdge?.target || null;
      console.log(`🖼️ [${correlationId}] Nó image, próximo:`, nextStepId);
      break;

    case 'audio':
      // Nó de áudio - envia um áudio
      const audioUrl = currentNode.data?.audioUrl;
      
      if (audioUrl) {
        try {
          // Normalizar o número de telefone removendo @s.whatsapp.net
          const targetNumber = session.phone_number.split('@')[0];
          
          const evolutionResponse = await fetch(`${EVOLUTION_API_URL}/message/sendMedia/${session.instance_id}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify({
              number: targetNumber,
              mediatype: 'audio',
              media: audioUrl
            })
          });

          if (!evolutionResponse.ok) {
            console.error(`❌ [${correlationId}] Erro ao enviar áudio:`, await evolutionResponse.text());
            response = 'Erro ao enviar áudio';
          } else {
            console.log(`✅ [${correlationId}] Áudio enviado com sucesso`);
            response = 'Áudio enviado';
          }
        } catch (error) {
          console.error(`❌ [${correlationId}] Erro na requisição de áudio:`, error);
          response = 'Erro ao enviar áudio';
        }
      } else {
        response = 'URL do áudio não configurada';
      }
      
      const audioEdge = flowData.edges?.find((edge: any) => edge.source === currentStepId);
      nextStepId = audioEdge?.target || null;
      console.log(`🔊 [${correlationId}] Nó audio, próximo:`, nextStepId);
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
            // 2. LÓGICA DE FLUXO VISUAL - Não há sessão ativa, buscar fluxo ativo
            console.log(`🔍 [${correlationId}] Nenhuma sessão ativa encontrada, buscando fluxo ativo...`);
            
            const { data: flows, error: flowsError } = await supabaseAdmin
              .from('flows')
              .select('*')
              .eq('chatbot_id', activeChatbot.id)
              .order('updated_at', { ascending: false })
              .limit(1);

            if (flowsError) {
              console.error(`❌ [${correlationId}] Erro ao buscar fluxos:`, flowsError);
              throw new Error('Erro ao buscar fluxos disponíveis');
            }

            // Usar o fluxo mais recente (ativo no SaaS)
            let activeFlow = null;
            
            if (flows && flows.length > 0) {
              activeFlow = flows[0];
              console.log(`✅ [${correlationId}] Fluxo ativo encontrado:`, activeFlow.name);
            } else {
              console.log(`⚠️ [${correlationId}] Nenhum fluxo encontrado para o chatbot`);
              return NextResponse.json({ 
                message: 'Nenhum fluxo configurado',
                correlationId 
              });
            }

            if (activeFlow) {
              // Encontrou um fluxo ativo - criar nova sessão
              const flowData = activeFlow.flow_data;
              
              // Encontrar o nó "Ponto de Início" (input node)
              const startNode = flowData.nodes?.find(node => node.type === 'input');
              
              if (!startNode) {
                console.error(`❌ [${correlationId}] Nó de início não encontrado no fluxo:`, activeFlow.name);
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
                  active_flow_id: activeFlow.id,
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
                activeFlow, 
                startNode.id, 
                newSession,
                messageContent,
                correlationId
              );
              
              // Executar passos automaticamente em sequência
              let currentSession = newSession;
              let executionCount = 0;
              const maxExecutions = 5; // Prevenir loops infinitos
              
              while ((!response || shouldContinueAutomatically(activeFlow, nextStepId)) && nextStepId && executionCount < maxExecutions) {
                console.log(`🔄 [${correlationId}] Continuando automaticamente para próximo passo: ${nextStepId} (execução ${executionCount + 1})`);
                
                // Atualizar current_step_id primeiro
                await supabaseAdmin
                  .from('chat_sessions')
                  .update({ 
                    current_step_id: nextStepId,
                    updated_at: nowIso()
                  })
                  .eq('id', currentSession.id);

                // Executar o próximo passo
                const nextStepResult = await executeFlowStep(
                  supabaseAdmin,
                  activeFlow,
                  nextStepId,
                  { ...currentSession, current_step_id: nextStepId },
                  messageContent,
                  correlationId
                );
                
                // Se o passo atual gerou uma resposta, usar ela
                if (nextStepResult.response) {
                  response = nextStepResult.response;
                }
                
                nextStepId = nextStepResult.nextStepId;
                executionCount++;
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
              // Nenhum fluxo ativo encontrado - deixar a IA geral responder
              console.log(`❌ [${correlationId}] Nenhum fluxo ativo encontrado, passando para IA geral`);
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
            let { response, nextStepId } = await executeFlowStep(
              supabaseAdmin,
              activeFlow,
              existingSession.current_step_id,
              existingSession,
              messageContent,
              correlationId
            );

            // Executar passos automaticamente em sequência para sessões existentes
            let currentSession = existingSession;
            let executionCount = 0;
            const maxExecutions = 5; // Prevenir loops infinitos
            
            while ((!response || shouldContinueAutomatically(activeFlow, nextStepId)) && nextStepId && executionCount < maxExecutions) {
              console.log(`🔄 [${correlationId}] Continuando automaticamente para próximo passo: ${nextStepId} (execução ${executionCount + 1})`);
              
              // Atualizar current_step_id primeiro
              await supabaseAdmin
                .from('chat_sessions')
                .update({ 
                  current_step_id: nextStepId,
                  updated_at: nowIso()
                })
                .eq('id', currentSession.id);

              // Executar o próximo passo
              const nextStepResult = await executeFlowStep(
                supabaseAdmin,
                activeFlow,
                nextStepId,
                { ...currentSession, current_step_id: nextStepId },
                messageContent,
                correlationId
              );
              
              // Se o passo atual gerou uma resposta, usar ela
              if (nextStepResult.response) {
                response = nextStepResult.response;
              }
              
              nextStepId = nextStepResult.nextStepId;
              executionCount++;
            }

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
              const numberExists = checkResult.find((num: any) => num.number === targetNumber)?.exists;
              
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