import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Obter sessão atual
  const { data: { user }, error } = await supabase.auth.getUser()
  
  // Verificar se há um usuário válido
  const isAuthenticated = !!user && !error

  // Verificar role do usuário para rotas super-admin
  // let userProfile = null
  if (isAuthenticated && request.nextUrl.pathname.startsWith('/super-admin')) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    // userProfile = profile
    
    // Se não é super_admin, redirecionar para dashboard
    if (profileError || !profile || profile.role !== 'super_admin') {
      console.log('[SuperAdmin] Access denied for user:', user.id, 'role:', profile?.role)
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    
    console.log('[SuperAdmin] Access granted for user:', user.id)
  }

  // Se não está autenticado e tenta acessar dashboard ou super-admin, redirecionar para signin
  if (!isAuthenticated && (request.nextUrl.pathname.startsWith('/dashboard') || request.nextUrl.pathname.startsWith('/super-admin'))) {
    return NextResponse.redirect(new URL('/signin', request.url))
  }

  // Se está autenticado e tenta acessar signin, redirecionar baseado no role
  if (isAuthenticated && request.nextUrl.pathname === '/signin') {
    // Verificar role do usuário para decidir redirecionamento
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    if (profile?.role === 'super_admin') {
      return NextResponse.redirect(new URL('/super-admin', request.url))
    } else {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Redirecionar root baseado na autenticação e role
  if (request.nextUrl.pathname === '/') {
    if (isAuthenticated) {
      // Verificar role do usuário para decidir redirecionamento
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      
      if (profile?.role === 'super_admin') {
        return NextResponse.redirect(new URL('/super-admin', request.url))
      } else {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    } else {
      return NextResponse.redirect(new URL('/signin', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes) - EXCLUÍDO COMPLETAMENTE
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - webhook (webhook routes)
     */
    '/((?!api/.*|_next/static|_next/image|favicon.ico|webhook).*)',
  ],
}