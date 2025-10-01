-- =====================================================
-- CORREÇÃO DO TRIGGER QUE CAUSA PERDA DE TOKENS
-- =====================================================
-- Problema: O trigger messages_outbound_autodebit_ai está 
-- sobrescrevendo tokens_used corretos com valores calculados
-- =====================================================

-- VERSÃO CORRIGIDA: Preserva tokens_used se já estiver definido
CREATE OR REPLACE FUNCTION messages_outbound_autodebit_ai()
RETURNS trigger AS $$
DECLARE
  v_used int;
  v_current_tokens int;
BEGIN
  IF NEW.direction = 'outbound'
     AND COALESCE(NEW.billing_status,'pending') IN ('pending','skipped','charged') THEN

    -- CORREÇÃO: Verifica se já tem tokens_used válidos
    SELECT tokens_used INTO v_current_tokens 
    FROM messages 
    WHERE id = NEW.id;
    
    -- Se já tem tokens válidos (>0), usa eles. Senão, calcula.
    IF v_current_tokens IS NOT NULL AND v_current_tokens > 0 THEN
      v_used := v_current_tokens;
      RAISE NOTICE 'Preservando tokens existentes: % para mensagem %', v_used, NEW.id;
    ELSE
      v_used := GREATEST(COALESCE(NEW.tokens_used,0), COALESCE(NEW.tokens_estimated,0), 50);
      RAISE NOTICE 'Calculando novos tokens: % para mensagem %', v_used, NEW.id;
    END IF;

    -- debita créditos
    PERFORM simple_debit_credits(NEW.org_id, v_used);

    -- finaliza mensagem (só atualiza tokens se não tinha antes)
    UPDATE messages
       SET tokens_used    = v_used,
           billing_status = 'debited',
           billed_at      = now()
     WHERE id = NEW.id;
     
    RAISE NOTICE 'Mensagem % processada: % tokens, status: debited', NEW.id, v_used;
  END IF;
  RETURN NULL; -- AFTER trigger ignora retorno
END;
$$ LANGUAGE plpgsql;

-- Recria o trigger
DROP TRIGGER IF EXISTS messages_outbound_autodebit_ai ON messages;
CREATE TRIGGER messages_outbound_autodebit_ai
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION messages_outbound_autodebit_ai();

-- =====================================================
-- SCRIPT DE TESTE E VERIFICAÇÃO
-- =====================================================

-- 1. Verificar mensagens recentes com problema
SELECT 
  id,
  direction,
  billing_status,
  tokens_used,
  tokens_estimated,
  created_at,
  billed_at
FROM messages 
WHERE direction = 'outbound' 
  AND billing_status = 'debited'
  AND tokens_used = 0
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;

-- 2. Estatísticas do problema
SELECT 
  'Mensagens debitadas sem tokens (24h)' as problema,
  COUNT(*) as quantidade
FROM messages 
WHERE direction = 'outbound' 
  AND billing_status = 'debited'
  AND tokens_used = 0
  AND created_at > NOW() - INTERVAL '24 hours';

-- 3. Comparação antes/depois da correção
SELECT 
  DATE_TRUNC('hour', created_at) as hora,
  COUNT(*) as total_mensagens,
  COUNT(CASE WHEN tokens_used = 0 THEN 1 END) as sem_tokens,
  COUNT(CASE WHEN tokens_used > 0 THEN 1 END) as com_tokens,
  ROUND(
    COUNT(CASE WHEN tokens_used = 0 THEN 1 END) * 100.0 / COUNT(*), 
    2
  ) as percentual_sem_tokens
FROM messages 
WHERE direction = 'outbound' 
  AND billing_status = 'debited'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hora DESC;