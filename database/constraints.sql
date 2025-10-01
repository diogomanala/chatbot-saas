-- PATCH C - "Guarda de banco" (Postgres/Supabase)
-- Impede estados inválidos mesmo se alguém errar no código.

-- 1) Não permitir 'debited' com tokens_used = 0
ALTER TABLE messages 
ADD CONSTRAINT messages_tokens_positive_on_debited_ck 
CHECK ( 
  NOT (billing_status IN ('debited','completed') AND COALESCE(tokens_used,0)=0) 
);

-- 2) Não permitir 'pending' se tokens_used já for > 0 (evita "pendência eterna")
CREATE OR REPLACE FUNCTION prevent_pending_with_tokens() 
RETURNS trigger AS $$ 
BEGIN 
  IF NEW.direction = 'outbound' 
     AND COALESCE(NEW.tokens_used,0) > 0 
     AND NEW.billing_status = 'pending' THEN 
    RAISE EXCEPTION 'Mensagem % não pode ficar pending com tokens_used > 0', NEW.id; 
  END IF; 
  RETURN NEW; 
END; 
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_pending_with_tokens ON messages;
CREATE TRIGGER trg_prevent_pending_with_tokens 
BEFORE INSERT OR UPDATE ON messages 
FOR EACH ROW EXECUTE FUNCTION prevent_pending_with_tokens();