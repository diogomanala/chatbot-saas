# Guia de Migração: Sistema de Cobrança Baseado em Mensagens

## Visão Geral

Este projeto migrou de um sistema de cobrança em tempo real (DebitInterceptor) para um sistema baseado em mensagens processadas posteriormente. Esta mudança oferece:

- ✅ Melhor performance (sem bloqueio durante chamadas LLM)
- ✅ Maior confiabilidade (processamento assíncrono)
- ✅ Melhor auditoria (histórico completo na tabela messages)
- ✅ Flexibilidade para reprocessamento

## Sistema Antigo vs Novo

### Sistema Antigo (DebitInterceptor)
```typescript
// Cobrança em tempo real durante chamadas LLM
const result = await DebitInterceptor.wrapLLMCall(
  debitContext,
  async () => {
    // Chamada para LLM
    return { response, tokenUsage }
  }
)
```

### Sistema Novo (MessageBillingService)
```typescript
// 1. Salvar mensagem na tabela messages
const message = await saveMessage({
  content,
  tokens_used,
  billing_status: 'pending'
})

// 2. Processar cobrança posteriormente
const result = await messageBillingService.processMessageBilling(messageId)
```

## Componentes Removidos

### DebitInterceptor
- **Arquivo**: `src/lib/debit.interceptor.ts`
- **Função**: Interceptava chamadas LLM para cobrar em tempo real
- **Status**: ❌ REMOVIDO

### Dependências no OpenAI Service
- **Arquivo**: `src/lib/openai-service.ts`
- **Linhas removidas**: Imports e chamadas para DebitInterceptor
- **Status**: ✅ ATUALIZADO

## Novos Componentes

### MessageBillingService
- **Arquivo**: `src/lib/message-billing.service.ts`
- **Função**: Processa cobranças baseadas em mensagens
- **Métodos principais**:
  - `processMessageBilling()` - Cobra mensagem individual
  - `processBatchBilling()` - Cobra múltiplas mensagens
  - `processAllPendingMessages()` - Cobra todas pendentes

### API Endpoints
- **Processamento**: `/api/billing/process-messages`
- **Cron Job**: `/api/cron/process-billing`
- **Estatísticas**: `/api/billing/process-messages` (GET)

### Interface Atualizada
- **Arquivo**: `src/app/dashboard/wallet/page.tsx`
- **Mudanças**:
  - Histórico baseado em mensagens
  - Botão para processar pendentes
  - Estatísticas de mensagens cobradas/pendentes

## Migração de Dados

### Tabela Messages
```sql
-- Campos adicionados
ALTER TABLE messages ADD COLUMN cost_credits DECIMAL(10,6);
ALTER TABLE messages ADD COLUMN charged_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE messages ADD COLUMN billing_status VARCHAR(20) DEFAULT 'pending';

-- Índices para performance
CREATE INDEX idx_messages_billing_status ON messages(billing_status);
CREATE INDEX idx_messages_org_billing ON messages(org_id, billing_status);
CREATE INDEX idx_messages_charged_at ON messages(charged_at);
```

## Como Usar o Novo Sistema

### 1. Processamento Manual
```bash
# Processar todas as mensagens pendentes
curl -X POST http://localhost:3000/api/billing/process-messages \
  -H "Content-Type: application/json" \
  -d '{"process_all": true}'

# Processar mensagens de uma organização específica
curl -X POST http://localhost:3000/api/billing/process-messages \
  -H "Content-Type: application/json" \
  -d '{"org_id": "your-org-id"}'
```

### 2. Processamento Automático (Cron)
```bash
# Configurar cron job (executar a cada 5 minutos)
*/5 * * * * curl -X GET "http://localhost:3000/api/cron/process-billing?secret=your-secret"
```

### 3. Via Interface Web
- Acesse Dashboard → Wallet
- Clique em "Processar Pendentes" para cobrar mensagens pendentes
- Visualize estatísticas e histórico de mensagens

## Variáveis de Ambiente

```env
# Para cron job (opcional)
CRON_SECRET=your-secret-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Monitoramento

### Logs
- `[MessageBillingService]` - Logs do serviço de cobrança
- `[BillingService]` - Logs do serviço de créditos

### Métricas
- Mensagens pendentes: `SELECT COUNT(*) FROM messages WHERE billing_status = 'pending'`
- Mensagens cobradas: `SELECT COUNT(*) FROM messages WHERE billing_status = 'charged'`
- Mensagens com falha: `SELECT COUNT(*) FROM messages WHERE billing_status = 'failed'`

## Rollback (Se Necessário)

Caso precise voltar ao sistema antigo:

1. Restaurar `DebitInterceptor` do git
2. Reverter mudanças no `openai-service.ts`
3. Remover campos da tabela `messages`
4. Restaurar interface da wallet

```sql
-- Remover campos adicionados
ALTER TABLE messages DROP COLUMN cost_credits;
ALTER TABLE messages DROP COLUMN charged_at;
ALTER TABLE messages DROP COLUMN billing_status;
```

## Benefícios da Migração

1. **Performance**: Chamadas LLM não são bloqueadas por cobrança
2. **Confiabilidade**: Falhas de cobrança não impedem respostas
3. **Auditoria**: Histórico completo de todas as mensagens
4. **Flexibilidade**: Reprocessamento e correções possíveis
5. **Escalabilidade**: Processamento em lote mais eficiente

## Suporte

Para dúvidas ou problemas:
1. Verifique os logs da aplicação
2. Consulte as métricas de monitoramento
3. Execute o script de teste: `node setup-billing-cron.js`