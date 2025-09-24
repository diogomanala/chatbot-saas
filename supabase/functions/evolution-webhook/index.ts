// Supabase Edge Function: evolution-webhook (Deno)
// Runtime: Deno on Supabase Edge Functions
// Requires environment variables:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - WEBHOOK_SECRET (Bearer or x-webhook-secret)
// - EVOLUTION_API_URL
// - EVOLUTION_API_KEY
// - OPENAI_API_KEY (optional)

/// <reference path="./deno.d.ts" />

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}

import { createClient } from '@supabase/supabase-js'

// Types (align with your DB schema)
type Device = {
  id: string
  org_id: string
  session_name: string
  phone_number: string | null
}

type DeviceUpdate = {
  status?: string
  qr_code?: string
  updated_at?: string
}

type MessageUpdate = {
  status: string
  updated_at: string
}

// Create Supabase client with Service Role for server-side operations
function getSupabaseAdmin() {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('NEXT_PUBLIC_SUPABASE_URL')
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SERVICE_ROLE_KEY env vars')
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  })
}

// Helper: JSON response
function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    headers: corsHeaders,
    ...init
  })
}

// Webhook entrypoint
Deno.serve(async (req: Request) => {
  console.log('🔗 Webhook called:', req.method, req.url)
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    console.log('❌ Method not allowed:', req.method)
    return json({ error: 'Method not allowed' }, { status: 405 })
  }

  try {
    console.log('🔐 Checking authentication...')
    
    // Security: verify webhook secret
    const authHeader = req.headers.get('authorization') || ''
    const bearer = authHeader.startsWith('Bearer ')
      ? authHeader.substring('Bearer '.length)
      : ''
    const headerSecret = req.headers.get('x-webhook-secret')
    const urlObj = new URL(req.url)
    const querySecret = urlObj.searchParams.get('secret') || ''
    const providedSecret = headerSecret || bearer || querySecret
    const expectedSecret = Deno.env.get('WEBHOOK_SECRET')

    console.log('🔑 Auth check:', { hasExpected: !!expectedSecret, hasProvided: !!providedSecret })

    if (expectedSecret && (!providedSecret || providedSecret !== expectedSecret)) {
      console.log('❌ Unauthorized webhook attempt')
      return json({ error: 'Não autorizado' }, { status: 401 })
    }

    console.log('📥 Parsing request body...')
    const body = await req.json()
    let { event, instance, data } = body ?? {}

    console.log('📋 Request data:', { event, instance, dataKeys: data ? Object.keys(data) : [] })

    // Support path suffix /<eventName>
    if (!event) {
      const path = urlObj.pathname
      const parts = path.split('/')
      const last = parts[parts.length - 1]
      if (last && last !== 'evolution-webhook') {
        event = last
      }
    }

    // Normalize event name to a canonical format we handle
    const normalizedEvent = (event ? String(event) : '')
      .trim()
      .toLowerCase()
      .replace(/_/g, '.')

    console.log('🎯 Evolution webhook received:', { event: normalizedEvent, instance })

    if (!normalizedEvent || !instance) {
      console.log('❌ Invalid data:', { event: normalizedEvent, instance })
      return json({ error: 'Dados inválidos' }, { status: 400 })
    }

    console.log('🔧 Initializing Supabase client...')
    const supabase = getSupabaseAdmin()

    // Extract session_name from instance (remove UUID suffix)
    // Instance format: medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77
    // Session name: medical-crm
    function extractSessionName(instance: string): string {
      const uuidPattern = /-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return instance.replace(uuidPattern, '');
    }

    const sessionName = extractSessionName(instance);
    console.log('🔍 Extracted session_name from instance:', { instance, sessionName })

    // First try to find the real device by session_name
    console.log('🔍 Searching for device with session_name:', sessionName)
    const { data: realDevice } = await supabase
      .from('devices')
      .select('*')
      .eq('session_name', sessionName)
      .single()

    let device: Device
    if (realDevice) {
      console.log('📱 Real device found:', realDevice.id, '| org_id:', realDevice.org_id)
      device = realDevice
    } else {
      console.log('⚠️ No real device found, using virtual device')
      // Create a virtual device object using the extracted session name
      device = {
        id: sessionName, // Use extracted session name as device ID
        org_id: '', // Will be populated from chatbot if needed
        session_name: sessionName,
        phone_number: null
      }
    }

    console.log('🔄 Processing event:', normalizedEvent)
    switch (normalizedEvent) {
      case 'connection.update':
        console.log('🔗 Handling connection update...')
        await handleConnectionUpdate(supabase, device, data)
        break
      case 'qrcode.updated':
        console.log('📱 Handling QR code update...')
        await handleQRCodeUpdate(supabase, device, data)
        break
      case 'messages.upsert':
        console.log('💬 Handling message upsert...')
        await handleMessageUpsert(supabase, device, data)
        break
      case 'messages.update':
        console.log('📝 Handling message update...')
        await handleMessageUpdate(supabase, device, data)
        break
      default:
        console.log('❓ Unhandled event type:', normalizedEvent)
    }

    console.log('✅ Webhook processed successfully')
    return json({ success: true })
  } catch (err) {
    const error = err as Error
    console.error('💥 Error in evolution webhook:', error)
    console.error('📊 Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    })
    return json({ error: 'Erro interno do servidor', details: error.message }, { status: 500 })
  }
})

