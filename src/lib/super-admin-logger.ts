import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { NextRequest } from 'next/server'

interface LogEntry {
  action: string
  targetClientId?: string
  targetClientEmail?: string
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
}

export class SuperAdminLogger {
  private supabase
  private adminId: string

  constructor(adminId: string) {
    this.supabase = createClientComponentClient()
    this.adminId = adminId
  }

  async log(entry: LogEntry, request?: NextRequest) {
    try {
      const logData = {
        admin_id: this.adminId,
        action: entry.action,
        target_client_id: entry.targetClientId || null,
        target_client_email: entry.targetClientEmail || null,
        details: entry.details || null,
        ip_address: this.getClientIP(request),
        user_agent: request?.headers.get('user-agent') || null
      }

      const { error } = await this.supabase
        .from('super_admin_logs')
        .insert(logData)

      if (error) {
        console.error('[SuperAdminLogger] Error inserting log:', error)
        return false
      }

      console.log('[SuperAdminLogger] Action logged:', entry.action, entry.targetClientId || 'N/A')
      return true
    } catch (error) {
      console.error('[SuperAdminLogger] Unexpected error:', error)
      return false
    }
  }

  private getClientIP(request?: NextRequest): string | null {
    if (!request) return null

    // Tentar obter IP de diferentes headers
    const forwarded = request.headers.get('x-forwarded-for')
    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }

    const realIP = request.headers.get('x-real-ip')
    if (realIP) {
      return realIP
    }

    const clientIP = request.headers.get('x-client-ip')
    if (clientIP) {
      return clientIP
    }

    return null
  }

  // Métodos de conveniência para ações específicas
  async logClientCreation(clientEmail: string, clientId: string, details: any, request?: NextRequest) {
    return this.log({
      action: 'create_client',
      targetClientId: clientId,
      targetClientEmail: clientEmail,
      details: {
        client_name: details.full_name,
        org_name: details.org_name,
        evolution_instance: details.evolution_instance
      }
    }, request)
  }

  async logStatusToggle(clientId: string, clientEmail: string, oldStatus: string, newStatus: string, request?: NextRequest) {
    return this.log({
      action: 'toggle_client_status',
      targetClientId: clientId,
      targetClientEmail: clientEmail,
      details: {
        old_status: oldStatus,
        new_status: newStatus
      }
    }, request)
  }

  async logPaymentStatusToggle(clientId: string, clientEmail: string, oldStatus: string, newStatus: string, request?: NextRequest) {
    return this.log({
      action: 'toggle_payment_status',
      targetClientId: clientId,
      targetClientEmail: clientEmail,
      details: {
        old_payment_status: oldStatus,
        new_payment_status: newStatus
      }
    }, request)
  }

  async logApiKeyReset(clientId: string, clientEmail: string, request?: NextRequest) {
    return this.log({
      action: 'reset_api_key',
      targetClientId: clientId,
      targetClientEmail: clientEmail,
      details: {
        timestamp: new Date().toISOString()
      }
    }, request)
  }

  async logLogin(request?: NextRequest) {
    return this.log({
      action: 'super_admin_login',
      details: {
        timestamp: new Date().toISOString()
      }
    }, request)
  }

  async logDashboardAccess(request?: NextRequest) {
    return this.log({
      action: 'dashboard_access',
      details: {
        timestamp: new Date().toISOString()
      }
    }, request)
  }
}

// Função utilitária para criar logger
export async function createSuperAdminLogger(adminId: string): Promise<SuperAdminLogger | null> {
  try {
    const supabase = createClientComponentClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session || session.user.id !== adminId) {
      return null
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', adminId)
      .single()

    if (!profile || profile.role !== 'super_admin') {
      return null
    }

    return new SuperAdminLogger(adminId)
  } catch (error) {
    console.error('[SuperAdminLogger] Error creating logger:', error)
    return null
  }
}