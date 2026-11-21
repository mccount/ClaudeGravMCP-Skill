# TODO

## Later

- [ ] **Release workflow for the claude.ai skill zip.** Add a GitHub Actions workflow that runs `npm test` and `npm run build:skill` on a version tag (`v*`) and attaches `dist/grav-cms-skill.zip` to a GitHub Release. Then point the README ("download it from a release") to the releases page.
  - Keep the versions in `package.json`, `plugins/grav-cms/.claude-plugin/plugin.json` and the tag in sync, ideally with a check in CI.
