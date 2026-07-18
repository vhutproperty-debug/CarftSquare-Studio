'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Network } from 'lucide-react';
import { DEFAULT_RESEARCH_WORKSPACE } from '@/lib/research/business';
import type { KgExplorerNode } from '@/lib/research/graph/explorer';
import type { KgProject } from '@/lib/research/graph/types';

function NodeTree({
  node,
  depth = 0,
  selectedId,
  onSelect,
}: {
  node: KgExplorerNode;
  depth?: number;
  selectedId?: string;
  onSelect: (node: KgExplorerNode) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = Boolean(node.children?.length);
  const selected = selectedId === node.id;

  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={() => {
          if (hasChildren) setOpen((v) => !v);
          onSelect(node);
        }}
        className={`flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 ${
          selected ? 'bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200' : ''
        }`}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        {hasChildren ? (
          <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition ${open ? 'rotate-90' : ''}`} />
        ) : (
          <span className="inline-block w-3.5" />
        )}
        <span className="truncate font-medium">{node.label}</span>
        <span className="ml-auto text-[10px] uppercase tracking-wide text-slate-400">{node.type}</span>
      </button>
      {open && hasChildren
        ? node.children!.map((child) => (
            <NodeTree
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))
        : null}
    </div>
  );
}

export default function KnowledgeExplorer() {
  const workspaceId = DEFAULT_RESEARCH_WORKSPACE.id;
  const [projects, setProjects] = useState<KgProject[]>([]);
  const [projectId, setProjectId] = useState<string>('');
  const [tree, setTree] = useState<KgExplorerNode | null>(null);
  const [selected, setSelected] = useState<KgExplorerNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/research/graph/explorer?workspaceId=${encodeURIComponent(workspaceId)}`,
        { credentials: 'include' },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setProjects(json.projects || []);
      if (!projectId && json.projects?.[0]?.id) setProjectId(json.projects[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, projectId]);

  const loadTree = useCallback(async (id: string) => {
    if (!id) return;
    setError(null);
    try {
      const res = await fetch(
        `/api/research/graph/explorer?workspaceId=${encodeURIComponent(workspaceId)}&projectId=${encodeURIComponent(id)}`,
        { credentials: 'include' },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setTree(json.tree);
      setSelected(json.tree);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }, [workspaceId]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (projectId) void loadTree(projectId);
  }, [projectId, loadTree]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Knowledge graph explorer
          </p>
          <p className="text-xs text-slate-500">
            Project → Tower → Property → Portal listings → Broker → Research history
          </p>
        </div>
        <label className="text-xs text-slate-500">
          Project
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="ml-2 h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            {projects.length === 0 ? <option value="">No projects yet</option> : null}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.propertyCount})
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {loading ? <p className="text-sm text-slate-500">Loading explorer…</p> : null}

      {!loading && !projects.length ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <Network className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-800 dark:text-slate-100">
            Knowledge graph is empty
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Run research from the Research workspace. Completed runs permanently expand this graph.
          </p>
        </div>
      ) : null}

      {tree ? (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
            <NodeTree
              node={tree}
              selectedId={selected?.id}
              onSelect={setSelected}
            />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {selected?.label || 'Select a node'}
            </h3>
            <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">
              {selected?.type}
            </p>
            {selected?.meta ? (
              <dl className="mt-4 space-y-2 text-sm">
                {Object.entries(selected.meta).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[120px_1fr] gap-2">
                    <dt className="text-xs uppercase tracking-wide text-slate-400">{k}</dt>
                    <dd className="break-words text-slate-700 dark:text-slate-200">
                      {typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-4 text-sm text-slate-500">No metadata for this node.</p>
            )}
            {selected?.type === 'property' ? (
              <a
                href={`/api/research/graph/properties/${selected.id}`}
                className="mt-4 inline-flex text-xs font-medium text-slate-600 underline"
              >
                Open property JSON (timeline, history, relationships)
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
