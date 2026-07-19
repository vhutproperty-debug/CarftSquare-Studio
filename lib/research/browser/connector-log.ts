type LogLevel = 'info' | 'warn' | 'error';

/** Structured connector logs for connect → capture → encrypt → validate. */
export function connectorLog(
  portal: string,
  step: string,
  fields: Record<string, unknown> = {},
  level: LogLevel = 'info',
) {
  const line = JSON.stringify({
    scope: 'research-connector',
    portal,
    step,
    at: new Date().toISOString(),
    ...fields,
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}
