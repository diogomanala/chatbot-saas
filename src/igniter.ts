import { Igniter } from '@igniter-js/core'
import { createIgniterAppContext } from './igniter.context'

/**
 * @description Initialize the Igniter.js
 * @see https://github.com/felipebarcelospro/igniter-js
 */
export const igniter = Igniter
  .context(createIgniterAppContext())
  .config({
    baseURL: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
    basePATH: '/api',
  })
  .create()

export type IgniterContext = ReturnType<typeof createIgniterAppContext>