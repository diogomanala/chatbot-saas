// Teste da API local para processamento de débito automático
const fetch = require('node-fetch');
// const https = require('https');
// const http = require('http');

// Configuração para ignorar certificados SSL em desenvolvimento
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function testLocalAPI() {
  try {
    console.log('🧪 Testando API local para processamento de débito...');
    
    // Testar se o servidor local está rodando
    const testUrl = 'http://localhost:3000/api/health';
    
    console.log(`🔍 Verificando se servidor local está ativo: ${testUrl}`);
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.text();
      console.log('✅ Servidor local está ativo');
      console.log('📄 Resposta:', data);
    } else {
      console.log('❌ Servidor local não está respondendo');
      console.log('📄 Status:', response.status);
    }
    
  } catch (error) {
    console.error('❌ Erro ao testar API local:', error.message);
    
    // Tentar alternativa com curl via child_process
    console.log('\n🔄 Tentando alternativa com curl...');
    
    const { exec } = require('child_process');
    
    exec('curl -I http://localhost:3000', (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Curl também falhou:', error.message);
        console.log('\n💡 Diagnóstico:');
        console.log('   1. O servidor de desenvolvimento pode não estar rodando');
        console.log('   2. Pode haver problema de conectividade de rede local');
        console.log('   3. Firewall pode estar bloqueando conexões');
        console.log('\n🛠️  Soluções recomendadas:');
        console.log('   1. Verificar se npm run dev está ativo');
        console.log('   2. Testar acesso direto via browser: http://localhost:3000');
        console.log('   3. Verificar configurações de firewall/antivírus');
        return;
      }
      
      console.log('✅ Curl funcionou:');
      console.log(stdout);
      
      if (stderr) {
        console.log('⚠️  Stderr:', stderr);
      }
    });
  }
}

// Função para testar conectividade básica
function testBasicConnectivity() {
  console.log('\n🌐 Testando conectividade básica...');
  
  // Testar DNS
  const dns = require('dns');
  
  dns.lookup('google.com', (err, address) => {
    if (err) {
      console.log('❌ DNS não está funcionando:', err.message);
    } else {
      console.log('✅ DNS funcionando - google.com resolve para:', address);
    }
  });
  
  // Testar localhost
  dns.lookup('localhost', (err, address) => {
    if (err) {
      console.log('❌ Localhost não resolve:', err.message);
    } else {
      console.log('✅ Localhost resolve para:', address);
    }
  });
}

// Função para verificar variáveis de ambiente
function checkEnvironment() {
  console.log('\n🔧 Verificando variáveis de ambiente...');
  
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NODE_ENV'
  ];
  
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`✅ ${varName}: ${varName.includes('KEY') ? '[REDACTED]' : value}`);
    } else {
      console.log(`❌ ${varName}: não definida`);
    }
  });
}

// Executar todos os testes
async function runAllTests() {
  console.log('🚀 Iniciando diagnóstico completo...');
  console.log('=' .repeat(50));
  
  checkEnvironment();
  testBasicConnectivity();
  
  // Aguardar um pouco para os testes DNS
  setTimeout(async () => {
    await testLocalAPI();
  }, 2000);
}

runAllTests();