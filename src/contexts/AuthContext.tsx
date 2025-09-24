'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

// Tipos simplificados para evitar problemas de tipagem
type Profile = {
  id: string
  org_id: string
  role: string
  full_name: string
  email?: string
  avatar_url?: string
  phone?: string
  created_at: string
  updated_at?: string
}

type Organization = {
  id: string
  name: string
  slug: string
  owner_user_id: string
  plan: string
  status: string
  created_at: string
  updated_at: string
}

type CreditWallet = {
  id: string
  org_id: string
  balance: number
  plan?: string
  renew_start?: string
  renew_end?: string
  auto_recharge: boolean
  created_at: string
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  organization: Organization | null
  creditWallet: CreditWallet | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string; success?: boolean }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: string; success?: boolean }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  refreshOrganization: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [creditWallet, setCreditWallet] = useState<CreditWallet | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Função para buscar perfil do usuário
  const refreshProfile = async () => {
    if (!user) {
      console.log('❌ No user found, cannot refresh profile')
      return
    }

    try {
      console.log('🔄 Refreshing profile for user:', user.id, user.email)
      
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.error('❌ Error fetching profile:', profileError)
        
        // Se o perfil não existe, aguardar um pouco e tentar novamente
        if (profileError.code === 'PGRST116') {
          console.log('⏳ Profile not found, waiting for trigger to create it...')
          
          // Aguardar 2 segundos e tentar novamente
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          const { data: retryProfileData, error: retryError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()
          
          if (retryError) {
            console.error('❌ Profile still not found after retry:', retryError)
            // Criar perfil temporário como fallback
            const tempProfile: Profile = {
              id: user.id,
              org_id: '', // Será preenchido quando a organização for criada
              role: 'owner',
              full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
              email: user.email || '',
              created_at: new Date().toISOString()
            }
            setProfile(tempProfile)
            console.log('✅ Temporary profile created as fallback')
            return
          }
          
          setProfile(retryProfileData)
          console.log('✅ Profile found after retry:', retryProfileData.email)
        } else {
          return
        }
      } else {
        setProfile(profileData)
        console.log('✅ Profile found:', profileData.email)
      }

    } catch (error) {
      console.error('💥 Unexpected error in refreshProfile:', error)
    }
  }

  // Função para buscar organização do usuário
  const refreshOrganization = async () => {
    if (!user || !profile) {
      console.log('❌ No user or profile found, cannot refresh organization')
      return
    }

    try {
      console.log('🔄 Refreshing organization for user:', user.id, 'org_id:', profile.org_id)
      
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profile.org_id)
        .single()

      if (orgError) {
        if (orgError.code === 'PGRST116') {
          console.log('⚠️ No organization found for user')
          setOrganization(null)
          setCreditWallet(null)
        } else {
          console.error('❌ Error fetching organization:', orgError)
        }
        return
      }

      setOrganization(orgData)
      console.log('✅ Organization found:', orgData.name)

      // Buscar carteira de créditos
      const { data: walletData, error: walletError } = await supabase
        .from('credit_wallets')
        .select('*')
        .eq('org_id', orgData.id)
        .single()

      if (walletError) {
        console.log('⚠️ No credit wallet found for organization')
        setCreditWallet(null)
      } else {
        setCreditWallet(walletData)
        console.log('✅ Credit wallet found, balance:', walletData.balance)
      }

    } catch (error) {
      console.error('💥 Unexpected error in refreshOrganization:', error)
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      console.log('🔐 Attempting sign in for:', email)
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('❌ Sign in error:', error.message)
        return { error: error.message }
      }

      if (data.session) {
        console.log('✅ Sign in successful, session created')
        // Aguardar um pouco para garantir que os cookies sejam definidos
        await new Promise(resolve => setTimeout(resolve, 100))
        return { success: true }
      } else {
        console.error('❌ Sign in failed: No session created')
        return { error: 'Falha ao criar sessão' }
      }
    } catch (error) {
      console.error('💥 Unexpected error in signIn:', error)
      return { error: 'Erro inesperado durante o login' }
    }
  }

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      console.log('📝 Attempting sign up for:', email)
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (error) {
        console.error('❌ Sign up error:', error.message)
        return { error: error.message }
      }

      console.log('✅ Sign up successful')
      return { success: true }
    } catch (error) {
      console.error('💥 Unexpected error in signUp:', error)
      return { error: 'Erro inesperado durante o cadastro' }
    }
  }

  const signOut = async () => {
    try {
      console.log('🚪 Signing out user')
      
      // Limpar estado imediatamente para melhor UX
      setUser(null)
      setSession(null)
      setProfile(null)
      setOrganization(null)
      setCreditWallet(null)
      
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('❌ Sign out error:', error.message)
        // Mesmo com erro, mantemos o estado limpo localmente
      } else {
        console.log('✅ Sign out successful')
      }
      
      // Forçar redirecionamento para página de login
      if (typeof window !== 'undefined') {
        window.location.href = '/signin'
      }
    } catch (error) {
      console.error('💥 Unexpected error in signOut:', error)
      // Mesmo com erro, limpar estado local
      setUser(null)
      setSession(null)
      setProfile(null)
      setOrganization(null)
      setCreditWallet(null)
      
      // Redirecionar mesmo em caso de erro
      if (typeof window !== 'undefined') {
        window.location.href = '/signin'
      }
    }
  }

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Tentar obter sessão com retry para melhor confiabilidade
        let session = null
        let attempts = 0
        const maxAttempts = 3
        
        while (!session && attempts < maxAttempts) {
          const { data: { session: currentSession }, error } = await supabase.auth.getSession()
          if (error) {
            console.error(`Auth attempt ${attempts + 1} failed:`, error)
          }
          session = currentSession
          if (!session && attempts < maxAttempts - 1) {
            await new Promise(resolve => setTimeout(resolve, 200))
          }
          attempts++
        }
        
        console.log('🔐 Auth initialized:', session ? 'Session found' : 'No session')
        console.log('🔐 Session details:', session ? { 
          access_token: session.access_token ? 'Present' : 'Missing',
          user_id: session.user?.id,
          expires_at: session.expires_at 
        } : 'No session object')
        setSession(session)
        setUser(session?.user ?? null)
      } catch (error) {
        console.error('Error getting session:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state changed:', event, session ? 'Session exists' : 'No session')
        console.log('🔄 Session details on change:', session ? { 
          access_token: session.access_token ? 'Present' : 'Missing',
          user_id: session.user?.id,
          expires_at: session.expires_at 
        } : 'No session object')
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) {
      console.log('👤 User detected, loading profile...')
      refreshProfile().then(() => {
        console.log('✅ Profile loaded')
      }).catch(error => {
        console.error('❌ Error loading profile:', error)
      })
    } else {
      console.log('👤 No user, clearing profile and organization')
      setProfile(null)
      setOrganization(null)
      setCreditWallet(null)
      setLoading(false)
    }
  }, [user])

  // Carregar organização apenas após o perfil estar disponível
  useEffect(() => {
    if (profile) {
      console.log('👤 Profile available, loading organization...')
      refreshOrganization().then(() => {
        console.log('✅ Organization loaded')
        setLoading(false)
      }).catch(error => {
        console.error('❌ Error loading organization:', error)
        setLoading(false)
      })
    }
  }, [profile])

  const value = {
    user,
    session,
    profile,
    organization,
    creditWallet,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    refreshOrganization,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}