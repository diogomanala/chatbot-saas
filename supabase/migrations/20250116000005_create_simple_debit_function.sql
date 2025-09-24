-- Create a simple debit function that works with local database
CREATE OR REPLACE FUNCTION simple_debit_credits(
  p_org_id TEXT,
  p_agent_id TEXT,
  p_input_tokens INTEGER,
  p_output_tokens INTEGER,
  p_cost_credits NUMERIC,
  p_channel TEXT,
  p_message_id TEXT DEFAULT NULL,
  p_meta TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  current_balance NUMERIC;
  new_balance NUMERIC;
  usage_event_id UUID;
  result JSON;
BEGIN
  -- Get current balance
  SELECT balance INTO current_balance
  FROM credit_wallets
  WHERE org_id = p_org_id;
  
  -- Check if wallet exists
  IF current_balance IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Credit wallet not found'
    );
  END IF;
  
  -- Check sufficient balance
  IF current_balance < p_cost_credits THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Insufficient credits'
    );
  END IF;
  
  -- Calculate new balance
  new_balance := current_balance - p_cost_credits;
  
  -- Update wallet balance
  UPDATE credit_wallets
  SET balance = new_balance,
      updated_at = NOW()
  WHERE org_id = p_org_id;
  
  -- Create usage event
  INSERT INTO usage_events (
    org_id,
    agent_id,
    channel,
    input_tokens,
    output_tokens,
    cost_credits,
    message_id,
    meta
  ) VALUES (
    p_org_id,
    p_agent_id,
    p_channel,
    p_input_tokens,
    p_output_tokens,
    p_cost_credits,
    p_message_id,
    p_meta::jsonb
  ) RETURNING id INTO usage_event_id;
  
  -- Return success result
  RETURN json_build_object(
    'success', true,
    'message', 'Credits debited successfully',
    'remaining_balance', new_balance,
    'usage_event_id', usage_event_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error: ' || SQLERRM
    );
END;
$$;