'use client';

import { createContext, useContext, type ReactNode } from 'react';

const OpsRoleContext = createContext<string | null>(null);
const OpsPhaseContext = createContext<ReadonlySet<number>>(new Set());
const OpsGrowthContext = createContext<ReadonlySet<string>>(new Set());

export function OpsActorProvider({
  role,
  enabledPhases = [],
  enabledGrowth = [],
  children,
}: {
  role: string | null;
  enabledPhases?: number[];
  enabledGrowth?: string[];
  children: ReactNode;
}) {
  return (
    <OpsRoleContext.Provider value={role}>
      <OpsPhaseContext.Provider value={new Set(enabledPhases)}>
        <OpsGrowthContext.Provider value={new Set(enabledGrowth)}>{children}</OpsGrowthContext.Provider>
      </OpsPhaseContext.Provider>
    </OpsRoleContext.Provider>
  );
}

export function useOpsRole(): string | null {
  return useContext(OpsRoleContext);
}

export function useEnabledPhases(): ReadonlySet<number> {
  return useContext(OpsPhaseContext);
}

export function useEnabledGrowth(): ReadonlySet<string> {
  return useContext(OpsGrowthContext);
}
