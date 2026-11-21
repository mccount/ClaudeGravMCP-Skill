#!/usr/bin/env node
// Runs `claude plugin validate` for the plugin and the marketplace.
// Uses `claude` from PATH, or falls back to the binary bundled with the
// Claude Code VS Code extension (newest version found). Override with CLAUDE_BIN.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exe = process.platform === 'win32' ? 'claude.exe' : 'claude';

function onPath() {
  const r = spawnSync(exe, ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' });
  return r.status === 0 ? exe : null;
}

function fromVsCodeExtension() {
  const roots = ['.vscode', '.vscode-insiders', '.cursor', '.windsurf'].map((d) =>
    path.join(os.homedir(), d, 'extensions')
  );
  const found = [];
  for (const r of roots) {
    if (!fs.existsSync(r)) continue;
    for (const d of fs.readdirSync(r)) {
      if (!d.startsWith('anthropic.claude-code-')) continue;
      const bin = path.join(r, d, 'resources', 'native-binary', exe);
      if (fs.existsSync(bin)) found.push({ bin, mtime: fs.statSync(bin).mtimeMs });
    }
  }
  found.sort((a, b) => b.mtime - a.mtime);
  return found[0]?.bin || null;
}

const bin = process.env.CLAUDE_BIN || onPath() || fromVsCodeExtension();
if (!bin) {
  console.error(
    'Claude Code CLI not found. Install it (https://code.claude.com/docs/en/setup) or set CLAUDE_BIN to the claude binary.'
  );
  process.exit(1);
}

let failed = false;
for (const target of ['./plugins/grav-cms', '.']) {
  const r = spawnSync(bin, ['plugin', 'validate', target], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
