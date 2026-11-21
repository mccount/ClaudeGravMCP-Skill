#!/usr/bin/env node
// Claude Code PreToolUse hook for the grav-cms plugin.
//
// 1. Grav MCP calls (mcp__<server>__<tool> and MCP resource tools):
//    - deny if no Grav CMS instance has been locked for this session yet
//    - deny if the call targets a different (or unregistered) Grav server
//    - ask for confirmation on destructive Grav tools/actions
// 2. Bash / PowerShell / Write / Edit / MultiEdit / NotebookEdit:
//    - deny any attempt to touch the lock directory or prune locks
//
// Non-Grav tools are never affected. When a Grav call is permitted the hook
// prints nothing, so the user's normal permission settings still apply.
import fs from 'node:fs';
import {
  extractMcpToolName,
  extractServerName,
  findInstanceByServer,
  getLockPath,
  loadInstances,
  loadRegistry,
  looksLikeGrav,
  readJsonSafe,
} from './grav-common.mjs';

const FILE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);

const LOCK_PATH_PATTERN = /grav-cms[\\/]+locks/i;
const PRUNE_PATTERN = /grav-lock\.mjs["']?\s+prune/i;

// Tools that are always destructive / high impact
const DESTRUCTIVE_TOOL_PATTERN =
  /^(delete_|flex_delete_|clear_|revert_config$|update_config$|run_scheduler$|manage_twig_sandbox$)/i;
// Action-style tools (manage_*, bulk_pages, plugin_action, …) with a destructive action argument
const DESTRUCTIVE_ACTION_PATTERN =
  /^(delete|remove|uninstall|install|update|upgrade|downgrade|restore|revoke|purge|reset|disable|drop|destroy|wipe|trash|move|self[-_]?upgrade|rotate|regenerate)/i;

function decide(decision, reason) {
  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: decision,
        permissionDecisionReason: reason,
      },
    })}\n`
  );
  process.exit(0);
}

function noDecision() {
  process.exit(0);
}

function readPayload() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw && raw.trim() ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function guardLockFiles(toolName, input) {
  const texts = [];
  if (SHELL_TOOLS.has(toolName)) texts.push(input.command);
  if (FILE_TOOLS.has(toolName)) texts.push(input.file_path, input.notebook_path, input.path);

  for (const t of texts) {
    if (typeof t !== 'string') continue;
    if (LOCK_PATH_PATTERN.test(t)) {
      decide(
        'deny',
        'Grav CMS session locks are immutable and must not be read, edited or deleted directly. ' +
          'Use `grav-lock.mjs status` to inspect the lock. To use another Grav instance, the user has to start a new session.'
      );
    }
    if (SHELL_TOOLS.has(toolName) && PRUNE_PATTERN.test(t)) {
      decide(
        'deny',
        'Pruning Grav CMS session locks is reserved for the user. Ask the user to run it in their own terminal.'
      );
    }
  }
  noDecision();
}

function destructiveReason(mcpTool, input) {
  if (DESTRUCTIVE_TOOL_PATTERN.test(mcpTool)) {
    return `"${mcpTool}" changes or deletes data on the Grav CMS site.`;
  }
  for (const field of ['action', 'operation', 'op', 'command', 'mode']) {
    const v = input[field];
    if (typeof v === 'string' && DESTRUCTIVE_ACTION_PATTERN.test(v.trim())) {
      return `"${mcpTool}" with ${field}="${v}" is a high-impact change on the Grav CMS site.`;
    }
  }
  return '';
}

function main() {
  const payload = readPayload();
  if (!payload || typeof payload !== 'object') noDecision(); // malformed input: never interfere

  const toolName = String(payload.tool_name || '');
  const input = payload.tool_input && typeof payload.tool_input === 'object' ? payload.tool_input : {};

  if (SHELL_TOOLS.has(toolName) || FILE_TOOLS.has(toolName)) guardLockFiles(toolName, input);

  const serverName = extractServerName(toolName, input);
  if (!serverName) noDecision();

  const instances = loadInstances();
  const target = findInstanceByServer(serverName, instances);
  if (!target && !looksLikeGrav(serverName)) noDecision(); // not a Grav server

  const sessionId = String(payload.session_id || '').trim();
  if (!sessionId) {
    decide('deny', 'Cannot verify the Grav CMS session lock: session_id missing in hook input.');
  }

  const lock = readJsonSafe(getLockPath(sessionId));
  if (!lock || !lock.instanceKey) {
    decide(
      'deny',
      instances.length === 0
        ? 'No Grav CMS instances are registered yet. Run /grav-cms:grav-cms-setup to register one, then /grav-cms:grav-cms to select it.'
        : 'No Grav CMS instance has been selected for this session yet. Run the /grav-cms:grav-cms skill: ask the user which ' +
            'instance to use (AskUserQuestion) and lock the choice with grav-lock.mjs before calling any Grav MCP tool.'
    );
  }

  if (!target) {
    decide(
      'deny',
      `MCP server "${serverName}" looks like a Grav CMS server but is not registered in the grav-cms instance registry. ` +
        `This session is permanently locked to "${lock.label}" (server "${lock.serverName}").`
    );
  }

  if (target.key !== lock.instanceKey) {
    decide(
      'deny',
      `This session is permanently locked to Grav CMS instance "${lock.label}" (server "${lock.serverName}"). ` +
        `Calling "${target.label}" (server "${target.serverName}") in the same session is not allowed — ` +
        'tell the user to start a new session and run /grav-cms:grav-cms to connect to a different instance.'
    );
  }

  const settings = loadRegistry().settings || {};
  if (settings.confirmDestructive !== false) {
    const reason = destructiveReason(extractMcpToolName(toolName), input);
    if (reason) decide('ask', `[Grav CMS: ${lock.label}] ${reason} Please confirm.`);
  }

  noDecision();
}

main();
