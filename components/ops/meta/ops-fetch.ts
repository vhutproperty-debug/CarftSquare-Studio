export type OpsPayload = {
  error?: string;
  permissionPending?: boolean;
  [key: string]: unknown;
};

export async function opsFetch(input: string, init?: RequestInit): Promise<{
  ok: boolean;
  status: number;
  data: OpsPayload;
}> {
  const response = await fetch(input, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
  });
  const data = (await response.json().catch(() => ({}))) as OpsPayload;
  return { ok: response.ok, status: response.status, data };
}
