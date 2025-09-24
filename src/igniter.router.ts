import { igniter } from './igniter'
import { authController } from './features/auth/controllers/auth.controller'
import { messageController } from './features/message'

export const AppRouter = igniter.router({
  controllers: {
    auth: authController,
    messages: messageController,
  },
})

export type AppRouterType = typeof AppRouter