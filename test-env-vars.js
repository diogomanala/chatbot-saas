// Teste para verificar se as variáveis de ambiente estão sendo carregadas
console.log('=== Teste de Variáveis de Ambiente ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('OPENAI_API_KEY presente:', !!process.env.OPENAI_API_KEY);
console.log('OPENAI_API_KEY length:', process.env.OPENAI_API_KEY?.length);
console.log('OPENAI_API_KEY primeiros 20 chars:', process.env.OPENAI_API_KEY?.substring(0, 20));
console.log('SUPABASE_SERVICE_ROLE_KEY presente:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log('NEXT_PUBLIC_SUPABASE_URL presente:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);

// Teste direto com dotenv
require('dotenv').config({ path: '.env.local' });
console.log('\n=== Após carregar .env.local com dotenv ===');
console.log('OPENAI_API_KEY presente:', !!process.env.OPENAI_API_KEY);
console.log('OPENAI_API_KEY length:', process.env.OPENAI_API_KEY?.length);
console.log('OPENAI_API_KEY primeiros 20 chars:', process.env.OPENAI_API_KEY?.substring(0, 20));