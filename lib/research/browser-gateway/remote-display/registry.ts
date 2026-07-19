import type { RemoteDisplaySession } from '@/lib/research/browser-gateway/remote-display/types';

const byViewId = new Map<string, RemoteDisplaySession>();
const byConnectId = new Map<string, string>();

export function registerRemoteSession(session: RemoteDisplaySession) {
  byViewId.set(session.viewId, session);
  byConnectId.set(session.connectSessionId, session.viewId);
}

export function getRemoteSessionByViewId(viewId: string): RemoteDisplaySession | undefined {
  return byViewId.get(viewId);
}

export function getRemoteSessionByConnectId(
  connectSessionId: string,
): RemoteDisplaySession | undefined {
  const viewId = byConnectId.get(connectSessionId);
  if (!viewId) return undefined;
  return byViewId.get(viewId);
}

export function unregisterRemoteSession(viewId: string) {
  const session = byViewId.get(viewId);
  if (!session) return;
  byViewId.delete(viewId);
  byConnectId.delete(session.connectSessionId);
}

export function listRemoteSessions(): RemoteDisplaySession[] {
  return [...byViewId.values()];
}
