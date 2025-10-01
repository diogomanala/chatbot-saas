import { NextRequest, NextResponse } from 'next/server'
import { openaiService } from '@/lib/openai-service'

/**
 * Rota de health check para verificar configuração da IA
 * Retorna provider e modelo atual sem expor segredos
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [HEALTH-AI] Verificando status da IA...')
    
    // Verificar se está em produção (Vercel)
    const isProduction = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production'
    const environment = isProduction ? 'production' : 'development'
    
    // Verificar se OPENAI_API_KEY está presente (sem expor o valor)
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY
    
    // Testar conectividade com OpenAI
    const isConnected = await openaiService.testConnection()
    
    // Configurações padrão
    const defaultConfig = {
      provider: 'openai',
      defaultModel: 'gpt-4o-mini',
      defaultTemperature: 0.3,
      defaultTopP: 1.0
    }
    
    // Log específico para produção
    if (isProduction) {
      console.log(`🚀 [HEALTH-AI] Rodando em produção (Vercel) - provider=${defaultConfig.provider}/model=${defaultConfig.defaultModel}`)
    }
    
    const healthStatus = {
      status: isConnected ? 'healthy' : 'unhealthy',
      environment,
      timestamp: new Date().toISOString(),
      ai: {
        provider: defaultConfig.provider,
        defaultModel: defaultConfig.defaultModel,
        defaultTemperature: defaultConfig.defaultTemperature,
        defaultTopP: defaultConfig.defaultTopP,
        apiKeyConfigured: hasOpenAIKey,
        connectionStatus: isConnected ? 'connected' : 'failed'
      },
      checks: {
        openaiApiKey: hasOpenAIKey ? 'configured' : 'missing',
        openaiConnection: isConnected ? 'success' : 'failed',
        environment: environment
      }
    }
    
    console.log('✅ [HEALTH-AI] Status verificado:', {
      status: healthStatus.status,
      provider: healthStatus.ai.provider,
      model: healthStatus.ai.defaultModel,
      environment: healthStatus.environment
    })
    
    return NextResponse.json(healthStatus, {
      status: isConnected ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
    
  } catch (error: any) {
    console.error('❌ [HEALTH-AI] Erro ao verificar status:', error)
    
    return NextResponse.json({
      status: 'error',
      environment: process.env.VERCEL === '1' ? 'production' : 'development',
      timestamp: new Date().toISOString(),
      error: {
        message: 'Erro interno ao verificar status da IA',
        type: error.name || 'UnknownError'
      },
      ai: {
        provider: 'openai',
        defaultModel: 'gpt-4o-mini',
        apiKeyConfigured: !!process.env.OPENAI_API_KEY,
        connectionStatus: 'error'
      }
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  }
}