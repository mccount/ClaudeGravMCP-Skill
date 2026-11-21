---
name: grav-cms
description: >-
  Connect to and manage a Grav CMS 2.0+ site through its OAuth2 Streamable HTTP MCP server (/mcp):
  pages, media, translations, configuration, blueprints, users, GPM packages, backups, webhooks and system health.
  Use whenever the user wants to read or change content or settings on a Grav CMS site. Supports multiple
  registered instances; the first use in a session requires an explicit instance selection that is then
  permanently locked for the session.
argument-hint: "[what to do on the Grav site]"
---

# Grav CMS

Manage one of the user's registered [Grav CMS 2.0+](https://getgrav.org/blog/grav-2-mcp-server) instances over its OAuth2 MCP endpoint (`https://<hostname.tld>/mcp`).

User request: $ARGUMENTS

A `PreToolUse` hook enforces the rules below. Any Grav MCP call is **denied** until an instance is locked for this session, and calls to any other Grav instance are denied afterwards. Do not try to work around it.

## Step 1 — Check the session lock

Run this before any Grav MCP tool call:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/grav-lock.mjs" status --session "${CLAUDE_SESSION_ID}"
```

Read the JSON output:

### Case A — no instances registered (`instanceCount === 0`)

Tell the user that no Grav CMS instance is registered yet and offer to set one up with the `grav-cms-setup` skill (`/grav-cms:grav-cms-setup`).

### Case B — not locked (`locked === false`): mandatory selection

1. Use **AskUserQuestion** with:
   - question: "Which Grav CMS instance should this session use? (The choice is locked for the whole session — start a new session to switch.)"
   - one option per registered instance: label `<label>`, description `<url or serverName> — key: <key>`
   - If the user already named an instance, put it first and add "(Recommended)". **Still ask**, even then.
   - If only one instance is registered, add a second option "Register another instance first" so the user explicitly confirms the connection.
2. If the user picks "Register another instance first", switch to the `grav-cms-setup` skill.
3. Lock the choice immediately:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/grav-lock.mjs" lock --session "${CLAUDE_SESSION_ID}" --instance "<key>"
   ```

4. Tell the user which instance this session is now permanently locked to (`<label>` — `<url>`), then go to Step 2.

### Case C — already locked (`locked === true`)

- Do **not** ask again.
- If the user asks to switch to, compare with, or act on a **different** Grav instance, decline politely:
  > This session is permanently locked to **<lock.label>** (`<lock.url>`). To work with a different Grav CMS instance, start a new session (for example `/clear`) and run `/grav-cms:grav-cms` again.
- Never read, edit, delete or overwrite lock files under `~/.claude/grav-cms/locks/`, and never run `grav-lock.mjs prune`.

## Step 2 — Find the locked MCP server and check auth

1. All tools of the locked instance are named `<lock.toolPrefix><tool>`, for example `mcp__grav-blog__list_pages`, or `mcp__claude_ai_<Connector>__list_pages` for claude.ai connectors. If they are deferred, load their schemas with ToolSearch (for example the query `+<serverName> page`) before calling them.
2. If no tools with that prefix exist, or calls fail with `401` or an authentication error:
   - Never ask for passwords, API keys or tokens. Grav `/mcp` uses **OAuth2**.
   - Ask the user to run `/mcp` in Claude Code, select `<lock.serverName>` and complete the browser login on their Grav site. For claude.ai connectors: claude.ai → Settings → Connectors.
   - If the server was only just added with `claude mcp add`, Claude Code may need a restart or a reconnect via `/mcp`.
3. Optional sanity check: call `whoami` and/or `site_info` and tell the user which Grav account and site you are connected as.

## Step 3 — Work on the locked instance

- **Use live schemas.** The available tools depend on the Grav version, the installed plugins and the OAuth user's permissions. Never guess tool names or arguments. Read the schema first.
- **Read before you write.** Fetch the current state (page, config, package list) before changing it. Afterwards, read it back and verify the change.
- **Confirm high-impact actions.** Get explicit confirmation before deleting pages, media or users, before GPM install, update or remove, before restoring backups, before changing system or security configuration, and before clearing caches on production. The hook also triggers a permission prompt for many of these calls.
- **Respect ACLs.** A `403` or missing tools usually means the signed-in Grav user lacks a permission. Explain that; do not try to work around it.
- **Keep secrets out of the chat.** Never print API keys, tokens or user password hashes, even if a tool returns them.

For the tool domains, typical workflows and Grav conventions (page routes, frontmatter, multilingual pages, Flex objects), see [references/operations.md](references/operations.md).
