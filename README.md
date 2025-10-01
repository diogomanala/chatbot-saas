# SaaS WhatsApp Chatbot Multi-Tenant

Um sistema SaaS completo para gerenciamento de chatbots do WhatsApp com arquitetura multi-tenant, construído com Next.js 14, Supabase e Evolution API.

## 🚀 Funcionalidades

### Autenticação e Organizações
- ✅ Sistema de autenticação com Supabase Auth
- ✅ Arquitetura multi-tenant com organizações
- ✅ Controle de acesso baseado em roles (owner, admin, member)
- ✅ Perfis de usuário personalizáveis

### Gerenciamento de Dispositivos WhatsApp
- ✅ Conexão de múltiplos dispositivos WhatsApp
- ✅ Geração de QR Codes para pareamento
- ✅ Monitoramento de status em tempo real
- ✅ Integração com Evolution API

### Sistema de Chatbots
- ✅ Criação de chatbots personalizados
- ✅ Sistema de intents com palavras-chave
- ✅ Respostas automáticas configuráveis
- ✅ Ativação/desativação de chatbots e intents

### Mensagens e Conversas
- ✅ Visualização de todas as conversas
- ✅ Histórico completo de mensagens
- ✅ Filtros por dispositivo e período
- ✅ Status de entrega das mensagens

### Sistema de Créditos
- ✅ Carteira de créditos por organização
- ✅ Cobrança por mensagem enviada
- ✅ Histórico de transações (ledger)
- ✅ Alertas de créditos baixos

### API e Webhooks
- ✅ API REST completa
- ✅ Webhooks da Evolution API
- ✅ Processamento automático de mensagens
- ✅ Integração em tempo real

## 🛠️ Tecnologias Utilizadas

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui, Lucide Icons
- **Backend**: Next.js API Routes, Supabase
- **Database**: PostgreSQL (Supabase)
- **Authentication**: Supabase Auth
- **WhatsApp Integration**: Evolution API
- **Forms**: React Hook Form, Zod
- **Notifications**: Sonner (Toast)

## 📋 Pré-requisitos

- Node.js 18+ 
- npm ou yarn
- Conta no Supabase
- Evolution API configurada
- Groq API Key (opcional, para IA)

## 🚀 Instalação

### 1. Clone o repositório
```bash
git clone <repository-url>
cd saas-chatbot
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure as variáveis de ambiente
Crie um arquivo `.env.local` na raiz do projeto:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Evolution API
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=your_evolution_api_key

# Groq (Opcional)
GROQ_API_KEY=your_groq_api_key

# Next.js
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret
```

### 4. Configure o banco de dados
Execute o schema SQL no seu projeto Supabase:

```bash
# O arquivo supabase-schema.sql contém todo o schema necessário
# Execute-o no SQL Editor do Supabase Dashboard
```

### 5. Execute o projeto
```bash
npm run dev
```

O projeto estará disponível em `http://localhost:3000`

## 📊 Estrutura do Banco de Dados

### Tabelas Principais

- **organizations**: Organizações (tenants)
- **profiles**: Perfis de usuário
- **devices**: Dispositivos WhatsApp
- **chatbots**: Configurações de chatbots
- **intents**: Intents e respostas automáticas
- **messages**: Histórico de mensagens
- **credit_wallets**: Carteiras de crédito
- **usage_ledger**: Registro de uso e transações
- **api_keys**: Chaves de API (futuro)

### Views

- **organization_stats**: Estatísticas por organização
- **device_message_counts**: Contadores de mensagens por dispositivo

### Stored Procedures

- **sp_debit_credits**: Debitar créditos da carteira
- **handle_new_user**: Criar perfil automaticamente

## 🔧 Configuração da Evolution API

Para integrar com a Evolution API:

1. Configure a Evolution API em seu servidor
2. Defina a URL e API Key nas variáveis de ambiente
3. Configure o webhook para `{APP_URL}/api/webhook/evolution`

### Exemplo de configuração da Evolution API:
```json
{
  "instanceName": "device_id",
  "token": "device_id",
  "qrcode": true,
  "webhook": "http://localhost:3000/api/webhook/evolution",
  "webhook_by_events": true
}
```

## 📱 Como Usar

### 1. Primeiro Acesso
1. Acesse `/signin` para criar uma conta
2. Após o registro, uma organização será criada automaticamente
3. Você será redirecionado para o dashboard

### 2. Conectar Dispositivo WhatsApp
1. Vá para "Dispositivos" no menu lateral
2. Clique em "Adicionar Dispositivo"
3. Escaneie o QR Code com o WhatsApp
4. Aguarde a conexão ser estabelecida

### 3. Criar Chatbot
1. Vá para "Chatbots" no menu lateral
2. Clique em "Criar Chatbot"
3. Configure nome, dispositivo e ative o chatbot
4. Adicione intents com palavras-chave e respostas

### 4. Gerenciar Créditos
1. Vá para "Carteira" no menu lateral
2. Visualize o saldo atual e histórico
3. Adicione créditos conforme necessário

## 🔒 Segurança

- **RLS (Row Level Security)**: Todas as tabelas têm políticas RLS
- **Autenticação**: Supabase Auth com JWT
- **Autorização**: Controle baseado em organizações
- **API Keys**: Validação de chaves de API
- **Sanitização**: Validação de entrada com Zod

## 📈 Monitoramento

- **Logs**: Console logs para debugging
- **Métricas**: Contadores de mensagens e uso
- **Status**: Monitoramento de dispositivos em tempo real
- **Alertas**: Notificações de créditos baixos

## 🚀 Deploy

### Vercel (Recomendado)
1. Conecte seu repositório ao Vercel
2. Configure as variáveis de ambiente
3. Deploy automático

### Docker
```dockerfile
# Dockerfile incluído no projeto
docker build -t saas-chatbot .
docker run -p 3000:3000 saas-chatbot
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 🆘 Suporte

Para suporte e dúvidas:
- Abra uma issue no GitHub
- Consulte a documentação
- Verifique os logs do console

## 🔄 Roadmap

- [ ] Dashboard de analytics avançado
- [ ] Integração com mais provedores de IA
- [ ] Sistema de templates de mensagens
- [ ] API pública para integrações
- [ ] App mobile
- [ ] Relatórios em PDF
- [ ] Integração com CRM
- [ ] Chatbots com IA conversacional

---

**Desenvolvido com ❤️ usando Next.js e Supabase**
