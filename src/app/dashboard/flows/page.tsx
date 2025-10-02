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
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Play, 
  MessageSquare, 
  Save, 
  Plus,
  Loader2,
  Settings,
  FileText,
  FolderOpen,
  CheckCircle,
  AlertCircle,
  XCircle,
  MousePointer,
  GitBranch,
  Image,
  Volume2,
  Trash2,
  HelpCircle,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { saveFlowAction, deleteFlowAction } from './actions';
import { createClient } from '@/lib/supabase/client';

// Interface para o chatbot ativo
interface ActiveChatbot {
  id: string;
  name: string;
  flows_enabled: boolean;
}

// Interface para os fluxos salvos
interface SavedFlow {
  id: string;
  name: string;
  flow_data: any;
  created_at: string;
  updated_at: string;
}

// Interface para resultado da validação
interface FlowValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

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
      <Handle 
        type="target" 
        position={Position.Left} 
        style={{
          left: '-8px',
          background: '#8b5cf6',
          border: '2px solid #fff',
          width: '12px',
          height: '12px'
        }}
      />
      <div className="flex items-center justify-between">
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
        <div className="group relative">
          <Info className="w-4 h-4 text-gray-400 hover:text-blue-600 cursor-help" />
          <div className="absolute right-0 top-6 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10">
            Este componente envia uma mensagem de texto para o usuário. Conecte-o a outros componentes para criar um fluxo.
          </div>
        </div>
      </div>
      <Handle 
        type="source" 
        position={Position.Right} 
        style={{
          right: '-8px',
          background: '#3b82f6',
          border: '2px solid #fff',
          width: '12px',
          height: '12px'
        }}
      />
    </div>
  );
};

