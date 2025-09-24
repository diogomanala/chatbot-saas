const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Verificando configurações do Supabase...');
console.log('URL:', supabaseUrl ? '✅ Definida' : '❌ Não definida');
console.log('Anon Key:', supabaseAnonKey ? `✅ Definida (${supabaseAnonKey.length} chars)` : '❌ Não definida');
console.log('Service Key:', supabaseServiceKey ? `✅ Definida (${supabaseServiceKey.length} chars)` : '❌ Não definida');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Configurações básicas do Supabase não encontradas');
  process.exit(1);
}

// Teste com chave anon
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

// Teste com chave service (se disponível)
let supabaseService = null;
if (supabaseServiceKey && supabaseServiceKey.length > 20) {
  supabaseService = createClient(supabaseUrl, supabaseServiceKey);
}

async function testConnection() {
  console.log('\n🧪 Testando conexão com Supabase...');
  
  try {
    // Teste 1: Verificar se consegue conectar
    console.log('\n1️⃣ Teste básico de conectividade...');
    const { error } = await supabaseAnon
      .from('messages')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log('❌ Erro na conexão:', error.message);
    } else {
      console.log('✅ Conexão estabelecida com sucesso');
    }

    // Teste 2: Buscar mensagens (com chave anon)
    console.log('\n2️⃣ Buscando mensagens com chave anon...');
    const { data: messages, error: messagesError } = await supabaseAnon
      .from('messages')
      .select('id, message_content, direction, billing_status')
      .limit(3);
    
    if (messagesError) {
      console.log('❌ Erro ao buscar mensagens:', messagesError.message);
    } else {
      console.log(`✅ Encontradas ${messages?.length || 0} mensagens`);
      if (messages && messages.length > 0) {
        messages.forEach((msg, i) => {
          console.log(`   ${i+1}. ID: ${msg.id}`);
          console.log(`      Direção: ${msg.direction}`);
          console.log(`      Status: ${msg.billing_status || 'null'}`);
          console.log(`      Conteúdo: "${msg.message_content?.substring(0, 50)}..."`);
        });
      }
    }

    // Teste 3: Verificar créditos da organização
    console.log('\n3️⃣ Verificando créditos da organização...');
    const { data: credits, error: creditsError } = await supabaseAnon
      .from('organization_credits')
      .select('org_id, balance')
      .limit(3);
    
    if (creditsError) {
      console.log('❌ Erro ao buscar créditos:', creditsError.message);
    } else {
      console.log(`✅ Encontradas ${credits?.length || 0} organizações com créditos`);
      if (credits && credits.length > 0) {
        credits.forEach((org, i) => {
          console.log(`   ${i+1}. Org: ${org.org_id}`);
          console.log(`      Saldo: ${org.balance} créditos`);
        });
      }
    }

    // Teste 4: Com chave service (se disponível)
    if (supabaseService) {
      console.log('\n4️⃣ Testando com chave service role...');
      const { error: serviceError } = await supabaseService
        .from('messages')
        .select('id')
        .limit(1);
      
      if (serviceError) {
        console.log('❌ Erro com chave service:', serviceError.message);
      } else {
        console.log('✅ Chave service funcionando');
      }
    } else {
      console.log('\n4️⃣ ⚠️  Chave service role não disponível ou incompleta');
    }

  } catch (error) {
    console.error('❌ Erro geral no teste:', error.message);
    console.error('Stack:', error.stack);
  }
}

testConnection();