const fs = require('fs');
const path = require('path');

// Arquivos e pastas que podem ser removidos com segurança
const REMOVABLE_PATTERNS = {
  // Arquivos de backup e documentação duplicada
  backup_files: [
    'BACKUP-ROMARIO-README.md',
    'CORRIGIR-LOGIN-REDIRECT.md',
    'CRIAR-USUARIO-ADMIN.md',
    'DEPLOY-INSTRUCTIONS.md',
    'DEPLOY_INSTRUCTIONS.md',
    'EXECUTAR-SQL-MANUALMENTE.md',
    'EXECUTE_SQL_INSTRUCTIONS.md',
    'INSTRUCOES-ADMIN.md',
    'INSTRUCOES-EXECUCAO.md',
    'INSTRUCOES-RAPIDAS.md',
    'INSTRUCOES-SUPABASE.md',
    'SETUP-ALERTS-SYSTEM.md',
    'VERCEL-DEPLOYMENT-GUIDE.md',
    'WEBHOOK-LOCALHOST-GUIDE.md',
    'analise-arquitetura.md',
    'complete-backup-restoration.md',
    'evolution-api-webhook-config.md',
    'guia-deploy-producao.md',
    'manual-restore-instructions.md',
    'manual-setup-instructions.md',
    'manual-webhook-update.md',
    'test-results-summary.md'
  ],
  
  // Scripts SQL duplicados e de backup
  sql_files: [
    'SQL-ADMIN-USER.sql',
    'SQL-DADOS-EXEMPLO.sql',
    'SQL-RESTAURACAO-COMPLETA.sql',
    'SQL-SAAS-COMPLETO-CORRIGIDO.sql',
    'SQL-SAAS-COMPLETO-UNIFICADO.sql',
    'SQL-SAAS-COMPLETO-UUID-CORRIGIDO.sql',
    'SQL-SAAS-COMPLETO.sql',
    'add-chatbot-columns.sql',
    'add-chatbot-config-column.sql',
    'add-is-default-column.sql',
    'add-missing-columns.sql',
    'add-user-id-column.sql',
    'add-webhook-column.sql',
    'check-device-exists.sql',
    'complete-saas-schema.sql',
    'complete-setup.sql',
    'create-conversation-history-table.sql',
    'create-conversation-history.sql',
    'create-debug-table.sql',
    'create-device-configs-table.sql',
    'create-devices-table.sql',
    'create-exec-sql-function.sql',
    'create-messages-table.sql',
    'create-org-training-table.sql',
    'create-tables.sql',
    'create-test-user.sql',
    'diagnose-device-final.sql',
    'diagnose-device.sql',
    'execute-all-fixes.sql',
    'fix-auth-system.sql',
    'fix-chatbot-ai-columns.sql',
    'fix-chatbot-schema.sql',
    'fix-database-simple.sql',
    'fix-database.sql',
    'fix-devices-schema.sql',
    'fix-rls-policies.sql',
    'messages-table.sql',
    'migration_create_chatbots.sql',
    'query-device-direct.sql',
    'query-device-mcp.sql',
    'sql-limpo.sql',
    'supabase-schema.sql',
    'supabase-webhook-redirect.sql',
    'test-auth.sql',
    'update-chatbots-schema.sql',
    'update-deprecated-models.sql',
    'update-devices-table.sql'
  ],
  
  // Scripts de debug e teste
  debug_test_files: [
    'activate-backup.js',
    'activate-chatbots.js',
    'activate-demo-chatbot.js',
    'add-columns-direct.js',
    'add-columns-simple.js',
    'add-missing-columns.js',
    'add-webhook-field.js',
    'auto-fix-login.js',
    'auto-setup-webhook.js',
    'backup-database-schema.js',
    'backup-env-config.js',
    'backup-romario-config.js',
    'check-admin-user.js',
    'check-and-create-device.js',
    'check-chatbot-config.js',
    'check-chatbot-for-device.js',
    'check-chatbot-status.js',
    'check-chatbot-structure.js',
    'check-chatbot.js',
    'check-chatbots-by-id.js',
    'check-chatbots-columns.js',
    'check-chatbots-for-device.js',
    'check-chatbots.js',
    'check-connection-status.js',
    'check-database-status.js',
    'check-database-structure.js',
    'check-demo-chatbot.js',
    'check-device-chatbot-match.js',
    'check-device-chatbots.js',
    'check-device-config.js',
    'check-device-match.js',
    'check-device-status.js',
    'check-device-structure.js',
    'check-device.js',
    'check-devices-columns.js',
    'check-devices-schema.js',
    'check-devices-simple.js',
    'check-devices-structure.js',
    'check-devices-table.js',
    'check-devices.js',
    'check-duplicate-devices.js',
    'check-evolution-config.js',
    'check-evolution-status.js',
    'check-evolution-webhook-config.js',
    'check-evolution-webhook.js',
    'check-existing-data.js',
    'check-existing-devices.js',
    'check-instance-status.js',
    'check-intents.js',
    'check-medical-device.js',
    'check-messages-data.js',
    'check-messages-structure.js',
    'check-messages.js',
    'check-organizations.js',
    'check-phone-number.js',
    'check-profiles-table.js',
    'check-real-table-structure.js',
    'check-recent-messages.js',
    'check-remote-table.js',
    'check-schema.js',
    'check-specific-device.js',
    'check-table-structure.js',
    'check-tables.js',
    'check-target-instance.js',
    'check-titecweb-chatbot.js',
    'check-valid-numbers.js',
    'check-vercel-logs.js',
    'check-vercel-status.js',
    'check-webhook-config.js',
    'check-webhook.js',
    'check-your-messages.js',
    'clean-duplicate-chatbots.js',
    'configure-evolution-for-production.js',
    'configure-evolution-webhook.js',
    'configure-local-webhook.js',
    'configure-production-webhook.js',
    'configure-supabase-webhook.js',
    'configure-webhook-correct.js',
    'configure-webhook-localhost.js',
    'configure-webhook-medical-crm.js',
    'configure-webhook-new-instance.js',
    'configure-webhook-production-final.js',
    'configure-webhook-production.js',
    'configure-webhook.js',
    'connect-whatsapp-instance.js',
    'connect-whatsapp.js',
    'create-chatbot-direct.js',
    'create-device.js',
    'create-devices-table.js',
    'create-full-backup.js',
    'create-medical-device.js',
    'create-medical-instance.js',
    'create-messages-table.js',
    'create-test-chatbot.js',
    'create-test-device.js',
    'create-test-user.js',
    'create-training-table-simple.js',
    'debug-chatbot-issue.js',
    'debug-device-mapping.js',
    'debug-device-metadata.js',
    'debug-device-query.js',
    'debug-devices.js',
    'debug-evolution-api.js',
    'debug-message-flow.js',
    'debug-message-processing.js',
    'debug-real-messages.js',
    'debug-rls-policies.js',
    'debug-webhook-chatbot.js',
    'debug-webhook-detailed.js',
    'debug-webhook-error.js',
    'debug-webhook-messages.js',
    'debug-webhook-payload.js',
    'debug-webhook-response.js',
    'debug-webhook-specific.js',
    'debug-webhook-vercel.js',
    'debug-webhook.js',
    'deploy-env-auto.js',
    'deploy-env-manual.js',
    'deploy-env.js',
    'deploy-function.js',
    'deploy-vercel.js',
    'diagnose-chatbot-bug.js',
    'diagnose-chatbot.js',
    'diagnose-device-complete.js',
    'diagnose-device-mcp.js',
    'diagnose-device-sql.js',
    'diagnose-real-app.js',
    'diagnose-response-issue.js',
    'diagnose-vercel-permissions.js',
    'diagnose-webhook-issue.js',
    'diagnose-webhook-response.js',
    'direct-sql-investigation.js',
    'direct-supabase-query.js',
    'disable-sso.js',
    'enhanced-auto-response.js',
    'execute-device-check.js',
    'execute-diagnosis.js',
    'execute-fix-simple.js',
    'execute-fix-sql.js',
    'execute-fix.js',
    'execute-fixes.js',
    'execute-sql-direct.js',
    'execute-sql-fix.js',
    'execute-sql.js',
    'execute-webhook-sql.js',
    'explain-supabase-tokens.js',
    'final-device-check.js',
    'final-production-setup.js',
    'fix-auth-system.sql',
    'fix-chatbot-device-association.js',
    'fix-chatbot-devices.js',
    'fix-chatbot-issues.js',
    'fix-chatbot-org.js',
    'fix-chatbots-structure.js',
    'fix-chatbots-table.js',
    'fix-chatbots-with-exec-sql.js',
    'fix-database-schema.js',
    'fix-device-chatbot-config.js',
    'fix-device-final.js',
    'fix-device-instance.js',
    'fix-device-mcp.js',
    'fix-devices-rls.js',
    'fix-duplicate-chatbots-atual.js',
    'fix-duplicate-chatbots.js',
    'fix-duplicate-devices-final.js',
    'fix-instance-97eeeb59.js',
    'fix-missing-chatbot.js',
    'fix-organization.js',
    'fix-production-webhook.js',
    'fix-session-name.js',
    'fix-test-user.js',
    'fix-typescript-interfaces.js',
    'fix-user-profile.js',
    'fix-webhook-config.js',
    'fix-webhook-configuration.js',
    'fix-webhook-final.js',
    'fix-webhook-instance-extraction.js',
    'fix-webhook-url.js',
    'fix-webhook.js',
    'fix-whatsapp-connection.js',
    'fix-whatsapp-instance.js',
    'force-update-webhook.js',
    'generate-new-qrcode.js',
    'generate-qr-code.js',
    'get-supabase-keys.js',
    'implement-webhook-solution.js',
    'intelligent-auto-response.js',
    'investigate-critical-error.js',
    'investigate-device-mcp.js',
    'list-all-instances.js',
    'list-devices.js',
    'list-instances.js',
    'manual-sql-setup.js',
    'monitor-connection-status.js',
    'monitor-real-messages.js',
    'monitor-webhook-logs.js',
    'monitor-webhook.js',
    'openai-demo-assistant.js',
    'openai-intelligent-response.js',
    'polling-backup-service.js',
    'polling-service.js',
    'populate-database.js',
    'reconnect-and-configure-production.js',
    'reconnect-qrcode.js',
    'reconnect-whatsapp.js',
    'recreate-webhook.js',
    'redirect-webhook-to-local.js',
    'remove-device.js',
    'restore-database.js',
    'restore-from-backup.js',
    'restore-romario-config.js',
    'run-migration.js',
    'send-test-message.js',
    'set-webhook-direct.js',
    'setup-complete-database.js',
    'setup-complete-system.js',
    'setup-database.js',
    'setup-debug-table.js',
    'setup-exec-sql.js',
    'setup-local-webhook.js',
    'setup-ngrok-tunnel.js',
    'setup-org-training.js',
    'setup-production-webhook.js',
    'setup-schema.js',
    'setup-supabase-secrets.js',
    'setup-tunnel-simple.js',
    'setup-webhook-alternatives.js',
    'setup-webhook-corrected.js',
    'setup-webhook-final-corrected.js',
    'setup-webhook-final.js',
    'setup-webhook-fixed.js',
    'setup-webhook-npx.js',
    'setup-webhook-simple.js',
    'setup-webhook-supabase.js',
    'setup-webhook-working.js',
    'simulate-corrected-webhook.js',
    'simulate-your-message.js',
    'supabase-mcp-setup-guide.js',
    'supabase-redirect.js',
    'supabase-rest-sql.js',
    'test-ai-webhook.js',
    'test-auto-response-flow.js',
    'test-auto-response-production.js',
    'test-auto-response.js',
    'test-chatbot-response.js',
    'test-chatbot.js',
    'test-chatbots-structure.js',
    'test-complete-chatbot.js',
    'test-complete-flow.js',
    'test-complete-system.js',
    'test-connectivity-issues.js',
    'test-correct-webhook.js',
    'test-device-creation.js',
    'test-device-crud.js',
    'test-device-search.js',
    'test-devices-api-debug.js',
    'test-devices-api.js',
    'test-devices-auth.js',
    'test-devices-complete.js',
    'test-devices-page.js',
    'test-devices-service.js',
    'test-devices-simple.js',
    'test-direct-message.js',
    'test-env-token.js',
    'test-env.js',
    'test-event-logic.js',
    'test-evolution-api-prod.js',
    'test-evolution-api.js',
    'test-evolution-direct.js',
    'test-final-fix.js',
    'test-final-integration.js',
    'test-final-webhook.js',
    'test-instance-id.js',
    'test-isolation.js',
    'test-malformed-json.js',
    'test-new-token.js',
    'test-payload.json',
    'test-process-chatbots.js',
    'test-prod-env.js',
    'test-production-complete.js',
    'test-production-supabase.js',
    'test-production-webhook.js',
    'test-real-chatbot.js',
    'test-real-message-flow.js',
    'test-real-message-processing.js',
    'test-real-message.js',
    'test-real-number.js',
    'test-response-fix.js',
    'test-send-message.js',
    'test-send-response.js',
    'test-supabase-connection.js',
    'test-supabase-token.js',
    'test-supabase-webhook-fixed.js',
    'test-supabase-webhook.js',
    'test-vercel-env.js',
    'test-vercel-webhook.js',
    'test-webhook-auth.js',
    'test-webhook-connection.js',
    'test-webhook-debug.js',
    'test-webhook-detailed.js',
    'test-webhook-direct.js',
    'test-webhook-endpoint.js',
    'test-webhook-final.js',
    'test-webhook-fix.js',
    'test-webhook-fixed.js',
    'test-webhook-flow.js',
    'test-webhook-local.js',
    'test-webhook-logs.js',
    'test-webhook-message.js',
    'test-webhook-no-auth.js',
    'test-webhook-post.js',
    'test-webhook-production.js',
    'test-webhook-response.js',
    'test-webhook.js',
    'test-working-instance.js',
    'test-your-number.js',
    'trigger-webhook-test.js',
    'update-chatbot-models.js',
    'update-device-instance.js',
    'update-devices-table.js',
    'update-metadata-webhook.js',
    'update-models.js',
    'update-webhook-prod.js',
    'update-webhook-production.js',
    'update-webhook-supabase.js',
    'update-webhook-to-supabase.js',
    'update-webhook.js',
    'verify-device-direct.js',
    'verify-setup.js',
    'verify-test-device.js',
    'webhook-test-server.js'
  ],
  
  // Arquivos de configuração temporários
  temp_config_files: [
    'supabase-secrets-config.txt',
    'mcp.json'
  ],
  
  // Pastas que podem ser removidas
  removable_folders: [
    'backups'
  ]
};

