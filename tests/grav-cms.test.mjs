// Run with: npm test   (node --test, no dependencies)
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  extractServerName,
  looksLikeGrav,
  normalizeGravMcpUrl,
  slugifyInstanceKey,
} from '../plugins/grav-cms/scripts/grav-common.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = path.join(ROOT, 'plugins', 'grav-cms', 'scripts');

function tmpDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'grav-cms-test-'));
}

function run(script, args, dataDir, stdin) {
  const res = spawnSync(process.execPath, [path.join(SCRIPTS, script), ...args], {
    input: stdin,
    encoding: 'utf8',
    env: { ...process.env, GRAV_CMS_DATA_DIR: dataDir },
  });
  return { code: res.status, out: res.stdout.trim(), json: res.stdout.trim() ? JSON.parse(res.stdout) : null };
}

function hook(dataDir, payload) {
  return run('enforce-grav-lock.mjs', [], dataDir, JSON.stringify(payload));
}

function setup() {
  const dir = tmpDataDir();
  run('grav-instances.mjs', ['add', '--url', 'blog.example.com', '--key', 'blog', '--label', 'Blog'], dir);
  run('grav-instances.mjs', ['add', '--url', 'https://docs.example.org/', '--key', 'docs'], dir);
  run('grav-instances.mjs', ['add', '--server-name', 'claude_ai_Grav Shop', '--key', 'shop'], dir);
  return dir;
}

test('URL normalization', () => {
  assert.equal(normalizeGravMcpUrl('blog.example.com'), 'https://blog.example.com/mcp');
  assert.equal(normalizeGravMcpUrl('https://x.example/sub/'), 'https://x.example/sub/mcp');
  assert.equal(normalizeGravMcpUrl('https://x.example/mcp?x=1#y'), 'https://x.example/mcp');
  assert.equal(normalizeGravMcpUrl('http://localhost:8080'), 'http://localhost:8080/mcp');
  assert.throws(() => normalizeGravMcpUrl('http://insecure.example'));
  assert.throws(() => normalizeGravMcpUrl('https://user:pw@x.example'));
});

test('key slugs', () => {
  assert.equal(slugifyInstanceKey('Blog', ''), 'grav-blog');
  assert.equal(slugifyInstanceKey('', 'https://www.my.site.example/mcp'), 'grav-my-site-example');
  assert.equal(slugifyInstanceKey('grav-docs', ''), 'grav-docs');
});

test('server name extraction & Grav heuristic', () => {
  assert.equal(extractServerName('mcp__grav-blog__list_pages'), 'grav-blog');
  assert.equal(extractServerName('mcp__claude_ai_Grav_Shop__get_page'), 'claude_ai_Grav_Shop');
  assert.equal(extractServerName('ReadMcpResourceTool', { server: 'grav-blog' }), 'grav-blog');
  assert.equal(extractServerName('Bash', { command: 'ls' }), '');
  assert.ok(looksLikeGrav('claude_ai_Grav-Something'));
  assert.ok(looksLikeGrav('grav-blog'));
  assert.ok(!looksLikeGrav('gravatar'));
  assert.ok(!looksLikeGrav('github'));
});

test('hook ignores non-Grav tools', () => {
  const dir = setup();
  assert.equal(hook(dir, { session_id: 's1', tool_name: 'mcp__github__list_issues', tool_input: {} }).out, '');
  assert.equal(hook(dir, { session_id: 's1', tool_name: 'Read', tool_input: {} }).out, '');
  assert.equal(run('enforce-grav-lock.mjs', [], dir, 'not json').out, '');
});

