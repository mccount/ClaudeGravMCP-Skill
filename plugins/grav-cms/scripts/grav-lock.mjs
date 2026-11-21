#!/usr/bin/env node
// Per-session Grav CMS instance lock.
//
//   node grav-lock.mjs status --session <session id>
//   node grav-lock.mjs lock   --session <session id> --instance <key>
//   node grav-lock.mjs prune  [--older-than-days 30]
//
// A lock is create-only: once written for a session it can never be changed
// by this script. The PreToolUse hook (enforce-grav-lock.mjs) reads it on
// every Grav MCP call and blocks writes to the lock directory.
import fs from 'node:fs';
import path from 'node:path';
import {
  fail,
  findInstance,
  getLockPath,
  getLocksDir,
  loadInstances,
  parseCliArgs,
  printJson,
  publicInstance,
  readJsonSafe,
  writeJsonExclusive,
} from './grav-common.mjs';

function requireSession(flags) {
  const sessionId = String(flags.session || flags['session-id'] || flags.conversation || '').trim();
  if (!sessionId || sessionId.includes('${')) {
    fail(
      'MISSING_SESSION_ID',
      'Pass --session <session id>. In a Claude Code skill use --session "${CLAUDE_SESSION_ID}".'
    );
  }
  return sessionId;
}

function main() {
  const { positional, flags } = parseCliArgs(process.argv.slice(2));
  const command = positional[0];
  const dataDir = typeof flags['data-dir'] === 'string' ? flags['data-dir'] : undefined;
  const instances = loadInstances(dataDir);

  if (command === 'status') {
    const sessionId = requireSession(flags);
    const lock = readJsonSafe(getLockPath(sessionId, dataDir));
    const valid = Boolean(lock && lock.instanceKey);
    printJson({
      ok: true,
      sessionId,
      locked: valid,
      lock: valid ? lock : null,
      lockedInstanceStillConfigured: valid ? Boolean(findInstance(lock.instanceKey, instances)) : null,
      instanceCount: instances.length,
      instances: instances.map(publicInstance),
    });
    return;
  }

  if (command === 'lock') {
    const sessionId = requireSession(flags);
    const requested = String(flags.instance || flags.key || '').trim();
    if (!requested) fail('MISSING_INSTANCE', 'Pass --instance <key>.');

    const lockPath = getLockPath(sessionId, dataDir);
    const existing = readJsonSafe(lockPath);
    if (existing && existing.instanceKey) {
      fail(
        'LOCK_IMMUTABLE',
        `Session is already permanently locked to "${existing.label}" (${existing.instanceKey}). ` +
          'Start a new session (e.g. /clear or a new conversation) to connect to a different Grav CMS instance.',
        { lock: existing }
      );
    }

    const match = findInstance(requested, instances);
    if (!match) {
      fail('UNKNOWN_INSTANCE', `Grav CMS instance "${requested}" is not registered.`, {
        availableKeys: instances.map((i) => i.key),
      });
    }

    const lock = {
      sessionId,
      instanceKey: match.key,
      label: match.label,
      url: match.url,
      serverName: match.serverName,
      toolPrefix: match.toolPrefix,
      lockedAt: new Date().toISOString(),
    };

    try {
      writeJsonExclusive(lockPath, lock);
    } catch (err) {
      if (err && err.code === 'EEXIST') {
        fail('LOCK_IMMUTABLE', 'A lock for this session was created concurrently and cannot be changed.', {
          lock: readJsonSafe(lockPath),
        });
      }
      fail('LOCK_WRITE_FAILED', String(err && err.message ? err.message : err));
    }

    printJson({ ok: true, locked: true, lock });
    return;
  }

  if (command === 'prune') {
    const days = Number(flags['older-than-days'] ?? 30);
    if (!Number.isFinite(days) || days < 1) fail('INVALID_DAYS', '--older-than-days must be >= 1.');
    const dir = getLocksDir(dataDir);
    const cutoff = Date.now() - days * 86400000;
    const removed = [];
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.json')) continue;
        const p = path.join(dir, f);
        if (fs.statSync(p).mtimeMs < cutoff) {
          fs.unlinkSync(p);
          removed.push(f);
        }
      }
    }
    printJson({ ok: true, action: 'pruned', olderThanDays: days, removedCount: removed.length });
    return;
  }

  fail('USAGE', 'Usage: grav-lock.mjs <status|lock|prune> --session <id> [--instance <key>]');
}

main();
