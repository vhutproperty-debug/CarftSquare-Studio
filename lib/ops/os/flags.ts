/**
 * CraftSquare OS phase flags.
 *
 * Unset means the phase is available. Set CSOS_PHASE_N=0 to hide that phase's
 * new screens and write APIs. Phase 0 permission checks stay on either way:
 * turning the flag off must not widen access.
 *
 * Dangerous automations have their own switches and default off.
 */

export type OsPhase = 0 | 1 | 2 | 3 | 4 | 5 | 6;

function flagOff(name: string): boolean {
  const raw = process.env[name];
  if (raw == null || raw.trim() === '') return false;
  return ['0', 'false', 'off', 'no'].includes(raw.trim().toLowerCase());
}

export function phaseEnabled(phase: OsPhase): boolean {
  return !flagOff(`CSOS_PHASE_${phase}`);
}

/** Meta campaign creation from the OS automation. Default off. */
export function metaAutomationEnabled(): boolean {
  return process.env.CSOS_META_AUTOMATION === '1' || process.env.CSOS_META_AUTOMATION === 'true';
}

export function phaseDisabledResponse(phase: OsPhase): { error: string } {
  return { error: `CraftSquare OS phase ${phase} is turned off (CSOS_PHASE_${phase}=0).` };
}
