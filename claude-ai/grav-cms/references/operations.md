# Grav CMS MCP — Operations Reference

The exact tool set depends on the Grav version, the installed plugins, the OAuth scopes and the signed-in user's ACL. Treat this file as a map, not a contract. Always check the live tool schema before calling a tool.

## Tool domains (typical Grav 2.0 MCP tool names)

| Domain | Typical tools | Notes |
|---|---|---|
| Identity & site | `whoami`, `site_info`, `get_system_info`, `get_dashboard`, `get_dashboard_widgets` | Start with `whoami` to see grants and the key's scopes. |
| Pages | `list_pages`, `get_page`, `create_page`, `update_page`, `delete_page`, `bulk_pages`, `transfer_page`, `get_page_neighbors`, `list_page_templates`, `get_page_preview_token` | Pages are addressed by **route** (e.g. `/blog/my-post`). |
| Taxonomy | `get_taxonomy` | Categories and tags used across pages. |
| Multilingual | `list_languages`, `get_page_translations`, `manage_page_translation`, `get_translations`, `search_translation_keys`, `manage_translation_overrides`, `machine_translate` | Always state the language code you operate on. |
| Media | `list_media`, `upload_media`, `delete_media`, `rename_media`, `get_media_meta`, `update_media_meta`, `manage_media_folder` | Page media lives next to the page. Site media lives in shared folders. |
| Flex objects | `flex_list_directories`, `flex_get_directory`, `flex_get_blueprint`, `flex_list_objects`, `flex_get_object`, `flex_create_object`, `flex_update_object`, `flex_delete_object`, `flex_list_media`, `flex_delete_media` | Structured data (accounts, custom Flex directories). Read the directory blueprint first. |
| Configuration | `list_config_scopes`, `get_config`, `update_config`, `revert_config`, `list_environments`, `manage_environments` | Configuration is environment-aware. Confirm the target environment before writing. |
| Blueprints | `get_blueprint`, `manage_blueprint_file` | Blueprints define valid fields for pages, config and plugins. |
| Users & ACL | `get_users`, `manage_users`, `get_groups`, `manage_groups`, `get_permissions`, `get_password_policy`, `manage_invitations`, `manage_api_keys` | Never print secrets, hashes or API keys. |
| Packages (GPM) | `get_packages`, `search_packages`, `manage_packages`, `discover_plugins`, `plugin_action` | Install, update and remove are high-impact. Confirm first. |
| Operations | `clear_cache`, `manage_backups`, `get_scheduler`, `run_scheduler`, `run_reports`, `get_logs`, `clear_log`, `get_audit_log` | Prefer reports and logs for diagnosis before changing anything. |
| Webhooks & extras | `get_webhooks`, `manage_webhook`, `manage_twig_sandbox`, `dismiss_notification` | |

## Grav conventions worth knowing

- **Page = folder + Markdown file.** A route like `/blog/my-post` maps to a folder such as `user/pages/02.blog/my-post/`, which holds a template-named file like `item.md` (template `item`). A numeric prefix (`02.`) sets the order and makes the page visible in menus.
- **Frontmatter** (YAML header) holds the `title`, `taxonomy`, `published`, `date`, `visible`, `routable`, template options and so on. When updating, change only the keys the user asked for and keep everything else.
- **Content** is Markdown, optionally with Twig if `process.twig` is enabled. Don't introduce Twig unless asked.
- **Multilingual pages** use language-suffixed files (`item.de.md`, `item.en.md`). Check which languages exist before creating translations.
- **Modular pages** use child folders with a `_` prefix (`_hero`, `_features`). They are not routable on their own.
- **Configuration scopes**: `system`, `site`, `plugins/<name>`, `themes/<name>`. Environment overrides live under `user/env/<host>/config`.

## Recommended workflows

### Edit a page
1. Call `get_page` with the route and show the user the relevant part.
2. Plan the change (frontmatter keys and/or the content diff).
3. Call `update_page` with only the changed fields.
4. Call `get_page` again to verify. If the change isn't visible on the frontend, offer `clear_cache`.

### Create a page
1. Use `list_page_templates` to pick a valid template, and `list_pages` to find the parent route and its siblings for ordering.
2. Call `create_page` with the route, template, title and frontmatter (`published` defaults according to the user's wish).
3. Verify with `get_page`. Optionally create a preview link with `get_page_preview_token`.

### Bulk changes
- Use `bulk_pages` only after showing the user the exact list of affected routes and getting explicit confirmation.

### Config change
1. Read the scope with `get_config` and the field definitions with `get_blueprint`.
2. Apply a minimal `update_config` and confirm the environment.
3. Re-read to verify. Mention that `revert_config` is available.

### Package management
1. Use `get_packages` to see installed packages and available updates.
2. Show the plan (which packages, from which version to which) and get confirmation.
3. Suggest creating a backup first (`manage_backups`). Then run `manage_packages`.
4. Check `get_logs` / `run_reports` afterwards.

### Diagnose a problem
Work through `get_system_info` → `run_reports` → `get_logs` (recent errors) → `get_audit_log` (who changed what) before proposing changes.

## Safety checklist

- Read the current state first. Make the smallest change that fixes the problem. Verify afterwards.
- Get explicit confirmation before delete, uninstall, restore, bulk operations, security or system config changes, and cache clears on production.
- Never output API keys, tokens, invitation links, password hashes or personal data beyond what the user asked for.
- Respect a `403` and explain which permission is missing (`whoami` shows the grants).
