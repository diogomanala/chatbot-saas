#!/usr/bin/env node

/**
 * Script para configurar e testar o sistema de cobrança baseado em mensagens
 * 
 * Uso:
 * node scripts/setup-billing-cron.js [comando]
 * 
 * Comandos disponíveis:
 * - test: Testa o processamento de cobrança
 * - process: Executa processamento manual
 * - stats: Mostra estatísticas de cobrança
 * - setup: Configura variáveis de ambiente necessárias
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// Configurações
const BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:3000';
const API_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET || 'your-cron-secret-here';

// Função para fazer requisições HTTP
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': CRON_SECRET,
        ...options.headers
      }
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (error) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

// Comandos disponíveis
const commands = {
  async test() {
    console.log('🧪 Testando sistema de cobrança baseado em mensagens...');
    
    try {
      const response = await makeRequest(`${BASE_URL}/api/cron/process-billing`);
      
      if (response.status === 200) {
        console.log('✅ Teste bem-sucedido!');
        console.log('📊 Resultado:', response.data);
      } else {
        console.log('❌ Teste falhou:', response.status, response.data);
      }
    } catch (error) {
      console.error('❌ Erro no teste:', error.message);
    }
  },

  async process(orgId) {
    console.log('⚡ Executando processamento manual de cobrança...');
    
    try {
      const body = orgId ? { orgId } : {};
      const response = await makeRequest(`${BASE_URL}/api/cron/process-billing`, {
        method: 'POST',
        body,
        headers: {
          'Authorization': `Bearer ${API_KEY}`
        }
      });
      
      if (response.status === 200) {
        console.log('✅ Processamento concluído!');
        console.log('📊 Resultado:', response.data);
      } else {
        console.log('❌ Processamento falhou:', response.status, response.data);
      }
    } catch (error) {
      console.error('❌ Erro no processamento:', error.message);
    }
  },

  async stats(orgId) {
    if (!orgId) {
      console.log('❌ orgId é obrigatório para estatísticas');
      console.log('Uso: node scripts/setup-billing-cron.js stats <orgId>');
      return;
    }

    console.log(`📊 Obtendo estatísticas para organização: ${orgId}`);
    
    try {
      const response = await makeRequest(
        `${BASE_URL}/api/billing/process-messages?orgId=${orgId}`,
        {
          headers: {
            'Authorization': `Bearer ${API_KEY}`
          }
        }
      );
      
      if (response.status === 200) {
        console.log('✅ Estatísticas obtidas!');
        console.log('📈 Dados:', response.data);
      } else {
        console.log('❌ Falha ao obter estatísticas:', response.status, response.data);
      }
    } catch (error) {
      console.error('❌ Erro ao obter estatísticas:', error.message);
    }
  },

  setup() {
    console.log('🔧 Configuração do sistema de cobrança baseado em mensagens');
    console.log('');
    console.log('📋 Variáveis de ambiente necessárias:');
    console.log('- NEXT_PUBLIC_SUPABASE_URL: URL do Supabase');
    console.log('- SUPABASE_SERVICE_ROLE_KEY: Chave de serviço do Supabase');
    console.log('- CRON_SECRET: Secret para autenticar cron jobs');
    console.log('');
    console.log('📅 Para configurar cron job automático (Linux/Mac):');
    console.log('1. Execute: crontab -e');
    console.log('2. Adicione a linha:');
    console.log(`   */5 * * * * curl -H "x-cron-secret: ${CRON_SECRET}" ${BASE_URL}/api/cron/process-billing`);
    console.log('');
    console.log('🪟 Para Windows (Task Scheduler):');
    console.log('1. Abra o Agendador de Tarefas');
    console.log('2. Crie uma nova tarefa básica');
    console.log('3. Configure para executar a cada 5 minutos');
    console.log('4. Ação: Iniciar um programa');
    console.log('5. Programa: curl');
    console.log(`6. Argumentos: -H "x-cron-secret: ${CRON_SECRET}" ${BASE_URL}/api/cron/process-billing`);
    console.log('');
    console.log('🔗 Endpoints disponíveis:');
    console.log('- GET /api/cron/process-billing (processamento automático)');
    console.log('- POST /api/cron/process-billing (processamento manual)');
    console.log('- GET /api/billing/process-messages?orgId=xxx (estatísticas)');
    console.log('');
    console.log('✅ Sistema configurado! Execute os testes para verificar.');
  },

  help() {
    console.log('🤖 Sistema de Cobrança Baseado em Mensagens');
    console.log('');
    console.log('📖 Comandos disponíveis:');
    console.log('  test                    - Testa o sistema de cobrança');
    console.log('  process [orgId]         - Executa processamento manual');
    console.log('  stats <orgId>           - Mostra estatísticas de uma organização');
    console.log('  setup                   - Mostra instruções de configuração');
    console.log('  help                    - Mostra esta ajuda');
    console.log('');
    console.log('💡 Exemplos:');
    console.log('  node scripts/setup-billing-cron.js test');
    console.log('  node scripts/setup-billing-cron.js process');
    console.log('  node scripts/setup-billing-cron.js process 123e4567-e89b-12d3-a456-426614174000');
    console.log('  node scripts/setup-billing-cron.js stats 123e4567-e89b-12d3-a456-426614174000');
  }
};

// Executar comando
const command = process.argv[2] || 'help';
const arg = process.argv[3];

if (commands[command]) {
  commands[command](arg);
} else {
  console.log(`❌ Comando desconhecido: ${command}`);
  commands.help();
}