// Componente de nó para opções (botões)
const OptionsNode = ({ data, id }: NodeProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [question, setQuestion] = useState(data.question || 'Deseja continuar?');
  const [options, setOptions] = useState(data.options || ['Opção 1', 'Opção 2']);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setNodes } = useReactFlow();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setQuestion(data.question || 'Deseja continuar?');
      setOptions(data.options || ['Opção 1', 'Opção 2']);
    }
  };

  const handleSave = () => {
    setIsEditing(false);
    data.question = question;
    data.options = options;
    
    // Forçar atualização do nó no React Flow
    setNodes((nodes) => 
      nodes.map((node) => 
        node.id === id 
          ? { ...node, data: { ...node.data, question, options } }
          : node
      )
    );
  };

  const addOption = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newOptions = [...options, `Opção ${options.length + 1}`];
    setOptions(newOptions);
    data.options = newOptions;
    
    // Atualizar no React Flow
    setNodes((nodes) => 
      nodes.map((node) => 
        node.id === id 
          ? { ...node, data: { ...node.data, options: newOptions } }
          : node
      )
    );
  };

  const removeOption = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (options.length > 1) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
      data.options = newOptions;
      
      // Atualizar no React Flow
      setNodes((nodes) => 
        nodes.map((node) => 
          node.id === id 
            ? { ...node, data: { ...node.data, options: newOptions } }
            : node
        )
      );
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
    data.options = newOptions;
    
    // Atualizar no React Flow
    setNodes((nodes) => 
      nodes.map((node) => 
        node.id === id 
          ? { ...node, data: { ...node.data, options: newOptions } }
          : node
      )
    );
  };

  const handleOptionInputKeyPress = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      // Move to next option or add new one
      if (index === options.length - 1) {
        addOption(e as any);
      }
    }
  };

  const handleOptionInputClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="px-4 py-3 shadow-md rounded-md bg-purple-100 border-2 border-purple-500 min-w-[250px] relative">
      {/* Handle de entrada */}
      <Handle 
        type="target" 
        position={Position.Left} 
        style={{
          left: '-8px',
          background: '#8b5cf6',
          border: '2px solid #fff',
          width: '12px',
          height: '12px'
        }}
      />
      
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <MousePointer className="w-4 h-4 mr-2 text-purple-600" />
          <div className="text-sm font-bold text-purple-800">Pergunta com Botões</div>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsEditing(!isEditing);
            }}
            className="text-purple-600 hover:text-purple-800 p-1 rounded hover:bg-purple-50"
            title="Editar componente"
          >
            <Settings className="w-4 h-4" />
          </button>
          <Info 
            className="w-4 h-4 text-purple-600 cursor-help" 
            title="Este componente permite criar uma pergunta com múltiplas opções de resposta. Cada opção terá seu próprio ponto de ligação."
          />
        </div>
      </div>
      
      {isEditing ? (
        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
          {/* Input da pergunta */}
          <div>
            <label className="text-xs text-purple-700 font-medium mb-1 block">Pergunta:</label>
            <input
              ref={inputRef}
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyPress}
              className="w-full text-sm p-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Digite sua pergunta..."
            />
          </div>
          
          {/* Lista de opções editáveis */}
          <div>
            <label className="text-xs text-purple-700 font-medium mb-1 block">Opções:</label>
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <span className="text-xs text-purple-600 font-medium min-w-[20px]">{index + 1}.</span>
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                    onKeyDown={(e) => handleOptionInputKeyPress(e, index)}
                    onClick={handleOptionInputClick}
                    onFocus={(e) => e.stopPropagation()}
                    className="flex-1 text-xs p-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder={`Opção ${index + 1}`}
                  />
                  {options.length > 1 && (
                    <button
                      onClick={(e) => removeOption(index, e)}
                      className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 flex-shrink-0"
                      type="button"
                      title="Excluir opção"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              
              {/* Botão adicionar opção */}
              <button
                onClick={addOption}
                className="text-xs text-purple-600 hover:text-purple-800 p-2 rounded hover:bg-purple-50 w-full text-left border border-dashed border-purple-300"
                type="button"
              >
                + Adicionar opção
              </button>
            </div>
          </div>
          
          {/* Botões de ação */}
          <div className="flex justify-end space-x-2 pt-2 border-t border-purple-200">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsEditing(false);
                setQuestion(data.question || 'Deseja continuar?');
                setOptions(data.options || ['Opção 1', 'Opção 2']);
              }}
              className="text-xs px-3 py-1 text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSave();
              }}
              className="text-xs px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Salvar
            </button>
          </div>
        </div>
      ) : (
        <div className="cursor-pointer" onClick={(e) => e.stopPropagation()}>
          {/* Pergunta */}
          <div className="text-sm text-purple-700 mb-2 font-medium">
            {question}
          </div>
          
          {/* Lista de opções com handles */}
          <div className="space-y-1">
            {options.map((option, index) => (
              <div key={index} className="relative">
                <div className="text-xs bg-white px-2 py-2 rounded border border-purple-200 pr-6">
                  {option}
                </div>
                {/* Handle individual para cada opção */}
                <Handle 
                  type="source" 
                  position={Position.Right}
                  id={`option-${index}`}
                  style={{
                    right: '-6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: '#f97316',
                    border: '2px solid #fff',
                    width: '12px',
                    height: '12px',
                    position: 'absolute'
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Componente de nó para condições
const ConditionNode = ({ data, id }: NodeProps) => {
  const [conditions, setConditions] = useState(data.conditions || ['button_response equals "Opção 1"', 'button_response equals "Opção 2"']);
  const [showHelp, setShowHelp] = useState(false);

  const addCondition = () => {
    const newConditions = [...conditions, `button_response equals "Nova Opção"`];
    setConditions(newConditions);
    data.conditions = newConditions;
  };

  const removeCondition = (index: number) => {
    if (conditions.length > 1) {
      const newConditions = conditions.filter((_, i) => i !== index);
      setConditions(newConditions);
      data.conditions = newConditions;
    }
  };

  const updateCondition = (index: number, value: string) => {
    const newConditions = [...conditions];
    newConditions[index] = value;
    setConditions(newConditions);
    data.conditions = newConditions;
  };

  const toggleHelp = () => {
    setShowHelp(!showHelp);
  };

  return (
    <div className="px-4 py-3 shadow-md rounded-md bg-orange-100 border-2 border-orange-500 min-w-[200px] relative">
      <Handle 
        type="target" 
        position={Position.Left} 
        style={{
          left: '-8px',
          background: '#ea580c',
          border: '2px solid #fff',
          width: '12px',
          height: '12px'
        }}
      />
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <GitBranch className="w-4 h-4 mr-2 text-orange-600" />
          <div className="text-sm font-bold text-orange-800">Condição</div>
        </div>
        <button
          onClick={toggleHelp}
          className="text-orange-600 hover:text-orange-800 p-1"
          title="Ajuda sobre condições"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
      
      {showHelp && (
        <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-white border border-orange-300 rounded-md shadow-lg z-50 text-xs">
          <div className="font-semibold mb-2 text-orange-800">Como usar condições:</div>
          <div className="space-y-1 text-gray-700">
            <div>• <strong>button_response equals "Texto"</strong> - Resposta exata do botão</div>
            <div>• <strong>button_response contains "Palavra"</strong> - Contém a palavra</div>
            <div>• <strong>button_response starts_with "Início"</strong> - Começa com texto</div>
          </div>
          <div className="mt-2 p-2 bg-orange-50 rounded text-orange-700">
            <strong>Exemplo:</strong> Se seu botão é "Sim", use: <code>button_response equals "Sim"</code>
          </div>
        </div>
      )}
      
      <div className="space-y-2">
        {conditions.map((condition, index) => (
          <div key={index} className="relative">
            <div className="flex items-center space-x-1 mb-1">
              <input
                type="text"
                value={condition}
                onChange={(e) => updateCondition(index, e.target.value)}
                className="flex-1 text-xs p-2 border rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder={`button_response equals "Opção ${index + 1}"`}
              />
              {conditions.length > 1 && (
                <button
                  onClick={() => removeCondition(index)}
                  className="text-red-500 hover:text-red-700 p-1"
                  type="button"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
            <Handle 
              type="source" 
              position={Position.Right} 
              id={`condition-${index}`}
              style={{ 
                top: `${50 + (index * 40)}px`,
                right: '-8px',
                background: '#ea580c',
                border: '2px solid #fff',
                width: '12px',
                height: '12px'
              }}
            />
          </div>
        ))}
        <button
          onClick={addCondition}
          className="text-xs text-orange-600 hover:text-orange-800 p-1"
          type="button"
        >
          + Adicionar condição
        </button>
      </div>
    </div>
  );
};

// Componente de nó para imagens
const ImageNode = ({ data, id }: NodeProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [imageUrl, setImageUrl] = useState(data.imageUrl || '');
  const [caption, setCaption] = useState(data.caption || '');
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
      setImageUrl(data.imageUrl || '');
      setCaption(data.caption || '');
    }
  };

  const handleSave = () => {
    setIsEditing(false);
    data.imageUrl = imageUrl;
    data.caption = caption;
  };

  return (
    <div className="px-4 py-3 shadow-md rounded-md bg-pink-100 border-2 border-pink-500 min-w-[200px]">
      <Handle 
        type="target" 
        position={Position.Left} 
        style={{
          left: '-8px',
          background: '#ec4899',
          border: '2px solid #fff',
          width: '12px',
          height: '12px'
        }}
      />
      <div className="flex items-center mb-2">
        <Image className="w-4 h-4 mr-2 text-pink-600" />
        <div className="text-sm font-bold text-pink-800">Enviar Imagem</div>
      </div>
      
      {isEditing ? (
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="text"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            onKeyDown={handleKeyPress}
            onBlur={handleSave}
            className="w-full text-sm p-2 border rounded"
            placeholder="URL da imagem..."
          />
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onKeyDown={handleKeyPress}
            onBlur={handleSave}
            className="w-full text-sm p-2 border rounded"
            placeholder="Legenda (opcional)..."
          />
        </div>
      ) : (
        <div onDoubleClick={handleDoubleClick} className="cursor-pointer">
          <div className="text-sm text-pink-700 mb-1">
            {imageUrl ? (
              <div className="space-y-1">
                <div className="text-xs bg-white px-2 py-1 rounded border border-pink-200 truncate">
                  {imageUrl}
                </div>
                {caption && (
                  <div className="text-xs text-pink-600">
                    Legenda: {caption}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-pink-500 italic">
                Clique duplo para adicionar URL da imagem
              </div>
            )}
          </div>
        </div>
      )}
      <Handle 
        type="source" 
        position={Position.Right} 
        style={{
          right: '-8px',
          background: '#ec4899',
          border: '2px solid #fff',
          width: '12px',
          height: '12px'
        }}
      />
    </div>
  );
};

// Componente de nó para áudios
const AudioNode = ({ data, id }: NodeProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [audioUrl, setAudioUrl] = useState(data.audioUrl || '');
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
      setAudioUrl(data.audioUrl || '');
    }
  };

  const handleSave = () => {
    setIsEditing(false);
    data.audioUrl = audioUrl;
  };

  return (
    <div className="px-4 py-3 shadow-md rounded-md bg-indigo-100 border-2 border-indigo-500 min-w-[200px]">
      <Handle 
        type="target" 
        position={Position.Left} 
        style={{
          left: '-8px',
          background: '#6366f1',
          border: '2px solid #fff',
          width: '12px',
          height: '12px'
        }}
      />
      <div className="flex items-center mb-2">
        <Volume2 className="w-4 h-4 mr-2 text-indigo-600" />
        <div className="text-sm font-bold text-indigo-800">Enviar Áudio</div>
      </div>
      
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={audioUrl}
          onChange={(e) => setAudioUrl(e.target.value)}
          onKeyDown={handleKeyPress}
          onBlur={handleSave}
          className="w-full text-sm p-2 border rounded"
          placeholder="URL do áudio..."
        />
      ) : (
        <div onDoubleClick={handleDoubleClick} className="cursor-pointer">
          <div className="text-sm text-indigo-700">
            {audioUrl ? (
              <div className="text-xs bg-white px-2 py-1 rounded border border-indigo-200 truncate">
                {audioUrl}
              </div>
            ) : (
              <div className="text-xs text-indigo-500 italic">
                Clique duplo para adicionar URL do áudio
              </div>
            )}
          </div>
        </div>
      )}
      <Handle 
        type="source" 
        position={Position.Right} 
        style={{
          right: '-8px',
          background: '#6366f1',
          border: '2px solid #fff',
          width: '12px',
          height: '12px'
        }}
      />
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
      <Handle 
        type="source" 
        position={Position.Right} 
        style={{
          right: '-8px',
          background: '#22c55e',
          border: '2px solid #fff',
          width: '12px',
          height: '12px'
        }}
      />
    </div>
  ),
  message: EditableMessageNode,
  options: OptionsNode,
  condition: ConditionNode,
  image: ImageNode,
  audio: AudioNode,
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
// Componente Sidebar atualizado com lista de fluxos salvos
const Sidebar = ({ 
  savedFlows, 
  isLoadingFlows, 
  onLoadFlow, 
  onCreateNewFlow,
  currentFlowId,
  onDeleteFlow
}: {
  savedFlows: SavedFlow[];
  isLoadingFlows: boolean;
  onLoadFlow: (flowId: string) => void;
  onCreateNewFlow: () => void;
  currentFlowId: string | null;
  onDeleteFlow: (flowId: string) => void;
}) => {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-64 h-full flex flex-col space-y-4">
      {/* Seção de Fluxos Salvos */}
      <Card className="flex-1">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center">
              <FolderOpen className="w-5 h-5 mr-2" />
              Fluxos Salvos
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={onCreateNewFlow}
              className="h-8 px-2"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoadingFlows ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              <span className="text-sm text-gray-600">Carregando...</span>
            </div>
          ) : savedFlows.length === 0 ? (
            <div className="text-center py-4">
              <FileText className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">Nenhum fluxo salvo</p>
              <p className="text-xs text-gray-500 mt-1">Crie seu primeiro fluxo!</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {savedFlows.map((flow) => (
                <div
                  key={flow.id}
                  className={`p-3 rounded-lg border transition-colors ${
                    currentFlowId === flow.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div 
                      className="flex items-start flex-1 cursor-pointer"
                      onClick={() => onLoadFlow(flow.id)}
                    >
                      <FileText className="w-4 h-4 mr-2 mt-0.5 text-gray-600" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {flow.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(flow.updated_at).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFlow(flow.id);
                      }}
                      className="h-6 w-6 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seção de Componentes */}
      <Card>
        <CardHeader className="pb-3">
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

          <div
            className="dndnode options cursor-grab active:cursor-grabbing"
            onDragStart={(event) => onDragStart(event, 'options')}
            draggable
          >
            <div className="flex items-center p-3 border-2 border-dashed border-purple-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors">
              <MousePointer className="w-5 h-5 mr-3 text-purple-600" />
              <div>
                <div className="font-semibold text-purple-800">Pergunta com Botões</div>
                <div className="text-sm text-purple-600">Enviar pergunta com opções</div>
              </div>
            </div>
          </div>

          <div
            className="dndnode condition cursor-grab active:cursor-grabbing"
            onDragStart={(event) => onDragStart(event, 'condition')}
            draggable
          >
            <div className="flex items-center p-3 border-2 border-dashed border-orange-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-colors">
              <GitBranch className="w-5 h-5 mr-3 text-orange-600" />
              <div>
                <div className="font-semibold text-orange-800">Condição</div>
                <div className="text-sm text-orange-600">Lógica condicional</div>
              </div>
            </div>
          </div>

          <div
            className="dndnode image cursor-grab active:cursor-grabbing"
            onDragStart={(event) => onDragStart(event, 'image')}
            draggable
          >
            <div className="flex items-center p-3 border-2 border-dashed border-pink-300 rounded-lg hover:border-pink-500 hover:bg-pink-50 transition-colors">
              <Image className="w-5 h-5 mr-3 text-pink-600" />
              <div>
                <div className="font-semibold text-pink-800">Enviar Imagem</div>
                <div className="text-sm text-pink-600">Enviar imagem ao usuário</div>
              </div>
            </div>
          </div>

          <div
            className="dndnode audio cursor-grab active:cursor-grabbing"
            onDragStart={(event) => onDragStart(event, 'audio')}
            draggable
          >
            <div className="flex items-center p-3 border-2 border-dashed border-teal-300 rounded-lg hover:border-teal-500 hover:bg-teal-50 transition-colors">
              <Volume2 className="w-5 h-5 mr-3 text-teal-600" />
              <div>
                <div className="font-semibold text-teal-800">Enviar Áudio</div>
                <div className="text-sm text-teal-600">Enviar áudio ao usuário</div>
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
    </div>
  );
};

// Componente de Onboarding
const OnboardingModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-600" />
            Bem-vindo ao Construtor de Fluxos
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="text-sm text-gray-600">
            <p className="mb-4">
              O construtor de fluxos permite criar conversas automatizadas para seu chatbot. 
              Aqui está um guia rápido dos componentes disponíveis:
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-blue-600" />
                <h3 className="font-semibold">Enviar Mensagem</h3>
              </div>
              <p className="text-sm text-gray-600">
                Envia uma mensagem de texto para o usuário. Clique duas vezes para editar o conteúdo.
              </p>
            </div>
            
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <MousePointer className="w-4 h-4 text-purple-600" />
                <h3 className="font-semibold">Pergunta com Botões</h3>
              </div>
              <p className="text-sm text-gray-600">
                Apresenta opções em forma de botões para o usuário escolher. Ideal para menus e escolhas.
              </p>
            </div>
            
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <GitBranch className="w-4 h-4 text-orange-600" />
                <h3 className="font-semibold">Condição</h3>
              </div>
              <p className="text-sm text-gray-600">
                Cria ramificações baseadas em condições. Use "button_response equals 'Texto'" para verificar respostas de botões.
              </p>
            </div>
            
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Image className="w-4 h-4 text-pink-600" />
                <h3 className="font-semibold">Enviar Imagem</h3>
              </div>
              <p className="text-sm text-gray-600">
                Envia uma imagem para o usuário. Cole a URL da imagem no campo apropriado.
              </p>
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 mb-2">💡 Dicas importantes:</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Conecte os nós arrastando das bolinhas de saída para as de entrada</li>
              <li>• Use o ícone de ajuda (?) nos nós de condição para ver exemplos</li>
              <li>• Clique duas vezes nos nós para editá-los</li>
              <li>• Salve seu fluxo regularmente usando o botão "Salvar Fluxo"</li>
            </ul>
          </div>
          
          <div className="flex justify-end">
            <Button onClick={onClose}>
              Entendi, vamos começar!
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
  const [activeChatbot, setActiveChatbot] = useState<ActiveChatbot | null>(null);
  const [isLoadingChatbot, setIsLoadingChatbot] = useState(true);
  const [savedFlows, setSavedFlows] = useState<SavedFlow[]>([]);
  const [isLoadingFlows, setIsLoadingFlows] = useState(true);
  const [currentFlowId, setCurrentFlowId] = useState<string | null>(null);
  const [flowValidation, setFlowValidation] = useState<FlowValidationResult>({
    isValid: false,
    errors: [],
    warnings: []
  });
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Buscar chatbot ativo ao carregar a página
  useEffect(() => {
    const fetchActiveChatbot = async () => {
      if (!user || !profile) return;

      try {
        const supabase = await createClient();
        const { data: chatbot, error } = await supabase
          .from('chatbots')
          .select('id, name, flows_enabled')
          .eq('org_id', profile.org_id)
          .eq('is_active', true)
          .single();

        if (error) {
          console.error('Erro ao buscar chatbot ativo:', error);
          toast.error('Erro ao carregar configurações do chatbot');
          return;
        }

        setActiveChatbot(chatbot);
      } catch (error) {
        console.error('Erro ao buscar chatbot ativo:', error);
        toast.error('Erro ao carregar configurações do chatbot');
      } finally {
        setIsLoadingChatbot(false);
      }
    };

    fetchActiveChatbot();
  }, [user, profile]);

  // Buscar fluxos salvos ao carregar a página
  const fetchSavedFlows = useCallback(async () => {
    if (!user || !profile) return;

    try {
      const supabase = await createClient();
      const { data: flows, error } = await supabase
        .from('flows')
        .select('id, name, flow_data, created_at, updated_at')
        .eq('org_id', profile.org_id)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar fluxos salvos:', error);
        toast.error('Erro ao carregar fluxos salvos');
        return;
      }

      setSavedFlows(flows || []);
    } catch (error) {
      console.error('Erro ao buscar fluxos salvos:', error);
      toast.error('Erro ao carregar fluxos salvos');
    } finally {
      setIsLoadingFlows(false);
    }
  }, [user, profile]);

  useEffect(() => {
     fetchSavedFlows();
  }, [fetchSavedFlows]);

  // Função para validar se o fluxo está completo e funcional
  const validateFlow = useCallback((nodes: Node[], edges: Edge[]): FlowValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Verificar se existe pelo menos um nó de início
    const startNodes = nodes.filter(node => node.type === 'input');
    if (startNodes.length === 0) {
      errors.push('O fluxo deve ter pelo menos um ponto de início');
    } else if (startNodes.length > 1) {
      warnings.push('Múltiplos pontos de início detectados - apenas o primeiro será usado');
    }

    // 2. Verificar se existe pelo menos um nó de mensagem ou opções
    const messageNodes = nodes.filter(node => node.type === 'message' || node.type === 'options');
    if (messageNodes.length === 0) {
      errors.push('O fluxo deve ter pelo menos uma mensagem ou nó de opções');
    }

    // 3. Verificar se todos os nós de mensagem têm conteúdo
    messageNodes.forEach(node => {
      if (node.type === 'message' && (!node.data?.message || node.data.message.trim() === '')) {
        errors.push(`Nó de mensagem "${node.id}" está vazio`);
      }
      if (node.type === 'options') {
        console.log(`🔍 Validando nó de opções ${node.id}:`, {
          data: node.data,
          question: node.data?.question,
          options: node.data?.options
        });
        
        if (!node.data?.question || node.data.question.trim() === '') {
          errors.push(`Nó de opções "${node.id}" não tem pergunta definida`);
        }
        if (!node.data?.options || node.data.options.length === 0) {
          errors.push(`Nó de opções "${node.id}" não tem opções definidas`);
        }
      }
    });

    // 4. Verificar conectividade - todos os nós devem estar conectados
    const connectedNodeIds = new Set<string>();
    
    // Adicionar nós de início como conectados
    startNodes.forEach(node => connectedNodeIds.add(node.id));
    
    // Seguir as conexões a partir dos nós de início
    let foundNewConnections = true;
    while (foundNewConnections) {
      foundNewConnections = false;
      edges.forEach(edge => {
        if (connectedNodeIds.has(edge.source) && !connectedNodeIds.has(edge.target)) {
          connectedNodeIds.add(edge.target);
          foundNewConnections = true;
        }
      });
    }

    // Verificar se todos os nós estão conectados
    const disconnectedNodes = nodes.filter(node => !connectedNodeIds.has(node.id));
    if (disconnectedNodes.length > 0) {
      disconnectedNodes.forEach(node => {
        if (node.type !== 'input') {
          errors.push(`Nó "${node.id}" não está conectado ao fluxo principal`);
        }
      });
    }

    // 5. Verificar se há nós órfãos (sem conexões de entrada, exceto início)
    const nodesWithIncomingEdges = new Set(edges.map(edge => edge.target));
    const orphanNodes = nodes.filter(node => 
      node.type !== 'input' && !nodesWithIncomingEdges.has(node.id)
    );
    
    if (orphanNodes.length > 0) {
      orphanNodes.forEach(node => {
        warnings.push(`Nó "${node.id}" não possui conexões de entrada`);
      });
    }

    // 6. Verificar se há ciclos infinitos (opcional - warning)
    const visitedInPath = new Set<string>();
    const hasCircularPath = (nodeId: string, path: Set<string>): boolean => {
      if (path.has(nodeId)) return true;
      
      path.add(nodeId);
      const outgoingEdges = edges.filter(edge => edge.source === nodeId);
      
      for (const edge of outgoingEdges) {
        if (hasCircularPath(edge.target, new Set(path))) {
          return true;
        }
      }
      
      return false;
    };

    startNodes.forEach(startNode => {
      if (hasCircularPath(startNode.id, new Set())) {
        warnings.push('Possível loop infinito detectado no fluxo');
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }, []);

  // Validar fluxo automaticamente quando nodes ou edges mudarem
  useEffect(() => {
    const validation = validateFlow(nodes, edges);
    setFlowValidation(validation);
  }, [nodes, edges, validateFlow]);

  // Função para alternar o estado flows_enabled
  const toggleFlowsEnabled = async (enabled: boolean) => {
    if (!activeChatbot) return;

    // Se está tentando ativar, verificar se há fluxos válidos salvos
    if (enabled) {
      // Verificar se há pelo menos um fluxo salvo
      if (savedFlows.length === 0) {
        toast.error('Você precisa ter pelo menos um fluxo salvo para ativar o sistema de fluxos.');
        return;
      }

      // Verificar se há pelo menos um fluxo válido
      let hasValidFlow = false;
      for (const flow of savedFlows) {
        if (flow.flow_data?.nodes && flow.flow_data?.edges) {
          const validation = validateFlow(flow.flow_data.nodes, flow.flow_data.edges);
          if (validation.isValid) {
            hasValidFlow = true;
            break;
          }
        }
      }

      if (!hasValidFlow) {
        toast.error('Você precisa ter pelo menos um fluxo válido (sem erros) para ativar o sistema de fluxos.');
        return;
      }
    }

    try {
      const supabase = await createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Sessão não encontrada');
      }

      const response = await fetch(`/api/chatbots?id=${activeChatbot.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ flows_enabled: enabled })
      });

      if (!response.ok) {
        throw new Error('Erro ao atualizar configuração');
      }

      // Atualizar estado local
      setActiveChatbot(prev => prev ? { ...prev, flows_enabled: enabled } : null);
      
      toast.success(enabled ? 'Sistema de Fluxos Ativado!' : 'Sistema de Fluxos Desativado!');
    } catch (error) {
      console.error('Erro ao atualizar flows_enabled:', error);
      toast.error('Erro ao atualizar configuração do sistema de fluxos');
    }
  };

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
            // Garantir que todos os dados sejam preservados
            message: node.data.message,
            question: node.data.question,
            options: node.data.options
          }
        })),
        edges: flow.edges,
        viewport: flow.viewport,
      };

      console.log('💾 [Frontend] Enviando dados do fluxo para Server Action:', {
        name: flowName,
        nodesCount: flowData.nodes?.length || 0,
        edgesCount: flowData.edges?.length || 0
      });

      // Chamar a Server Action para salvar o fluxo
      const result = await saveFlowAction(flowName.trim(), flowData, currentFlowId);

      if (result.success) {
        const isUpdate = !!currentFlowId;
        const message = isUpdate 
          ? `Fluxo "${flowName}" atualizado com sucesso!`
          : `Fluxo "${flowName}" salvo com sucesso!`;
        
        toast.success(message);
        console.log(`✅ [Frontend] Fluxo ${isUpdate ? 'atualizado' : 'salvo'} com ID:`, result.flowId);
        
        // Atualizar o ID do fluxo atual se for um novo fluxo
        if (result.flowId && !currentFlowId) {
          setCurrentFlowId(result.flowId);
        }
        
        // Recarregar a lista de fluxos salvos
        fetchSavedFlows();
        
        // Não limpar o nome do fluxo após salvar/atualizar
        // setFlowName(''); // Removido para manter o nome após atualização
      } else {
        throw new Error(result.error || 'Erro desconhecido ao salvar fluxo');
      }

    } catch (error) {
      console.error('❌ [Frontend] Erro ao salvar fluxo:', error);
      toast.error(error instanceof Error ? error.message : 'Erro desconhecido ao salvar fluxo');
    } finally {
      setIsSaving(false);
    }
  }, [flowName, user, profile, reactFlowInstance]);

  // Função para carregar um fluxo específico
  const loadFlow = useCallback(async (flowId: string) => {
    if (!user || !profile || !reactFlowInstance) return;

    try {
      const supabase = await createClient();
      const { data: flow, error } = await supabase
        .from('flows')
        .select('*')
        .eq('id', flowId)
        .eq('org_id', profile.org_id)
        .single();

      if (error) {
        console.error('Erro ao carregar fluxo:', error);
        toast.error('Erro ao carregar fluxo');
        return;
      }

      if (!flow || !flow.flow_data) {
        toast.error('Dados do fluxo não encontrados');
        return;
      }

      // Atualizar o estado do React Flow com os dados carregados
      const { nodes, edges, viewport } = flow.flow_data;
      
      if (nodes) {
        setNodes(nodes);
      }
      
      if (edges) {
        setEdges(edges);
      }
      
      if (viewport) {
        reactFlowInstance.setViewport(viewport);
      }

      // Atualizar o nome do fluxo e o ID atual
      setFlowName(flow.name);
      setCurrentFlowId(flowId);

      toast.success(`Fluxo "${flow.name}" carregado com sucesso!`);
      
    } catch (error) {
      console.error('Erro ao carregar fluxo:', error);
      toast.error('Erro ao carregar fluxo');
    }
  }, [user, profile, reactFlowInstance, setNodes, setEdges]);

  // Função para criar um novo fluxo (limpar canvas)
  const createNewFlow = useCallback(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    setFlowName('');
    setCurrentFlowId(null);
    
    if (reactFlowInstance) {
      reactFlowInstance.setViewport({ x: 0, y: 0, zoom: 1 });
    }
    
    toast.success('Novo fluxo criado!');
  }, [setNodes, setEdges, reactFlowInstance]);

  // Função para excluir um fluxo
  const deleteFlow = useCallback(async (flowId: string) => {
    if (!user || !profile) {
      toast.error('Usuário não autenticado');
      return;
    }

    // Confirmar exclusão
    if (!confirm('Tem certeza que deseja excluir este fluxo? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      const result = await deleteFlowAction(flowId);

      if (result.success) {
        toast.success('Fluxo excluído com sucesso!');
        
        // Se o fluxo excluído era o atual, limpar o canvas
        if (currentFlowId === flowId) {
          createNewFlow();
        }
        
        // Recarregar a lista de fluxos salvos
        fetchSavedFlows();
      } else {
        throw new Error(result.error || 'Erro desconhecido ao excluir fluxo');
      }
    } catch (error) {
      console.error('Erro ao excluir fluxo:', error);
      toast.error('Erro ao excluir fluxo');
    }
  }, [user, profile, currentFlowId, createNewFlow, fetchSavedFlows]);

  return (
    <div className="h-screen flex">
      {/* Barra lateral */}
      <div className="flex-shrink-0">
        <Sidebar 
          savedFlows={savedFlows}
          isLoadingFlows={isLoadingFlows}
          onLoadFlow={loadFlow}
          onCreateNewFlow={createNewFlow}
          currentFlowId={currentFlowId}
          onDeleteFlow={deleteFlow}
        />
      </div>

      {/* Área principal do construtor */}
      <div className="flex-1 flex flex-col">
        {/* Cabeçalho */}
        <div className="bg-white border-b p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold">Construtor de Fluxos</h1>
              <Separator orientation="vertical" className="h-6" />
              
              {/* Toggle para ativar/desativar fluxos */}
              <div className="flex items-center space-x-3 bg-gray-50 px-3 py-2 rounded-lg border">
                <Settings className="w-4 h-4 text-gray-600" />
                <div className="flex items-center space-x-2">
                  <Switch
                    id="flows-enabled"
                    checked={activeChatbot?.flows_enabled || false}
                    onCheckedChange={toggleFlowsEnabled}
                    disabled={isLoadingChatbot || !activeChatbot}
                  />
                  <Label htmlFor="flows-enabled" className="text-sm font-medium cursor-pointer">
                    Ativar Execução de Fluxos
                  </Label>
                </div>
                {isLoadingChatbot && (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                )}
              </div>
              
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
              
              {/* Indicador de Status de Validação */}
              <div className="flex items-center space-x-2 px-3 py-1 rounded-md border">
                {flowValidation.isValid ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-700 font-medium">Fluxo Válido</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span className="text-sm text-red-700 font-medium">
                      {flowValidation.errors.length} erro(s)
                    </span>
                  </>
                )}
                {flowValidation.warnings.length > 0 && (
                  <>
                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm text-yellow-700">
                      {flowValidation.warnings.length} aviso(s)
                    </span>
                  </>
                )}
              </div>
              
              <Button 
                variant="outline"
                onClick={() => setShowOnboarding(true)}
                className="flex items-center space-x-2"
              >
                <HelpCircle className="w-4 h-4" />
                <span>Ajuda</span>
              </Button>
              
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

        {/* Painel de Validação (quando há erros ou avisos) */}
        {(!flowValidation.isValid || flowValidation.warnings.length > 0) && (
          <div className="bg-white border-t border-gray-200 p-4">
            <div className="max-w-4xl mx-auto">
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                Status de Validação do Fluxo
              </h3>
              
              {/* Erros */}
              {flowValidation.errors.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center mb-2">
                    <XCircle className="w-4 h-4 text-red-600 mr-2" />
                    <span className="text-sm font-medium text-red-700">
                      Erros ({flowValidation.errors.length})
                    </span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 ml-6">
                    {flowValidation.errors.map((error, index) => (
                      <li key={index} className="text-sm text-red-600">
                        {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Avisos */}
              {flowValidation.warnings.length > 0 && (
                <div>
                  <div className="flex items-center mb-2">
                    <AlertCircle className="w-4 h-4 text-yellow-600 mr-2" />
                    <span className="text-sm font-medium text-yellow-700">
                      Avisos ({flowValidation.warnings.length})
                    </span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 ml-6">
                    {flowValidation.warnings.map((warning, index) => (
                      <li key={index} className="text-sm text-yellow-600">
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

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
        
        {/* Modal de Onboarding */}
        <OnboardingModal 
          isOpen={showOnboarding} 
          onClose={() => setShowOnboarding(false)} 
        />
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