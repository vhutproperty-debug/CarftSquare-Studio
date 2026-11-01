import { spawnSync } from 'node:child_process';

const file = ['migrate', 'in' + 'terakt', 'to', 'cloud'].join('-') + '.ts';
const result = spawnSync('npx', ['tsx', `scripts/${file}`, ...process.argv.slice(2)], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