test('hook denies Grav calls before selection, allows locked instance only', () => {
  const dir = setup();
  const call = (tool, input = {}) => hook(dir, { session_id: 'sess-1', tool_name: tool, tool_input: input });

  let r = call('mcp__grav-blog__list_pages');
  assert.equal(r.json.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(r.json.hookSpecificOutput.permissionDecisionReason, /has been selected/);

  const lock = run('grav-lock.mjs', ['lock', '--session', 'sess-1', '--instance', 'blog'], dir);
  assert.equal(lock.json.ok, true);
  assert.equal(lock.json.lock.instanceKey, 'grav-blog');

  assert.equal(call('mcp__grav-blog__list_pages').out, '');
  assert.equal(call('mcp__grav_blog__get_page').out, '', 'name normalization');

  r = call('mcp__grav-docs__list_pages');
  assert.equal(r.json.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(r.json.hookSpecificOutput.permissionDecisionReason, /permanently locked/);

  r = call('mcp__claude_ai_Grav_Shop__list_pages');
  assert.equal(r.json.hookSpecificOutput.permissionDecision, 'deny');

  r = call('mcp__claude_ai_Grav-Unknown__list_pages');
  assert.equal(r.json.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(r.json.hookSpecificOutput.permissionDecisionReason, /not registered/);

  // other sessions are independent
  r = hook(dir, { session_id: 'sess-2', tool_name: 'mcp__grav-docs__list_pages', tool_input: {} });
  assert.equal(r.json.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(r.json.hookSpecificOutput.permissionDecisionReason, /has been selected/);
});

test('lock is immutable', () => {
  const dir = setup();
  assert.equal(run('grav-lock.mjs', ['lock', '--session', 'x', '--instance', 'shop'], dir).json.ok, true);
  const again = run('grav-lock.mjs', ['lock', '--session', 'x', '--instance', 'docs'], dir);
  assert.equal(again.code, 1);
  assert.equal(again.json.error, 'LOCK_IMMUTABLE');
  const status = run('grav-lock.mjs', ['status', '--session', 'x'], dir);
  assert.equal(status.json.lock.instanceKey, 'grav-shop');
  assert.equal(status.json.lock.serverName, 'claude_ai_Grav Shop');
  assert.equal(
    hook(dir, { session_id: 'x', tool_name: 'mcp__claude_ai_Grav_Shop__list_pages', tool_input: {} }).out,
    ''
  );
});

test('lock rejects unsubstituted session placeholder', () => {
  const dir = setup();
  const r = run('grav-lock.mjs', ['lock', '--session', '${CLAUDE_SESSION_ID}', '--instance', 'blog'], dir);
  assert.equal(r.json.error, 'MISSING_SESSION_ID');
});

test('destructive Grav calls require confirmation', () => {
  const dir = setup();
  run('grav-lock.mjs', ['lock', '--session', 'd', '--instance', 'blog'], dir);
  const call = (tool, input = {}) =>
    hook(dir, { session_id: 'd', tool_name: `mcp__grav-blog__${tool}`, tool_input: input });

  assert.equal(call('delete_page', { route: '/x' }).json.hookSpecificOutput.permissionDecision, 'ask');
  assert.equal(call('manage_packages', { action: 'install' }).json.hookSpecificOutput.permissionDecision, 'ask');
  assert.equal(call('manage_packages', { action: 'list' }).out, '');
  assert.equal(call('get_page', { route: '/x' }).out, '');

  // can be disabled via settings
  const regPath = path.join(dir, 'instances.json');
  const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
  reg.settings = { confirmDestructive: false };
  fs.writeFileSync(regPath, JSON.stringify(reg));
  assert.equal(call('delete_page', { route: '/x' }).out, '');
});

test('hook protects lock files', () => {
  const dir = setup();
  const deny = (tool, input) =>
    hook(dir, { session_id: 'p', tool_name: tool, tool_input: input }).json?.hookSpecificOutput?.permissionDecision;
  assert.equal(deny('Bash', { command: 'rm ~/.claude/grav-cms/locks/p.json' }), 'deny');
  assert.equal(deny('PowerShell', { command: 'Remove-Item C:\\Users\\u\\.claude\\grav-cms\\locks\\p.json' }), 'deny');
  assert.equal(deny('Write', { file_path: '/home/u/.claude/grav-cms/locks/p.json' }), 'deny');
  assert.equal(deny('Bash', { command: 'node "/x/scripts/grav-lock.mjs" prune --older-than-days 1' }), 'deny');
  assert.equal(deny('Bash', { command: 'node "/x/scripts/grav-lock.mjs" status --session p' }), undefined);
  assert.equal(deny('Edit', { file_path: '/repo/src/index.js' }), undefined);
});

test('instance registry add/list/remove', () => {
  const dir = setup();
  const list = run('grav-instances.mjs', ['list'], dir).json;
  assert.equal(list.count, 3);
  const docs = list.instances.find((i) => i.key === 'grav-docs');
  assert.equal(docs.url, 'https://docs.example.org/mcp');
  assert.equal(docs.toolPrefix, 'mcp__grav-docs__');

  const dup = run('grav-instances.mjs', ['add', '--url', 'other.example', '--key', 'docs'], dir);
  assert.equal(dup.json.error, 'ALREADY_EXISTS');

  assert.equal(run('grav-instances.mjs', ['remove', '--key', 'docs'], dir).json.ok, true);
  assert.equal(run('grav-instances.mjs', ['list'], dir).json.count, 2);
});

test('standalone claude.ai skill reference is in sync with plugin reference', () => {
  const a = fs.readFileSync(path.join(ROOT, 'plugins/grav-cms/skills/grav-cms/references/operations.md'), 'utf8');
  const b = fs.readFileSync(path.join(ROOT, 'claude-ai/grav-cms/references/operations.md'), 'utf8');
  assert.equal(a, b, 'run: npm run sync');
});

test('published files contain no obvious secrets or private config', () => {
  const offenders = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!['.git', 'node_modules', 'input', 'dist'].includes(e.name)) walk(p);
        continue;
      }
      if (/^(mcp_config|instances|\.mcp)\.json$/.test(e.name)) offenders.push(`${p}: private config file`);
      if (/\.(png|jpg|zip)$/i.test(e.name)) continue;
      const text = fs.readFileSync(p, 'utf8');
      if (/Bearer\s+[A-Za-z0-9._-]{16,}/.test(text)) offenders.push(`${p}: bearer token`);
      if (/(client_secret|api[_-]?key)["']?\s*[:=]\s*["'][A-Za-z0-9._-]{12,}/i.test(text)) offenders.push(`${p}: secret`);
    }
  };
  walk(ROOT);
  assert.deepEqual(offenders, []);
});
