/**
 * CraftSquare OS phase flags.
 *
 * Unset means the phase is off. Set CSOS_PHASE_N=1 to show that phase's new
 * screens and write APIs. Phase 0 permission checks stay on either way:
 * leaving the flag unset must not widen access.
 *
 * Dangerous automations have their own switches and default off.
 */

export type OsPhase = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function phaseFlagOn(name: string): boolean {
  const raw = process.env[name];
  if (raw == null || raw.trim() === '') return false;
  return ['1', 'true', 'on', 'yes'].includes(raw.trim().toLowerCase());
}

export function phaseEnabled(phase: OsPhase): boolean {
  return phaseFlagOn(`CSOS_PHASE_${phase}`);
}

export function enabledPhases(): OsPhase[] {
  return ([0, 1, 2, 3, 4, 5, 6] as OsPhase[]).filter((phase) => phaseEnabled(phase));
}

/** Meta campaign creation from the OS automation. Default off. */
export function metaAutomationEnabled(): boolean {
  return process.env.CSOS_META_AUTOMATION === '1' || process.env.CSOS_META_AUTOMATION === 'true';
}

export function phaseDisabledResponse(phase: OsPhase): { error: string } {
  return { error: `CraftSquare OS phase ${phase} is off. Set CSOS_PHASE_${phase}=1 to turn it on.` };
}
