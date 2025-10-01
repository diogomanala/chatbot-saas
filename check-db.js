// Script para verificar dados no banco
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDatabase() {
  console.log('🔍 Verificando dados no banco...');
  
  try {
    // Verificar organizações
    console.log('\n📊 Organizações:');
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, credits, is_active')
      .limit(5);
    
    if (orgError) {
      console.error('❌ Erro ao buscar organizações:', orgError);
    } else {
      console.log('✅ Organizações encontradas:', orgs?.length || 0);
      orgs?.forEach(org => {
        console.log(`  - ${org.name} (ID: ${org.id}, Créditos: ${org.credits}, Ativo: ${org.is_active})`);
      });
    }

    // Verificar chatbots
    console.log('\n🤖 Chatbots:');
    const { data: bots, error: botError } = await supabase
      .from('chatbots')
      .select('id, name, organization_id, is_active')
      .limit(5);
    
    if (botError) {
      console.error('❌ Erro ao buscar chatbots:', botError);
    } else {
      console.log('✅ Chatbots encontrados:', bots?.length || 0);
      bots?.forEach(bot => {
        console.log(`  - ${bot.name} (ID: ${bot.id}, Org: ${bot.organization_id}, Ativo: ${bot.is_active})`);
      });
    }

    // Verificar mensagens
    console.log('\n💬 Mensagens:');
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('id, content, organization_id')
      .limit(3);
    
    if (msgError) {
      console.error('❌ Erro ao buscar mensagens:', msgError);
    } else {
      console.log('✅ Mensagens encontradas:', messages?.length || 0);
    }

    // Criar uma organização de teste se não existir
    if (!orgs || orgs.length === 0) {
      console.log('\n🏗️ Criando organização de teste...');
      const { data: newOrg, error: createError } = await supabase
        .from('organizations')
        .insert({
          name: 'Organização Teste',
          credits: 1000,
          is_active: true
        })
        .select()
        .single();
      
      if (createError) {
        console.error('❌ Erro ao criar organização:', createError);
      } else {
        console.log('✅ Organização criada:', newOrg);
        
        // Criar chatbot de teste
        console.log('🤖 Criando chatbot de teste...');
        const { data: newBot, error: botCreateError } = await supabase
          .from('chatbots')
          .insert({
            name: 'Chatbot Teste',
            organization_id: newOrg.id,
            is_active: true,
            phone_number: '5511999999999'
          })
          .select()
          .single();
        
        if (botCreateError) {
          console.error('❌ Erro ao criar chatbot:', botCreateError);
        } else {
          console.log('✅ Chatbot criado:', newBot);
        }
      }
    }

  } catch (error) {
    console.error('💥 Erro geral:', error);
  }
}

checkDatabase();