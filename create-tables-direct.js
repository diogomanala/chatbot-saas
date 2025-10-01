require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTablesDirect() {
  console.log('=== CRIANDO TABELAS DIRETAMENTE ===\n');
  
  try {
    console.log('IMPORTANTE: Execute os seguintes comandos SQL no painel do Supabase:');
    console.log('1. Acesse: https://supabase.com/dashboard');
    console.log('2. Selecione seu projeto');
    console.log('3. Vá para "SQL Editor"');
    console.log('4. Execute cada comando abaixo:\n');
    
    console.log('-- COMANDO 1: Criar tabela message_billing');
    console.log(`CREATE TABLE IF NOT EXISTS message_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL,
  org_id TEXT NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  credits_charged DECIMAL(10,4) NOT NULL DEFAULT 0,
  billing_status TEXT NOT NULL DEFAULT 'pending' CHECK (billing_status IN ('pending', 'charged', 'failed')),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`);
    
    console.log('\n-- COMANDO 2: Criar índices para message_billing');
    console.log(`CREATE INDEX IF NOT EXISTS idx_message_billing_org_id ON message_billing(org_id);
CREATE INDEX IF NOT EXISTS idx_message_billing_status ON message_billing(billing_status);
CREATE INDEX IF NOT EXISTS idx_message_billing_message_id ON message_billing(message_id);`);
    
    console.log('\n-- COMANDO 3: Criar tabela organization_credits');
    console.log(`CREATE TABLE IF NOT EXISTS organization_credits (
  id SERIAL PRIMARY KEY,
  org_id TEXT NOT NULL UNIQUE,
  balance DECIMAL(10,4) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`);
    
    console.log('\n-- COMANDO 4: Criar índice para organization_credits');
    console.log(`CREATE INDEX IF NOT EXISTS idx_organization_credits_org_id ON organization_credits(org_id);`);
    
    console.log('\n-- COMANDO 5: Inserir saldo inicial');
    console.log(`INSERT INTO organization_credits (org_id, balance)
VALUES ('3108d984-ed2d-44f3-a742-ca223129c5fa', 1000.0)
ON CONFLICT (org_id) DO NOTHING;`);
    
    console.log('\n=== APÓS EXECUTAR OS COMANDOS ACIMA ===');
    console.log('Execute: node test-new-billing.js');
    
    // Tentar verificar se as tabelas já existem
    console.log('\nVerificando se as tabelas já existem...');
    
    const { data: billingTest, error: billingError } = await supabase
      .from('message_billing')
      .select('count')
      .limit(1);
      
    const { data: creditsTest, error: creditsError } = await supabase
      .from('organization_credits')
      .select('count')
      .limit(1);
    
    if (!billingError) {
      console.log('✅ Tabela message_billing já existe');
    } else {
      console.log('❌ Tabela message_billing não existe');
    }
    
    if (!creditsError) {
      console.log('✅ Tabela organization_credits já existe');
    } else {
      console.log('❌ Tabela organization_credits não existe');
    }
    
  } catch (error) {
    console.error('Erro:', error);
  }
}

createTablesDirect().catch(console.error);