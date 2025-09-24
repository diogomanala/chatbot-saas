const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTableColumns() {
    console.log('🔍 Verificando colunas da tabela system_alerts...');
    
    try {
        // Fazer uma consulta SELECT * para ver quais colunas existem
        const { data, error } = await supabase
            .from('system_alerts')
            .select('*')
            .limit(1);
            
        if (error) {
            console.log('❌ Erro ao consultar tabela:', error.message);
            
            // Se o erro menciona colunas específicas, vamos tentar descobrir quais existem
            console.log('\n🔍 Tentando descobrir a estrutura atual...');
            
            // Tentar colunas básicas uma por uma
            const possibleColumns = ['id', 'type', 'severity', 'title', 'message', 'source', 'resolved', 'created_at', 'updated_at'];
            const existingColumns = [];
            
            for (const column of possibleColumns) {
                try {
                    const { error: colError } = await supabase
                        .from('system_alerts')
                        .select(column)
                        .limit(1);
                        
                    if (!colError) {
                        existingColumns.push(column);
                        console.log(`✅ Coluna '${column}' existe`);
                    } else {
                        console.log(`❌ Coluna '${column}' não existe`);
                    }
                } catch (e) {
                    console.log(`❌ Coluna '${column}' não existe`);
                }
            }
            
            console.log('\n📊 Colunas encontradas:', existingColumns.join(', '));
            
            const requiredColumns = ['id', 'type', 'severity', 'title', 'message', 'source', 'resolved', 'created_at'];
            const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
            
            if (missingColumns.length > 0) {
                console.log('\n❌ Colunas obrigatórias ausentes:', missingColumns.join(', '));
                console.log('\n🔧 SOLUÇÃO NECESSÁRIA:');
                console.log('A tabela system_alerts existe mas não tem a estrutura correta.');
                console.log('\n📋 Passos para corrigir:');
                console.log('1. Abra o Supabase Dashboard: https://supabase.com/dashboard');
                console.log('2. Vá para seu projeto e clique em "SQL Editor"');
                console.log('3. Execute este comando para remover a tabela atual:');
                console.log('   DROP TABLE IF EXISTS public.system_alerts CASCADE;');
                console.log('4. Cole e execute o conteúdo completo do arquivo:');
                console.log('   scripts/create-system-alerts-table.sql');
            }
            
        } else {
            console.log('✅ Consulta bem-sucedida!');
            
            if (data && data.length > 0) {
                console.log('\n📊 Estrutura da tabela (baseada no primeiro registro):');
                const columns = Object.keys(data[0]);
                columns.forEach(col => {
                    console.log(`  - ${col}: ${typeof data[0][col]}`);
                });
            } else {
                console.log('\n📊 Tabela vazia, mas estrutura parece correta');
                console.log('\n✅ Pronto para criar alertas de teste!');
            }
        }
        
    } catch (error) {
        console.error('❌ Erro inesperado:', error.message);
    }
}

async function main() {
    console.log('🚀 Diagnóstico detalhado da tabela system_alerts\n');
    
    await checkTableColumns();
    
    console.log('\n✅ Diagnóstico concluído');
}

main().catch(console.error);