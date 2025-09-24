const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    }
  }
);

async function createCreditWallet() {
  try {
    console.log('Verificando carteira existente para TitecWeb Admin...');
    
    const orgId = '3108d984-ed2d-44f3-a742-ca223129c5fa';
    
    // Primeiro verificar se já existe uma carteira
    const { data: existingWallet, error: checkError } = await supabase
      .from('credit_wallets')
      .select('*')
      .eq('org_id', orgId)
      .single();
    
    if (existingWallet) {
      console.log('Carteira já existe:', existingWallet);
      return existingWallet;
    }
    
    console.log('Criando nova carteira de créditos...');
    
    // Dados da carteira
    const walletData = {
      org_id: orgId,
      balance: 1000.00,
      currency: 'BRL'
    };
    
    // Tentar inserir com bypass de RLS usando service role
    const { data, error } = await supabase
      .from('credit_wallets')
      .insert(walletData)
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao criar carteira:', error);
      throw error;
    }
    
    console.log('Carteira criada com sucesso:', data);
    return data;
    
  } catch (error) {
    console.error('Erro ao criar carteira:', error);
    throw error;
  }
}

// Executar a função
createCreditWallet()
  .then(() => {
    console.log('Processo concluído com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Falha no processo:', error);
    process.exit(1);
  });