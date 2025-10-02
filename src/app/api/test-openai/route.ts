import { NextRequest, NextResponse } from 'next/server'
import { openaiService } from '@/lib/openai-service'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 [TEST] Testando conectividade com OpenAI...')
    
    // Testa a conectividade
    const isConnected = await openaiService.testConnection()
    
    if (!isConnected) {
      return NextResponse.json({
        success: false,
        error: 'Falha na conectividade com OpenAI',
        openai_configured: !!process.env.OPENAI_API_KEY
      }, { status: 500 })
    }
    
    // Lista modelos disponíveis
    const models = await openaiService.getAvailableModels()
    
    // Testa uma resposta simples com um objeto chatbot mock
    const mockChatbot = {
      id: 'f99ae725-f996-483d-8813-cde922d8877a',
      org_id: '3108d984-ed2d-44f3-a742-ca223129c5fa',
      name: 'Teste Zap',
      system_prompt: 'Você é um assistente útil e amigável.',
      model: 'gpt-4o-mini',
      temperature: 0.7
    }
    
    const testResponse = await openaiService.generateResponse(
      mockChatbot,
      'Olá, este é um teste da integração OpenAI',
      [] // Histórico vazio
    )
    
    return NextResponse.json({
      success: true,
      message: 'OpenAI configurada e funcionando!',
      data: {
        openai_configured: !!process.env.OPENAI_API_KEY,
        connectivity: isConnected,
        available_models_count: models.length,
        sample_models: models.slice(0, 5),
        test_response: testResponse,
        test_response_length: testResponse?.response?.length || 0
      }
    })
    
  } catch (error) {
    console.error('❌ [TEST] Erro no teste da OpenAI:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno no teste da OpenAI',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
      openai_configured: !!process.env.OPENAI_API_KEY
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { message, chatbot_id, org_id } = await request.json()
    
    if (!message) {
      return NextResponse.json({
        success: false,
        error: 'Mensagem é obrigatória'
      }, { status: 400 })
    }
    
    console.log('🧪 [TEST] Testando geração de resposta personalizada...')
    
    const response = await openaiService.generateResponse(
      chatbot_id || 'f99ae725-f996-483d-8813-cde922d8877a',
      org_id || '3108d984-ed2d-44f3-a742-ca223129c5fa',
      message
    )
    
    return NextResponse.json({
      success: true,
      message: 'Resposta gerada com sucesso',
      data: {
        user_message: message,
        ai_response: response,
        response_length: response?.response?.length || 0,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('❌ [TEST] Erro na geração de resposta:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Erro ao gerar resposta',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 })
  }
}