const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDatabaseIntegrity() {
  console.log('🔍 [DB-CHECK] Iniciando verificação de integridade do banco...');
  console.log(`📊 [DB-INFO] Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log(`🔑 [DB-INFO] Service Role configurada: ${!!process.env.SUPABASE_SERVICE_ROLE_KEY}`);
  
  let hasErrors = false;
  
  try {
    // 1. Verificar se a tabela devices existe e sua estrutura
    console.log('\n📋 [DEVICES-CHECK] Verificando tabela devices...');
    
    const { data: devices, error: devicesError } = await supabase
      .from('devices')
      .select('id, name, instance_id, phone_jid, config, metadata, chatbot_id, org_id, created_at')
      .limit(1);
    
    if (devicesError) {
      console.error('❌ [DEVICES-ERROR] Erro ao acessar tabela devices:', devicesError.message);
      hasErrors = true;
    } else {
      console.log('✅ [DEVICES-OK] Tabela devices acessível');
      
      // Verificar se há devices
      const { count: devicesCount } = await supabase
        .from('devices')
        .select('*', { count: 'exact', head: true });
      
      console.log(`📊 [DEVICES-COUNT] Total de devices: ${devicesCount}`);
      
      // Verificar unicidade de instance_id
      const { data: duplicateInstances } = await supabase
        .from('devices')
        .select('instance_id')
        .not('instance_id', 'is', null);
      
      if (duplicateInstances) {
        const instanceIds = duplicateInstances.map(d => d.instance_id);
        const uniqueIds = new Set(instanceIds);
        
        if (instanceIds.length !== uniqueIds.size) {
          console.error('❌ [DEVICES-ERROR] Duplicatas encontradas em instance_id');
          hasErrors = true;
        } else {
          console.log('✅ [DEVICES-OK] instance_id únicos');
        }
      }
    }
    
    // 2. Verificar se a tabela chatbots existe e sua estrutura
    console.log('\n🤖 [CHATBOTS-CHECK] Verificando tabela chatbots...');
    
    const { data: chatbots, error: chatbotsError } = await supabase
      .from('chatbots')
      .select('id, name, is_default, is_active, org_id, created_at')
      .limit(1);
    
    if (chatbotsError) {
      console.error('❌ [CHATBOTS-ERROR] Erro ao acessar tabela chatbots:', chatbotsError.message);
      hasErrors = true;
    } else {
      console.log('✅ [CHATBOTS-OK] Tabela chatbots acessível');
      
      // Verificar se há chatbots
      const { count: chatbotsCount } = await supabase
        .from('chatbots')
        .select('*', { count: 'exact', head: true });
      
      console.log(`📊 [CHATBOTS-COUNT] Total de chatbots: ${chatbotsCount}`);
      
      // Verificar se existe chatbot default
      const { data: defaultChatbots } = await supabase
        .from('chatbots')
        .select('id, name, org_id, is_active')
        .eq('is_default', true);
      
      if (!defaultChatbots || defaultChatbots.length === 0) {
        console.error('❌ [CHATBOTS-ERROR] Nenhum chatbot default encontrado');
        hasErrors = true;
      } else {
        console.log(`✅ [CHATBOTS-OK] ${defaultChatbots.length} chatbot(s) default encontrado(s)`);
        defaultChatbots.forEach(bot => {
          console.log(`   - ${bot.name} (ID: ${bot.id}, Org: ${bot.org_id}, Ativo: ${bot.is_active})`);
        });
      }
    }
    
    // 3. Verificar integridade referencial devices -> chatbots
    console.log('\n🔗 [INTEGRITY-CHECK] Verificando integridade referencial...');
    
    const { data: devicesWithChatbots } = await supabase
      .from('devices')
      .select(`
        id,
        name,
        chatbot_id,
        org_id,
        chatbots!inner(id, name, is_active)
      `);
    
    if (devicesWithChatbots) {
      console.log(`✅ [INTEGRITY-OK] ${devicesWithChatbots.length} devices com chatbots válidos`);
    }
    
    // Verificar devices sem chatbot_id
    const { data: devicesWithoutChatbot } = await supabase
      .from('devices')
      .select('id, name, org_id')
      .is('chatbot_id', null);
    
    if (devicesWithoutChatbot && devicesWithoutChatbot.length > 0) {
      console.warn(`⚠️ [INTEGRITY-WARN] ${devicesWithoutChatbot.length} devices sem chatbot_id:`);
      devicesWithoutChatbot.forEach(device => {
        console.log(`   - ${device.name} (ID: ${device.id}, Org: ${device.org_id})`);
      });
    }
    
    // 4. Resumo final
    console.log('\n📋 [SUMMARY] Resumo da verificação:');
    
    if (hasErrors) {
      console.error('❌ [RESULT] Problemas de integridade encontrados!');
      process.exit(1);
    } else {
      console.log('✅ [RESULT] Integridade do banco de dados OK');
      console.log('📊 [METRICS] Métricas:');
      console.log(`   - Devices: ${devicesCount || 0}`);
      console.log(`   - Chatbots: ${chatbotsCount || 0}`);
      console.log(`   - Chatbots default: ${defaultChatbots?.length || 0}`);
      console.log(`   - Devices com chatbot: ${devicesWithChatbots?.length || 0}`);
      console.log(`   - Devices sem chatbot: ${devicesWithoutChatbot?.length || 0}`);
    }
    
  } catch (error) {
    console.error('❌ [DB-CHECK] Erro durante verificação:', error);
    process.exit(1);
  }
}

// Executar verificação
checkDatabaseIntegrity();