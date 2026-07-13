import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { loadEnvLocal, parseEnvLocalContent, parseEnvLine, stripBom } = require('./load-env-local.cjs');

export { loadEnvLocal, parseEnvLocalContent, parseEnvLine, stripBom };
