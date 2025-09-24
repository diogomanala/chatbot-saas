// Script para investigar erros do lado do cliente
console.log('🔍 Investigando erros do lado do cliente...');

// 1. Verificar se há problemas de CORS
console.log('\n1. Testando CORS e conectividade básica:');
fetch('http://localhost:3000/api/health')
  .then(response => {
    console.log('✅ Health check:', response.status);
    return response.json();
  })
  .then(data => console.log('Health data:', data))
  .catch(error => console.error('❌ Health check error:', error));

// 2. Verificar se há problemas com autenticação
console.log('\n2. Verificando autenticação:');
const token = localStorage.getItem('supabase.auth.token');
console.log('Token presente no localStorage:', !!token);

if (token) {
  try {
    const parsedToken = JSON.parse(token);
    console.log('Token válido:', !!parsedToken.access_token);
    console.log('Token expira em:', new Date(parsedToken.expires_at * 1000));
  } catch (e) {
    console.error('Erro ao parsear token:', e);
  }
}

// 3. Verificar se há AbortController ativo
console.log('\n3. Verificando AbortController:');
window.addEventListener('beforeunload', () => {
  console.log('🚪 Página sendo fechada - isso pode causar ERR_ABORTED');
});

// 4. Monitorar requisições que falham
console.log('\n4. Monitorando requisições:');
const originalFetch = window.fetch;
window.fetch = function(...args) {
  console.log('🌐 Fetch iniciado:', args[0]);
  
  return originalFetch.apply(this, args)
    .then(response => {
      console.log('✅ Fetch sucesso:', args[0], response.status);
      return response;
    })
    .catch(error => {
      console.error('❌ Fetch erro:', args[0], error.name, error.message);
      throw error;
    });
};

// 5. Verificar se há timeouts configurados
console.log('\n5. Verificando configurações de timeout:');
console.log('Timeout padrão do navegador: ~30s');

console.log('\n✅ Debug script carregado. Monitore o console para mais informações.');