import { createBrowserClient } from '@supabase/ssr'
import { Database } from './database.types'

// Configuração robusta do Supabase com verificação de variáveis
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://anlemekgocrrllsogxix.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFubGVtZWtnb2Nycmxsc29neGl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MDEyMjMsImV4cCI6MjA3MzE3NzIyM30.7K4zVdnDh_3YuBz59PX8WoRwDxKjXJ0KXnD1tNvp7iM'

// Verificação de segurança (apenas log, não throw)
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Configuração do Supabase inválida:', {
    url: !!supabaseUrl,
    key: !!supabaseAnonKey
  })
}

// Função para criar cliente Supabase de forma segura
function createSupabaseClient() {
  try {
    return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          if (typeof document !== 'undefined') {
            try {
              const cookie = document.cookie
                .split('; ')
                .find(row => row.startsWith(`${name}=`))
              return cookie ? cookie.split('=')[1] : undefined
            } catch (error) {
              console.warn('Erro ao ler cookie:', error)
              return undefined
            }
          }
          return undefined
        },
        set(name: string, value: string, options: any) {
          if (typeof document !== 'undefined') {
            try {
              let cookieString = `${name}=${value}`
              if (options?.maxAge) cookieString += `; max-age=${options.maxAge}`
              if (options?.path) cookieString += `; path=${options.path}`
              if (options?.domain) cookieString += `; domain=${options.domain}`
              if (options?.secure) cookieString += '; secure'
              if (options?.httpOnly) cookieString += '; httponly'
              if (options?.sameSite) cookieString += `; samesite=${options.sameSite}`
              document.cookie = cookieString
            } catch (error) {
              console.warn('Erro ao definir cookie:', error)
            }
          }
        },
        remove(name: string, options: any) {
          if (typeof document !== 'undefined') {
            try {
              let cookieString = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`
              if (options?.path) cookieString += `; path=${options.path}`
              if (options?.domain) cookieString += `; domain=${options.domain}`
              document.cookie = cookieString
            } catch (error) {
              console.warn('Erro ao remover cookie:', error)
            }
          }
        },
      },
    })
  } catch (error) {
    console.error('Erro ao criar cliente Supabase:', error)
    // Retorna um cliente mock para evitar crashes
    return createBrowserClient<Database>(
      'https://placeholder.supabase.co',
      'placeholder-key',
      {
        cookies: {
          get: () => undefined,
          set: () => {},
          remove: () => {},
        },
      }
    )
  }
}

export const supabase = createSupabaseClient()!