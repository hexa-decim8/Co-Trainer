import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type OnConnect,
  MarkerType,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Save, Plus, ChevronDown, GitMerge, Loader2 } from 'lucide-react';
import { progressionsApi } from '../api';
import type { ProgressionChartSummary, ProgressionChartFull, ProgressionNodeData } from '../types';
import ProgressionDrillPanel from '../components/ProgressionDrillPanel';
import DrillNode from '../components/progression/DrillNode';
import SkillNode from '../components/progression/SkillNode';

// Register custom node types
const nodeTypes = {
  drillNode: DrillNode,
  skillNode: SkillNode,
};

const defaultEdgeOptions = {
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed, color: '#7c3aed' },
  style: { stroke: '#7c3aed', strokeWidth: 2 },
};

let nodeCounter = 0;
const newNodeId = () => `node_${Date.now()}_${++nodeCounter}`;

export default function ProgressionsPage() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<any>(null);

  const [charts, setCharts] = useState<ProgressionChartSummary[]>([]);
  const [currentChart, setCurrentChart] = useState<ProgressionChartFull | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [showChartDropdown, setShowChartDropdown] = useState(false);
  const [showNewChartDialog, setShowNewChartDialog] = useState(false);
  const [newChartName, setNewChartName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Load chart list on mount
  useEffect(() => {
    progressionsApi.list().then((list) => {
      setCharts(list);
      if (list.length > 0) {
        loadChart(list[0].id);
      }
    }).catch(console.error);
  }, []);

  const loadChart = async (id: number) => {
    setIsLoadingChart(true);
    try {
      const chart = await progressionsApi.get(id);
      setCurrentChart(chart);
      setNameValue(chart.name);
      setNodes((chart.nodes as Node[]) ?? []);
      setEdges((chart.edges as Edge[]) ?? []);
      setIsDirty(false);
    } catch (e) {
      console.error('Failed to load chart', e);
    } finally {
      setIsLoadingChart(false);
    }
  };

  const handleNodesChange: typeof onNodesChange = useCallback((changes) => {
    onNodesChange(changes);
    setIsDirty(true);
  }, [onNodesChange]);

  const handleEdgesChange: typeof onEdgesChange = useCallback((changes) => {
    onEdgesChange(changes);
    setIsDirty(true);
  }, [onEdgesChange]);

  const handleConnect: OnConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({ ...params, ...defaultEdgeOptions }, eds));
    setIsDirty(true);
  }, [setEdges]);

  const handleDeleteNode = useCallback((id: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setIsDirty(true);
  }, [setNodes, setEdges]);

  // Enrich nodes with onDelete callback before passing to ReactFlow
  const enrichedNodes: Node[] = nodes.map((n) => ({
    ...n,
    data: { ...n.data, onDelete: handleDeleteNode },
  }));

  // Drop handler — receive a drill or skill node dragged from the panel
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData('application/progression-node');
      if (!raw || !rfInstance) return;

      let nodeData: ProgressionNodeData;
      try {
        nodeData = JSON.parse(raw);
      } catch {
        return;
      }

      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!bounds) return;

      const position = rfInstance.screenToFlowPosition({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      });

      const newNode: Node = {
        id: newNodeId(),
        type: nodeData.nodeType === 'drill' ? 'drillNode' : 'skillNode',
        position,
        data: nodeData,
      };

      setNodes((nds) => [...nds, newNode]);
      setIsDirty(true);
    },
    [rfInstance, setNodes]
  );

  const handleAddSkillNode = useCallback(
    (data: ProgressionNodeData) => {
      const position = rfInstance
        ? rfInstance.screenToFlowPosition({ x: 300 + Math.random() * 200, y: 200 + Math.random() * 200 })
        : { x: 300 + Math.random() * 200, y: 200 + Math.random() * 200 };

      const newNode: Node = {
        id: newNodeId(),
        type: 'skillNode',
        position,
        data,
      };
      setNodes((nds) => [...nds, newNode]);
      setIsDirty(true);
    },
    [rfInstance, setNodes]
  );

  const handleSave = async () => {
    if (!currentChart) return;
    setIsSaving(true);
    try {
      const updated = await progressionsApi.update(currentChart.id, {
        name: nameValue,
        nodes: nodes as unknown as Record<string, unknown>[],
        edges: edges as unknown as Record<string, unknown>[],
      });
      setCurrentChart(updated);
      setCharts((prev) => prev.map((c) => c.id === updated.id ? { ...c, name: updated.name, updated_at: updated.updated_at } : c));
      setIsDirty(false);
    } catch (e) {
      console.error('Failed to save chart', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateChart = async () => {
    if (!newChartName.trim()) return;
    try {
      const chart = await progressionsApi.create(newChartName.trim());
      setCharts((prev) => [{ id: chart.id, name: chart.name, updated_at: chart.updated_at }, ...prev]);
      setCurrentChart(chart);
      setNameValue(chart.name);
      setNodes([]);
      setEdges([]);
      setIsDirty(false);
      setNewChartName('');
      setShowNewChartDialog(false);
    } catch (e) {
      console.error('Failed to create chart', e);
    }
  };

  const handleNameBlur = () => {
    setEditingName(false);
    if (nameValue !== currentChart?.name) setIsDirty(true);
  };

  return (
    <div className="flex h-full">
      {/* Left panel */}
      <ProgressionDrillPanel onAddSkillNode={handleAddSkillNode} />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <GitMerge className="w-5 h-5 text-primary-500 shrink-0" />

          {/* Chart name (inline edit) */}
          {editingName ? (
            <input
              autoFocus
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false); }}
              className="text-base font-bold text-gray-800 dark:text-gray-100 bg-transparent border-b-2 border-primary-400 outline-none min-w-0 max-w-[220px]"
            />
          ) : (
            <button
              onClick={() => { if (currentChart) setEditingName(true); }}
              className="text-base font-bold text-gray-800 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 transition-colors truncate max-w-[220px]"
              title="Click to rename"
            >
              {currentChart ? nameValue : 'No chart loaded'}
            </button>
          )}

          {isDirty && (
            <span className="text-xs font-semibold text-amber-500 dark:text-amber-400 shrink-0">
              • unsaved
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            {/* Chart selector */}
            <div className="relative">
              <button
                onClick={() => setShowChartDropdown((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                My Charts
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {showChartDropdown && (
                <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50 max-h-60 overflow-y-auto">
                  {charts.length === 0 && (
                    <p className="px-4 py-3 text-sm text-gray-400">No saved charts yet.</p>
                  )}
                  {charts.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { loadChart(c.id); setShowChartDropdown(false); }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                        currentChart?.id === c.id ? 'font-bold text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* New chart */}
            {showNewChartDialog ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={newChartName}
                  onChange={(e) => setNewChartName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateChart(); if (e.key === 'Escape') { setShowNewChartDialog(false); setNewChartName(''); } }}
                  placeholder="Chart name…"
                  className="px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 outline-none focus:border-primary-400 w-40"
                />
                <button
                  onClick={handleCreateChart}
                  disabled={!newChartName.trim()}
                  className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 transition-colors"
                >
                  Create
                </button>
                <button
                  onClick={() => { setShowNewChartDialog(false); setNewChartName(''); }}
                  className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewChartDialog(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Chart
              </button>
            )}

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={!currentChart || isSaving || !isDirty}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 transition-colors"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={reactFlowWrapper}
          className="flex-1 min-h-0 bg-gray-50 dark:bg-gray-950"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          {isLoadingChart ? (
            <div className="flex items-center justify-center h-full text-gray-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading chart…</span>
            </div>
          ) : !currentChart ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
              <GitMerge className="w-12 h-12 opacity-30" />
              <p className="text-sm font-medium">No progression chart loaded.</p>
              <button
                onClick={() => setShowNewChartDialog(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create your first chart
              </button>
            </div>
          ) : (
            <ReactFlow
              nodes={enrichedNodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={handleConnect}
              onInit={setRfInstance}
              defaultEdgeOptions={defaultEdgeOptions}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d1d5db" />
              <Controls />
              <MiniMap
                nodeColor={(n) => n.type === 'drillNode' ? '#7c3aed' : '#10b981'}
                className="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700"
              />
            </ReactFlow>
          )}
        </div>
      </div>

      {/* Click-away for dropdowns */}
      {showChartDropdown && (
        <div className="fixed inset-0 z-40" onClick={() => setShowChartDropdown(false)} />
      )}
    </div>
  );
}
