'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import AddProspectDialog from '@/components/ops/calls/AddProspectDialog';
import ActionCenterPanel, { type ActionCenterHandle } from '@/components/ops/calls/ActionCenterPanel';
import LeadWorkspacePanel, { type WorkspaceDetail } from '@/components/ops/calls/LeadWorkspacePanel';
import QueuePanel, { QUEUE_SECTIONS, type QueueSectionId } from '@/components/ops/calls/QueuePanel';
import type { CallQueueItem, CallTargetSummary, CallWorkspaceMetrics, OpsCallActivity } from '@/lib/ops/calls/types';

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function CallsWorkspace() {
  const [section, setSection] = useState<QueueSectionId>('follow_ups_due');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [mineOnly, setMineOnly] = useState(false);
  const [items, setItems] = useState<CallQueueItem[]>([]);
  const [sections, setSections] = useState<Array<{ id: string; label: string; count: number }>>([]);
  const [metrics, setMetrics] = useState<CallWorkspaceMetrics | null>(null);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState('');

  const [selectedItem, setSelectedItem] = useState<CallQueueItem | null>(null);
  const [detail, setDetail] = useState<WorkspaceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [currentUser, setCurrentUser] = useState<{ id?: string; role?: string; isSuperAdmin?: boolean } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'queue' | 'lead' | 'actions'>('queue');

  const callLinkRef = useRef<HTMLAnchorElement>(null);
  const actionCenterRef = useRef<ActionCenterHandle>(null);
  const actionSheetOpenRef = useRef(false);

  const sectionConfig = QUEUE_SECTIONS.find((s) => s.id === section) || QUEUE_SECTIONS[0];

  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    setQueueError('');
    try {
      const params = new URLSearchParams({ section: sectionConfig.apiSection });
      if (sectionConfig.callStatus) params.set('callStatus', sectionConfig.callStatus);
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (mineOnly) params.set('mineOnly', 'true');

      const [queueRes, metricsRes] = await Promise.all([
        fetch(`/api/ops/calls/queue?${params.toString()}`, { credentials: 'include' }),
        fetch('/api/ops/calls/metrics', { credentials: 'include' }),
      ]);

      const queueData = await queueRes.json().catch(() => ({}));
      if (!queueRes.ok) {
        setQueueError(queueData.error || 'Unable to load call queue.');
        return;
      }

      setItems(queueData.items || []);
      setSections(queueData.sections || []);

      const metricsData = await metricsRes.json().catch(() => ({}));
      if (metricsRes.ok) setMetrics(metricsData.metrics || null);
    } catch {
      setQueueError('Unable to load call queue.');
    } finally {
      setQueueLoading(false);
    }
  }, [debouncedSearch, mineOnly, sectionConfig.apiSection, sectionConfig.callStatus]);

  const loadDetail = useCallback(async (item: CallQueueItem) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      if (item.kind === 'ops_prospect') {
        const response = await fetch(`/api/ops/prospects/${item.id}`, { credentials: 'include' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return;
        setDetail({
          kind: 'ops_prospect',
          prospect: data.prospect,
          summary: data.summary,
          activities: data.activities || [],
        });
      } else if (item.leadSource) {
        const sourceId = item.id.includes(':') ? item.id.split(':').slice(1).join(':') : item.id;
        const response = await fetch(`/api/ops/leads/${item.leadSource}/${sourceId}`, {
          credentials: 'include',
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return;
        setDetail({
          kind: 'unified_lead',
          lead: data.lead,
          summary: data.callSummary,
          activities: data.callActivities || [],
        });
      }
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch('/api/auth/status', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setCurrentUser(data.user || null))
      .catch(() => setCurrentUser(null));
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (selectedItem) {
      loadDetail(selectedItem);
      setMobilePanel('lead');
    }
  }, [selectedItem, loadDetail]);

  useEffect(() => {
    if (!items.length) {
      setSelectedItem(null);
      setDetail(null);
      return;
    }
    if (!selectedItem || !items.some((item) => item.id === selectedItem.id)) {
      setSelectedItem(items[0]);
    }
  }, [items, selectedItem]);

  function goToNextLead() {
    if (!items.length) return;
    const currentIndex = selectedItem ? items.findIndex((item) => item.id === selectedItem.id) : -1;
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
    setSelectedItem(items[nextIndex]);
  }

  function handleCallContextChange(payload: {
    summary: CallTargetSummary;
    activities: OpsCallActivity[];
  }) {
    setDetail((current) => {
      if (!current) return current;
      if (current.kind === 'ops_prospect') {
        return {
          ...current,
          summary: payload.summary,
          activities: payload.activities,
          prospect: {
            ...current.prospect,
            callStatus: payload.summary.currentStatus,
            nextFollowUpAt: payload.summary.nextFollowUpAt || undefined,
            phoneInvalid: payload.summary.wrongNumber,
          },
        };
      }
      return {
        ...current,
        summary: payload.summary,
        activities: payload.activities,
      };
    });

    setItems((current) => current.map((item) => {
      if (!selectedItem || item.id !== selectedItem.id) return item;
      return {
        ...item,
        callStatus: payload.summary.currentStatus,
        lastCalledAt: payload.summary.lastCalledAt || item.lastCalledAt,
        nextFollowUpAt: payload.summary.nextFollowUpAt,
        doNotCall: payload.summary.doNotCall,
        wrongNumber: payload.summary.wrongNumber,
      };
    }));
  }

  async function saveProspectNotes(notes: string) {
    if (!detail || detail.kind !== 'ops_prospect') return;
    const response = await fetch(`/api/ops/prospects/${detail.prospect.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setDetail({
        ...detail,
        prospect: data.prospect,
      });
    }
  }

  async function convertLeadToProspect() {
    if (!detail || detail.kind !== 'unified_lead') return;
    const lead = detail.lead;
    const response = await fetch('/api/ops/prospects', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: lead.name || undefined,
        phone: lead.phone,
        email: lead.email || undefined,
        projectName: lead.projectName || undefined,
        location: lead.location || undefined,
        requirement: lead.requirement || undefined,
        prospectType: 'unknown',
        source: 'existing_database',
        notes: `Converted from ${lead.source} lead ${lead.sourceId}`,
      }),
    });
    if (response.ok) {
      await loadQueue();
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (actionSheetOpenRef.current) return;

      const key = event.key.toLowerCase();
      if (key === 'n') {
        event.preventDefault();
        goToNextLead();
      } else if (key === 'c') {
        event.preventDefault();
        callLinkRef.current?.click();
      } else if (key === 'f') {
        event.preventDefault();
        actionCenterRef.current?.openFollowUp();
      } else if (key === 's') {
        event.preventDefault();
        actionCenterRef.current?.openStatus();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      {metrics ? (
        <div className="shrink-0 flex flex-wrap items-center gap-4 border-b border-slate-200/80 bg-white px-4 py-2.5 text-xs">
          <span className="flex items-center gap-1.5 font-semibold text-slate-700">
            <BarChart3 className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            Supply Outreach
          </span>
          <MetricPill label="Follow-ups today" value={metrics.callsDueToday} tone="blue" />
          <MetricPill label="Overdue" value={metrics.overdueFollowUps} tone="red" />
          <MetricPill label="New supply" value={metrics.notCalled} tone="amber" />
          <MetricPill label="Interested" value={metrics.interested} tone="emerald" />
          <MetricPill label="Logged today" value={metrics.callsLoggedToday} tone="slate" />
        </div>
      ) : null}

      {queueError ? (
        <div className="shrink-0 border-b border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {queueError}
        </div>
      ) : null}

      <div className="flex shrink-0 border-b border-slate-200 bg-white md:hidden">
        {(['queue', 'lead', 'actions'] as const).map((panel) => (
          <button
            key={panel}
            type="button"
            onClick={() => setMobilePanel(panel)}
            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wide ${
              mobilePanel === panel
                ? 'border-b-2 border-slate-900 text-slate-900'
                : 'text-slate-500'
            }`}
          >
            {panel}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[280px_1fr_300px] lg:grid-cols-[300px_1fr_320px]">
        <div className={`min-h-0 ${mobilePanel === 'queue' ? 'flex' : 'hidden'} md:flex`}>
          <QueuePanel
            section={section}
            onSectionChange={setSection}
            sections={sections}
            items={items}
            selectedId={selectedItem?.id || null}
            onSelect={setSelectedItem}
            search={search}
            onSearchChange={setSearch}
            mineOnly={mineOnly}
            onMineOnlyChange={setMineOnly}
            loading={queueLoading}
            onNextLead={goToNextLead}
            onAddProspect={() => setAddOpen(true)}
          />
        </div>

        <div className={`min-h-0 ${mobilePanel === 'lead' ? 'flex' : 'hidden'} md:flex`}>
          <LeadWorkspacePanel
            detail={detail}
            loading={detailLoading}
            onNotesSaved={saveProspectNotes}
          />
        </div>

        <div className={`min-h-0 ${mobilePanel === 'actions' ? 'flex' : 'hidden'} md:flex`}>
          <ActionCenterPanel
            ref={actionCenterRef}
            detail={detail}
            currentUser={currentUser}
            onCallContextChange={handleCallContextChange}
            onQueueRefresh={loadQueue}
            onConvertToProspect={detail?.kind === 'unified_lead' ? convertLeadToProspect : undefined}
            callLinkRef={callLinkRef}
            onSheetOpenChange={(open) => { actionSheetOpenRef.current = open; }}
          />
        </div>
      </div>

      <AddProspectDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => loadQueue()}
      />
    </div>
  );
}

function MetricPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'blue' | 'red' | 'amber' | 'emerald' | 'slate';
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-800',
    red: 'bg-red-50 text-red-800',
    amber: 'bg-amber-50 text-amber-900',
    emerald: 'bg-emerald-50 text-emerald-800',
    slate: 'bg-slate-100 text-slate-700',
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 font-semibold ${tones[tone]}`}>
      {label}: {value}
    </span>
  );
}
