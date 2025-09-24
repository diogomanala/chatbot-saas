-- Função para inserir mensagem simples (evita conflitos UUID)
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

-- Função para inserir mensagem e debitar créditos (transação atômica)
CREATE OR REPLACE FUNCTION insert_message_and_debit(
  p_org_id TEXT,
  p_chatbot_id TEXT,
  p_sender_phone TEXT,
  p_receiver_phone TEXT,
  p_message_content TEXT,
  p_direction TEXT,
  p_status TEXT,
  p_credits_to_debit INTEGER
) RETURNS UUID AS $$
DECLARE
  v_message_id UUID;
  v_org_uuid UUID;
  v_chatbot_uuid UUID;
  v_current_credits INTEGER;
BEGIN
  -- Converter strings para UUID
  v_org_uuid := p_org_id::UUID;
  v_chatbot_uuid := p_chatbot_id::UUID;
  
  -- Verificar créditos disponíveis
  SELECT credits INTO v_current_credits 
  FROM organizations 
  WHERE id = v_org_uuid;
  
  IF v_current_credits < p_credits_to_debit THEN
    RAISE EXCEPTION 'Créditos insuficientes. Disponível: %, Necessário: %', v_current_credits, p_credits_to_debit;
  END IF;
  
  -- Inserir mensagem
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
    'debit_' || extract(epoch from now()) || '_' || floor(random() * 1000),
    p_credits_to_debit,
    'processed',
    NOW()
  ) RETURNING id INTO v_message_id;
  
  -- Debitar créditos
  UPDATE organizations 
  SET credits = credits - p_credits_to_debit,
      updated_at = NOW()
  WHERE id = v_org_uuid;
  
  RETURN v_message_id;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao inserir mensagem e debitar créditos: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;