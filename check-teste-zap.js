require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase usando as credenciais corretas
const supabaseUrl = 'https://anlemekgocrrllsogxix.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFubGVtZWtnb2Nycmxsc29neGl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MDEyMjMsImV4cCI6MjA3MzE3NzIyM30.7K4zVdnDh_3YuBz59PX8WoRwDxKjXJ0KXnD1tNvp7iM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTesteZap() {
  try {
    console.log('🔍 Verificando dados completos do chatbot "Teste Zap"...');
    
    const { data: chatbot, error } = await supabase
      .from('chatbots')
      .select('*')
      .eq('name', 'Teste Zap')
      .single();
    
    if (error) {
      console.error('❌ Erro ao buscar chatbot:', error);
      return;
    }
    
    if (!chatbot) {
      console.log('⚠️ Chatbot "Teste Zap" não encontrado');
      return;
    }
    
    console.log('\n=== DADOS COMPLETOS DO CHATBOT "TESTE ZAP" ===');
    console.log('ID:', chatbot.id);
    console.log('Nome:', chatbot.name);
    console.log('Ativo:', chatbot.is_active);
    console.log('Organização:', chatbot.org_id);
    console.log('Modelo:', chatbot.model);
    console.log('Temperatura:', chatbot.temperature);
    console.log('Criado em:', chatbot.created_at);
    
    console.log('\n=== PROMPTS E TREINAMENTO ===');
    console.log('System Prompt:');
    console.log(chatbot.system_prompt || '(não definido)');
    
    console.log('\nCompany Prompt:');
    console.log(chatbot.company_prompt || '(não definido)');
    
    console.log('\nTraining Prompt:');
    console.log(chatbot.training_prompt || '(não definido)');
    
    console.log('\nResponse Rules:');
    console.log(chatbot.response_rules || '(não definido)');
    
    // Verificar se tem treinamento
    const hasTraining = !!(chatbot.system_prompt || chatbot.company_prompt || chatbot.training_prompt || chatbot.response_rules);
    
    console.log('\n=== ANÁLISE ===');
    console.log('Tem treinamento configurado:', hasTraining ? '✅ SIM' : '❌ NÃO');
    
    if (!hasTraining) {
      console.log('⚠️ PROBLEMA IDENTIFICADO: O chatbot não possui nenhum prompt ou treinamento configurado!');
      console.log('Isso explica por que ele está respondendo com mensagens genéricas.');
    }
    
  } catch (error) {
    console.error('💥 Erro:', error);
  }
}

checkTesteZap();