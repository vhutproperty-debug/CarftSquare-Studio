/** Display status includes NOT_CALLED (no activity yet). Activity records exclude NOT_CALLED. */
export const CALL_DISPLAY_STATUSES = [
  'NOT_CALLED',
  'NO_ANSWER',
  'BUSY',
  'SWITCHED_OFF',
  'WRONG_NUMBER',
  'CALL_BACK',
  'CONNECTED',
  'INTERESTED',
  'NOT_INTERESTED',
  'FOLLOW_UP',
  'DO_NOT_CALL',
  'CONVERTED',
] as const;

export type CallDisplayStatus = (typeof CALL_DISPLAY_STATUSES)[number];

/** Statuses stored on call activity records (never NOT_CALLED). */
export const CALL_ACTIVITY_STATUSES = [
  'NO_ANSWER',
  'BUSY',
  'SWITCHED_OFF',
  'WRONG_NUMBER',
  'CALL_BACK',
  'CONNECTED',
  'INTERESTED',
  'NOT_INTERESTED',
  'FOLLOW_UP',
  'DO_NOT_CALL',
  'CONVERTED',
] as const;

export type CallActivityStatus = (typeof CALL_ACTIVITY_STATUSES)[number];

export const CALL_STATUS_LABELS: Record<CallDisplayStatus, string> = {
  NOT_CALLED: 'Not Called',
  NO_ANSWER: 'No Answer',
  BUSY: 'Busy',
  SWITCHED_OFF: 'Switched Off',
  WRONG_NUMBER: 'Wrong Number',
  CALL_BACK: 'Call Back',
  CONNECTED: 'Connected',
  INTERESTED: 'Interested',
  NOT_INTERESTED: 'Not Interested',
  FOLLOW_UP: 'Follow Up',
  DO_NOT_CALL: 'Do Not Call',
  CONVERTED: 'Converted',
};

export const QUICK_CALL_RESULTS: CallActivityStatus[] = [
  'NO_ANSWER',
  'CALL_BACK',
  'INTERESTED',
  'NOT_INTERESTED',
  'FOLLOW_UP',
];

export const MORE_CALL_RESULTS: CallActivityStatus[] = [
  'BUSY',
  'SWITCHED_OFF',
  'WRONG_NUMBER',
  'CONNECTED',
  'DO_NOT_CALL',
  'CONVERTED',
];

export const FOLLOW_UP_STATUSES: CallActivityStatus[] = [
  'CALL_BACK',
  'INTERESTED',
  'FOLLOW_UP',
];

export function isCallActivityStatus(value: string): value is CallActivityStatus {
  return CALL_ACTIVITY_STATUSES.includes(value as CallActivityStatus);
}

export function isCallDisplayStatus(value: string): value is CallDisplayStatus {
  return CALL_DISPLAY_STATUSES.includes(value as CallDisplayStatus);
}

export function requiresFollowUp(status: CallActivityStatus): boolean {
  return FOLLOW_UP_STATUSES.includes(status);
}
