import { nextRouteHandlerAdapter } from '@igniter-js/core/adapters'
import { AppRouter } from '../../../../igniter.router'

export const { GET, POST, PUT, DELETE, PATCH } = nextRouteHandlerAdapter(AppRouter)