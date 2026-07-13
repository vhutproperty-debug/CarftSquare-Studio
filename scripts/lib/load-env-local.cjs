const fs = require('fs');
const path = require('path');

/**
 * Script-only .env.local loader (maintenance scripts).
 * Handles UTF-8 BOM and CRLF line endings. Does not affect app runtime.
 */
function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function parseEnvLine(line) {
  const trimmed = line.replace(/\r$/, '').trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const eq = trimmed.indexOf('=');
  if (eq <= 0) return null;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

function parseEnvLocalContent(raw) {
  const entries = {};
  for (const line of stripBom(raw).split('\n')) {
    const parsed = parseEnvLine(line);
    if (parsed) entries[parsed.key] = parsed.value;
  }
  return entries;
}

function loadEnvLocal(options = {}) {
  const cwd = options.cwd || process.cwd();
  const override = Boolean(options.override);
  const filenames = options.files || ['.env.local', '.env'];
  const loaded = {};

  for (const filename of filenames) {
    const envPath = path.join(cwd, filename);
    if (!fs.existsSync(envPath)) continue;
    try {
      const entries = parseEnvLocalContent(fs.readFileSync(envPath, 'utf8'));
      for (const [key, value] of Object.entries(entries)) {
        loaded[key] = value;
        if (override || !process.env[key]) {
          process.env[key] = value;
        }
      }
    } catch {
      // ignore unreadable env files
    }
  }

  return loaded;
}

module.exports = {
  stripBom,
  parseEnvLine,
  parseEnvLocalContent,
  loadEnvLocal,
};
