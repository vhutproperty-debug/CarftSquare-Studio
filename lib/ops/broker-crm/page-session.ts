import { cookies } from 'next/headers';

/** Tie this segment to the incoming request so it cannot be a cookie-less static shell. */
export function bindBrokerCrmPageToSession(): void {
  cookies();
}
