"use client"
import React from 'react'
import { QRCodeSVG } from 'qrcode.react'

type Status = 'connecting' | 'qr' | 'pairing' | 'connected' | 'disconnected' | 'unknown'

type ConnectResponse = {
  state: Status
  code?: string | null
  pairingCode?: string | null
  ttl?: number | null
  updated_at?: string
  error?: string
}

type StatusResponse = ConnectResponse & { raw?: any }

export default function ConnectionPanel() {
  const [status, setStatus] = React.useState<Status>('unknown')
  const [code, setCode] = React.useState<string | null>(null)
  const [pairingCode, setPairingCode] = React.useState<string | null>(null)
  const [ttl, setTtl] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const fetchConnect = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/wa/connect', { method: 'POST' })
      const data: ConnectResponse = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to connect')
      setStatus(data.state)
      setCode(data.code ?? null)
      setPairingCode(data.pairingCode ?? null)
      setTtl(data.ttl ?? null)
    } catch (e: any) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchStatus = React.useCallback(async () => {
    try {
      const res = await fetch('/api/wa/status')
      const data: StatusResponse = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to get status')
      setStatus(data.state)
      setCode(data.code ?? null)
      setPairingCode(data.pairingCode ?? null)
      setTtl(data.ttl ?? null)
    } catch (e: any) {
      setError(e.message || String(e))
    }
  }, [])

  React.useEffect(() => {
    let timer: any
    if (['connecting', 'qr', 'pairing'].includes(status)) {
      timer = setInterval(fetchStatus, 7000)
    }
    return () => timer && clearInterval(timer)
  }, [status, fetchStatus])

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
      <h2>Conexão WhatsApp</h2>
      <p>Estado: <strong>{status}</strong></p>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={fetchConnect} disabled={loading}>
          {loading ? 'Conectando...' : 'Conectar'}
        </button>
        <button onClick={fetchConnect} disabled={loading}>
          Gerar novo QR
        </button>
        <button onClick={fetchStatus}>
          Verificar status
        </button>
      </div>

      {(pairingCode || code) && (
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <p>Escaneie o QR no WhatsApp ou use o Pairing Code:</p>
          {pairingCode && <p style={{ fontSize: 24, letterSpacing: 4 }}>{pairingCode}</p>}
          {code && (
            <div style={{ display: 'inline-block', padding: 8, background: '#fff' }}>
              <QRCodeSVG value={code} size={256} />
            </div>
          )}
          {ttl && <p>Expira em ~{ttl}s</p>}
        </div>
      )}
    </div>
  )
}