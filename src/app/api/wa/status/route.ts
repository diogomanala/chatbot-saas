import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

function getEnv(name: string, fallback?: string) {
  const v = process.env[name]
  if (v === undefined || v === null || v === '') return fallback
  return v
}

function ok(data: any, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === 'number' ? { status: init } : init)
}

async function getInstanceStatus(baseUrl: string, apiKey: string, session: string) {
  const res = await fetch(`${baseUrl}/instance/status/${session}`, {
    method: 'GET',
    headers: { 'apikey': apiKey },
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Evolution status failed: ${res.status} ${text}`)
  }
  return res.json()
}

export async function GET(req: NextRequest) {
  try {
    const EVOLUTION_API_URL = getEnv('EVOLUTION_API_URL')
    const EVOLUTION_API_KEY = getEnv('EVOLUTION_API_KEY')
    const WA_SESSION = getEnv('WA_SESSION', 'wa_login')!

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return ok({ error: 'Missing Evolution API env', hint: 'Configure EVOLUTION_API_URL and EVOLUTION_API_KEY' }, 500)
    }

    const data = await getInstanceStatus(EVOLUTION_API_URL, EVOLUTION_API_KEY, WA_SESSION)

    // Normalize state mapping
    const apiState = data?.instance?.state || data?.state || data?.instance?.connectionStatus
    let state: string
    switch (apiState) {
      case 'open':
      case 'connected':
        state = 'connected'
        break
      case 'connecting':
      case 'qr':
      case 'pairing':
        state = apiState
        break
      case 'close':
      case 'disconnected':
      default:
        state = 'disconnected'
    }

    const code = data?.qrcode?.code || data?.qrCode || null
    const pairingCode = data?.pairing?.code || data?.pairingCode || null
    const ttl = data?.qrcode?.ttl || data?.ttl || null

    return ok({ state, code, pairingCode, ttl, raw: data, updated_at: new Date().toISOString() })
  } catch (error: any) {
    return ok({ error: 'Failed to fetch status', details: error?.message || String(error) }, 500)
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}