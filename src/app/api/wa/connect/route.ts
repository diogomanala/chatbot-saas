import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 })
}

function getEnv(name: string, fallback?: string) {
  const v = process.env[name]
  if (v === undefined || v === null || v === '') return fallback
  return v
}

function ok(data: any, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === 'number' ? { status: init } : init)
}

async function getConnectionState(baseUrl: string, apiKey: string, session: string) {
  const res = await fetch(`${baseUrl}/instance/connectionState/${session}`, {
    method: 'GET',
    headers: { 'apikey': apiKey },
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Evolution connectionState failed: ${res.status} ${text}`)
  }
  return res.json()
}

async function connectInstance(baseUrl: string, apiKey: string, session: string) {
  const res = await fetch(`${baseUrl}/instance/connect/${session}`, {
    method: 'GET',
    headers: { 'apikey': apiKey },
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Evolution connect failed: ${res.status} ${text}`)
  }
  return res.json()
}

function isAuthorized(req: NextRequest) {
  const wantAuth = false // optional security; set to true to enforce
  if (!wantAuth) return true
  const header = req.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  const querySecret = new URL(req.url).searchParams.get('action_token')
  const envSecret = getEnv('WEBHOOK_SECRET')
  return Boolean((token && envSecret && token === envSecret) || (querySecret && envSecret && querySecret === envSecret))
}

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorized(req)) return unauthorized()

    const EVOLUTION_API_URL = getEnv('EVOLUTION_API_URL')
    const EVOLUTION_API_KEY = getEnv('EVOLUTION_API_KEY')
    const WA_SESSION = getEnv('WA_SESSION', 'wa_login')!

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return ok({ error: 'Missing Evolution API env', hint: 'Configure EVOLUTION_API_URL and EVOLUTION_API_KEY' }, 500)
    }

    // 1) Read current connection state, avoid side effects if already connected
    let state = 'unknown'
    try {
      const statusData = await getConnectionState(EVOLUTION_API_URL, EVOLUTION_API_KEY, WA_SESSION)
      const apiState = statusData?.instance?.state || statusData?.state || statusData?.instance?.connectionStatus
      if (apiState === 'open') {
        state = 'connected'
        return ok({ state, updated_at: new Date().toISOString() })
      }
    } catch (e) {
      // Continue to connect attempt
    }

    // 2) Attempt to connect (idempotent, reuses the SAME session)
    const data = await connectInstance(EVOLUTION_API_URL, EVOLUTION_API_KEY, WA_SESSION)

    // Normalize payload to our contract
    const code = data?.code || data?.qrcode?.code || data?.qrcode?.value || data?.qrCode || null
    const pairingCode = data?.pairingCode || data?.pairing?.code || null
    const ttl = data?.ttl || data?.qrcode?.ttl || null

    // Connection state hints
    if (data?.instance?.state === 'open') state = 'connected'
    else if (pairingCode || code) state = 'qr'
    else if (data?.instance?.state === 'connecting') state = 'connecting'
    else state = (data?.state as string) || 'connecting'

    return ok({ state, code, pairingCode, ttl, updated_at: new Date().toISOString() })
  } catch (error: any) {
    return ok({ error: 'Failed to connect instance', details: error?.message || String(error) }, 500)
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}