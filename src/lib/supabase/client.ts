import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '../database.types'

// Função para criar cliente Supabase no navegador (componentes de cliente)
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    }
  )
}

// Cliente Supabase para uso em componentes de cliente
export const supabaseClient = createClient()