-- Tabela de idempotência simples
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key text PRIMARY KEY,
  created_at timestamptz DEFAULT now()
);

-- RPC transacional: DEBITA + FINALIZA MENSAGEM
CREATE OR REPLACE FUNCTION perform_outbound_debit(
  p_message_id uuid,
  p_org_id uuid,
  p_tokens_used integer,
  p_idem_key text
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_used int := GREATEST(COALESCE(p_tokens_used,0), 50);
  v_new_idem boolean := false;
BEGIN
  -- idempotência
  INSERT INTO idempotency_keys(key) VALUES (p_idem_key)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_new_idem = ROW_COUNT > 0;

  IF NOT v_new_idem THEN
    -- já processado
    RETURN;
  END IF;

  -- trava a mensagem
  PERFORM 1 FROM messages WHERE id = p_message_id AND org_id = p_org_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mensagem % não encontrada para org %', p_message_id, p_org_id;
  END IF;

  -- DEBITAR CRÉDITOS (usando a função existente)
  PERFORM simple_debit_credits(p_org_id, v_used);

  -- FINALIZAR mensagem na MESMA transação
  UPDATE messages
     SET tokens_used   = v_used,
         billing_status= 'debited',
         billed_at     = now()
   WHERE id = p_message_id;

END
$$;