require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addUniqueIdentifierColumn() {
  try {
    console.log('🔧 Adicionando coluna unique_identifier na tabela devices...');
    
    // Executar SQL para adicionar a coluna
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'devices' AND column_name = 'unique_identifier'
          ) THEN
            ALTER TABLE devices ADD COLUMN unique_identifier TEXT;
            CREATE INDEX IF NOT EXISTS idx_devices_unique_identifier ON devices(unique_identifier);
          END IF;
        END $$;
      `
    });
    
    if (error) {
      console.error('❌ Erro ao adicionar coluna:', error);
      
      // Tentar método alternativo usando SQL direto
      console.log('🔄 Tentando método alternativo...');
      const { error: altError } = await supabase
        .from('devices')
        .select('unique_identifier')
        .limit(1);
      
      if (altError && altError.message.includes('column "unique_identifier" does not exist')) {
        console.log('⚠️  Coluna unique_identifier não existe. Você precisa adicioná-la manualmente no Supabase:');
        console.log('   1. Acesse o painel do Supabase');
        console.log('   2. Vá para Table Editor > devices');
        console.log('   3. Adicione uma nova coluna:');
        console.log('      - Nome: unique_identifier');
        console.log('      - Tipo: text');
        console.log('      - Nullable: true');
        console.log('   4. Execute o script create-chatbot-identifier.js novamente');
        return;
      } else {
        console.log('✅ Coluna unique_identifier já existe!');
      }
    } else {
      console.log('✅ Coluna unique_identifier adicionada com sucesso!');
    }
    
    // Verificar se a coluna existe
    const { data: testData, error: testError } = await supabase
      .from('devices')
      .select('id, unique_identifier')
      .limit(1);
    
    if (testError) {
      console.error('❌ Erro ao verificar coluna:', testError);
    } else {
      console.log('✅ Coluna unique_identifier está disponível!');
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

addUniqueIdentifierColumn();