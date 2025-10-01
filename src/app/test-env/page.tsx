'use client'

import { useEffect, useState } from 'react'

export default function TestEnvPage() {
  // Executar teste imediatamente sem useEffect
  const envVars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'undefined',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'defined' : 'undefined',
    NODE_ENV: process.env.NODE_ENV || 'undefined',
  }
  
  const status = 'completed'
  const error = null
  
  console.log('Página renderizada com sucesso', envVars)

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8">Teste de Variáveis de Ambiente</h1>
        
        <div className="grid gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Status: {status}</h2>
            {error && (
              <div className="bg-red-50 p-4 rounded mb-4">
                <p className="text-red-700">Erro: {error}</p>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Variáveis de Ambiente</h2>
            <div className="space-y-2">
              {Object.entries(envVars).map(([key, value]) => (
                <p key={key} className="text-sm">
                  <strong>{key}:</strong> {String(value)}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}