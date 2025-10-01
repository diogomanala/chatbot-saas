import { createIgniterClient } from '@igniter-js/core/client'
import type { AppRouterType } from './igniter.router'

export const api = createIgniterClient<AppRouterType>({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  basePATH: '/api',
  router: () => {
    if (typeof window === 'undefined') {
      return require('./igniter.router').AppRouter
    }
    return require('./igniter.router').AppRouter
  },
})