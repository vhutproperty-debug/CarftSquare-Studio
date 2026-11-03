'use client';

import { createContext, useContext, type ReactNode } from 'react';

const OpsRoleContext = createContext<string | null>(null);
const OpsPhaseContext = createContext<ReadonlySet<number>>(new Set());

export function OpsActorProvider({
  role,
  enabledPhases = [],
  children,
}: {
  role: string | null;
  enabledPhases?: number[];
  children: ReactNode;
}) {
  return (
    <OpsRoleContext.Provider value={role}>
      <OpsPhaseContext.Provider value={new Set(enabledPhases)}>{children}</OpsPhaseContext.Provider>
    </OpsRoleContext.Provider>
  );
}

export function useOpsRole(): string | null {
  return useContext(OpsRoleContext);
}

export function useEnabledPhases(): ReadonlySet<number> {
  return useContext(OpsPhaseContext);
}
