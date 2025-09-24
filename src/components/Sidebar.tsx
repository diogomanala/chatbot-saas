'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  Smartphone,
  Bot,
  MessageSquare,
  Wallet,
  Settings,
  LogOut,
  Zap,
} from 'lucide-react'

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Dispositivos',
    href: '/dashboard/devices',
    icon: Smartphone,
  },
  {
    name: 'Chatbots',
    href: '/dashboard/chatbots',
    icon: Bot,
  },
  {
        name: 'Gatilhos',
        href: '/dashboard/intents',
    icon: Zap,
  },
  {
    name: 'Mensagens',
    href: '/dashboard/messages',
    icon: MessageSquare,
  },
  {
    name: 'Créditos',
    href: '/dashboard/wallet',
    icon: Wallet,
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { organization, signOut } = useAuth()

  return (
    <div className="flex h-full w-64 flex-col bg-gray-900">
      <div className="flex h-16 items-center justify-center border-b border-gray-800">
        <h1 className="text-xl font-bold text-white">SaaS Chatbot</h1>
      </div>

      <div className="flex-1 space-y-1 px-2 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group flex items-center rounded-md px-2 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              )}
            >
              <item.icon
                className={cn(
                  'mr-3 h-5 w-5 flex-shrink-0',
                  isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'
                )}
              />
              {item.name}
            </Link>
          )
        })}
      </div>

      <div className="border-t border-gray-800 p-4">
        <div className="mb-4">
          <p className="text-sm font-medium text-white">
            {organization?.name}
          </p>
          <p className="text-xs text-gray-400">
            {organization?.slug}
          </p>
          <Link
            href="/dashboard/profile"
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors mt-1 block"
          >
            Editar Perfil
          </Link>
        </div>
        
        <Button
          variant="ghost"
          className="w-full justify-start text-gray-300 hover:bg-gray-700 hover:text-white"
          onClick={signOut}
        >
          <LogOut className="mr-3 h-4 w-4" />
          Sair
        </Button>
      </div>
    </div>
  )
}