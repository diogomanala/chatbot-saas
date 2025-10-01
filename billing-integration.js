// =====================================================
// INTEGRAÇÃO COMPLETA DO SISTEMA DE COBRANÇA
// Use este código para integrar no seu sistema
// =====================================================

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configurar cliente Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

// =====================================================
// CLASSE PRINCIPAL DO SISTEMA DE COBRANÇA
// =====================================================

class BillingSystem {
  constructor() {
    this.creditsPerToken = 0.001; // R$ 0,001 por token
  }

  /**
   * Processar cobrança de uma mensagem
   * @param {string} messageId - ID da mensagem
   * @param {string} orgId - ID da organização
   * @param {string} content - Conteúdo da mensagem
   * @returns {Promise<Object>} Resultado da cobrança
   */
  async processMessageBilling(messageId, orgId, content) {
    try {
      const { data, error } = await supabase.rpc('process_message_billing', {
        p_message_id: messageId,
        p_org_id: orgId,
        p_content: content
      });

      if (error) {
        console.error('Erro ao processar cobrança:', error);
        return { success: false, error: error.message };
      }

      return data;
    } catch (err) {
      console.error('Erro na cobrança:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Obter estatísticas de cobrança de uma organização
   * @param {string} orgId - ID da organização
   * @returns {Promise<Object>} Estatísticas
   */
  async getBillingStats(orgId) {
    try {
      const { data, error } = await supabase.rpc('get_billing_stats', {
        p_org_id: orgId
      });

      if (error) {
        console.error('Erro ao obter estatísticas:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Erro nas estatísticas:', err);
      return null;
    }
  }

  /**
   * Adicionar créditos a uma organização
   * @param {string} orgId - ID da organização
   * @param {number} amount - Quantidade de créditos
   * @returns {Promise<Object>} Resultado
   */
  async addCredits(orgId, amount) {
    try {
      const { data, error } = await supabase.rpc('add_credits', {
        p_org_id: orgId,
        p_amount: amount
      });

      if (error) {
        console.error('Erro ao adicionar créditos:', error);
        return { success: false, error: error.message };
      }

      return data;
    } catch (err) {
      console.error('Erro ao adicionar créditos:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Verificar se organização tem saldo suficiente
   * @param {string} orgId - ID da organização
   * @param {number} requiredCredits - Créditos necessários
   * @returns {Promise<boolean>} True se tem saldo suficiente
   */
  async hasSufficientBalance(orgId, requiredCredits) {
    try {
      const { data } = await supabase
        .from('organization_credits')
        .select('balance')
        .eq('org_id', orgId)
        .single();

      if (!data) return false;
      return data.balance >= requiredCredits;
    } catch (err) {
      console.error('Erro ao verificar saldo:', err);
      return false;
    }
  }

  /**
   * Obter saldo atual de uma organização
   * @param {string} orgId - ID da organização
   * @returns {Promise<number>} Saldo atual
   */
  async getCurrentBalance(orgId) {
    try {
      const { data } = await supabase
        .from('organization_credits')
        .select('balance')
        .eq('org_id', orgId)
        .single();

      return data?.balance || 0;
    } catch (err) {
      console.error('Erro ao obter saldo:', err);
      return 0;
    }
  }

  /**
   * Listar histórico de cobrança
   * @param {string} orgId - ID da organização
   * @param {number} limit - Limite de registros
   * @returns {Promise<Array>} Histórico
   */
  async getBillingHistory(orgId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('message_billing')
        .select('*')
        .eq('org_id', orgId)
        .order('charged_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Erro ao obter histórico:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('Erro no histórico:', err);
      return [];
    }
  }
}

// =====================================================
// MIDDLEWARE PARA INTEGRAÇÃO COM ROTAS
// =====================================================

/**
 * Middleware para verificar saldo antes de processar mensagem
 */
function checkBalance(billing) {
  return async (req, res, next) => {
    try {
      const { orgId, content } = req.body;
      
      if (!orgId || !content) {
        return res.status(400).json({ error: 'orgId e content são obrigatórios' });
      }

      // Estimar tokens necessários
      const estimatedTokens = Math.max(1, Math.floor(content.length / 4));
      const estimatedCredits = estimatedTokens * billing.creditsPerToken;

      // Verificar saldo
      const hasSufficientBalance = await billing.hasSufficientBalance(orgId, estimatedCredits);
      
      if (!hasSufficientBalance) {
        const currentBalance = await billing.getCurrentBalance(orgId);
        return res.status(402).json({
          error: 'Saldo insuficiente',
          currentBalance,
          required: estimatedCredits
        });
      }

      // Adicionar informações ao request
      req.billing = {
        estimatedTokens,
        estimatedCredits,
        orgId
      };

      next();
    } catch (error) {
      console.error('Erro no middleware de cobrança:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  };
}

// =====================================================
// EXEMPLO DE USO EM ROTAS EXPRESS
// =====================================================

/*
const express = require('express');
const app = express();
const billing = new BillingSystem();

app.use(express.json());

// Rota para processar mensagem com cobrança
app.post('/api/messages', checkBalance(billing), async (req, res) => {
  try {
    const { content, orgId } = req.body;
    const messageId = generateUUID(); // Implementar função de UUID
    
    // Processar mensagem (sua lógica aqui)
    const messageResponse = await processMessage(content);
    
    // Processar cobrança
    const billingResult = await billing.processMessageBilling(
      messageId,
      orgId,
      content
    );
    
    if (!billingResult.success) {
      return res.status(402).json({
        error: 'Falha na cobrança',
        details: billingResult.error
      });
    }
    
    res.json({
      message: messageResponse,
      billing: billingResult
    });
    
  } catch (error) {
    console.error('Erro ao processar mensagem:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para obter estatísticas
app.get('/api/billing/stats/:orgId', async (req, res) => {
  try {
    const { orgId } = req.params;
    const stats = await billing.getBillingStats(orgId);
    res.json(stats);
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para adicionar créditos
app.post('/api/billing/credits', async (req, res) => {
  try {
    const { orgId, amount } = req.body;
    const result = await billing.addCredits(orgId, amount);
    res.json(result);
  } catch (error) {
    console.error('Erro ao adicionar créditos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para histórico
app.get('/api/billing/history/:orgId', async (req, res) => {
  try {
    const { orgId } = req.params;
    const { limit = 50 } = req.query;
    const history = await billing.getBillingHistory(orgId, parseInt(limit));
    res.json(history);
  } catch (error) {
    console.error('Erro ao obter histórico:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});
*/

// =====================================================
// EXEMPLO DE TESTE
// =====================================================

async function testBillingSystem() {
  const billing = new BillingSystem();
  const testOrgId = 'test-org-' + Date.now();
  const testMessageId = 'msg-' + Date.now();
  const testContent = 'Esta é uma mensagem de teste para o sistema de cobrança.';

  console.log('🧪 Testando sistema de cobrança...');
  console.log(`📋 Organização: ${testOrgId}`);
  console.log(`📨 Mensagem: ${testMessageId}`);
  console.log(`📝 Conteúdo: ${testContent}`);

  try {
    // 1. Adicionar créditos iniciais
    console.log('\n💰 Adicionando créditos iniciais...');
    const addResult = await billing.addCredits(testOrgId, 100.00);
    console.log('Resultado:', addResult);

    // 2. Verificar saldo
    console.log('\n💳 Verificando saldo...');
    const balance = await billing.getCurrentBalance(testOrgId);
    console.log('Saldo atual:', balance);

    // 3. Processar cobrança
    console.log('\n⚡ Processando cobrança...');
    const billingResult = await billing.processMessageBilling(
      testMessageId,
      testOrgId,
      testContent
    );
    console.log('Resultado da cobrança:', billingResult);

    // 4. Obter estatísticas
    console.log('\n📊 Obtendo estatísticas...');
    const stats = await billing.getBillingStats(testOrgId);
    console.log('Estatísticas:', stats);

    // 5. Obter histórico
    console.log('\n📋 Obtendo histórico...');
    const history = await billing.getBillingHistory(testOrgId, 10);
    console.log('Histórico:', history);

    console.log('\n✅ Teste concluído com sucesso!');

  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

// Exportar para uso em outros módulos
module.exports = {
  BillingSystem,
  checkBalance,
  testBillingSystem
};

// Executar teste se chamado diretamente
if (require.main === module) {
  testBillingSystem();
}

// =====================================================
// INSTRUÇÕES DE USO:
// 
// 1. Execute o SQL no painel do Supabase (setup-billing-system.sql)
// 2. Instale as dependências: npm install @supabase/supabase-js dotenv
// 3. Configure as variáveis de ambiente no .env
// 4. Importe e use a classe BillingSystem no seu código
// 5. Use o middleware checkBalance nas rotas que precisam de cobrança
// 6. Teste com: node billing-integration.js
// =====================================================