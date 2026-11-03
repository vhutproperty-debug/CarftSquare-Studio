'use client';

import { createContext, useContext, type ReactNode } from 'react';

const OpsRoleContext = createContext<string | null>(null);

export function OpsActorProvider({ role, children }: { role: string | null; children: ReactNode }) {
  return <OpsRoleContext.Provider value={role}>{children}</OpsRoleContext.Provider>;
}

export function useOpsRole(): string | null {
  return useContext(OpsRoleContext);
}
