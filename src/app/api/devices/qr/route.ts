import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import QRCode from 'qrcode'
import { config, validateConfig, buildEvolutionApiUrl, getEvolutionApiHeaders } from '@/lib/config'

// Inicializar cliente Supabase admin
const supabaseAdmin = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey
)

/**
 * Faz uma requisição HTTP com timeout
 */
async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  
  try {
    const response = await fetch(url, { 
      ...init, 
      signal: controller.signal 
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Normaliza a resposta da Evolution API para extrair dados do QR Code
 */
async function normalizeQRResponse(response: Response) {
  const contentType = response.headers.get('content-type') || ''
  
  if (contentType.includes('application/json')) {
    const data = await response.json().catch(() => ({}))

    // Tentar extrair imagem base64
    const base64 = data.base64 || 
                   data.image_base64 || 
                   data.image || 
                   data.qrPngBase64

    if (base64 && typeof base64 === 'string') {
      const cleaned = base64.replace(/^data:image\/png;base64,?/i, '')
      return { type: 'base64', value: cleaned, raw: data }
    }

    // Tentar extrair texto do QR
    const text = data.qrcode || 
                 data.qr || 
                 data.code || 
                 data.qr_string || 
                 data.message

    if (text && typeof text === 'string') {
      return { type: 'text', value: text, raw: data }
    }

    return { type: 'unknown', value: null, raw: data }
  }

  // Resposta em texto puro
  const text = await response.text().catch(() => '')
  if (text) {
    return { type: 'text', value: text, raw: text }
  }
  
  return { type: 'unknown', value: null, raw: null }
}

/**
 * Garante que a instância existe na Evolution API com webhook configurado
 */
async function ensureInstanceExists(instanceName: string, apiKey: string): Promise<void> {
  try {
    // Verificar se a instância já existe
    const listUrl = buildEvolutionApiUrl('/instance/fetchInstances')
    const listResponse = await fetchWithTimeout(listUrl, {
      headers: getEvolutionApiHeaders(apiKey),
      cache: 'no-store',
    }, 10000)

    if (!listResponse.ok) {
      throw new Error(`Failed to check instances: ${listResponse.status}`)
    }

    const instances = await listResponse.json().catch(() => [])
    const existingInstance = Array.isArray(instances) &&
      instances.find((inst: any) => inst?.instance?.instanceName === instanceName)

    if (existingInstance) {
      console.log(`Instance ${instanceName} already exists`)
      
      // Verificar se o webhook está configurado
      const webhookUrl = `${config.app.url}/api/webhook/evolution`
      const hasWebhook = existingInstance?.instance?.webhook === webhookUrl
      
      if (!hasWebhook) {
        console.log(`Instance ${instanceName} exists but webhook not configured. Updating...`)
        
        // Atualizar a instância com webhook
        const updateUrl = buildEvolutionApiUrl(`/instance/update/${encodeURIComponent(instanceName)}`)
        const updatePayload = {
          webhook: webhookUrl,
          webhook_by_events: false,
          webhook_base64: false,
          events: [
            'APPLICATION_STARTUP',
            'QRCODE_UPDATED',
            'CONNECTION_UPDATE',
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'SEND_MESSAGE',
          ],
        }
        
        const updateResponse = await fetchWithTimeout(updateUrl, {
          method: 'PUT',
          headers: getEvolutionApiHeaders(apiKey),
          body: JSON.stringify(updatePayload),
        }, 10000)
        
        if (updateResponse.ok) {
          console.log(`Instance ${instanceName} webhook updated successfully`)
        } else {
          console.warn(`Failed to update webhook for instance ${instanceName}:`, await updateResponse.text().catch(() => ''))
        }
      } else {
        console.log(`Instance ${instanceName} already has webhook configured`)
      }
      
      return
    }

    // Criar nova instância
    console.log(`Creating new instance: ${instanceName}`)
    
    // Validar configurações antes de criar o payload
    console.log('🔍 Validating config values:')
    console.log('- config.app.url:', config.app.url)
    console.log('- config.app.url type:', typeof config.app.url)
    console.log('- config.app.url length:', config.app.url?.length)
    console.log('- instanceName:', instanceName)
    console.log('- instanceName type:', typeof instanceName)
    console.log('- instanceName length:', instanceName?.length)
    console.log('- apiKey:', apiKey ? `${apiKey.substring(0, 10)}...` : 'undefined')
    console.log('- apiKey type:', typeof apiKey)
    console.log('- apiKey length:', apiKey?.length)
    
    const webhookUrl = `${config.app.url}/api/webhook/evolution`
    console.log('- webhookUrl:', webhookUrl)
    console.log('- webhookUrl type:', typeof webhookUrl)
    console.log('- webhookUrl length:', webhookUrl?.length)
    
    // Criar payload completo com webhook
    const payload = {
      instanceName,
      token: apiKey,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
      webhook: webhookUrl,
      webhook_by_events: false,
      webhook_base64: false,
      events: [
        'APPLICATION_STARTUP',
        'QRCODE_UPDATED',
        'CONNECTION_UPDATE',
        'MESSAGES_UPSERT',
        'MESSAGES_UPDATE',
        'SEND_MESSAGE',
      ],
    }
    
    console.log('🔍 Creating instance with full payload:', JSON.stringify(payload, null, 2))
    
    const createUrl = buildEvolutionApiUrl('/instance/create')
    
    // Criar instância com payload completo
    console.log('🔍 Creating instance with webhook configuration...')
    const createResponse = await fetchWithTimeout(createUrl, {
      method: 'POST',
      headers: getEvolutionApiHeaders(apiKey),
      body: JSON.stringify(payload),
    }, 15000)

    if (!createResponse.ok) {
      const errorText = await createResponse.text().catch(() => '')
      
      // Se a instância já existe (403), não é um erro fatal
      if (createResponse.status === 403 && errorText.includes('already in use')) {
        console.warn(`Instance ${instanceName} already exists (403), continuing...`)
        return
      }
      
      throw new Error(`Failed to create instance: ${createResponse.status} - ${errorText}`)
    }

    console.log(`Instance ${instanceName} created successfully`)
    
    // Aguardar um momento para a instância inicializar
    await new Promise(resolve => setTimeout(resolve, 2000))
    
  } catch (error) {
    console.error(`Error ensuring instance ${instanceName}:`, error)
    throw error
  }
}

/**
 * Obtém o QR Code da Evolution API
 */
async function getQRCodeFromEvolution(instanceName: string, apiKey: string) {
  const candidateEndpoints = [
    `/instance/connect/${encodeURIComponent(instanceName)}`,
    `/instance/${encodeURIComponent(instanceName)}/qrcode`,
    `/sessions/${encodeURIComponent(instanceName)}/qrcode`,
    `/sessions/${encodeURIComponent(instanceName)}/qr`,
  ]

  let lastError: any = null

  for (const endpoint of candidateEndpoints) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const url = buildEvolutionApiUrl(endpoint)
        console.log(`Attempting to get QR from: ${url} (attempt ${attempt})`)
        
        const response = await fetchWithTimeout(url, {
          headers: getEvolutionApiHeaders(apiKey),
          cache: 'no-store',
        }, 10000)

        if (!response.ok) {
          lastError = `HTTP ${response.status} at ${url}`
          await new Promise(resolve => setTimeout(resolve, attempt * 500))
          continue
        }

        const parsed = await normalizeQRResponse(response)

        // Se recebemos uma imagem base64, retornar diretamente
        if (parsed.type === 'base64' && parsed.value) {
          return {
            qrPngBase64: parsed.value,
            source: 'evolution_api_image',
            endpoint: url,
            attempt
          }
        }

        // Se recebemos texto, gerar QR Code
        if (parsed.type === 'text' && parsed.value) {
          const dataUrl = await QRCode.toDataURL(parsed.value, { 
            errorCorrectionLevel: 'M',
            width: 256
          })
          const base64 = dataUrl.replace(/^data:image\/png;base64,?/i, '')
          
          return {
            qrPngBase64: base64,
            source: 'generated_from_text',
            endpoint: url,
            attempt
          }
        }

        lastError = `Unrecognized response format at ${url}`
        
      } catch (error: any) {
        lastError = error?.message || String(error)
        console.error(`Error on attempt ${attempt} for ${endpoint}:`, lastError)
        await new Promise(resolve => setTimeout(resolve, attempt * 500))
      }
    }
  }

  throw new Error(`Failed to obtain QR code: ${lastError}`)
}

