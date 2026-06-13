export class AsyncTimeoutError extends Error {
  constructor(message = 'Operation timed out.') {
    super(message);
    this.name = 'AsyncTimeoutError';
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = 'operation',
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new AsyncTimeoutError(`${label} timed out after ${ms}ms`));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
