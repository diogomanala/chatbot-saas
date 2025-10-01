// Script de debug para verificar variáveis de ambiente
console.log('=== DEBUG VARIÁVEIS DE AMBIENTE ===');

// Antes de carregar qualquer coisa
console.log('1. ANTES de carregar dotenv:');
console.log('   OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? `${process.env.OPENAI_API_KEY.substring(0, 10)}...` : 'undefined');
console.log('   SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? `${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 10)}...` : 'undefined');

// Carregando dotenv diretamente
const { config } = require('dotenv');
const path = require('path');

config({ path: path.resolve(process.cwd(), '.env.local') });

console.log('2. DEPOIS de carregar .env.local:');
console.log('   OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? `${process.env.OPENAI_API_KEY.substring(0, 10)}...` : 'undefined');
console.log('   SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? `${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 10)}...` : 'undefined');

// Testando OpenAI diretamente
console.log('3. TESTANDO OpenAI diretamente:');
const OpenAI = require('openai');

try {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  openai.models.list()
    .then(models => {
      console.log('   ✅ OpenAI funcionando! Modelos encontrados:', models.data.length);
    })
    .catch(err => {
      console.log('   ❌ Erro OpenAI:', err.message);
      console.log('   ❌ Código do erro:', err.code);
    });
} catch (err) {
  console.log('   ❌ Erro ao criar cliente OpenAI:', err.message);
}

console.log('=== FIM DEBUG ===');