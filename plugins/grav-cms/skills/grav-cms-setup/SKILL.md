---
name: grav-cms-setup
description: >-
  Register, list, remove or troubleshoot Grav CMS OAuth2 MCP instances (https://hostname.tld/mcp) for the grav-cms plugin.
  Use when adding a new Grav site, connecting an existing claude.ai Grav connector, viewing registered sites,
  or fixing OAuth2 / connection problems.
argument-hint: "[add <host> | list | remove <key> | troubleshoot]"
---

# Grav CMS Setup

Manage the Grav CMS 2.0+ instances that the `grav-cms` plugin may use. Each instance connects over Streamable HTTP at `https://<hostname.tld>/mcp` and authenticates with **OAuth2**. You never need a static API key, and you must never ask for one.

User request: $ARGUMENTS

Instances are stored in a local registry, outside the plugin folder:

- Registry: `~/.claude/grav-cms/instances.json` (override with the `GRAV_CMS_DATA_DIR` environment variable)
- Helper: `node "${CLAUDE_PLUGIN_ROOT}/scripts/grav-instances.mjs" <list|add|remove>`

The registry stores only keys, labels, public endpoint URLs and MCP server names. OAuth tokens are managed by Claude Code (`/mcp`) or by claude.ai.

## List instances

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/grav-instances.mjs" list
```

You can also run `claude mcp list` to see which MCP servers Claude Code knows about and whether they still need authentication.

## Add a self-hosted Grav instance (Claude Code MCP server)

1. Ask the user for:
   - the hostname or URL (e.g. `blog.example.com` → normalized to `https://blog.example.com/mcp`)
   - an optional label (e.g. "Company Blog") and an optional short key (e.g. `blog` → stored as `grav-blog`)
2. Register it in the plugin registry:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/grav-instances.mjs" add --url "<host or url>" --key "<slug>" --label "<label>" --description "<optional>"
   ```

3. Register the MCP server with Claude Code under the **same name** as the instance key (`grav-<slug>`). Show the user the exact command from the `nextSteps` output and run it only after they agree:

   ```bash
   claude mcp add --transport http --scope user grav-<slug> https://<hostname.tld>/mcp
   ```

   Do **not** add an `Authorization` header or API key unless the user explicitly asks for static token auth instead of OAuth2.
4. Tell the user to authorize:
   - run `/mcp` in Claude Code, select `grav-<slug>` and complete the OAuth2 login and consent in the browser on their Grav site
   - alternatively, run `claude mcp login grav-<slug>` in a terminal
   - restart Claude Code or reconnect via `/mcp` if the tools don't show up
5. Then run `/grav-cms:grav-cms` to select and lock the instance.

## Add an existing claude.ai connector

If the user has already connected their Grav site as a claude.ai connector, its tools appear as `mcp__claude_ai_<Connector_Name>__<tool>`. Register the connector's server name, which is the part between `mcp__` and the second `__`:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/grav-instances.mjs" add --server-name "claude_ai_<Connector_Name>" --key "<slug>" --label "<label>" --url "<optional https://host/mcp>"
```

## Remove an instance

Confirm the key with the user first, then run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/grav-instances.mjs" remove --key "<key>"
```

Optionally offer to remove the MCP server as well: `claude mcp remove grav-<slug> --scope user`.

## Settings

`~/.claude/grav-cms/instances.json` may contain an optional `settings` block:

```json
{ "settings": { "confirmDestructive": true }, "instances": { } }
```

`confirmDestructive` defaults to `true`. When it is on, the hook asks for confirmation before destructive Grav tool calls.

## Troubleshooting

- **`401` / "Needs authentication"**: re-authorize via `/mcp` → server → authenticate, or run `claude mcp login <server>`. Never ask for passwords or keys in chat.
- **Wrong endpoint**: it must be `https://<hostname.tld>/mcp`, with HTTPS and the `/mcp` path (not `/api` or `/sse`). The Grav 2.0 MCP/API plugin must be installed and enabled on the site.
- **`403` or missing tools**: Grav's MCP server applies the signed-in user's native Grav ACL and the OAuth scopes. Calling `whoami` shows the grants. Fix the permissions in the Grav admin.
- **Calls denied with "No Grav CMS instance has been selected"**: this is expected. Run `/grav-cms:grav-cms` first.
- **Calls denied with "permanently locked to …"**: expected as well. Start a new session to use another instance.
- **Server registered but tools denied as "not registered"**: the MCP server name differs from the registry's `serverName`. Fix it with `add --key <key> --server-name <actual-server-name> --update`.
