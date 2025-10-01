import { NextRequest, NextResponse } from 'next/server'
import { aiService } from '@/lib/ai-service'

/**
 * Rota de teste para o sistema simplificado
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🧪 [TEST] Testando sistema simplificado...')

    // Teste básico
    const result = await aiService.processMessage({
      phone: '5511999999999',
      message: 'Olá, como você pode me ajudar?',
      instanceId: 'test_instance'
    })

    return NextResponse.json({
      success: true,
      test: 'Sistema Simplificado',
      result,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ [TEST] Erro:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    })
  }
}

/**
 * Teste via POST
 */
export async function POST(request: NextRequest) {
  try {
    const { phone, message, instanceId } = await request.json()

    if (!phone || !message || !instanceId) {
      return NextResponse.json({
        success: false,
        error: 'Parâmetros obrigatórios: phone, message, instanceId'
      })
    }

    const result = await aiService.processMessage({
      phone,
      message,
      instanceId
    })

    return NextResponse.json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ [TEST] Erro POST:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    })
  }
}