async function handleConnectionUpdate(supabase: ReturnType<typeof getSupabaseAdmin>, device: Device, payload: any) {
  const { state } = payload || {}
  let status = 'disconnected'
  if (state === 'open') status = 'open'
  else if (state === 'connecting') status = 'connecting'

  // Skip device table update due to RLS restrictions
  // Just log the status change
  console.log(`Device ${device.id} connection status:`, status)
}

async function handleQRCodeUpdate(supabase: ReturnType<typeof getSupabaseAdmin>, device: Device, payload: any) {
  const { qrcode } = payload || {}
  
  if (!qrcode) return

  // Skip device table update due to RLS restrictions
  // Just log the QR code update
  console.log(`QR Code updated for device ${device.id}`, qrcode ? 'QR Code available' : 'No QR Code')
}

async function handleMessageUpsert(supabase: ReturnType<typeof getSupabaseAdmin>, device: Device, payload: any) {
  const messages = (payload && Array.isArray(payload.messages)) ? payload.messages : [payload]
  if (!messages || !Array.isArray(messages)) return

  for (const message of messages) {
    try {
      // Ignore messages sent by us
      if (message?.key?.fromMe) continue

      const messageRecord = {
        external_id: message?.key?.id,
        device_id: device.id,
        org_id: device.org_id,
        sender_phone: message?.key?.remoteJid || '',
        receiver_phone: device.phone_number || 'bot',
        direction: 'inbound',
        message_type: getMessageType(message),
        message_content: getMessageContent(message),
        status: 'received',
        metadata: {
          pushName: message?.pushName,
          messageTimestamp: message?.messageTimestamp
        }
      }

      // Idempotent upsert by external_id
      const { error: insertError } = await supabase
        .from('messages')
        .upsert(messageRecord, { onConflict: 'external_id', ignoreDuplicates: true })

      if (insertError) {
        console.error('Erro ao inserir mensagem:', insertError)
      }

      // Process inbound with chatbots
      await processWithChatbots(supabase, device, messageRecord)
    } catch (e) {
      console.error('Error processing message:', e)
    }
  }
}

async function handleMessageUpdate(supabase: ReturnType<typeof getSupabaseAdmin>, device: Device, payload: any) {
  const list = payload?.messages
  if (!list || !Array.isArray(list)) return

  for (const message of list) {
    try {
      const status = getMessageStatus(message?.update?.status)
      const updateData: MessageUpdate = {
        status,
        updated_at: new Date().toISOString()
      }
      // Assuming you store external_id in messages table
      await supabase
        .from('messages')
        .update(updateData)
        .eq('external_id', message?.key?.id)
    } catch (e) {
      console.error('Error updating message status:', e)
    }
  }
}

