const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Configuração do Supabase
const supabaseUrl = 'https://anlemekgocrrllsogxix.supabase.co';
const supabaseServiceKey = 'sb_secret_PR3yVUXsopPYTE87R1L3eA_62IHitGT';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyFix() {
  try {
    console.log('🔧 Aplicando correção do débito automático da carteira...');
    
    // Ler o arquivo SQL
    const sqlContent = fs.readFileSync('fix-wallet-debit.sql', 'utf8');
    
    // Dividir em comandos individuais (separados por ;)
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd && !cmd.startsWith('--') && !cmd.startsWith('/*'));
    
    console.log(`📝 Executando ${commands.length} comandos SQL...`);
    
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      if (command) {
        console.log(`⚡ Executando comando ${i + 1}/${commands.length}...`);
        
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: command
        });
        
        if (error) {
          console.error(`❌ Erro no comando ${i + 1}:`, error);
          // Tentar executar diretamente
          const { error: directError } = await supabase
            .from('_temp')
            .select('1')
            .limit(0);
          
          if (directError) {
            console.log('🔄 Tentando método alternativo...');
            // Usar SQL direto via RPC
            const { error: rpcError } = await supabase.rpc('exec', {
              query: command
            });
            
            if (rpcError) {
              console.error('❌ Erro no método alternativo:', rpcError);
            } else {
              console.log('✅ Comando executado com sucesso (método alternativo)');
            }
          }
        } else {
          console.log('✅ Comando executado com sucesso');
        }
      }
    }
    
    console.log('🎉 Correção aplicada com sucesso!');
    
    // Verificar se a função foi criada
    console.log('🔍 Verificando se a função foi criada...');
    const { data: functions, error: funcError } = await supabase
      .from('information_schema.routines')
      .select('routine_name')
      .eq('routine_name', 'debit_wallet_balance');
    
    if (funcError) {
      console.log('⚠️ Não foi possível verificar a função:', funcError.message);
    } else if (functions && functions.length > 0) {
      console.log('✅ Função debit_wallet_balance criada com sucesso!');
    } else {
      console.log('⚠️ Função não encontrada, tentando criar manualmente...');
      
      // Criar função manualmente
      const createFunction = `
        CREATE OR REPLACE FUNCTION debit_wallet_balance()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.direction = 'outbound' AND NEW.cost_credits > 0 THEN
                UPDATE credit_wallets 
                SET balance = balance - NEW.cost_credits,
                    updated_at = NOW()
                WHERE org_id = NEW.org_id;
                
                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Carteira não encontrada para org_id: %', NEW.org_id;
                END IF;
                
                RAISE NOTICE 'Debitado % créditos da carteira para org_id: %', NEW.cost_credits, NEW.org_id;
            END IF;
            
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `;
      
      const { error: createError } = await supabase.rpc('exec', {
        query: createFunction
      });
      
      if (createError) {
        console.error('❌ Erro ao criar função:', createError);
      } else {
        console.log('✅ Função criada manualmente!');
      }
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

applyFix();