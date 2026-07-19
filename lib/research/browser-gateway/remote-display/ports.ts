import net from 'net';

/** Find a free TCP port on 127.0.0.1. */
export async function allocatePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        server.close(() => reject(new Error('Failed to allocate port')));
        return;
      }
      const { port } = addr;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
    server.on('error', reject);
  });
}

let nextDisplay = 100;

/** Allocate a unique X display number for this process. */
export function allocateDisplayNumber(): number {
  const n = nextDisplay;
  nextDisplay += 1;
  if (nextDisplay > 250) nextDisplay = 100;
  return n;
}
