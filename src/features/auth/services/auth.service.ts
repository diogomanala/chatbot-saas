import { IgniterContext } from '../../../igniter'

interface SignInInput {
  email: string
  password: string
}

interface SignUpInput {
  email: string
  password: string
  fullName?: string
}

export const authService = {
  async signIn(input: SignInInput, ctx: IgniterContext) {
    const { data, error } = await ctx.supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    })

    if (error) {
      throw new Error(error.message)
    }

    return {
      user: data.user,
      session: data.session,
      success: true,
    }
  },

  async signUp(input: SignUpInput, ctx: IgniterContext) {
    const { data, error } = await ctx.supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          full_name: input.fullName,
        },
      },
    })

    if (error) {
      throw new Error(error.message)
    }

    return {
      user: data.user,
      session: data.session,
      success: true,
    }
  },

  async signOut(ctx: IgniterContext) {
    const { error } = await ctx.supabase.auth.signOut()

    if (error) {
      throw new Error(error.message)
    }

    return { success: true }
  },

  async getSession(ctx: IgniterContext) {
    const { data: { user }, error } = await ctx.supabase.auth.getUser()
    const session = user ? { user } : null

    if (error) {
      throw new Error(error.message)
    }

    return {
      session,
      user: session?.user || null,
    }
  },

  async getProfile(ctx: IgniterContext) {
    const { data: { user } } = await ctx.supabase.auth.getUser()
    const session = user ? { user } : null
    
    if (!session?.user) {
      return {
        profile: null,
        organization: null,
      }
    }

    // Buscar perfil do usuário
    const { data: profileData } = await ctx.supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (!profileData) {
      return {
        profile: null,
        organization: null,
      }
    }

    // Buscar organização
    const { data: orgData } = await ctx.supabase
      .from('organizations')
      .select('*')
      .eq('id', (profileData as any).org_id)
      .single()

    return {
      profile: profileData,
      organization: orgData,
    }
  },
}