<p align="center"><img src="plugins/grav-cms/assets/logo.svg" width="96" alt="Grav CMS logo"></p>

# Grav CMS for Claude

Manage [Grav CMS 2.0+](https://getgrav.org/blog/grav-2-mcp-server) sites from Claude through their **OAuth2-protected Streamable HTTP MCP endpoint** (`https://<hostname.tld>/mcp`). There are no static API keys: you authenticate in the browser.

This repository ships two flavours:

| Flavour | For | Instance lock |
|---|---|---|
| **Claude Code plugin** ([`plugins/grav-cms`](plugins/grav-cms)) | Claude Code (CLI, IDE, desktop) | **Technically enforced** by a `PreToolUse` hook |
| **Standalone skill** ([`claude-ai/grav-cms`](claude-ai/grav-cms)) | claude.ai / Claude Desktop with a custom connector | Instruction-based |

## Features

- **OAuth2 MCP, no tokens in config.** Claude Code (`/mcp`) or the claude.ai connector handles authentication.
- **Multiple instances.** Register as many Grav sites as you like: self-hosted MCP servers or existing claude.ai connectors.
- **Mandatory, immutable per-session instance lock.** The first `/grav-cms:grav-cms` in a session asks which site to use and locks the session to it. The hook then:
  - denies every Grav MCP call until a site is selected,
  - denies calls to any other Grav site in the same session,
  - blocks attempts to edit, delete or prune lock files.
- **Confirmation for destructive actions.** Deleting pages or media, GPM install/update/remove, config changes, cache clears and similar calls trigger a Claude Code permission prompt. You can turn this off.
- **Non-Grav tools are never touched.** When a Grav call is allowed, the hook stays silent, so your normal permission rules still apply.

## Requirements

- A Grav CMS 2.0+ site with the MCP/API plugin enabled, reachable at `https://<host>/mcp`
- A Grav user with the permissions you want Claude to use (Grav enforces its own ACL and OAuth scopes)
- For the plugin: Claude Code and Node.js ≥ 18 on `PATH`

## Install: Claude Code plugin

```bash
# inside Claude Code
/plugin marketplace add <github-owner>/<repo>
/plugin install grav-cms@grav-cms-marketplace
```

Or from a local clone:

```bash
claude plugin marketplace add ./path/to/this/repo
claude plugin install grav-cms@grav-cms-marketplace
```

### Register a Grav site

Run `/grav-cms:grav-cms-setup add blog.example.com` and let Claude guide you, or do it by hand:

```bash
# 1. Make the MCP server known to Claude Code (OAuth2, no header needed)
claude mcp add --transport http --scope user grav-blog https://blog.example.com/mcp

# 2. Register it with the plugin (stores key, label, URL, server name — nothing secret)
node ~/.claude/plugins/.../grav-cms/scripts/grav-instances.mjs add --url blog.example.com --key blog --label "Company Blog"
```

Then run `/mcp` in Claude Code, select `grav-blog` and complete the browser login on your Grav site.

Already connected the site as a **claude.ai connector**? Its tools show up as `mcp__claude_ai_<Name>__…`. Register it with:

```bash
node .../scripts/grav-instances.mjs add --server-name "claude_ai_<Name>" --key mysite --label "My Site"
```

### Use it

```text
/grav-cms:grav-cms list all unpublished blog posts
```

Claude asks which site to use, locks the session to it, and then works only on that site. To switch sites, start a new session (`/clear`).

### Where your data lives

| What | Where |
|---|---|
| Instance registry | `~/.claude/grav-cms/instances.json` (see [`examples/instances.example.json`](examples/instances.example.json)) |
| Session locks | `~/.claude/grav-cms/locks/<session-id>.json` |
| OAuth tokens | Managed by Claude Code / claude.ai, **never** by this plugin |

Set `GRAV_CMS_DATA_DIR` to move the registry and locks somewhere else. To clean up old locks yourself, run `node .../scripts/grav-lock.mjs prune --older-than-days 30` in your own terminal. Claude is not allowed to run it.

## Install: standalone skill (claude.ai / Claude Desktop)

1. Add your Grav site as a custom connector: **Settings → Connectors → Add custom connector** → `https://<host>/mcp`, then authorize it.
2. Build the skill package (or download it from a release):
   ```bash
   npm run build:skill   # → dist/grav-cms-skill.zip
   ```
3. Upload it under **Settings → Capabilities → Skills → Upload skill**.

Without hooks, the instance lock here is enforced by the skill's instructions only.

## Repository layout

```text
.claude-plugin/marketplace.json     marketplace manifest (this repo = one-plugin marketplace)
plugins/grav-cms/
  .claude-plugin/plugin.json        plugin manifest
  skills/grav-cms/                  main skill (+ references/operations.md)
  skills/grav-cms-setup/            register / remove / troubleshoot instances
  hooks/hooks.json                  PreToolUse hook wiring
  scripts/                          zero-dependency Node.js helpers + hook
claude-ai/grav-cms/                 hook-free skill for claude.ai / Claude Desktop
examples/                           example registry (fake hosts only)
tests/                              node:test suite
tools/                              build script for the claude.ai skill zip
```

## Development

```bash
npm test             # unit + hook behaviour tests, secret scan
npm run sync         # copy the shared operations reference into the claude.ai skill
npm run build:skill  # build dist/grav-cms-skill.zip
npm run validate     # claude plugin validate (needs the claude CLI)
```

Test the plugin locally without installing it: `claude --plugin-dir ./plugins/grav-cms`.

## Security notes

- Never commit `instances.json`, `mcp_config.json` or `.mcp.json` files that contain real hosts. They are git-ignored, and the test suite fails if one shows up.
- The plugin never asks for or stores passwords, API keys or OAuth tokens.
- The instance lock protects against *accidental* cross-site changes by the model. It is not a security boundary against a user who has shell access to their own machine.

## Origin

This is a port of a Grav CMS plugin originally built for Google Antigravity, adapted to Claude Code's plugin, skill and hook model.

## License

[MIT](LICENSE)