async function processWithChatbots(supabase: ReturnType<typeof getSupabaseAdmin>, device: Device, messageData: any) {
  console.log('🤖 [PROCESS-CHATBOTS] Iniciando processamento para device:', device.id, 'org_id:', device.org_id)
  console.log('💬 [PROCESS-CHATBOTS] Mensagem:', messageData.message_content)
  
  const { data: chatbots, error } = await supabase
    .from('chatbots')
    .select('*, intents(*)')
    .eq('org_id', device.org_id)
    .eq('is_active', true)

  if (error) {
    console.error('❌ [PROCESS-CHATBOTS] Erro ao buscar chatbots:', error)
    return
  }

  console.log('📊 [PROCESS-CHATBOTS] Chatbots encontrados:', chatbots?.length || 0)
  
  if (!chatbots || chatbots.length === 0) {
    console.log('❌ [PROCESS-CHATBOTS] Nenhum chatbot ativo encontrado para org_id:', device.org_id)
    return
  }

  for (const chatbot of chatbots as any[]) {
    console.log(`🤖 [CHATBOT] Processando: ${chatbot.name} (ID: ${chatbot.id})`);
    console.log(`🎯 [CHATBOT] Intents disponíveis: ${chatbot.intents?.length || 0}`);
    
    const matchedIntent = findMatchingIntent(chatbot.intents || [], messageData.message_content)
    
    if (matchedIntent) {
      console.log(`✅ [INTENT] Match encontrado: ${matchedIntent.name}`);
      const randomResponse = matchedIntent.responses?.[Math.floor(Math.random() * (matchedIntent.responses?.length || 1))]
      if (randomResponse) {
        console.log(`📤 [RESPONSE] Enviando resposta de intent para ${messageData.sender_phone}`);
        await sendResponse(device, messageData.sender_phone, randomResponse)
        console.log(`✅ [SUCCESS] Intent "${matchedIntent.name}" detectada - Resposta enviada: ${randomResponse}`)
        break
      }
    } else if (chatbot.default_fallback_enabled) {
        console.log(`🔄 [FALLBACK] Usando fallback para chatbot: ${chatbot.name}`);
        let fallbackMessage = chatbot.fallback_message || 'Olá! Como posso ajudá-lo hoje?'
        if (!chatbot.fallback_message) {
          console.log(`🤖 [AI] Gerando resposta com IA...`);
          try {
            const aiResponse = await generateAIResponse(chatbot, messageData.message_content)
            if (aiResponse) {
              fallbackMessage = aiResponse
              console.log(`✅ [AI] Resposta gerada com sucesso`);
            }
          } catch (e) {
            console.error('❌ [AI] Error generating AI response:', e)
          }
        }
      console.log(`📤 [RESPONSE] Enviando resposta de fallback para ${messageData.sender_phone}`);
      await sendResponse(device, messageData.sender_phone, fallbackMessage)
      console.log(`✅ [SUCCESS] Resposta de fallback enviada: ${fallbackMessage}`)
      break
    } else {
      console.log(`❌ [CHATBOT] Nenhum match e fallback desabilitado para: ${chatbot.name}`);
    }
  }
}

function findMatchingIntent(intents: any[], messageContent: string): any | null {
  if (!intents || !messageContent) return null
  const content = String(messageContent || '').toLowerCase().trim()
  return intents.find((intent: any) => {
    if (!intent.is_active || !intent.patterns) return false
    try {
      return intent.patterns.some((p: string) => content.includes(String(p || '').toLowerCase().trim()))
    } catch {
      return false
    }
  }) || null
}

async function generateAIResponse(chatbot: any, userMessage: string): Promise<string | null> {
  try {
    const key = Deno.env.get('OPENAI_API_KEY')
    if (!key) return null

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: chatbot.system_prompt || 'Você é um assistente útil e amigável para suporte via WhatsApp. Responda de forma concisa e profissional.' },
          { role: 'user', content: userMessage }
        ],
        temperature: chatbot.temperature ?? 0.7,
        max_tokens: 500
      })
    })

    if (!response.ok) {
      console.error('Error calling OpenAI API:', await response.text())
      return null
    }

    const data = await response.json()
    return data?.choices?.[0]?.message?.content || null
  } catch (error) {
    console.error('Error generating AI response:', error)
    return null
  }
}

