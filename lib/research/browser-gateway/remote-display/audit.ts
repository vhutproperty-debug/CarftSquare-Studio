import { pushWorkerLog } from '@/lib/research/browser-gateway/worker-state';

export function auditRemote(
  event: string,
  detail: Record<string, unknown>,
  level: 'info' | 'warn' | 'error' = 'info',
) {
  const flat = Object.entries(detail)
    .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join(' ');
  pushWorkerLog(level, `remote_audit event=${event} ${flat}`);
}
