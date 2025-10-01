// Teste simples usando fetch direto
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = 'https://anlemekgocrrllsogxix.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFubGVtZWtnb2Nycmxsc29neGl4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzYwMTIyMywiZXhwIjoyMDczMTc3MjIzfQ.sb_secret_PR3yVUXsopPYTE87R1L3eA_62IHitGT';

console.log('🔧 Configurações:');
console.log('URL:', SUPABASE_URL);
console.log('Key:', SUPABASE_KEY ? `${SUPABASE_KEY.substring(0, 20)}...` : 'MISSING');
console.log('');

async function testSupabaseConnection() {
  try {
    console.log('🧪 Testando conexão com Supabase...');
    
    // Teste 1: Verificar mensagens pendentes
    const response = await fetch(`${SUPABASE_URL}/rest/v1/messages?billing_status=eq.pending&select=*&limit=5`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const pendingMessages = await response.json();
    console.log(`✅ Conexão OK! Mensagens pendentes: ${pendingMessages.length}`);
    
    if (pendingMessages.length > 0) {
      console.log('\n📋 Mensagens pendentes encontradas:');
      pendingMessages.forEach((msg, index) => {
        console.log(`${index + 1}. ID: ${msg.id}`);
        console.log(`   📞 ${msg.direction}: ${msg.sender_phone} → ${msg.receiver_phone}`);
        console.log(`   💬 Conteúdo: "${(msg.message_content || msg.content || '').substring(0, 50)}..."`);
        console.log(`   🔢 Tokens: ${msg.tokens_used || 0}`);
        console.log(`   📅 Criado: ${new Date(msg.created_at).toLocaleString('pt-BR')}`);
        console.log('');
      });
    }
    
    // Teste 2: Estatísticas de billing_status
    console.log('📊 Buscando estatísticas de billing_status...');
    const statsResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_billing_stats`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      console.log('✅ Estatísticas:', stats);
    } else {
      console.log('⚠️  Função get_billing_stats não encontrada, fazendo consulta manual...');
      
      // Consulta manual para contar por status
      const allMessagesResponse = await fetch(`${SUPABASE_URL}/rest/v1/messages?select=billing_status&limit=1000`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (allMessagesResponse.ok) {
        const allMessages = await allMessagesResponse.json();
        const statusCounts = {};
        allMessages.forEach(msg => {
          const status = msg.billing_status || 'null';
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        
        console.log('📊 Status das mensagens:');
        Object.entries(statusCounts).forEach(([status, count]) => {
          console.log(`   ${status}: ${count} mensagens`);
        });
      }
    }
    
    // Teste 3: Verificar carteiras de crédito
    console.log('\n💰 Verificando carteiras de crédito...');
    const walletsResponse = await fetch(`${SUPABASE_URL}/rest/v1/credit_wallets?select=*`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (walletsResponse.ok) {
      const wallets = await walletsResponse.json();
      console.log(`✅ Carteiras encontradas: ${wallets.length}`);
      wallets.forEach(wallet => {
        console.log(`   Org ${wallet.org_id}: ${wallet.balance} créditos`);
      });
    } else {
      console.log('❌ Erro ao buscar carteiras:', await walletsResponse.text());
    }
    
    console.log('\n🎉 Teste concluído!');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testSupabaseConnection();