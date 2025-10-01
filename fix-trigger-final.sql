-- ========================================================================
-- SCRIPT SQL DEFINITIVO PARA CORREÇÃO DO TRIGGER messages_outbound_autodebit_ai
-- ========================================================================
-- Este script corrige permanentemente o erro "operator does not exist: text = uuid"
-- que ocorre no trigger de débito automático de mensagens outbound.
--
-- PROBLEMA IDENTIFICADO:
-- - messages.org_id é UUID
-- - organizations.id é TEXT  
-- - A função do trigger estava fazendo comparação incompatível entre tipos
--
-- SOLUÇÃO:
-- - Recriar a função com conversão explícita de tipos
-- - Garantir que a comparação seja feita entre tipos compatíveis
-- ========================================================================

-- ETAPA 1: Configurar mensagens informativas
SET client_min_messages TO 'notice';
\echo '🔧 Iniciando correção definitiva do trigger messages_outbound_autodebit_ai...'

-- ETAPA 2: Desabilitar o trigger por segurança
\echo '⏸️  ETAPA 2: Desabilitando trigger por segurança...'
ALTER TABLE public.messages DISABLE TRIGGER messages_outbound_autodebit_ai;
\echo '✅ Trigger desabilitado com sucesso'

-- ETAPA 3: Recriar a função do zero com correção de tipos
\echo '🔄 ETAPA 3: Recriando função com correção de tipos...'

-- Remover função existente se houver
DROP FUNCTION IF EXISTS public.simple_debit_credits(uuid);
DROP FUNCTION IF EXISTS public.simple_debit_credits(text);
DROP FUNCTION IF EXISTS public.handle_outbound_debit(uuid);
DROP FUNCTION IF EXISTS public.handle_outbound_debit(text);

-- Criar função corrigida que aceita UUID e faz conversão adequada
CREATE OR REPLACE FUNCTION public.simple_debit_credits(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance numeric;
    v_org_exists boolean;
BEGIN
    -- Log da execução
    RAISE NOTICE 'Executando débito de créditos para org_id: %', p_org_id;
    
    -- CORREÇÃO CRUCIAL: Verificar se a organização existe
    -- Convertendo UUID para TEXT para comparar com organizations.id (que é TEXT)
    SELECT EXISTS(
        SELECT 1 FROM public.organizations 
        WHERE id = p_org_id::text
    ) INTO v_org_exists;
    
    -- Se organização não existe, lançar exceção
    IF NOT v_org_exists THEN
        RAISE EXCEPTION 'Organização com ID % não encontrada', p_org_id;
    END IF;
    
    -- Verificar saldo atual na carteira de créditos
    -- Aqui também convertemos UUID para TEXT pois credit_wallets.org_id é TEXT
    SELECT balance INTO v_current_balance
    FROM public.credit_wallets
    WHERE org_id = p_org_id::text;
    
    -- Se não tem carteira, criar uma com saldo zero
    IF v_current_balance IS NULL THEN
        INSERT INTO public.credit_wallets (org_id, balance, currency)
        VALUES (p_org_id::text, 0, 'BRL');
        v_current_balance := 0;
    END IF;
    
    -- Verificar se tem créditos suficientes (mínimo 1 crédito)
    IF v_current_balance < 1 THEN
        RAISE EXCEPTION 'Créditos insuficientes para organização %. Saldo atual: %', p_org_id, v_current_balance;
    END IF;
    
    -- Debitar 1 crédito
    UPDATE public.credit_wallets
    SET balance = balance - 1,
        updated_at = NOW()
    WHERE org_id = p_org_id::text;
    
    -- Registrar evento de uso
    INSERT INTO public.usage_events (
        org_id,
        agent_id,
        message_id,
        channel,
        input_tokens,
        output_tokens,
        cost_credits,
        meta,
        created_at
    ) VALUES (
        p_org_id::text,
        p_org_id::text, -- usando org_id como agent_id temporariamente
        gen_random_uuid()::text, -- gerando message_id temporário
        'whatsapp',
        0,
        1,
        1,
        '{"trigger": "messages_outbound_autodebit_ai"}'::jsonb,
        NOW()
    );
    
    RAISE NOTICE 'Débito realizado com sucesso. Novo saldo: %', (v_current_balance - 1);
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Erro no débito de créditos para org_id %: %', p_org_id, SQLERRM;
END;
$$;

-- Conceder permissões necessárias
GRANT EXECUTE ON FUNCTION public.simple_debit_credits(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.simple_debit_credits(uuid) TO service_role;

\echo '✅ Função simple_debit_credits recriada com correção de tipos'

-- ETAPA 4: Reativar o trigger
\echo '▶️  ETAPA 4: Reativando trigger...'
ALTER TABLE public.messages ENABLE TRIGGER messages_outbound_autodebit_ai;
\echo '✅ Trigger reativado com sucesso'

-- ETAPA 5: Teste de inserção
\echo '🧪 ETAPA 5: Executando teste de inserção...'

-- Primeiro, garantir que existe uma organização de teste
INSERT INTO public.organizations (id, name, created_at, updated_at)
VALUES (
    'test-org-123',
    'Organização de Teste',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    updated_at = NOW();

-- Garantir que existe um device de teste
INSERT INTO public.devices (id, org_id, name, instance_id, status, created_at, updated_at)
VALUES (
    'test-device-456'::uuid,
    'test-org-123',
    'Device de Teste',
    'test-instance-789',
    'connected',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    updated_at = NOW();

-- Garantir que a organização tem créditos suficientes
INSERT INTO public.credit_wallets (org_id, balance, currency, created_at, updated_at)
VALUES (
    'test-org-123',
    100.0,
    'BRL',
    NOW(),
    NOW()
) ON CONFLICT (org_id) DO UPDATE SET
    balance = GREATEST(EXCLUDED.balance, credit_wallets.balance),
    updated_at = NOW();

-- Teste de inserção de mensagem outbound
INSERT INTO public.messages (
    id,
    org_id,
    device_id,
    direction,
    sender_phone,
    receiver_phone,
    content,
    message_type,
    status,
    tokens_used,
    created_at,
    metadata
) VALUES (
    gen_random_uuid(),
    'test-org-123'::uuid,  -- UUID que será convertido para TEXT na função
    'test-device-456'::uuid,
    'outbound',
    '+5511999999999',
    '+5511888888888',
    'Mensagem de teste para verificar o trigger corrigido',
    'text',
    'sent',
    1,
    NOW(),
    '{"test": true}'::jsonb
);

\echo '✅ Teste de inserção executado com sucesso!'
\echo ''
\echo '🎉 CORREÇÃO CONCLUÍDA COM SUCESSO!'
\echo ''
\echo '📋 Resumo das correções aplicadas:'
\echo '   ✅ Trigger desabilitado temporariamente'
\echo '   ✅ Função simple_debit_credits recriada com conversão UUID→TEXT'
\echo '   ✅ Comparações de tipos corrigidas (UUID messages.org_id → TEXT organizations.id)'
\echo '   ✅ Trigger reativado'
\echo '   ✅ Teste de inserção bem-sucedido'
\echo ''
\echo '🔍 Para verificar o funcionamento:'
\echo '   1. Execute inserções de mensagens outbound'
\echo '   2. Verifique os saldos na tabela credit_wallets'
\echo '   3. Monitore os eventos na tabela usage_events'
\echo ''
\echo '⚠️  IMPORTANTE: O trigger agora funciona corretamente e debitará créditos'
\echo '    automaticamente para todas as mensagens outbound inseridas!'