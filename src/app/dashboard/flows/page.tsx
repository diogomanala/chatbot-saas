'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  ReactFlowInstance,
  NodeProps,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Play, 
  MessageSquare, 
  Save, 
  Plus,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Componente de nó editável para mensagens
const EditableMessageNode = ({ data, id }: NodeProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState(data.message || 'Digite sua mensagem...');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setMessage(data.message || 'Digite sua mensagem...');
    }
  };

  const handleSave = () => {
    setIsEditing(false);
    // Atualizar o nó com a nova mensagem
    data.message = message;
  };

  const handleBlur = () => {
    handleSave();
  };

  return (
    <div 
      className="px-4 py-2 shadow-md rounded-md bg-blue-100 border-2 border-blue-500 min-w-[200px]"
      onDoubleClick={handleDoubleClick}
    >
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center">
        <MessageSquare className="w-4 h-4 mr-2 text-blue-600 flex-shrink-0" />
        <div className="ml-2 flex-1">
          <div className="text-lg font-bold text-blue-800">Enviar Mensagem</div>
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              onBlur={handleBlur}
              className="text-sm text-blue-600 bg-transparent border-none outline-none w-full"
              placeholder="Digite sua mensagem..."
            />
          ) : (
            <div className="text-sm text-blue-600 cursor-pointer">
              {message || 'Digite sua mensagem...'}
            </div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
};

// Tipos de nós personalizados
const nodeTypes = {
  input: ({ data }: NodeProps) => (
    <div className="px-4 py-2 shadow-md rounded-md bg-green-100 border-2 border-green-500">
      <div className="flex items-center">
        <Play className="w-4 h-4 mr-2 text-green-600" />
        <div className="ml-2">
          <div className="text-lg font-bold text-green-800">Ponto de Início</div>
          <div className="text-sm text-green-600">Início do fluxo</div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  ),
  message: EditableMessageNode,
};

// Nós iniciais
const initialNodes: Node[] = [
  {
    id: '1',
    type: 'input',
    position: { x: 250, y: 25 },
    data: { label: 'Início' },
  },
];

const initialEdges: Edge[] = [];

