# Scripts de Verificação - Sistema de Cobrança

Este diretório contém scripts para verificar e validar o funcionamento correto do sistema de cobrança de mensagens OUTBOUND.

## Scripts Disponíveis

### 1. `inspect-pending.js`
**Objetivo**: Lista mensagens OUTBOUND que estão com `billing_status = 'pending'`

**Como usar**:
```bash
node scripts/inspect-pending.js
```

**O que verifica**:
- Mensagens OUTBOUND pendentes
- Tokens estimados vs tokens usados
- Status de cobrança e entrega
- Identifica mensagens "presas" em pending

### 2. `check-latest-outbound.js`
**Objetivo**: Verifica se as últimas mensagens OUTBOUND estão com status correto

**Como usar**:
```bash
node scripts/check-latest-outbound.js
```

**O que verifica**:
- Últimas 10 mensagens OUTBOUND
- Se `tokens_used > 0`
- Se `billing_status = 'debited'`
- Data de cobrança (`billed_at`)

## Interpretação dos Resultados

### ✅ Status Correto
- `tokens_used > 0`
- `billing_status = 'debited'`
- `billed_at` preenchido

### ❌ Problemas Identificados
- `tokens_used = 0` → Falha no cálculo de tokens
- `billing_status = 'pending'` → Falha no débito
- `billed_at` vazio → Processo incompleto

## Pré-requisitos

1. Arquivo `.env` configurado com:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

2. Dependências instaladas:
   ```bash
   npm install @supabase/supabase-js dotenv
   ```

## Solução de Problemas

Se os scripts identificarem problemas:

1. **Mensagens pendentes com tokens_used > 0**:
   - Execute o processo de débito manualmente
   - Verifique se o `autoDebitService` está funcionando

2. **Mensagens com tokens_used = 0**:
   - Verifique a função `extractTokenUsage`
   - Confirme se `MIN_CHARGE_TOKENS` está sendo aplicado

3. **Muitas mensagens pendentes**:
   - Verifique se o PATCH A foi aplicado corretamente
   - Confirme se o `await` está sendo usado no débito