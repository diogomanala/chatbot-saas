import { NextRequest, NextResponse } from 'next/server'
import { aiService } from '@/lib/ai-service'

/**
 * Webhook SIMPLES - apenas recebe e processa
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validação básica - aceita diferentes formatos
    let message, phone, instanceId

    // Formato Evolution API
    if (body.data?.message?.text) {
      message = body.data.message.text
      phone = body.data.key?.remoteJid?.replace('@s.whatsapp.net', '') || body.data.message.key?.remoteJid?.replace('@s.whatsapp.net', '')
      instanceId = body.instance
    } else {
      return NextResponse.json({ success: false, error: 'Dados inválidos' })
    }

    if (!message || !phone || !instanceId) {
      return NextResponse.json({ success: false, error: 'Campos obrigatórios ausentes' })
    }

    console.log(`📱 [WEBHOOK] Nova mensagem de ${phone}: ${message.substring(0, 50)}...`)

    // Processar com o serviço de IA
    const result = await aiService.processMessage({
      phone,
      message,
      instanceId
    })

    if (!result.success) {
      console.error('❌ [WEBHOOK] Falha:', result.error)
      return NextResponse.json({ success: false })
    }

    // Enviar resposta
    if (result.response) {
      await sendWhatsAppMessage(phone, result.response, instanceId)
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('❌ [WEBHOOK] Erro:', error)
    return NextResponse.json({ success: false })
  }
}

/**
 * Envia mensagem via WhatsApp
 */
async function sendWhatsAppMessage(phone: string, message: string, instanceId: string) {
  try {
    const evolutionUrl = process.env.EVOLUTION_API_URL
    const evolutionKey = process.env.EVOLUTION_API_KEY

    if (!evolutionUrl || !evolutionKey) {
      throw new Error('Configuração Evolution API não encontrada')
    }

    const response = await fetch(`${evolutionUrl}/message/sendText/${instanceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionKey
      },
      body: JSON.stringify({
        number: `${phone}@s.whatsapp.net`,
        text: message
      })
    })

    if (!response.ok) {
      throw new Error(`Evolution API error: ${response.status}`)
    }

    console.log(`✅ [WEBHOOK] Mensagem enviada para ${phone}`)

  } catch (error) {
    console.error('❌ [WEBHOOK] Erro ao enviar:', error)
  }
}