// Configurações de alertas para diferentes cenários
export const ALERT_CONFIG = {
  // Alertas críticos que requerem atenção imediata
  CRITICAL: {
    webhook_error: {
      severity: 'critical' as const,
      description: 'Erro crítico no webhook principal',
      channels: ['supabase', 'console'],
      metadata: ['correlationId', 'env', 'commit', 'endpoint']
    },
    env_config_error: {
      severity: 'critical' as const,
      description: 'Erro de configuração de ambiente',
      channels: ['supabase', 'console'],
      metadata: ['endpoint', 'missing_var']
    }
  },

  // Alertas de alta prioridade
  HIGH: {
    device_creation_failed: {
      severity: 'high' as const,
      description: 'Falha na criação automática de device',
      channels: ['supabase', 'console'],
      metadata: ['correlationId', 'phoneNumber', 'error']
    },
    chatbot_not_found: {
      severity: 'high' as const,
      description: 'Chatbot não encontrado para device',
      channels: ['supabase', 'console'],
      metadata: ['correlationId', 'instanceName', 'deviceId', 'orgId']
    },
    message_save_failed: {
      severity: 'high' as const,
      description: 'Falha ao salvar mensagem no banco',
      channels: ['supabase', 'console'],
      metadata: ['correlationId', 'phoneNumber', 'error']
    }
  },

  // Alertas de média prioridade
  MEDIUM: {
    ai_service_failed: {
      severity: 'medium' as const,
      description: 'Falha no serviço de IA (Groq)',
      channels: ['supabase', 'console'],
      metadata: ['correlationId', 'phoneNumber', 'error']
    },
    message_send_failed: {
      severity: 'medium' as const,
      description: 'Falha ao enviar mensagem via Evolution API',
      channels: ['supabase', 'console'],
      metadata: ['correlationId', 'phoneNumber', 'error']
    },
    device_update_failed: {
      severity: 'medium' as const,
      description: 'Falha ao atualizar device existente',
      channels: ['supabase', 'console'],
      metadata: ['correlationId', 'phoneNumber', 'error']
    }
  },

  // Alertas de baixa prioridade
  LOW: {
    invalid_payload: {
      severity: 'low' as const,
      description: 'Payload inválido recebido no webhook',
      channels: ['supabase'],
      metadata: ['correlationId', 'reason', 'payload_sample']
    }
  }
};

// Configurações de canais de alerta
export const ALERT_CHANNELS = {
  supabase: {
    enabled: true,
    table: 'system_alerts',
    batch_size: 10,
    flush_interval: 5000 // 5 segundos
  },
  console: {
    enabled: true,
    format: 'structured',
    include_stack: true
  },
  webhook: {
    enabled: false, // Pode ser habilitado para integração com Slack, Discord, etc.
    url: process.env.ALERT_WEBHOOK_URL,
    timeout: 5000
  }
};

// Configurações de rate limiting para evitar spam de alertas
export const RATE_LIMIT_CONFIG = {
  window_ms: 60000, // 1 minuto
  max_alerts_per_type: 10,
  max_alerts_total: 50,
  cooldown_ms: 300000 // 5 minutos de cooldown após atingir o limite
};

// Configurações de retenção de alertas
export const RETENTION_CONFIG = {
  critical: 90, // 90 dias
  high: 30, // 30 dias
  medium: 14, // 14 dias
  low: 7 // 7 dias
};

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';
export type AlertChannel = 'supabase' | 'console' | 'webhook';

export interface AlertMetadata {
  [key: string]: any;
}

export interface AlertConfig {
  severity: AlertSeverity;
  description: string;
  channels: AlertChannel[];
  metadata: string[];
}