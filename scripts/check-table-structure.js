const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTableStructure() {
  console.log('🔍 [STRUCTURE-CHECK] Verificando estrutura das tabelas...');
  
  try {
    // Verificar estrutura da tabela devices
    console.log('\n📋 [DEVICES] Verificando estrutura da tabela devices...');
    
    const { data: devicesData, error: devicesError } = await supabase
      .from('devices')
      .select('*')
      .limit(1);
    
    if (devicesError) {
      console.error('❌ [DEVICES-ERROR]', devicesError.message);
    } else {
      console.log('✅ [DEVICES-OK] Tabela devices acessível');
      if (devicesData && devicesData.length > 0) {
        console.log('📊 [DEVICES-COLUMNS] Colunas encontradas:');
        Object.keys(devicesData[0]).forEach(column => {
          console.log(`   - ${column}: ${typeof devicesData[0][column]}`);
        });
      } else {
        console.log('📊 [DEVICES-EMPTY] Tabela devices está vazia');
        
        // Tentar inserir um registro de teste para ver a estrutura
        const { error: insertError } = await supabase
          .from('devices')
          .insert({})
          .select();
        
        if (insertError) {
          console.log('📋 [DEVICES-STRUCTURE] Erro ao inserir (mostra estrutura esperada):');
          console.log(insertError.message);
        }
      }
    }
    
    // Verificar estrutura da tabela chatbots
    console.log('\n🤖 [CHATBOTS] Verificando estrutura da tabela chatbots...');
    
    const { data: chatbotsData, error: chatbotsError } = await supabase
      .from('chatbots')
      .select('*')
      .limit(1);
    
    if (chatbotsError) {
      console.error('❌ [CHATBOTS-ERROR]', chatbotsError.message);
    } else {
      console.log('✅ [CHATBOTS-OK] Tabela chatbots acessível');
      if (chatbotsData && chatbotsData.length > 0) {
        console.log('📊 [CHATBOTS-COLUMNS] Colunas encontradas:');
        Object.keys(chatbotsData[0]).forEach(column => {
          console.log(`   - ${column}: ${typeof chatbotsData[0][column]}`);
        });
      }
    }
    
    // Verificar se existe tabela messages
    console.log('\n💬 [MESSAGES] Verificando estrutura da tabela messages...');
    
    const { data: messagesData, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .limit(1);
    
    if (messagesError) {
      console.error('❌ [MESSAGES-ERROR]', messagesError.message);
    } else {
      console.log('✅ [MESSAGES-OK] Tabela messages acessível');
      if (messagesData && messagesData.length > 0) {
        console.log('📊 [MESSAGES-COLUMNS] Colunas encontradas:');
        Object.keys(messagesData[0]).forEach(column => {
          console.log(`   - ${column}: ${typeof messagesData[0][column]}`);
        });
      } else {
        console.log('📊 [MESSAGES-EMPTY] Tabela messages está vazia');
      }
    }
    
  } catch (error) {
    console.error('❌ [STRUCTURE-CHECK] Erro durante verificação:', error);
  }
}

// Executar verificação
checkTableStructure();