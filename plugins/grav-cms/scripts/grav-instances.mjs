#!/usr/bin/env node
// Manage the local Grav CMS instance registry (~/.claude/grav-cms/instances.json).
//
//   node grav-instances.mjs list
//   node grav-instances.mjs add --url <host|https://host/mcp> [--key <slug>] [--label <name>]
//                               [--description <text>] [--server-name <mcp server name>] [--update]
//   node grav-instances.mjs add --server-name claude_ai_<Connector> --key <slug> --label <name>
//   node grav-instances.mjs remove --key <key>
//
// The registry only stores names, labels and public endpoint URLs.
// It never stores OAuth tokens — those are handled by Claude Code / claude.ai.
import {
  fail,
  findInstance,
  getInstancesPath,
  loadInstances,
  loadRegistry,
  normalizeGravMcpUrl,
  parseCliArgs,
  printJson,
  publicInstance,
  slugifyInstanceKey,
  writeJson,
} from './grav-common.mjs';

function shellQuote(s) {
  return /^[A-Za-z0-9._:/@-]+$/.test(s) ? s : `"${String(s).replace(/"/g, '\\"')}"`;
}

function main() {
  const { positional, flags } = parseCliArgs(process.argv.slice(2));
  const command = positional[0] || 'list';
  const dataDir = typeof flags['data-dir'] === 'string' ? flags['data-dir'] : undefined;
  const registryPath = getInstancesPath(dataDir);

  if (command === 'list') {
    const instances = loadInstances(dataDir);
    printJson({
      ok: true,
      registryPath,
      count: instances.length,
      instances: instances.map(publicInstance),
    });
    return;
  }

  if (command === 'add') {
    const rawUrl = flags.url || flags.host || positional[1];
    const rawServer = typeof flags['server-name'] === 'string' ? flags['server-name'].trim() : '';

    if (!rawUrl && !rawServer) {
      fail(
        'MISSING_URL',
        'Usage: grav-instances.mjs add --url <https://hostname.tld/mcp> [--key <slug>] [--label <name>] ' +
          '[--description <text>] [--server-name <mcp-server-name>] [--update]'
      );
    }

    let url = '';
    if (rawUrl) {
      try {
        url = normalizeGravMcpUrl(rawUrl);
      } catch (err) {
        fail('INVALID_URL', err.message);
      }
    }

    let key;
    try {
      key = slugifyInstanceKey(
        typeof flags.key === 'string' ? flags.key : rawServer.replace(/^claude_ai_/i, ''),
        url
      );
    } catch (err) {
      fail('INVALID_KEY', err.message);
    }

    const serverName = rawServer || key;
    const label =
      (typeof flags.label === 'string' && flags.label.trim()) ||
      (url ? new URL(url).hostname : key.replace(/^grav-/, ''));
    const description = typeof flags.description === 'string' ? flags.description.trim() : '';

    const registry = loadRegistry(dataDir);
    if (registry.instances[key] && !flags.update) {
      fail(
        'ALREADY_EXISTS',
        `Instance key "${key}" already exists. Pass --update to replace it or choose a different --key.`,
        { existing: registry.instances[key] }
      );
    }

    registry.instances[key] = { label, description, url, serverName };
    writeJson(registryPath, registry);

    const isConnector = /^claude_ai_/i.test(serverName);
    printJson({
      ok: true,
      action: flags.update ? 'updated' : 'added',
      registryPath,
      instance: publicInstance(loadInstances(dataDir).find((i) => i.key === key)),
      nextSteps: isConnector
        ? [
            'This instance is a claude.ai connector. Make sure the connector is connected (claude.ai > Settings > Connectors) and authorized via OAuth2.',
          ]
        : [
            `Register the MCP server in Claude Code (once): claude mcp add --transport http --scope user ${shellQuote(serverName)} ${shellQuote(url || 'https://<hostname.tld>/mcp')}`,
            `Authorize via OAuth2: run /mcp in Claude Code, select "${serverName}" and complete the browser login (or: claude mcp login ${shellQuote(serverName)}).`,
            'Restart Claude Code or reconnect via /mcp if the server tools do not appear yet.',
          ],
    });
    return;
  }

  if (command === 'remove') {
    const requested = String(flags.key || positional[1] || '').trim();
    if (!requested) fail('MISSING_KEY', 'Usage: grav-instances.mjs remove --key <instance-key>');

    const match = findInstance(requested, loadInstances(dataDir));
    if (!match) {
      fail('NOT_FOUND', `No Grav CMS instance found for "${requested}".`, {
        availableKeys: loadInstances(dataDir).map((i) => i.key),
      });
    }

    const registry = loadRegistry(dataDir);
    delete registry.instances[match.key];
    writeJson(registryPath, registry);

    printJson({
      ok: true,
      action: 'removed',
      removed: publicInstance(match),
      nextSteps: /^claude_ai_/i.test(match.serverName)
        ? ['Optionally disconnect the connector in claude.ai > Settings > Connectors.']
        : [`Optionally remove the MCP server from Claude Code: claude mcp remove ${shellQuote(match.serverName)} --scope user`],
    });
    return;
  }

  fail('USAGE', 'Usage: grav-instances.mjs <list|add|remove> [options]');
}

main();
