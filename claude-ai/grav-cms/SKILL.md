---
name: grav-cms
description: >-
  Manage Grav CMS 2.0+ sites connected as MCP connectors (OAuth2 Streamable HTTP endpoint https://<host>/mcp):
  pages, media, translations, configuration, blueprints, users, GPM packages, backups, webhooks and system health.
  Use whenever the user wants to read or change content or settings on a Grav CMS site. When several Grav
  connectors are available, ask which one to use and stay on that single site for the whole conversation.
---

# Grav CMS (claude.ai / Claude Desktop)

This is the hook-free version of the `grav-cms` skill, for claude.ai and Claude Desktop. The Grav site is connected as a **custom connector**: Settings → Connectors → Add custom connector → `https://<hostname.tld>/mcp`. Authentication is **OAuth2** and is handled by the connector. Never ask the user for passwords, API keys or tokens.

## Step 1 — Select one Grav site for this conversation

1. Look at the available tools. Grav connectors expose tools such as `whoami`, `site_info`, `list_pages` and `get_page`. Group them by connector.
2. If **no** Grav connector is available, explain how to add one (see above) and stop.
3. If this conversation has **not** selected a Grav site yet, ask the user which connector or site to use. Ask this even if only one is connected, so the user explicitly confirms. Do not call any Grav tool before the user answers.
4. After the user answers, state clearly: "This conversation is now locked to **<site>**." Then call `whoami` and `site_info` on that connector and report the account and site.

## Step 2 — Stay locked

- For the rest of the conversation, call tools **only** on the selected connector.
- If the user asks to work on, compare with, or copy to another Grav site, decline politely and recommend starting a new conversation for that site. This prevents accidental cross-site changes.

## Step 3 — Work safely

- **Use live schemas.** The tool set depends on the Grav version, the installed plugins and the OAuth user's permissions. Never guess tool names or arguments.
- **Read before you write.** Fetch the current state, make the smallest change, then read it back to verify.
- **Confirm high-impact actions.** Ask before deleting pages, media or users, before GPM install, update or remove, before restoring backups, before bulk operations, before system or security config changes, and before clearing caches on production.
- **Respect ACLs.** A `403` means the signed-in Grav user lacks a permission. Explain that; do not try to work around it.
- **Keep secrets out of the chat.** Never print API keys, tokens, invitation links or password hashes.

For the tool domains, workflows and Grav conventions, see [references/operations.md](references/operations.md).
