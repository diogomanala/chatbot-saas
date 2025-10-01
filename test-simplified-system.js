const { createClient } = require('@supabase/supabase-js')

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testSimplifiedSystem() {
  console.log('🧪 TESTANDO SISTEMA DE COBRANÇA SIMPLIFICADO')
  console.log('=' .repeat(60))

  try {
    // 1. Verificar mensagens existentes
    console.log('\n📊 1. VERIFICANDO MENSAGENS EXISTENTES')
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id, direction, billing_status, tokens_used, cost_credits')
      .order('created_at', { ascending: false })
      .limit(10)

    if (messagesError) {
      console.error('❌ Erro ao buscar mensagens:', messagesError)
      return
    }

    console.log(`📈 Total de mensagens recentes: ${messages.length}`)
    
    // Estatísticas por status
    const statusStats = messages.reduce((acc, msg) => {
      acc[msg.billing_status] = (acc[msg.billing_status] || 0) + 1
      return acc
    }, {})

    console.log('📊 Status das mensagens:')
    Object.entries(statusStats).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} mensagens`)
    })

    // Verificar se todas são 'debited'
    const nonDebitedMessages = messages.filter(m => m.billing_status !== 'debited')
    if (nonDebitedMessages.length > 0) {
      console.log(`⚠️  Encontradas ${nonDebitedMessages.length} mensagens com status diferente de 'debited'`)
      nonDebitedMessages.forEach(msg => {
        console.log(`   - ID: ${msg.id}, Status: ${msg.billing_status}, Direction: ${msg.direction}`)
      })
    } else {
      console.log('✅ Todas as mensagens têm status "debited"')
    }

    // 2. Verificar tokens das mensagens outbound
    console.log('\n🔢 2. VERIFICANDO TOKENS DAS MENSAGENS OUTBOUND')
    const outboundMessages = messages.filter(m => m.direction === 'outbound')
    const wrongTokensOutbound = outboundMessages.filter(m => m.tokens_used !== 1)
    
    if (wrongTokensOutbound.length > 0) {
      console.log(`⚠️  Encontradas ${wrongTokensOutbound.length} mensagens outbound com tokens != 1`)
      wrongTokensOutbound.forEach(msg => {
        console.log(`   - ID: ${msg.id}, Tokens: ${msg.tokens_used}`)
      })
    } else {
      console.log('✅ Todas as mensagens outbound têm tokens = 1')
    }

    // 3. Verificar tokens das mensagens inbound
    console.log('\n📥 3. VERIFICANDO TOKENS DAS MENSAGENS INBOUND')
    const inboundMessages = messages.filter(m => m.direction === 'inbound')
    const wrongTokensInbound = inboundMessages.filter(m => m.tokens_used !== 0)
    
    if (wrongTokensInbound.length > 0) {
      console.log(`⚠️  Encontradas ${wrongTokensInbound.length} mensagens inbound com tokens != 0`)
      wrongTokensInbound.forEach(msg => {
        console.log(`   - ID: ${msg.id}, Tokens: ${msg.tokens_used}`)
      })
    } else {
      console.log('✅ Todas as mensagens inbound têm tokens = 0')
    }

    // 4. Testar inserção de nova mensagem
    console.log('\n🆕 4. TESTANDO INSERÇÃO DE NOVA MENSAGEM')
    
    // Buscar um usuário e chatbot para o teste
    const { data: users } = await supabase.from('users').select('id').limit(1)
    const { data: chatbots } = await supabase.from('chatbots').select('id').limit(1)
    
    if (!users?.length || !chatbots?.length) {
      console.log('⚠️  Não foi possível encontrar usuário ou chatbot para teste')
      return
    }

    // Inserir mensagem de teste outbound
    const testMessage = {
      user_id: users[0].id,
      chatbot_id: chatbots[0].id,
      direction: 'outbound',
      content: 'Mensagem de teste do sistema simplificado',
      billing_status: 'charged', // Deve ser convertido para 'debited'
      tokens_used: 999, // Deve ser convertido para 1
      cost_credits: 999 // Deve ser convertido para 1
    }

    const { data: insertedMessage, error: insertError } = await supabase
      .from('messages')
      .insert(testMessage)
      .select()
      .single()

    if (insertError) {
      console.error('❌ Erro ao inserir mensagem de teste:', insertError)
      return
    }

    console.log('✅ Mensagem de teste inserida com sucesso:')
    console.log(`   - ID: ${insertedMessage.id}`)
    console.log(`   - Status: ${insertedMessage.billing_status} (esperado: debited)`)
    console.log(`   - Tokens: ${insertedMessage.tokens_used} (esperado: 1)`)
    console.log(`   - Créditos: ${insertedMessage.cost_credits} (esperado: 1)`)

    // Verificar se o trigger funcionou
    const triggerWorked = 
      insertedMessage.billing_status === 'debited' &&
      insertedMessage.tokens_used === 1 &&
      insertedMessage.cost_credits === 1

    if (triggerWorked) {
      console.log('🎉 TRIGGER FUNCIONANDO CORRETAMENTE!')
    } else {
      console.log('❌ Trigger não está funcionando como esperado')
    }

    // Limpar mensagem de teste
    await supabase.from('messages').delete().eq('id', insertedMessage.id)
    console.log('🧹 Mensagem de teste removida')

    // 5. Resumo final
    console.log('\n📋 5. RESUMO DO TESTE')
    console.log('=' .repeat(40))
    
    const allGood = 
      nonDebitedMessages.length === 0 &&
      wrongTokensOutbound.length === 0 &&
      wrongTokensInbound.length === 0 &&
      triggerWorked

    if (allGood) {
      console.log('🎉 SISTEMA SIMPLIFICADO FUNCIONANDO PERFEITAMENTE!')
      console.log('✅ Todas as mensagens têm status "debited"')
      console.log('✅ Mensagens outbound têm tokens = 1')
      console.log('✅ Mensagens inbound têm tokens = 0')
      console.log('✅ Trigger está aplicando as regras corretamente')
    } else {
      console.log('⚠️  SISTEMA PRECISA DE AJUSTES')
      console.log('💡 Execute o script SQL para corrigir os problemas encontrados')
    }

  } catch (error) {
    console.error('❌ Erro durante o teste:', error)
  }
}

// Executar teste
testSimplifiedSystem()