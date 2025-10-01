import { NextRequest, NextResponse } from 'next/server'
import { config } from 'dotenv'
import path from 'path'
import OpenAI from 'openai'

export async function GET(request: NextRequest) {
  try {
    // Força o carregamento das variáveis de ambiente diretamente na rota
    console.log('🔧 [Test Direct] Carregando variáveis de ambiente...')
    
    // Carrega .env.local primeiro
    const envLocalResult = config({ path: path.resolve(process.cwd(), '.env.local') })
    console.log('🔧 [Test Direct] .env.local carregado:', !envLocalResult.error)
    
    // Carrega .env como fallback
    const envResult = config({ path: path.resolve(process.cwd(), '.env') })
    console.log('🔧 [Test Direct] .env carregado:', !envResult.error)
    
    // Log das variáveis
    console.log('🔧 [Test Direct] OPENAI_API_KEY presente:', !!process.env.OPENAI_API_KEY)
    console.log('🔧 [Test Direct] OPENAI_API_KEY valor bruto:', JSON.stringify(process.env.OPENAI_API_KEY))
    
    let apiKey = process.env.OPENAI_API_KEY
    
    // Remove aspas se existirem
    if (apiKey && (apiKey.startsWith('"') && apiKey.endsWith('"'))) {
      console.log('🔧 [Test Direct] Removendo aspas da API key...')
      apiKey = apiKey.slice(1, -1)
    }
    
    console.log('🔧 [Test Direct] OPENAI_API_KEY processada:', apiKey ? `${apiKey.substring(0, 20)}...` : 'undefined')
    
    if (!apiKey) {
      return NextResponse.json({ 
        error: 'OPENAI_API_KEY não encontrada',
        env: {
          hasEnvLocal: !envLocalResult.error,
          hasEnv: !envResult.error,
          processEnvKeys: Object.keys(process.env).filter(key => key.includes('OPENAI')),
          allEnvKeys: Object.keys(process.env).length,
          rawApiKey: JSON.stringify(process.env.OPENAI_API_KEY)
        }
      }, { status: 500 })
    }

    // Testa a conexão diretamente
    const openai = new OpenAI({ apiKey })
    
    console.log('🔧 [Test Direct] Testando conexão com OpenAI...')
    const models = await openai.models.list()
    console.log('🔧 [Test Direct] Conexão bem-sucedida! Modelos encontrados:', models.data.length)

    return NextResponse.json({
      success: true,
      message: 'Conexão com OpenAI estabelecida com sucesso!',
      modelsCount: models.data.length,
      apiKeyPrefix: apiKey.substring(0, 20) + '...',
      env: {
        hasEnvLocal: !envLocalResult.error,
        hasEnv: !envResult.error,
        processEnvKeys: Object.keys(process.env).filter(key => key.includes('OPENAI')),
        allEnvKeys: Object.keys(process.env).length,
        rawApiKey: JSON.stringify(process.env.OPENAI_API_KEY)
      }
    })

  } catch (error: any) {
    console.error('❌ [Test Direct] Erro ao testar OpenAI:', error)
    
    return NextResponse.json({
      error: 'Erro ao conectar com OpenAI',
      details: error.message,
      code: error.code,
      type: error.type,
      status: error.status,
      rawApiKey: JSON.stringify(process.env.OPENAI_API_KEY)
    }, { status: 500 })
  }
}