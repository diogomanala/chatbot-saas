const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variáveis de ambiente do Supabase não encontradas');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Função para criar alerta usando SQL direto
async function createAlertWithSQL(alertData) {
    const { type, severity, title, message, source, metadata } = alertData;
    
    try {
        const { data, error } = await supabase.rpc('create_system_alert', {
            p_type: type,
            p_severity: severity,
            p_title: title,
            p_message: message,
            p_source: source,
            p_metadata: metadata || {}
        });
        
        if (error) {
            // Se a função não existe, vamos tentar inserção direta
            console.log('⚠️  Função RPC não encontrada, tentando inserção direta...');
            
            const { data: insertData, error: insertError } = await supabase
                .from('system_alerts')
                .insert({
                    type: type,
                    severity: severity,
                    title: title,
                    message: message,
                    source: source,
                    metadata: metadata || {},
                    resolved: false
                })
                .select();
                
            if (insertError) {
                throw insertError;
            }
            
            return insertData;
        }
        
        return data;
        
    } catch (error) {
        throw error;
    }
}

// Função alternativa usando query SQL raw
async function createAlertWithRawSQL(alertData) {
    const { type, severity, title, message, source, metadata } = alertData;
    
    const query = `
        INSERT INTO public.system_alerts (type, severity, title, message, source, metadata, resolved)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
    `;
    
    try {
        const { data, error } = await supabase.rpc('execute_sql', {
            query: query,
            params: [type, severity, title, message, source, JSON.stringify(metadata || {}), false]
        });
        
        if (error) {
            throw error;
        }
        
        return data;
        
    } catch (error) {
        throw error;
    }
}

async function createTestAlert() {
    console.log('📝 Criando alerta de teste para o dashboard...');
    
    const alertData = {
        type: 'system',
        severity: 'medium',
        title: 'Teste de Alerta do Sistema',
        message: 'Este é um alerta de teste criado automaticamente para verificar o funcionamento do painel de alertas.',
        source: 'test-script',
        metadata: {
            test: true,
            created_by: 'test-script',
            timestamp: new Date().toISOString()
        }
    };
    
    try {
        // Tentar método 1: Inserção direta
        console.log('🔄 Tentativa 1: Inserção direta...');
        const { data, error } = await supabase
            .from('system_alerts')
            .insert([alertData])
            .select();
            
        if (error) {
            console.log('❌ Método 1 falhou:', error.message);
            
            // Tentar método 2: Sem especificar colunas explicitamente
            console.log('🔄 Tentativa 2: Inserção simplificada...');
            const simpleData = {
                type: alertData.type,
                severity: alertData.severity,
                title: alertData.title,
                message: alertData.message,
                source: alertData.source
            };
            
            const { data: data2, error: error2 } = await supabase
                .from('system_alerts')
                .insert(simpleData)
                .select();
                
            if (error2) {
                console.log('❌ Método 2 falhou:', error2.message);
                throw error2;
            }
            
            console.log('✅ Alerta criado com método simplificado');
            return data2;
        }
        
        console.log('✅ Alerta criado com sucesso');
        return data;
        
    } catch (error) {
        console.error('❌ Erro ao criar alerta:', error.message);
        return null;
    }
}

async function createCriticalAlert() {
    console.log('🚨 Criando alerta crítico de teste...');
    
    const alertData = {
        type: 'api_error',
        severity: 'critical',
        title: 'Alerta Crítico - Teste',
        message: 'Este é um alerta crítico de teste para verificar se os alertas de alta prioridade aparecem corretamente no dashboard.',
        source: 'test-script'
    };
    
    try {
        const { data, error } = await supabase
            .from('system_alerts')
            .insert([alertData])
            .select();
            
        if (error) {
            console.error('❌ Erro ao criar alerta crítico:', error.message);
            return null;
        }
        
        console.log('✅ Alerta crítico criado com sucesso');
        return data;
        
    } catch (error) {
        console.error('❌ Erro ao criar alerta crítico:', error.message);
        return null;
    }
}

async function verifyAlerts() {
    console.log('\n🔍 Verificando alertas criados...');
    
    try {
        const { data, error } = await supabase
            .from('system_alerts')
            .select('id, type, severity, title, created_at')
            .order('created_at', { ascending: false })
            .limit(5);
            
        if (error) {
            console.error('❌ Erro ao verificar alertas:', error.message);
            return;
        }
        
        if (data && data.length > 0) {
            console.log('\n📊 Alertas encontrados:');
            data.forEach((alert, index) => {
                console.log(`${index + 1}. [${alert.severity.toUpperCase()}] ${alert.title}`);
                console.log(`   Tipo: ${alert.type} | ID: ${alert.id.substring(0, 8)}...`);
            });
        } else {
            console.log('❌ Nenhum alerta encontrado');
        }
        
    } catch (error) {
        console.error('❌ Erro ao verificar alertas:', error.message);
    }
}

async function main() {
    console.log('🚀 Criando alertas de teste para o dashboard\n');
    
    const alert1 = await createTestAlert();
    const alert2 = await createCriticalAlert();
    
    await verifyAlerts();
    
    console.log('\n============================================================');
    console.log('🎉 Processo de criação de alertas concluído!');
    
    console.log('\n📊 Resumo:');
    console.log(`   ✅ Alerta normal: ${alert1 ? 'Sucesso' : 'Falhou'}`);
    console.log(`   🚨 Alerta crítico: ${alert2 ? 'Sucesso' : 'Falhou'}`);
    
    if (alert1 || alert2) {
        console.log('\n🌐 Acesse o dashboard para visualizar os alertas:');
        console.log('   http://localhost:3000/dashboard');
        console.log('\n💡 Os alertas aparecerão no painel "Alertas do Sistema"');
    } else {
        console.log('\n❌ Nenhum alerta foi criado com sucesso');
        console.log('\n🔧 Possível solução:');
        console.log('Execute o script SQL completo no Supabase SQL Editor:');
        console.log('scripts/create-system-alerts-table.sql');
    }
}

main().catch(console.error);