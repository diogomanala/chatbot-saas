'use client';

import { MessageProcessingDashboard } from '@/components/MessageProcessingDashboard';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function MessageProcessingPage() {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUserOrg() {
      if (!user?.id) return;
      
      try {
         const { data: profileData, error } = await supabase
           .from('profiles')
           .select('org_id')
           .eq('id', user.id)
           .single();

         if (error) {
           console.error('Erro ao buscar organização:', error);
           return;
         }

         if (profileData?.org_id) {
           setOrgId(profileData.org_id);
         }
      } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
      } finally {
        setLoading(false);
      }
    }

    loadUserOrg();
  }, [user]);

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">Carregando...</div>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center text-red-500">Organização não encontrada</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <MessageProcessingDashboard orgId={orgId} />
    </div>
  );
}