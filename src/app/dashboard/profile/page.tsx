'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Save,
  User,
  Building,
} from 'lucide-react'

interface OrganizationData {
  name: string
  slug: string
  description?: string
  website?: string
  phone?: string
  address?: string
}

interface ProfileData {
  full_name: string
  phone?: string
}

export default function ProfilePage() {
  const router = useRouter()
  const { organization, profile, user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [organizationData, setOrganizationData] = useState<OrganizationData>({
    name: '',
    slug: '',
    description: '',
    website: '',
    phone: '',
    address: ''
  })
  const [profileData, setProfileData] = useState<ProfileData>({
    full_name: '',
    phone: ''
  })

  useEffect(() => {
    if (organization) {
      setOrganizationData({
        name: organization.name || '',
        slug: organization.slug || '',
        description: (organization as any).description || '',
        website: (organization as any).website || '',
        phone: (organization as any).phone || '',
        address: (organization as any).address || ''
      })
    }

    if (profile) {
      setProfileData({
        full_name: profile.full_name || '',
        phone: profile.phone || ''
      })
    }
  }, [organization, profile])

  const handleOrganizationSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organization?.id) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: organizationData.name,
          description: organizationData.description,
          website: organizationData.website,
          phone: organizationData.phone,
          address: organizationData.address,
          updated_at: new Date().toISOString()
        })
        .eq('id', organization.id)

      if (error) throw error

      toast.success('Informações da organização atualizadas com sucesso!')
      
      // Recarregar a página para atualizar o contexto
      window.location.reload()
    } catch (error) {
      console.error('Erro ao atualizar organização:', error)
      toast.error('Erro ao atualizar informações da organização')
    } finally {
      setLoading(false)
    }
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.id) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name,
          phone: profileData.phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id)

      if (error) throw error

      toast.success('Perfil atualizado com sucesso!')
      
      // Recarregar a página para atualizar o contexto
      window.location.reload()
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error)
      toast.error('Erro ao atualizar perfil')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Editar Perfil
        </h1>
        <p className="text-gray-600">
          Gerencie as informações do seu perfil e da sua organização
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        {/* Informações da Organização */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Informações do Negócio
            </CardTitle>
            <CardDescription>
              Atualize as informações da sua organização
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleOrganizationSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Nome da Organização *</Label>
                <Input
                  id="org-name"
                  value={organizationData.name}
                  onChange={(e) => setOrganizationData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome da sua empresa"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-slug">Slug da Organização</Label>
                <Input
                  id="org-slug"
                  value={organizationData.slug}
                  onChange={(e) => setOrganizationData(prev => ({ ...prev, slug: e.target.value }))}
                  placeholder="slug-da-empresa"
                  disabled
                />
                <p className="text-xs text-gray-500">
                  O slug não pode ser alterado após a criação
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-description">Descrição</Label>
                <Textarea
                  id="org-description"
                  value={organizationData.description}
                  onChange={(e) => setOrganizationData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descreva sua empresa..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-website">Website</Label>
                <Input
                  id="org-website"
                  type="url"
                  value={organizationData.website}
                  onChange={(e) => setOrganizationData(prev => ({ ...prev, website: e.target.value }))}
                  placeholder="https://www.exemplo.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-phone">Telefone</Label>
                <Input
                  id="org-phone"
                  value={organizationData.phone}
                  onChange={(e) => setOrganizationData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-address">Endereço</Label>
                <Textarea
                  id="org-address"
                  value={organizationData.address}
                  onChange={(e) => setOrganizationData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Endereço completo da empresa"
                  rows={2}
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                <Save className="mr-2 h-4 w-4" />
                {loading ? 'Salvando...' : 'Salvar Informações do Negócio'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Informações do Perfil Pessoal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informações Pessoais
            </CardTitle>
            <CardDescription>
              Atualize suas informações pessoais
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Nome Completo *</Label>
                <Input
                  id="profile-name"
                  value={profileData.full_name}
                  onChange={(e) => setProfileData(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="Seu nome completo"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-email">Email</Label>
                <Input
                  id="profile-email"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  placeholder="seu@email.com"
                />
                <p className="text-xs text-gray-500">
                  O email não pode ser alterado
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-phone">Telefone Pessoal</Label>
                <Input
                  id="profile-phone"
                  value={profileData.phone}
                  onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                <Save className="mr-2 h-4 w-4" />
                {loading ? 'Salvando...' : 'Salvar Informações Pessoais'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}