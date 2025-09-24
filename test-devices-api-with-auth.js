const { createClient } = require('@supabase/supabase-js')

// Configuração do Supabase (mesma do dashboard)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testDevicesAPI() {
  try {
    console.log('🔐 Testando autenticação e API de devices...\n')
    
    // Verificar se há uma sessão ativa
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error('❌ Erro ao obter sessão:', sessionError.message)
      return
    }
    
    if (!session) {
      console.log('❌ Nenhuma sessão ativa encontrada')
      console.log('💡 Você precisa estar logado no dashboard para testar a API')
      return
    }
    
    console.log('✅ Sessão ativa encontrada')
    console.log('👤 Usuário:', session.user.email)
    console.log('🔑 Token válido até:', new Date(session.expires_at * 1000).toLocaleString())
    console.log('')
    
    // Testar a API de devices
    console.log('📡 Chamando API /api/devices...')
    
    const response = await fetch('http://localhost:3000/api/devices', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'Cache-Control': 'no-cache'
      }
    })
    
    console.log('📊 Status da resposta:', response.status)
    console.log('📋 Headers da resposta:')
    for (const [key, value] of response.headers.entries()) {
      console.log(`  ${key}: ${value}`)
    }
    console.log('')
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Erro na API:', errorText)
      return
    }
    
    const data = await response.json()
    console.log('✅ Dados recebidos da API:')
    console.log('📱 Número de devices:', data.devices?.length || 0)
    
    if (data.devices && data.devices.length > 0) {
      console.log('\n📋 Detalhes dos devices:')
      data.devices.forEach((device, index) => {
        console.log(`\n  Device ${index + 1}:`)
        console.log(`    📱 Nome: ${device.name}`)
        console.log(`    🆔 ID: ${device.id}`)
        console.log(`    📞 Sessão: ${device.session_name}`)
        console.log(`    🔗 Status: ${device.status}`)
        console.log(`    📅 Criado: ${new Date(device.created_at).toLocaleString()}`)
        console.log(`    🔄 Atualizado: ${new Date(device.updated_at).toLocaleString()}`)
      })
    }
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message)
    console.error('Stack trace:', error.stack)
  }
}

// Executar o teste
testDevicesAPI()