/// <reference path="./deno.d.ts" />
/// <reference lib="es2020" />
/// <reference lib="dom" />

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WebhookData {
  event: string
  instance: string
  data: any
}

interface Device {
  id: string
  org_id: string
  session_name: string
  phone_number?: string
  chatbot_config?: any
}

interface AIResponse {
  response: string
  tokensUsed: number
}

interface MessageData {
  key: {
    id: string
    remoteJid: string
    fromMe: boolean
  }
  message?: {
    conversation?: string
    extendedTextMessage?: {
      text: string
    }
  }
  pushName?: string
  messageTimestamp?: number
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verificar se é uma requisição POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verificar o secret do webhook
    const url = new URL(req.url)
    const secret = url.searchParams.get('secret')
    const expectedSecret = Deno.env.get('WEBHOOK_SECRET')
    
    console.log('Debug webhook secret:', { 
      received: secret, 
      expected: expectedSecret,
      url: req.url,
      allEnvVars: Object.keys(Deno.env.toObject())
    })
    
    if (!secret || secret !== expectedSecret) {
      console.log('Webhook secret inválido:', { received: secret, expected: expectedSecret })
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse do corpo da requisição
    const body: WebhookData = await req.json()
    console.log('Webhook recebido:', body)

    // Validar dados obrigatórios
    if (!body.event || !body.instance || !body.data) {
      console.log('Dados inválidos:', body)
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields', 
          received: { 
            event: body.event, 
            instance: body.instance, 
            data: body.data 
          } 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Inicializar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Buscar dispositivo pelo session_name (equivalente ao instance_name)
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('*')
      .eq('session_name', body.instance)
      .single()

    if (deviceError || !device) {
      console.log('Dispositivo não encontrado:', body.instance)
      return new Response(
        JSON.stringify({ error: 'Device not found', instance: body.instance }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Processar diferentes tipos de eventos
    switch (body.event) {
      case 'connection.update':
        await handleConnectionUpdate(supabase, device, body.data)
        break
      
      case 'qrcode.updated':
        await handleQRCodeUpdate(supabase, device, body.data)
        break
      
      case 'messages.upsert':
        await handleMessageUpsert(supabase, device, body.data)
        break
      
      case 'messages.update':
        await handleMessageUpdate(supabase, device, body.data)
        break
      
      default:
        console.log('Evento não tratado:', body.event)
    }

    return new Response(
      JSON.stringify({ success: true, event: body.event }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Erro no webhook:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

// Funções auxiliares para processar eventos
async function handleConnectionUpdate(supabase: SupabaseClient, device: Device, data: any): Promise<void> {
  console.log('Connection update:', data)
  
  // Mapear estados da Evolution API para os estados da tabela devices
  let deviceStatus = 'disconnected'
  if (data.state === 'open') deviceStatus = 'connected'
  else if (data.state === 'connecting') deviceStatus = 'connecting'
  else if (data.state === 'close') deviceStatus = 'disconnected'
  
  // Atualizar status do dispositivo
  const { error } = await supabase
    .from('devices')
    .update({ 
      status: deviceStatus,
      last_connection: new Date().toISOString()
    })
    .eq('id', device.id)
  
  if (error) {
    console.error('Erro ao atualizar dispositivo:', error)
  }
}

async function handleQRCodeUpdate(supabase: SupabaseClient, device: Device, data: any): Promise<void> {
  console.log('QR Code update:', data)
  
  // Atualizar QR code do dispositivo
  const { error } = await supabase
    .from('devices')
    .update({ 
      qr_code: data.qrcode || null,
      status: 'qr'
    })
    .eq('id', device.id)
  
  if (error) {
    console.error('Erro ao atualizar QR code:', error)
  }
}

async function handleMessageUpsert(supabase: SupabaseClient, device: Device, data: any): Promise<void> {
  console.log('Message upsert:', data)
  
  // Processar mensagens recebidas
  if (data.messages && Array.isArray(data.messages)) {
    for (const message of data.messages as MessageData[]) {
      // Verificar se é uma mensagem recebida (não enviada pelo bot)
      if (message.key?.fromMe === false) {
        console.log('Nova mensagem recebida:', {
          from: message.key?.remoteJid,
          message: message.message
        })
        
        // Extrair texto da mensagem
        let messageText = ''
        if (message.message?.conversation) {
          messageText = message.message.conversation
        } else if (message.message?.extendedTextMessage?.text) {
          messageText = message.message.extendedTextMessage.text
        }
        
        if (!messageText.trim()) {
          console.log('Mensagem vazia, ignorando')
          continue
        }
        
        console.log('Processando mensagem:', messageText)
        console.log('Remetente:', message.key.remoteJid)
        
        // Verificar se é o número específico que deve ter resposta automática
        const senderNumber = message.key.remoteJid.replace('@s.whatsapp.net', '')
        const isTargetNumber = senderNumber === '5521967725481' || senderNumber === '21967725481'
        
        console.log('Número do remetente:', senderNumber)
        console.log('É o número alvo para resposta automática:', isTargetNumber)
        
        // Salvar mensagem no banco de dados
        const { error: messageError } = await supabase
          .from('messages')
          .insert({
            org_id: device.org_id,
            device_id: device.id,
            direction: 'inbound',
            sender_phone: message.key.remoteJid,
            receiver_phone: device.phone_number || 'unknown',
            content: messageText,
            message_type: 'text',
            status: 'received',
            external_id: message.key.id,
            metadata: {
              pushName: message.pushName,
              messageTimestamp: message.messageTimestamp
            }
          })
        
        if (messageError) {
          console.error('Erro ao salvar mensagem:', messageError)
        }
        
        // Gerar resposta do chatbot apenas se for o número específico ou se o chatbot estiver configurado normalmente
        let shouldRespond = false
        let aiResponse: AIResponse | null = null
        
        if (isTargetNumber) {
          console.log('🎯 Número 21967725481 detectado - gerando resposta automática')
          shouldRespond = true
          aiResponse = await generateAIResponse(messageText, device.id, supabase)
        } else {
          // Para outros números, verificar se o chatbot está ativo normalmente
          const { data: chatbot } = await supabase
            .from('chatbots')
            .select('auto_response_enabled')
            .eq('org_id', device.org_id)
            .eq('auto_response_enabled', true)
            .single()
          
          if (chatbot) {
            console.log('📱 Chatbot ativo para outros números')
            shouldRespond = true
            aiResponse = await generateAIResponse(messageText, device.id, supabase)
          } else {
            console.log('🔇 Chatbot não está ativo para este número')
          }
        }
        
        if (shouldRespond && aiResponse) {
          // Enviar resposta via Evolution API
          await sendMessage(device.session_name, message.key.remoteJid, aiResponse.response)
          
          // Salvar resposta do bot no banco de dados
          const { data: savedMessage, error: saveError } = await supabase
            .from('messages')
            .insert({
              org_id: device.org_id,
              device_id: device.id,
              direction: 'outbound',
              sender_phone: device.phone_number || 'bot',
              receiver_phone: message.key.remoteJid,
              content: aiResponse.response,
              message_type: 'text',
              status: 'sent',
              external_id: `outbound_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
              tokens_used: aiResponse.tokensUsed,
              billing_status: 'pending',
              metadata: {
                generated_by: 'ai',
                original_message_id: message.key.id,
                input_tokens: Math.floor(aiResponse.tokensUsed * 0.7), // Estimativa
                output_tokens: Math.floor(aiResponse.tokensUsed * 0.3) // Estimativa
              }
            })
            .select()
            .single()
          
          if (saveError) {
            console.error('Erro ao salvar mensagem:', saveError)
          } else if (savedMessage) {
            console.log(`💰 Mensagem salva com ${aiResponse.tokensUsed} tokens para cobrança`)
            
            // Processar cobrança usando a função SQL
            try {
              const { data: billingResult, error: billingError } = await supabase
                .rpc('process_message_billing', {
                  p_message_id: savedMessage.id,
                  p_org_id: device.org_id
                })
              
              if (billingError) {
                console.error('❌ Erro ao processar cobrança:', billingError)
                // Marcar mensagem como erro de cobrança
                await supabase
                  .from('messages')
                  .update({ billing_status: 'error' })
                  .eq('id', savedMessage.id)
              } else {
                console.log('✅ Cobrança processada com sucesso:', billingResult)
              }
            } catch (billingError) {
              console.error('❌ Erro crítico na cobrança:', billingError)
              // Marcar mensagem como erro de cobrança
              await supabase
                .from('messages')
                .update({ billing_status: 'error' })
                .eq('id', savedMessage.id)
            }
          }
        }
      }
    }
  }
}

async function handleMessageUpdate(supabase: SupabaseClient, device: Device, data: any): Promise<void> {
  console.log('Message update:', data)
  // Implementar lógica para atualizações de mensagem se necessário
}

async function generateAIResponse(message: string, deviceId: string, supabase: SupabaseClient): Promise<AIResponse | null> {
  try {
    // Buscar configuração do chatbot
    const { data: device } = await supabase
      .from('devices')
      .select('chatbot_config')
      .eq('id', deviceId)
      .single()
    
    const config = device?.chatbot_config || {}
    const systemPrompt = config.system_prompt || 'Você é um assistente virtual útil e amigável. Responda de forma clara e concisa.'
    
    // Chamar API do Groq
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('GROQ_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    })
    
    if (!groqResponse.ok) {
      console.error('Erro na API Groq:', await groqResponse.text())
      return {
        response: 'Desculpe, não consegui processar sua mensagem no momento. Tente novamente mais tarde.',
        tokensUsed: 0
      }
    }
    
    const data = await groqResponse.json()
    const responseText = data.choices[0]?.message?.content || 'Desculpe, não consegui gerar uma resposta.'
    
    // Calcular tokens usados (input + output)
    const inputTokens = data.usage?.prompt_tokens || 0
    const outputTokens = data.usage?.completion_tokens || 0
    const totalTokens = inputTokens + outputTokens
    
    console.log(`🔢 Tokens usados - Input: ${inputTokens}, Output: ${outputTokens}, Total: ${totalTokens}`)
    
    return {
      response: responseText,
      tokensUsed: totalTokens
    }
  } catch (error) {
    console.error('Erro ao gerar resposta AI:', error)
    return {
      response: 'Desculpe, ocorreu um erro ao processar sua mensagem.',
      tokensUsed: 0
    }
  }
}

async function sendMessage(instance: string, remoteJid: string, message: string): Promise<void> {
  try {
    const response = await fetch(`https://evolution-api-evolution-api.audihb.easypanel.host/message/sendText/${instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': '429683C4C977415CAAFCCE10F7D57E11'
      },
      body: JSON.stringify({
        number: remoteJid,
        text: message
      })
    })
    
    if (!response.ok) {
      console.error('Erro ao enviar mensagem:', await response.text())
    } else {
      console.log('Mensagem enviada com sucesso para:', remoteJid)
    }
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error)
  }
}