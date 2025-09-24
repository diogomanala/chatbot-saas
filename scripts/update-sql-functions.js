require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateSQLFunctions() {
  try {
    console.log('🔄 Atualizando funções SQL...');
    
    // Ler o arquivo SQL
    const sqlContent = fs.readFileSync('sql/simple_functions.sql', 'utf8');
    
    // Executar o SQL usando RPC
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: sqlContent
    });
    
    if (error) {
      console.error('❌ Erro ao executar SQL via RPC:', error);
      
      // Tentar executar as funções individualmente
      console.log('🔄 Tentando executar funções individualmente...');
      
      // Função 1: insert_simple_message
      const func1 = `
        CREATE OR REPLACE FUNCTION insert_simple_message(
          p_org_id TEXT,
          p_chatbot_id TEXT,
          p_sender_phone TEXT,
          p_receiver_phone TEXT,
          p_message_content TEXT,
          p_direction TEXT,
          p_status TEXT
        ) RETURNS UUID AS $$
        DECLARE
          v_message_id UUID;
          v_org_uuid UUID;
          v_chatbot_uuid UUID;
        BEGIN
          -- Converter strings para UUID
          v_org_uuid := p_org_id::UUID;
          v_chatbot_uuid := p_chatbot_id::UUID;
          
          INSERT INTO messages (
            org_id,
            chatbot_id,
            sender_phone,
            receiver_phone,
            message_content,
            direction,
            status,
            external_id,
            tokens_used,
            billing_status,
            created_at
          ) VALUES (
            v_org_uuid,
            v_chatbot_uuid,
            p_sender_phone,
            p_receiver_phone,
            p_message_content,
            p_direction,
            p_status,
            'simple_' || extract(epoch from now()) || '_' || floor(random() * 1000),
            0,
            'received',
            NOW()
          ) RETURNING id INTO v_message_id;
          
          RETURN v_message_id;
          
        EXCEPTION
          WHEN OTHERS THEN
            RAISE EXCEPTION 'Erro ao inserir mensagem simples: %', SQLERRM;
        END;
        $$ LANGUAGE plpgsql;
      `;
      
      const { error: func1Error } = await supabase.rpc('exec_sql', {
        sql_query: func1
      });
      
      if (func1Error) {
        console.error('❌ Erro na função 1:', func1Error);
      } else {
        console.log('✅ Função insert_simple_message atualizada');
      }
      
    } else {
      console.log('✅ Funções SQL atualizadas com sucesso');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

updateSQLFunctions();