// Arquivos essenciais que NUNCA devem ser removidos
const ESSENTIAL_FILES = [
  'package.json',
  'package-lock.json',
  'next.config.js',
  'next.config.ts',
  'tsconfig.json',
  'tailwind.config.ts',
  'postcss.config.mjs',
  'components.json',
  'eslint.config.mjs',
  '.eslintrc.json',
  '.gitignore',
  '.npmrc',
  'vercel.json',
  'README.md'
];

function analyzeProject() {
  console.log('🔍 Analisando projeto para limpeza...');
  
  const projectRoot = process.cwd();
  const allFiles = fs.readdirSync(projectRoot);
  
  let totalSize = 0;
  let removableCount = 0;
  const categories = {
    backup_files: [],
    sql_files: [],
    debug_test_files: [],
    temp_config_files: [],
    removable_folders: []
  };
  
  // Categorizar arquivos
  allFiles.forEach(file => {
    const filePath = path.join(projectRoot, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isFile()) {
      Object.keys(REMOVABLE_PATTERNS).forEach(category => {
        if (REMOVABLE_PATTERNS[category].includes(file)) {
          categories[category].push({
            name: file,
            size: stats.size,
            path: filePath
          });
          totalSize += stats.size;
          removableCount++;
        }
      });
    } else if (stats.isDirectory()) {
      if (REMOVABLE_PATTERNS.removable_folders.includes(file)) {
        const folderSize = getFolderSize(filePath);
        categories.removable_folders.push({
          name: file,
          size: folderSize,
          path: filePath
        });
        totalSize += folderSize;
        removableCount++;
      }
    }
  });
  
  // Relatório
  console.log('\n📊 RELATÓRIO DE LIMPEZA');
  console.log('=' .repeat(50));
  console.log(`Total de arquivos/pastas removíveis: ${removableCount}`);
  console.log(`Espaço total a ser liberado: ${formatBytes(totalSize)}`);
  
  Object.keys(categories).forEach(category => {
    if (categories[category].length > 0) {
      console.log(`\n📁 ${category.toUpperCase().replace('_', ' ')} (${categories[category].length} itens):`);
      categories[category].forEach(item => {
        console.log(`  - ${item.name} (${formatBytes(item.size)})`);
      });
    }
  });
  
  console.log('\n⚠️  ARQUIVOS ESSENCIAIS (NÃO REMOVER):');
  ESSENTIAL_FILES.forEach(file => {
    if (allFiles.includes(file)) {
      console.log(`  ✅ ${file}`);
    }
  });
  
  return categories;
}

function getFolderSize(folderPath) {
  let size = 0;
  try {
    const files = fs.readdirSync(folderPath);
    files.forEach(file => {
      const filePath = path.join(folderPath, file);
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        size += getFolderSize(filePath);
      } else {
        size += stats.size;
      }
    });
  } catch (error) {
    console.warn(`Erro ao calcular tamanho da pasta ${folderPath}:`, error.message);
  }
  return size;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

if (require.main === module) {
  analyzeProject();
}

module.exports = { analyzeProject, REMOVABLE_PATTERNS, ESSENTIAL_FILES };