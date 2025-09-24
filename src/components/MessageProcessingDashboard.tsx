'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Play, BarChart3, CreditCard, MessageSquare, Clock, CheckCircle, XCircle, SkipForward } from 'lucide-react';
import { toast } from 'sonner';

interface MessageStats {
  total: number;
  pending: number;
  charged: number;
  failed: number;
  skipped: number;
  totalCreditsCharged: number;
  totalTokensUsed: number;
}

interface ProcessingResult {
  success: boolean;
  message: string;
  data?: {
    messagesProcessed: number;
    creditsDebited: number;
    currentBalance: number;
    timestamp: string;
  };
}

interface MessageProcessingDashboardProps {
  orgId: string;
}

export function MessageProcessingDashboard({ orgId }: MessageProcessingDashboardProps) {
  const [stats, setStats] = useState<MessageStats | null>(null);
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  // Carregar estatísticas
  const loadStats = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/process-messages?orgId=${orgId}`);
      const result = await response.json();
      
      if (result.success) {
        setStats(result.data.messageStats);
        setCurrentBalance(result.data.currentBalance);
        setLastUpdate(new Date(result.data.timestamp).toLocaleString('pt-BR'));
      } else {
        toast.error('Erro ao carregar estatísticas: ' + result.error);
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
      toast.error('Erro ao carregar estatísticas');
    } finally {
      setIsLoading(false);
    }
  };

  // Processar mensagens
  const processMessages = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/process-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orgId })
      });
      
      const result: ProcessingResult = await response.json();
      
      if (result.success) {
        toast.success(result.message);
        
        if (result.data) {
          toast.success(
            `Processadas ${result.data.messagesProcessed} mensagens. ` +
            `Debitados ${result.data.creditsDebited} créditos. ` +
            `Saldo atual: ${result.data.currentBalance}`
          );
        }
        
        // Recarregar estatísticas
        await loadStats();
      } else {
        toast.error('Erro no processamento: ' + result.message);
      }
    } catch (error) {
      console.error('Erro ao processar mensagens:', error);
      toast.error('Erro ao processar mensagens');
    } finally {
      setIsProcessing(false);
    }
  };

  // Carregar dados iniciais
  useEffect(() => {
    loadStats();
  }, [orgId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Processamento de Mensagens</h2>
          <p className="text-muted-foreground">
            Contagem automática e débito de créditos baseado em mensagens processadas
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadStats}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            onClick={processMessages}
            disabled={isProcessing || isLoading}
            size="sm"
          >
            <Play className={`h-4 w-4 mr-2 ${isProcessing ? 'animate-pulse' : ''}`} />
            {isProcessing ? 'Processando...' : 'Processar Mensagens'}
          </Button>
        </div>
      </div>

      {/* Saldo Atual */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Saldo Atual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600">
            {currentBalance.toLocaleString('pt-BR')} créditos
          </div>
          {lastUpdate && (
            <p className="text-sm text-muted-foreground mt-1">
              Última atualização: {lastUpdate}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Estatísticas de Mensagens */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Mensagens</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                Todas as mensagens registradas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">
                Aguardando processamento
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cobradas</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.charged}</div>
              <p className="text-xs text-muted-foreground">
                Processadas com sucesso
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Falharam</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
              <p className="text-xs text-muted-foreground">
                Saldo insuficiente ou erro
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Resumo Financeiro */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Resumo Financeiro
            </CardTitle>
            <CardDescription>
              Análise de créditos e tokens utilizados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <p className="text-sm font-medium">Total de Créditos Cobrados</p>
                <p className="text-2xl font-bold text-blue-600">
                  {stats.totalCreditsCharged.toLocaleString('pt-BR')}
                </p>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium">Total de Tokens Usados</p>
                <p className="text-2xl font-bold text-purple-600">
                  {stats.totalTokensUsed.toLocaleString('pt-BR')}
                </p>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium">Taxa de Sucesso</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.total > 0 ? Math.round((stats.charged / stats.total) * 100) : 0}%
                </p>
              </div>
            </div>
            
            <Separator />
            
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                {stats.charged} Cobradas
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {stats.pending} Pendentes
              </Badge>
              <Badge variant="destructive" className="flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                {stats.failed} Falharam
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1">
                <SkipForward className="h-3 w-3" />
                {stats.skipped} Ignoradas
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instruções */}
      <Card>
        <CardHeader>
          <CardTitle>Como Funciona</CardTitle>
          <CardDescription>
            Sistema automático de contagem e débito de créditos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm space-y-2">
            <p><strong>1. Contagem Automática:</strong> O sistema conta todas as mensagens outbound (respostas do bot) que ainda não foram processadas.</p>
            <p><strong>2. Fórmula de Tokens:</strong> Para mensagens sem tokens definidos, aplica a fórmula: ~4 caracteres por token + 50 tokens de sistema.</p>
            <p><strong>3. Cálculo de Créditos:</strong> Converte tokens em créditos usando a taxa: 1000 tokens = 1 crédito.</p>
            <p><strong>4. Débito Automático:</strong> Debita os créditos da carteira e atualiza o saldo em tempo real.</p>
            <p><strong>5. Atualização de Status:</strong> Marca as mensagens como &apos;debited&apos;, &apos;failed&apos; ou &apos;skipped&apos; conforme o resultado.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}