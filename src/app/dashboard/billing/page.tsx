'use client';

import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  CreditCard, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  AlertTriangle,
  RefreshCw,
  Zap,
  BarChart3,
  DollarSign,
  MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BillingStats {
  org_id: string;
  current_balance: number;
  total_charged: number;
  total_messages: number;
  total_tokens: number;
  average_tokens_per_message: number;
}

interface UsageStats {
  totalCreditsUsed: number;
  totalTokensProcessed: number;
  averageCreditsPerMessage: number;
  mostActiveChannel: 'web' | 'whatsapp';
}

export default function BillingPage() {
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addingCredits, setAddingCredits] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const supabase = createClientComponentClient();
  const { organization } = useAuth();

  // Fetch billing data
  const fetchBillingData = async (showRefreshing = false) => {
    if (!organization?.id) return;
    
    try {
      if (showRefreshing) setRefreshing(true);
      setLoading(true);
      
      const { data, error } = await supabase.rpc('get_billing_stats', {
        p_org_id: organization.id
      });

      if (error) {
        console.error('Erro ao buscar estatísticas:', error);
        setError('Erro ao carregar estatísticas de cobrança');
        toast.error('Erro ao carregar estatísticas de cobrança');
        return;
      }

      setStats(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching billing data:', err);
      setError('Erro ao carregar dados de cobrança');
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const addCredits = async () => {
    if (!creditAmount || parseFloat(creditAmount) <= 0) {
      toast.error('Digite um valor válido para os créditos');
      return;
    }

    try {
      setAddingCredits(true);
      const response = await fetch('/api/billing/add-credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          org_id: organization?.id,
          credits: parseFloat(creditAmount)
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`R$ ${creditAmount} adicionados com sucesso!`);
        setCreditAmount('');
        fetchBillingData(true); // Atualizar estatísticas
      } else {
        toast.error('Erro ao adicionar créditos');
      }
    } catch (error) {
      console.error('Erro ao adicionar créditos:', error);
      toast.error('Erro ao adicionar créditos');
    } finally {
      setAddingCredits(false);
    }
  };

  useEffect(() => {
    if (organization?.id) {
      fetchBillingData();
    }
  }, [organization?.id]);

  // Helper functions
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getBalanceStatus = (balance: number) => {
    if (balance > 100) return { color: 'bg-green-500', text: 'Saldo Alto' };
    if (balance > 50) return { color: 'bg-yellow-500', text: 'Saldo Médio' };
    if (balance > 10) return { color: 'bg-orange-500', text: 'Saldo Baixo' };
    return { color: 'bg-red-500', text: 'Saldo Crítico' };
  };

  // Calculate usage statistics
  const calculateUsageStats = (): UsageStats => {
    if (!stats) {
      return {
        totalCreditsUsed: 0,
        totalTokensProcessed: 0,
        averageCreditsPerMessage: 0,
        mostActiveChannel: 'web'
      };
    }

    return {
      totalCreditsUsed: stats.total_charged,
      totalTokensProcessed: stats.total_tokens,
      averageCreditsPerMessage: stats.average_tokens_per_message * 0.001, // tokens * custo por token
      mostActiveChannel: 'web'
    };
  };

  const usageStats = calculateUsageStats();
  const balance = stats?.current_balance || 0;
  const isLowBalance = balance < 100;
  const balanceStatus = getBalanceStatus(balance);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Carregando estatísticas...</span>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <p className="text-muted-foreground">{error || 'Erro ao carregar estatísticas de cobrança'}</p>
          <Button onClick={() => fetchBillingData()} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard de Cobrança</h1>
          <p className="text-muted-foreground">
            Gerencie créditos e monitore o uso do sistema
          </p>
        </div>
        <Button 
          onClick={() => fetchBillingData(true)}
          variant="outline"
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Low Balance Warning */}
      {isLowBalance && balance > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            ⚠️ Saldo baixo! Você tem apenas {formatCurrency(balance)} restantes. 
            Considere recarregar para evitar interrupções no serviço.
          </AlertDescription>
        </Alert>
      )}

      {/* Zero Balance Alert */}
      {balance === 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            🚫 Saldo esgotado! Recarregue seus créditos para continuar usando o serviço.
          </AlertDescription>
        </Alert>
      )}

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Atual</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.current_balance)}</div>
            <div className="flex items-center mt-2">
              <Badge className={`${balanceStatus.color} text-white`}>
                {balanceStatus.text}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cobrado</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.total_charged)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Valor total já cobrado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Mensagens</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_messages.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Mensagens processadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tokens Utilizados</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_tokens.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Média: {stats.average_tokens_per_message.toFixed(1)} por mensagem
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Seção de Adicionar Créditos */}
      <Card>
        <CardHeader>
          <CardTitle>Adicionar Créditos</CardTitle>
          <CardDescription>
            Adicione créditos à sua conta para continuar usando o sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end space-x-4">
            <div className="flex-1">
              <Label htmlFor="credit-amount">Valor em Reais (R$)</Label>
              <Input
                id="credit-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="100.00"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                disabled={addingCredits}
              />
            </div>
            <Button 
              onClick={addCredits} 
              disabled={addingCredits || !creditAmount}
            >
              {addingCredits ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              Adicionar Créditos
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Informações Adicionais */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Sistema</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">ID da Organização</Label>
              <p className="text-sm text-muted-foreground font-mono">{stats.org_id}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Custo por Token</Label>
              <p className="text-sm text-muted-foreground">R$ 0,001</p>
            </div>
          </div>
          
          <div className="text-sm text-muted-foreground">
            <p><strong>Como funciona a cobrança:</strong></p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Cada mensagem é processada e convertida em tokens</li>
              <li>Cada token custa R$ 0,001</li>
              <li>O valor é debitado automaticamente do seu saldo</li>
              <li>Quando o saldo fica baixo, adicione mais créditos</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}