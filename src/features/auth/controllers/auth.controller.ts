import { igniter } from '../../../igniter'
import { z } from 'zod'

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(2),
})

export const authController = igniter.controller({
  name: 'auth',
  path: '/auth',
  actions: {
    signIn: igniter.mutation({
      path: '/signin',
      method: 'POST',
      body: signInSchema,
      handler: async ({ request, context, response }) => {
        const { email, password } = request.body
        const { data, error } = await context.supabase.auth.signInWithPassword({
          email,
          password,
        })
        
        if (error) {
          throw new Error(error.message)
        }
        
        return response.success({ user: data.user, session: data.session })
      },
    }),
    
    signUp: igniter.mutation({
      path: '/signup',
      method: 'POST',
      body: signUpSchema,
      handler: async ({ request, context, response }) => {
        const { email, password, fullName } = request.body
        
        // Use admin client if available (server-side), otherwise use regular client
        if (context.supabaseAdmin) {
          const { data, error } = await context.supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
              full_name: fullName,
            },
          })
          
          if (error) {
            throw new Error(error.message)
          }
          
          return response.success({ user: data.user })
        } else {
          // Fallback to regular signup
          const { data, error } = await context.supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: fullName,
              },
            },
          })
          
          if (error) {
            throw new Error(error.message)
          }
          
          return response.success({ user: data.user })
        }
      },
    }),
    
    signOut: igniter.mutation({
      path: '/signout',
      method: 'POST',
      handler: async ({ context, response }) => {
        const { error } = await context.supabase.auth.signOut()
        
        if (error) {
          throw new Error(error.message)
        }
        
        return response.success({ message: 'Signed out successfully' })
      },
    }),
    
    getSession: igniter.query({
      path: '/session',
      method: 'GET',
      handler: async ({ context, response }) => {
        const { data: { user } } = await context.supabase.auth.getUser()
    const session = user ? { user } : null
        return response.success({ session })
      },
    }),
    
    getProfile: igniter.query({
      path: '/profile',
      method: 'GET',
      handler: async ({ context, response }) => {
        const { data: { user } } = await context.supabase.auth.getUser()
    const session = user ? { user } : null
        
        if (!session) {
          throw new Error('Not authenticated')
        }
        
        const { data: profileData } = await context.supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
        
        const { data: orgData } = await context.supabase
          .from('organizations')
          .select('*')
          .eq('owner_user_id', session.user.id)
          .single()
        
        return response.success({ 
          profile: profileData, 
          organization: orgData 
        })
      },
    }),
  },
})