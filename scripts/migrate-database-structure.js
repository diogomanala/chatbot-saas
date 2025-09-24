const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrateDatabaseStructure() {
  console.log('🔧 [MIGRATION] Iniciando migração da estrutura do banco...');
  
  try {
    // 1. Adicionar colunas necessárias na tabela devices
    console.log('\n📋 [DEVICES-MIGRATION] Adicionando colunas necessárias...');
    
    const deviceMigrations = [
      {
        column: 'instance_id',
        type: 'TEXT UNIQUE',
        description: 'ID único da instância Evolution'
      },
      {
        column: 'phone_jid',
        type: 'TEXT',
        description: 'JID do telefone WhatsApp'
      },
      {
        column: 'config',
        type: 'JSONB DEFAULT \'{}\'::\:jsonb',
        description: 'Configurações do device'
      }
    ];
    
    for (const migration of deviceMigrations) {
      console.log(`🔧 [ADD-COLUMN] Adicionando ${migration.column}...`);
      
      const { error } = await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE devices ADD COLUMN IF NOT EXISTS ${migration.column} ${migration.type};`
      });
      
      if (error) {
        console.error(`❌ [MIGRATION-ERROR] Erro ao adicionar ${migration.column}:`, error.message);
      } else {
        console.log(`✅ [MIGRATION-OK] Coluna ${migration.column} adicionada`);
      }
    }
    
    // 2. Criar índices para performance
    console.log('\n📊 [INDEXES] Criando índices...');
    
    const indexes = [
      {
        name: 'idx_devices_instance_id',
        sql: 'CREATE INDEX IF NOT EXISTS idx_devices_instance_id ON devices(instance_id);'
      },
      {
        name: 'idx_devices_session_name',
        sql: 'CREATE INDEX IF NOT EXISTS idx_devices_session_name ON devices(session_name);'
      },
      {
        name: 'idx_devices_org_id',
        sql: 'CREATE INDEX IF NOT EXISTS idx_devices_org_id ON devices(org_id);'
      },
      {
        name: 'idx_chatbots_is_default',
        sql: 'CREATE INDEX IF NOT EXISTS idx_chatbots_is_default ON chatbots(is_default) WHERE is_default = true;'
      }
    ];
    
    for (const index of indexes) {
      console.log(`📊 [INDEX] Criando ${index.name}...`);
      
      const { error } = await supabase.rpc('exec_sql', {
        sql: index.sql
      });
      
      if (error) {
        console.error(`❌ [INDEX-ERROR] Erro ao criar ${index.name}:`, error.message);
      } else {
        console.log(`✅ [INDEX-OK] Índice ${index.name} criado`);
      }
    }
    
    // 3. Verificar se existe pelo menos um chatbot default
    console.log('\n🤖 [DEFAULT-CHATBOT] Verificando chatbot default...');
    
    const { data: defaultChatbots } = await supabase
      .from('chatbots')
      .select('id, name')
      .eq('is_default', true)
      .eq('is_active', true);
    
    if (!defaultChatbots || defaultChatbots.length === 0) {
      console.log('⚠️ [DEFAULT-CHATBOT] Nenhum chatbot default ativo encontrado');
      
      // Buscar o primeiro chatbot ativo para tornar default
      const { data: activeChatbots } = await supabase
        .from('chatbots')
        .select('id, name')
        .eq('is_active', true)
        .limit(1);
      
      if (activeChatbots && activeChatbots.length > 0) {
        const chatbot = activeChatbots[0];
        
        const { error: updateError } = await supabase
          .from('chatbots')
          .update({ is_default: true })
          .eq('id', chatbot.id);
        
        if (updateError) {
          console.error('❌ [DEFAULT-CHATBOT-ERROR]', updateError.message);
        } else {
          console.log(`✅ [DEFAULT-CHATBOT-OK] Chatbot '${chatbot.name}' definido como default`);
        }
      } else {
        console.error('❌ [DEFAULT-CHATBOT-ERROR] Nenhum chatbot ativo encontrado');
      }
    } else {
      console.log(`✅ [DEFAULT-CHATBOT-OK] ${defaultChatbots.length} chatbot(s) default encontrado(s)`);
    }
    
    // 4. Migrar session_name para instance_id onde necessário
    console.log('\n🔄 [DATA-MIGRATION] Migrando dados existentes...');
    
    const { data: devicesWithoutInstanceId } = await supabase
      .from('devices')
      .select('id, session_name, instance_id')
      .is('instance_id', null)
      .not('session_name', 'is', null);
    
    if (devicesWithoutInstanceId && devicesWithoutInstanceId.length > 0) {
      console.log(`🔄 [DATA-MIGRATION] Migrando ${devicesWithoutInstanceId.length} devices...`);
      
      for (const device of devicesWithoutInstanceId) {
        const { error: updateError } = await supabase
          .from('devices')
          .update({ instance_id: device.session_name })
          .eq('id', device.id);
        
        if (updateError) {
          console.error(`❌ [DATA-MIGRATION-ERROR] Device ${device.id}:`, updateError.message);
        } else {
          console.log(`✅ [DATA-MIGRATION-OK] Device ${device.id} migrado`);
        }
      }
    } else {
      console.log('✅ [DATA-MIGRATION-OK] Nenhuma migração de dados necessária');
    }
    
    console.log('\n🎉 [MIGRATION-COMPLETE] Migração concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ [MIGRATION-ERROR] Erro durante migração:', error);
    process.exit(1);
  }
}

// Executar migração
migrateDatabaseStructure();