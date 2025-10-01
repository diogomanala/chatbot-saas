const fs = require('fs');
const { execSync } = require('child_process');
require('dotenv').config();

// Construir URL de conexão do Supabase para psql
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Variáveis SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontradas');
  process.exit(1);
}

// Extrair informações da URL do Supabase
const urlParts = supabaseUrl.replace('https://', '').split('.');
const projectRef = urlParts[0];

// Tentar diferentes formatos de URL de conexão do Supabase
const connectionUrls = [
  // Formato 1: Conexão direta
  `postgresql://postgres:${serviceRoleKey}@db.${projectRef}.supabase.co:5432/postgres`,
  // Formato 2: Pooler
  `postgresql://postgres.${projectRef}:${serviceRoleKey}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`,
  // Formato 3: Alternativo
  `postgresql://postgres:${serviceRoleKey}@${projectRef}.supabase.co:5432/postgres`
];

console.log('🔗 Testando diferentes formatos de URL de conexão...');

for (let i = 0; i < connectionUrls.length; i++) {
  const databaseUrl = connectionUrls[i];
  console.log(`\n📋 Formato ${i + 1}:`);
  console.log(`DATABASE_URL="${databaseUrl}"`);
  
  try {
    console.log('🧪 Testando conexão...');
    
    const result = execSync(`"C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe" "${databaseUrl}" -c "SELECT 1 as test;"`, {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 10000
    });
    
    console.log('✅ Conexão bem-sucedida!');
    console.log('📊 Resultado do teste:', result.trim());
    
    console.log('\n🎯 Use esta URL para executar SQL:');
    console.log(`$env:DATABASE_URL="${databaseUrl}"`);
    console.log('& "C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe" $env:DATABASE_URL -f create-billing-table.sql');
    
    // Salvar a URL que funcionou
    fs.writeFileSync('.env.database', `DATABASE_URL="${databaseUrl}"`);
    console.log('\n💾 URL salva em .env.database');
    
    break;
    
  } catch (error) {
    console.error('❌ Erro na conexão:', error.message.split('\n')[0]);
  }
}

console.log('\n💡 Se nenhuma conexão funcionou:');
console.log('1. Acesse o painel do Supabase > Settings > Database');
console.log('2. Copie a "Connection string" na seção "Connection parameters"');
console.log('3. Substitua [YOUR-PASSWORD] pela sua service role key');
console.log('4. Use essa URL com o psql');