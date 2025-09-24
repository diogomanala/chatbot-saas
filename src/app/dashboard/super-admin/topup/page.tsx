'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Plus, 
  Search, 
  AlertTriangle, 
  CheckCircle, 
  CreditCard,
  TrendingUp,
  Users,
  Clock,
  RefreshCw
} from 'lucide-react';
import { CreditWallet, TopUpEvent } from '../../../../../packages/shared/pricing';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Organization {
  id: string;
  name: string;
  email: string;
  orgId: string;
  wallet?: CreditWallet;
}

export default function SuperAdminTopUpPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [filteredOrgs, setFilteredOrgs] = useState<Organization[]>([]);
  const [recentTopUps, setRecentTopUps] = useState<TopUpEvent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpReason, setTopUpReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch organizations and their wallets
  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/super-admin/clients');
      if (!response.ok) {
        throw new Error('Failed to fetch organizations');
      }
      
      const data = await response.json();
      const orgsWithWallets = await Promise.all(
        data.clients.map(async (org: any) => {
          try {
            const walletResponse = await fetch(`/api/credits?type=wallet&orgId=${org.orgId}`);
            const walletData = walletResponse.ok ? await walletResponse.json() : null;
            return {
              ...org,
              wallet: walletData?.wallet
            };
          } catch (error) {
            console.error(`Error fetching wallet for org ${org.orgId}:`, error);
            return org;
          }
        })
      );
      
      setOrganizations(orgsWithWallets);
      setFilteredOrgs(orgsWithWallets);
    } catch (error) {
      console.error('Error fetching organizations:', error);
      setMessage({ type: 'error', text: 'Erro ao carregar organizações' });
    }
  };

  // Fetch recent top-ups across all organizations
  const fetchRecentTopUps = async () => {
    try {
      const response = await fetch('/api/super-admin/topups/recent');
      if (response.ok) {
        const data = await response.json();
        setRecentTopUps(data.events || []);
      }
    } catch (error) {
      console.error('Error fetching recent top-ups:', error);
    }
  };

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchOrganizations(),
        fetchRecentTopUps()
      ]);
      setLoading(false);
    };
    
    loadData();
  }, []);

  // Filter organizations based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredOrgs(organizations);
    } else {
      const filtered = organizations.filter(org => 
        org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        org.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        org.orgId.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredOrgs(filtered);
    }
  }, [searchTerm, organizations]);

  // Handle top-up submission
  const handleTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedOrg || !topUpAmount || parseInt(topUpAmount) <= 0) {
      setMessage({ type: 'error', text: 'Selecione uma organização e informe um valor válido' });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orgId: selectedOrg.orgId,
          addedCredits: parseInt(topUpAmount),
          reason: topUpReason.trim() || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao processar recarga');
      }

      setMessage({ 
        type: 'success', 
        text: `Recarga de ${topUpAmount} créditos realizada com sucesso para ${selectedOrg.name}` 
      });
      
      // Reset form
      setSelectedOrg(null);
      setTopUpAmount('');
      setTopUpReason('');
      
      // Refresh data
      await Promise.all([
        fetchOrganizations(),
        fetchRecentTopUps()
      ]);
    } catch (error) {
      console.error('Error processing top-up:', error);
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Erro ao processar recarga' 
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Refresh all data
  const refreshData = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchOrganizations(),
      fetchRecentTopUps()
    ]);
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <Skeleton className="h-4 w-48 mb-2" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <Skeleton className="h-6 w-20" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recarga de Créditos</h1>
          <p className="text-muted-foreground">
            Adicione créditos manualmente às organizações (Super Admin)
          </p>
        </div>
        <Button 
          onClick={refreshData} 
          disabled={refreshing}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Message Alert */}
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          {message.type === 'error' ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Organizations List */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Organizações ({filteredOrgs.length})
              </CardTitle>
              <CardDescription>
                Selecione uma organização para adicionar créditos
              </CardDescription>
              
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email ou ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredOrgs.length > 0 ? (
                  filteredOrgs.map((org) => (
                    <div 
                      key={org.id}
                      className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedOrg?.id === org.id 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedOrg(org)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium">{org.name}</h3>
                          {org.wallet && org.wallet.balance < 50 && (
                            <Badge variant="destructive" className="text-xs">
                              Saldo Baixo
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{org.email}</p>
                        <p className="text-xs text-muted-foreground">ID: {org.orgId}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">
                          {org.wallet?.balance?.toLocaleString() || '0'}
                        </div>
                        <div className="text-xs text-muted-foreground">créditos</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    {searchTerm ? 'Nenhuma organização encontrada' : 'Nenhuma organização disponível'}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top-up Form */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Adicionar Créditos
              </CardTitle>
              <CardDescription>
                Recarga manual de créditos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTopUp} className="space-y-4">
                {/* Selected Organization */}
                <div className="space-y-2">
                  <Label>Organização Selecionada</Label>
                  {selectedOrg ? (
                    <div className="p-3 border rounded-lg bg-muted/50">
                      <div className="font-medium">{selectedOrg.name}</div>
                      <div className="text-sm text-muted-foreground">{selectedOrg.email}</div>
                      <div className="text-sm">
                        Saldo atual: <span className="font-medium">
                          {selectedOrg.wallet?.balance?.toLocaleString() || '0'} créditos
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 border rounded-lg border-dashed text-center text-muted-foreground">
                      Selecione uma organização na lista
                    </div>
                  )}
                </div>

                {/* Amount */}
                <div className="space-y-2">
                  <Label htmlFor="amount">Quantidade de Créditos</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Ex: 1000"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    disabled={!selectedOrg}
                  />
                  <p className="text-xs text-muted-foreground">
                    1 crédito = até 1.000 tokens processados
                  </p>
                </div>

                {/* Reason */}
                <div className="space-y-2">
                  <Label htmlFor="reason">Motivo (Opcional)</Label>
                  <Textarea
                    id="reason"
                    placeholder="Ex: Recarga promocional, créditos de boas-vindas..."
                    value={topUpReason}
                    onChange={(e) => setTopUpReason(e.target.value)}
                    disabled={!selectedOrg}
                    rows={3}
                  />
                </div>

                {/* Submit Button */}
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={!selectedOrg || !topUpAmount || submitting}
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Adicionar {topUpAmount || '0'} Créditos
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Recent Top-ups */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recargas Recentes
              </CardTitle>
              <CardDescription>
                Últimas {recentTopUps.length} recargas realizadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {recentTopUps.length > 0 ? (
                  recentTopUps.map((event) => {
                    const org = organizations.find(o => o.orgId === event.orgId);
                    return (
                      <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-green-100 text-green-600">
                            <TrendingUp className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {org?.name || 'Organização não encontrada'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(event.createdAt), { 
                                addSuffix: true, 
                                locale: ptBR 
                              })}
                            </p>
                            {event.reason && (
                              <p className="text-xs text-muted-foreground italic">
                                {event.reason}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          +{event.addedCredits}
                        </Badge>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma recarga registrada ainda
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}