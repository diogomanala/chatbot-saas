const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testSurgicalFix() {
  console.log('🔧 TESTE DA CORREÇÃO CIRÚRGICA - DÉBITO AUTOMÁTICO');
  console.log('='.repeat(60));
  
  // Simular payload de webhook da Evolution API
  const testPayload = {
    event: "messages.upsert",
    instance: "medical-crm-fb4f70d9-9f69-4c7f-8188-e412057aeb77",
    data: {
      key: {
        remoteJid: "5511999999999@s.whatsapp.net",
        fromMe: false,
        id: `test_surgical_fix_${Date.now()}`
      },
      message: {
        conversation: "Teste da correção cirúrgica do débito automático"
      },
      messageTimestamp: Math.floor(Date.now() / 1000),
      status: "RECEIVED"
    }
  };
  
  console.log('📤 Enviando payload de teste para webhook...');
  console.log('Payload:', JSON.stringify(testPayload, null, 2));
  
  try {
    const response = await fetch('http://localhost:3000/api/webhook/evolution/messages-upsert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Evolution-API/1.0'
      },
      body: JSON.stringify(testPayload)
    });
    
    const responseText = await response.text();
    
    console.log('📥 Resposta do webhook:');
    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    console.log('Body:', responseText);
    
    if (response.ok) {
      console.log('✅ Webhook processado com sucesso!');
      
      // Aguardar um pouco para o processamento assíncrono
      console.log('⏳ Aguardando processamento assíncrono...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Verificar mensagens outbound criadas nos últimos 30 segundos
      const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
      
      const { data: recentMessages, error } = await supabase
        .from('messages')
        .select('id, tokens_used, billing_status, created_at, message_content, direction')
        .eq('direction', 'outbound')
        .gte('created_at', thirtySecondsAgo)
        .order('created_at', { ascending: false })
        .limit(3);
        
      if (error) {
        console.error('❌ Erro ao buscar mensagens recentes:', error);
        return;
      }
      
      console.log('🔍 MENSAGENS OUTBOUND RECENTES:');
      console.log('Quantidade encontrada:', recentMessages?.length || 0);
      
      recentMessages?.forEach((msg, index) => {
        console.log(`\n📨 Mensagem ${index + 1}:`);
        console.log(`  ID: ${msg.id}`);
        console.log(`  Tokens: ${msg.tokens_used}`);
        console.log(`  Status: ${msg.billing_status}`);
        console.log(`  Criado: ${msg.created_at}`);
        console.log(`  Conteúdo: ${msg.message_content?.substring(0, 100)}...`);
        
        // Verificar se a correção funcionou
        if (msg.tokens_used > 0 && msg.billing_status === 'charged') {
          console.log('  ✅ CORREÇÃO FUNCIONOU! Tokens > 0 e status = charged');
        } else if (msg.tokens_used === 0 && msg.billing_status === 'skipped') {
          console.log('  ❌ CORREÇÃO FALHOU! Tokens = 0 e status = skipped');
        } else {
          console.log(`  ⚠️ Status intermediário: tokens=${msg.tokens_used}, status=${msg.billing_status}`);
        }
      });
      
    } else {
      console.log('❌ Erro no webhook:', response.status, responseText);
    }
    
  } catch (error) {
    console.error('❌ Erro ao testar webhook:', error);
  }
}

testSurgicalFix().catch(console.error);