/**
 * Handler principal da API Route
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔍 [QR-API] Request received')
    
    // Validar configuração
    validateConfig(['SUPABASE_SERVICE_ROLE_KEY'])
    console.log('✅ [QR-API] Config validated')

    // Verificar autenticação
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ [QR-API] Missing authorization header')
      return NextResponse.json(
        { error: 'Authorization header required' }, 
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    console.log('🔍 [QR-API] Token length:', token.length)
    
    if (token.length < 400) {
      console.log('❌ [QR-API] Parece ANON_KEY, rejeitado')
      return NextResponse.json(
        { error: 'Anon key is not allowed here' },
        { status: 401 }
      )
    }
    
    // Verificar token com Supabase
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      console.log('❌ [QR-API] Auth error:', authError?.message)
      return NextResponse.json(
        { error: 'Invalid or expired token' }, 
        { status: 401 }
      )
    }

    console.log('✅ [QR-API] User authenticated:', user.id)

    // Parse do body
    const body = await request.json().catch(() => ({}))
    const { deviceId } = body
    console.log('🔍 [QR-API] Device ID:', deviceId)

    if (!deviceId) {
      console.log('❌ [QR-API] Missing device ID')
      return NextResponse.json(
        { success: false, message: 'Device ID is required' }, 
        { status: 400 }
      )
    }

    // Buscar perfil do usuário
    console.log('🔍 [QR-API] Fetching user profile...')
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      console.log('❌ [QR-API] Profile error:', profileError?.message)
      return NextResponse.json(
        { success: false, message: 'User profile not found' }, 
        { status: 404 }
      )
    }

    console.log('✅ [QR-API] Profile found, org_id:', profile.org_id)

    // Buscar dispositivo
    console.log('🔍 [QR-API] Fetching device...')
    const { data: device, error: deviceError } = await supabaseAdmin
      .from('devices')
      .select('*')
      .eq('id', deviceId)
      .eq('org_id', profile.org_id)
      .single()

    if (deviceError || !device) {
      console.log('❌ [QR-API] Device error:', deviceError?.message)
      return NextResponse.json(
        { success: false, message: 'Device not found' }, 
        { status: 404 }
      )
    }

    console.log('✅ [QR-API] Device found:', device.session_name)

    if (!device.session_name || !device.evolution_api_key) {
      console.warn('⚠️ [QR-API] Missing device configuration')
      return NextResponse.json(
        { success: false, message: 'Device configuration incomplete' }, 
        { status: 400 }
      )
    }

    console.log('🔍 [QR-API] Ensuring instance exists...')
    // Garantir que a instância existe
    await ensureInstanceExists(device.session_name, device.evolution_api_key)
    console.log('✅ [QR-API] Instance ensured')

    console.log('🔍 [QR-API] Getting QR code from Evolution API...')
    // Obter QR Code
    const qrData = await getQRCodeFromEvolution(device.session_name, device.evolution_api_key)
    console.log('✅ [QR-API] QR code obtained')

    // Atualizar status do dispositivo
    console.log('🔍 [QR-API] Updating device status...')
    await supabaseAdmin
      .from('devices')
      .update({ status: 'connecting' })
      .eq('id', deviceId)
    console.log('✅ [QR-API] Device status updated')

    console.log('✅ [QR-API] Success - returning QR data')
    return NextResponse.json({
      success: true,
      qrPngBase64: qrData.qrPngBase64,
      qrCode: (qrData as any).qrCode || qrData.qrPngBase64
    })

  } catch (error) {
    console.error('💥 [QR-API] Unexpected error:', error)
    console.error('💥 [QR-API] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { success: false, message: 'Internal server error', error: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    )
  }
}