// Componente da barra lateral
const Sidebar = () => {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <Card className="w-64 h-full">
      <CardHeader>
        <CardTitle className="text-lg">Componentes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="dndnode input cursor-grab active:cursor-grabbing"
          onDragStart={(event) => onDragStart(event, 'input')}
          draggable
        >
          <div className="flex items-center p-3 border-2 border-dashed border-green-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors">
            <Play className="w-5 h-5 mr-3 text-green-600" />
            <div>
              <div className="font-semibold text-green-800">Ponto de Início</div>
              <div className="text-sm text-green-600">Onde o fluxo começa</div>
            </div>
          </div>
        </div>

        <div
          className="dndnode message cursor-grab active:cursor-grabbing"
          onDragStart={(event) => onDragStart(event, 'message')}
          draggable
        >
          <div className="flex items-center p-3 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors">
            <MessageSquare className="w-5 h-5 mr-3 text-blue-600" />
            <div>
              <div className="font-semibold text-blue-800">Enviar Mensagem</div>
              <div className="text-sm text-blue-600">Enviar texto ao usuário</div>
            </div>
          </div>
        </div>

        <Separator />
        
        <div className="text-sm text-gray-600 space-y-2">
          <div className="font-semibold">Instruções:</div>
          <ul className="text-xs space-y-1">
            <li>• Arraste componentes para o canvas</li>
            <li>• Conecte nós arrastando das bordas</li>
            <li>• Duplo clique em "Enviar Mensagem" para editar</li>
            <li>• Selecione itens e pressione Delete para remover</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

// Componente principal do Flow Builder
const FlowBuilder = () => {
  const { user, profile } = useAuth();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [flowName, setFlowName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Handler para conectar nós
  const onConnect = useCallback(
    (params: Connection) => {
      console.log('Conectando nós:', params);
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  // Handler para arrastar sobre o canvas
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handler para soltar nós no canvas
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      const type = event.dataTransfer.getData('application/reactflow');

      if (typeof type === 'undefined' || !type || !reactFlowInstance || !reactFlowBounds) {
        return;
      }

      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const newNode: Node = {
        id: `${type}_${Date.now()}`,
        type,
        position,
        data: { 
          label: type === 'input' ? 'Início' : 'Nova mensagem',
          message: type === 'message' ? 'Digite sua mensagem aqui...' : undefined
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  // Handler para teclas (Delete/Backspace)
  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (!reactFlowInstance) return;

        const selectedNodes = reactFlowInstance.getNodes().filter(node => node.selected);
        const selectedEdges = reactFlowInstance.getEdges().filter(edge => edge.selected);

        if (selectedNodes.length > 0 || selectedEdges.length > 0) {
          // Remover nós selecionados
          if (selectedNodes.length > 0) {
            const nodeIdsToRemove = selectedNodes.map(node => node.id);
            setNodes((nds) => nds.filter(node => !nodeIdsToRemove.includes(node.id)));
            
            // Também remover arestas conectadas aos nós removidos
            setEdges((eds) => eds.filter(edge => 
              !nodeIdsToRemove.includes(edge.source) && !nodeIdsToRemove.includes(edge.target)
            ));
          }

          // Remover arestas selecionadas
          if (selectedEdges.length > 0) {
            const edgeIdsToRemove = selectedEdges.map(edge => edge.id);
            setEdges((eds) => eds.filter(edge => !edgeIdsToRemove.includes(edge.id)));
          }

          console.log('Itens removidos:', { 
            nodes: selectedNodes.length, 
            edges: selectedEdges.length 
          });
        }
      }
    },
    [reactFlowInstance, setNodes, setEdges]
  );

  // Adicionar listener para teclas
  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onKeyDown]);

  // Handler para salvar o fluxo
  const onSave = useCallback(async () => {
    if (!flowName.trim()) {
      toast.error('Por favor, digite um nome para o fluxo');
      return;
    }

    if (!user || !profile) {
      toast.error('Usuário não autenticado');
      return;
    }

    if (!reactFlowInstance) {
      toast.error('Erro interno: instância do React Flow não encontrada');
      return;
    }

    setIsSaving(true);

    try {
      // Obter o estado atual do fluxo com todos os dados atualizados
      const flow = reactFlowInstance.toObject();
      
      // Preparar dados para salvar - incluindo dados editados dos nós
      const flowData = {
        nodes: flow.nodes.map(node => ({
          ...node,
          data: {
            ...node.data,
            // Garantir que mensagens editadas sejam salvas
            message: node.data.message
          }
        })),
        edges: flow.edges,
        viewport: flow.viewport,
      };

      console.log('Dados do fluxo a serem salvos:', flowData);

      // Buscar um chatbot ativo para associar ao fluxo
      const { data: chatbots, error: chatbotsError } = await supabase
        .from('chatbots')
        .select('id')
        .eq('org_id', profile.org_id)
        .eq('active', true)
        .limit(1);

      if (chatbotsError) {
        throw new Error(`Erro ao buscar chatbots: ${chatbotsError.message}`);
      }

      if (!chatbots || chatbots.length === 0) {
        toast.error('Nenhum chatbot ativo encontrado. Crie um chatbot primeiro.');
        return;
      }

      // Salvar o fluxo no banco de dados
      const { data, error } = await supabase
        .from('flows')
        .insert({
          org_id: profile.org_id,
          chatbot_id: chatbots[0].id,
          name: flowName.trim(),
          flow_data: flowData,
          trigger_keywords: [], // Por enquanto vazio, pode ser expandido futuramente
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao salvar fluxo: ${error.message}`);
      }

      toast.success(`Fluxo "${flowName}" salvo com sucesso!`);
      console.log('Fluxo salvo:', data);

      // Limpar o nome do fluxo após salvar
      setFlowName('');

    } catch (error) {
      console.error('Erro ao salvar fluxo:', error);
      toast.error(error instanceof Error ? error.message : 'Erro desconhecido ao salvar fluxo');
    } finally {
      setIsSaving(false);
    }
  }, [flowName, user, profile, reactFlowInstance]);

  return (
    <div className="h-screen flex">
      {/* Barra lateral */}
      <div className="flex-shrink-0">
        <Sidebar />
      </div>

      {/* Área principal do construtor */}
      <div className="flex-1 flex flex-col">
        {/* Cabeçalho */}
        <div className="bg-white border-b p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold">Construtor de Fluxos</h1>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center space-x-2">
                <Label htmlFor="flow-name">Nome do Fluxo:</Label>
                <Input
                  id="flow-name"
                  value={flowName}
                  onChange={(e) => setFlowName(e.target.value)}
                  placeholder="Digite o nome do fluxo..."
                  className="w-64"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="text-sm text-gray-600">
                Nós: {nodes.length} | Conexões: {edges.length}
              </div>
              <Button 
                onClick={onSave} 
                disabled={isSaving || !flowName.trim()}
                className="flex items-center space-x-2"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{isSaving ? 'Salvando...' : 'Salvar Fluxo'}</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Área do React Flow */}
        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode={['Delete', 'Backspace']}
            multiSelectionKeyCode={['Meta', 'Ctrl']}
            selectionKeyCode={null}
          >
            <Controls />
            <MiniMap />
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
};

// Página principal com Provider
export default function FlowsPage() {
  return (
    <ReactFlowProvider>
      <FlowBuilder />
    </ReactFlowProvider>
  );
}