async function sendResponse(device: Device, toJidOrNumber: string, responseText: string) {
  try {
    const url = Deno.env.get('EVOLUTION_API_URL')
    const apiKey = Deno.env.get('EVOLUTION_API_KEY')
    // Prefer the instance that triggered the event; fallback to WA_SESSION if needed
    const session = device.session_name || Deno.env.get('WA_SESSION')
    if (!url || !apiKey || !session) {
      console.error('Missing EVOLUTION_API_URL or EVOLUTION_API_KEY or session (device.session_name/WA_SESSION)')
      return
    }

    const endpoint = `${url.replace(/\/$/, '')}/message/sendText/${session}`
    // Prefer JID if present; fallback to number
    const hasJid = toJidOrNumber?.includes('@')
    const payload = hasJid
      ? { jid: toJidOrNumber, text: responseText }
      : { number: toJidOrNumber, text: responseText }

    const evolutionResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify(payload)
    })

    if (!evolutionResponse.ok) {
      const errorText = await evolutionResponse.text()
      console.error(`Error sending response to ${toJidOrNumber}:`, errorText)
      return
    }

    console.log(`✅ Resposta enviada com sucesso para ${toJidOrNumber}: ${responseText}`)
    
    // Salvar mensagem outbound no banco de dados com billing_status pending
    await saveOutboundMessage(device, toJidOrNumber, responseText)
    
  } catch (error) {
    console.error('Error sending response:', error)
  }
}

// Função para salvar mensagem outbound no banco
async function saveOutboundMessage(device: Device, toJidOrNumber: string, responseText: string) {
  try {
    const supabase = getSupabaseAdmin()
    
    // Estimar tokens baseado no conteúdo da resposta
    const estimatedTokens = Math.max(1, Math.ceil(responseText.length / 4) + 50) // ~4 chars per token + system tokens
    
    const messageRecord = {
      device_id: device.id,
      org_id: device.org_id,
      sender_phone: device.phone_number || 'bot',
      receiver_phone: toJidOrNumber,
      direction: 'outbound',
      message_type: 'text',
      message_content: responseText,
      status: 'sent',
      external_id: `outbound_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tokens_used: estimatedTokens,
      billing_status: 'pending',
      metadata: {
        generated_by: 'chatbot',
        estimated_tokens: true,
        created_at: new Date().toISOString()
      }
    }

    const { error: insertError } = await supabase
      .from('messages')
      .insert(messageRecord)

    if (insertError) {
      console.error('❌ Erro ao salvar mensagem outbound:', insertError)
    } else {
      console.log(`💾 Mensagem outbound salva: ${estimatedTokens} tokens, status: pending`)
    }
  } catch (error) {
    console.error('❌ Erro ao salvar mensagem outbound:', error)
  }
}

function getMessageType(message: any): string {
  if (message?.message?.conversation) return 'text'
  if (message?.message?.extendedTextMessage?.text) return 'text'
  if (message?.message?.imageMessage) return 'image'
  if (message?.message?.videoMessage) return 'video'
  if (message?.message?.audioMessage) return 'audio'
  if (message?.message?.documentMessage) return 'document'
  return 'unknown'
}

function getMessageContent(message: any): string {
  if (message?.message?.conversation) return message.message.conversation
  if (message?.message?.extendedTextMessage?.text) return message.message.extendedTextMessage.text
  if (message?.message?.imageMessage?.caption) return message.message.imageMessage.caption
  if (message?.message?.videoMessage?.caption) return message.message.videoMessage.caption
  return '[Mídia]'
}

function getMessageStatus(status: number): string {
  switch (status) {
    case 0: return 'pending'
    case 1: return 'sent'
    case 2: return 'delivered'
    case 3: return 'read'
    default: return 'unknown'
  }
}