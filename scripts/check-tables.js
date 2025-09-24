require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!SUPABASE_URL || !SUPABASE_ACCESS_TOKEN) {
  console.error('❌ Variáveis de ambiente SUPABASE_URL e SUPABASE_ACCESS_TOKEN são obrigatórias');
  process.exit(1);
}

async function checkTables() {
  try {
    console.log('🔍 Verificando tabelas no Supabase...');
    
    // Listar todas as tabelas
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'apikey': SUPABASE_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error('❌ Erro ao conectar com Supabase:', response.status, response.statusText);
      return;
    }
    
    const data = await response.json();
    console.log('📋 Resposta da API:', data);
    
    // Tentar verificar especificamente a tabela system_alerts
    console.log('\n🎯 Verificando tabela system_alerts...');
    const alertsResponse = await fetch(`${SUPABASE_URL}/rest/v1/system_alerts?limit=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'apikey': SUPABASE_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📊 Status da tabela system_alerts:', alertsResponse.status);
    
    if (alertsResponse.ok) {
      console.log('✅ Tabela system_alerts existe e está acessível!');
      const alertsData = await alertsResponse.json();
      console.log('📝 Dados da tabela:', alertsData);
    } else {
      console.log('❌ Tabela system_alerts não encontrada ou inacessível');
      const errorText = await alertsResponse.text();
      console.log('🔍 Detalhes do erro:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

checkTables();