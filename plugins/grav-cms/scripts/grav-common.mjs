// Shared helpers for the grav-cms Claude Code plugin.
// No runtime dependencies — Node.js >= 18 only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const PLUGIN_NAME = 'grav-cms';

/**
 * Directory that holds the user's instance registry and per-session locks.
 * Deliberately NOT inside the plugin folder: the plugin cache is replaced on
 * every update, and user data must never end up in the public repository.
 *
 * Resolution order: explicit argument -> GRAV_CMS_DATA_DIR -> ~/.claude/grav-cms
 */
export function getDataDir(explicit) {
  const candidates = [explicit, process.env.GRAV_CMS_DATA_DIR];
  for (const c of candidates) {
    const v = typeof c === 'string' ? c.trim() : '';
    // Ignore unsubstituted placeholders such as "${CLAUDE_PLUGIN_DATA}"
    if (v && !v.includes('${')) return path.resolve(v);
  }
  return path.join(os.homedir(), '.claude', PLUGIN_NAME);
}

export function getInstancesPath(dataDir) {
  return path.join(getDataDir(dataDir), 'instances.json');
}

export function getLocksDir(dataDir) {
  return path.join(getDataDir(dataDir), 'locks');
}

export function sanitizeId(id) {
  return String(id || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function getLockPath(sessionId, dataDir) {
  const safeId = sanitizeId(sessionId);
  if (!safeId || safeId.includes('${')) return null;
  return path.join(getLocksDir(dataDir), `${safeId}.json`);
}

export function readJsonSafe(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

export function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

/** Create-only write. Throws EEXIST if the file already exists. */
export function writeJsonExclusive(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
}

/**
 * Normalize an MCP server name for comparison. Claude Code builds tool names
 * as mcp__<server>__<tool>; claude.ai connectors appear as
 * mcp__claude_ai_<Connector_Name>__<tool>. Spaces/hyphens/case may differ
 * between what the user types and what Claude Code emits.
 */
export function normalizeServerName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Heuristic: does this MCP server name look like a Grav CMS server? */
export function looksLikeGrav(serverName) {
  return /(^|[^a-z0-9])grav([^a-z0-9]|$)/i.test(String(serverName || ''));
}

export function deriveLabel(key, url) {
  if (url) {
    try {
      return new URL(url).hostname;
    } catch {
      // ignore
    }
  }
  return String(key).replace(/^grav-/, '');
}

export function loadRegistry(dataDir) {
  const file = readJsonSafe(getInstancesPath(dataDir));
  if (!file || typeof file !== 'object' || typeof file.instances !== 'object' || !file.instances) {
    return { instances: {} };
  }
  return file;
}

export function loadInstances(dataDir) {
  const { instances } = loadRegistry(dataDir);
  return Object.entries(instances)
    .filter(([, cfg]) => cfg && typeof cfg === 'object')
    .map(([key, cfg]) => {
      const serverName = String(cfg.serverName || key);
      return {
        key,
        label: cfg.label || deriveLabel(key, cfg.url),
        description: cfg.description || '',
        url: cfg.url || '',
        serverName,
        toolPrefix: `mcp__${serverName}__`,
      };
    });
}

export function publicInstance({ key, label, description, url, serverName, toolPrefix }) {
  return { key, label, description, url, serverName, toolPrefix };
}

export function findInstanceByServer(serverName, instances) {
  const n = normalizeServerName(serverName);
  if (!n) return null;
  return instances.find((i) => normalizeServerName(i.serverName) === n) || null;
}

export function findInstance(requested, instances) {
  const r = String(requested || '').trim().toLowerCase();
  if (!r) return null;
  return (
    instances.find((i) => i.key.toLowerCase() === r) ||
    instances.find((i) => i.key.toLowerCase() === `grav-${r}`) ||
    findInstanceByServer(r, instances) ||
    instances.find((i) => i.url && i.url.toLowerCase() === r) ||
    null
  );
}

/**
 * Extract the MCP server name targeted by a Claude Code tool call.
 * Returns '' for non-MCP tools.
 */
export function extractServerName(toolName, toolInput) {
  const name = String(toolName || '');
  if (name.startsWith('mcp__')) {
    const rest = name.slice(5);
    const sep = rest.indexOf('__');
    return sep === -1 ? rest : rest.slice(0, sep);
  }
  // Built-in MCP resource tools carry the server as an argument
  if (/^(ListMcpResourcesTool|ReadMcpResourceTool|ReadMcpResourceDirTool)$/.test(name)) {
    const input = toolInput && typeof toolInput === 'object' ? toolInput : {};
    const s = input.server ?? input.serverName ?? input.server_name;
    return typeof s === 'string' ? s : '';
  }
  return '';
}

export function extractMcpToolName(toolName) {
  const name = String(toolName || '');
  if (!name.startsWith('mcp__')) return '';
  const rest = name.slice(5);
  const sep = rest.indexOf('__');
  return sep === -1 ? '' : rest.slice(sep + 2);
}

export function normalizeGravMcpUrl(rawInput) {
  let raw = String(rawInput || '').trim();
  if (!raw) throw new Error('URL or hostname is required.');
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`Invalid URL: "${rawInput}"`);
  }

  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocal)) {
    throw new Error(`Grav CMS MCP URL must use https:// (got "${parsed.protocol}").`);
  }
  if (parsed.username || parsed.password) {
    throw new Error('Do not put credentials into the URL — Grav MCP uses OAuth2.');
  }

  const cleanPath = parsed.pathname.replace(/\/+$/, '');
  if (!cleanPath) parsed.pathname = '/mcp';
  else if (!cleanPath.endsWith('/mcp')) parsed.pathname = `${cleanPath}/mcp`;
  else parsed.pathname = cleanPath;

  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}

export function slugifyInstanceKey(rawKey, url) {
  let base = String(rawKey || '').trim().toLowerCase();
  if (!base && url) {
    try {
      base = new URL(url).hostname.toLowerCase().replace(/^www\./, '').replace(/\./g, '-');
    } catch {
      base = 'site';
    }
  }
  base = base.replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!base) throw new Error('Could not derive a valid instance key.');
  if (!base.startsWith('grav-')) base = `grav-${base}`;
  return base;
}

export function parseCliArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const eq = token.indexOf('=');
      if (eq !== -1) {
        flags[token.slice(2, eq)] = token.slice(eq + 1);
      } else {
        const key = token.slice(2);
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('--')) {
          flags[key] = next;
          i += 1;
        } else {
          flags[key] = true;
        }
      }
    } else {
      positional.push(token);
    }
  }
  return { positional, flags };
}

export function printJson(obj) {
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}

export function fail(error, message, extra = {}) {
  printJson({ ok: false, error, message, ...extra });
  process.exit(1);
}
