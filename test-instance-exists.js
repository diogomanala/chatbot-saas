require('dotenv').config({ path: '.env.local' })

async function testInstanceExists() {
  try {
    console.log('🔍 [TEST] Verificando se a instância existe na Evolution API...')
    
    const instanceName = 'medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77'
    const apiKey = process.env.EVOLUTION_API_KEY
    const baseUrl = process.env.EVOLUTION_API_URL
    
    if (!apiKey || !baseUrl) {
      console.error('❌ [ERROR] Variáveis de ambiente não configuradas')
      return
    }
    
    console.log('🌐 [INFO] Base URL:', baseUrl)
    console.log('🔑 [INFO] API Key:', apiKey ? 'Configurada' : 'Não configurada')
    console.log('📱 [INFO] Instance Name:', instanceName)
    
    // Testar diferentes endpoints para verificar a instância
    const endpoints = [
      `/instance/connect/${encodeURIComponent(instanceName)}`,
      `/instance/${encodeURIComponent(instanceName)}/qrcode`,
      `/instance/${encodeURIComponent(instanceName)}/status`,
      `/instance/fetchInstances`
    ]
    
    for (const endpoint of endpoints) {
      try {
        const url = `${baseUrl}${endpoint}`
        console.log(`\n🔗 [REQUEST] Testando: ${url}`)
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'apikey': apiKey,
            'Content-Type': 'application/json'
          }
        })
        
        console.log(`📊 [RESPONSE] Status: ${response.status} ${response.statusText}`)
        
        if (response.ok) {
          const data = await response.json().catch(() => response.text())
          console.log('✅ [SUCCESS] Resposta recebida:', typeof data === 'string' ? data.substring(0, 200) : JSON.stringify(data, null, 2).substring(0, 500))
        } else {
          const errorText = await response.text().catch(() => 'Erro desconhecido')
          console.log('❌ [ERROR] Erro na resposta:', errorText.substring(0, 200))
        }
        
      } catch (error) {
        console.error(`❌ [ERROR] Erro na requisição para ${endpoint}:`, error.message)
      }
    }
    
  } catch (error) {
    console.error('❌ [ERROR] Erro geral:', error)
  }
}

testInstanceExists()