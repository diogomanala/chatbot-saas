const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuração do Supabase com chave anon
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variáveis de ambiente do Supabase não encontradas');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAlertsTable() {
    console.log('🔍 Verificando se a tabela system_alerts existe...');
    
    try {
        // Tentar fazer uma consulta simples na tabela
        const { data, error } = await supabase
            .from('system_alerts')
            .select('count')
            .limit(1);
            
        if (error) {
            console.log('❌ Erro ao acessar tabela system_alerts:', error.message);
            
            if (error.message.includes('relation "public.system_alerts" does not exist') || 
                error.message.includes('does not exist')) {
                console.log('\n📋 DIAGNÓSTICO: A tabela system_alerts não existe no banco de dados');
                console.log('\n🔧 SOLUÇÃO:');
                console.log('1. Abra o Supabase Dashboard: https://supabase.com/dashboard');
                console.log('2. Vá para seu projeto: anlemekgocrrllsogxix');
                console.log('3. Clique em "SQL Editor" no menu lateral');
                console.log('4. Cole o conteúdo do arquivo: scripts/create-system-alerts-table.sql');
                console.log('5. Clique em "Run" para executar o script');
                console.log('\n📄 O arquivo SQL está localizado em:');
                console.log('   C:\\Users\\diogo\\Local Sites\\saas-chatbot\\scripts\\create-system-alerts-table.sql');
            } else if (error.message.includes('column') && error.message.includes('does not exist')) {
                console.log('\n📋 DIAGNÓSTICO: A tabela existe mas está com estrutura incorreta');
                console.log('\n🔧 SOLUÇÃO:');
                console.log('1. A tabela system_alerts existe mas não tem a estrutura correta');
                console.log('2. Execute o script SQL completo para recriar a tabela:');
                console.log('   - Abra o Supabase SQL Editor');
                console.log('   - Cole o conteúdo de: scripts/create-system-alerts-table.sql');
                console.log('   - Execute o script');
            } else {
                console.log('\n📋 DIAGNÓSTICO: Erro de permissão ou configuração');
                console.log('\n🔧 POSSÍVEIS SOLUÇÕES:');
                console.log('1. Verifique se as chaves do Supabase estão corretas no .env');
                console.log('2. Execute o script SQL diretamente no Supabase SQL Editor');
            }
            return false;
        }
        
        console.log('✅ Tabela system_alerts existe e está acessível');
        
        // Tentar contar registros
        const { count, error: countError } = await supabase
            .from('system_alerts')
            .select('*', { count: 'exact', head: true });
            
        if (countError) {
            console.log('⚠️  Erro ao contar registros:', countError.message);
        } else {
            console.log(`📊 Total de alertas na tabela: ${count || 0}`);
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Erro inesperado:', error.message);
        return false;
    }
}

async function main() {
    console.log('🚀 Verificando configuração da tabela system_alerts\n');
    
    const tableExists = await checkAlertsTable();
    
    if (tableExists) {
        console.log('\n✅ Tabela configurada corretamente!');
        console.log('\n📋 Próximos passos:');
        console.log('1. Execute: node scripts/create-test-alert.js');
        console.log('2. Verifique o dashboard: http://localhost:3000/dashboard');
    } else {
        console.log('\n❌ Tabela precisa ser criada');
        console.log('\n📋 Arquivo SQL pronto para execução:');
        console.log('   scripts/create-system-alerts-table.sql');
    }
}

main().catch(console.error);