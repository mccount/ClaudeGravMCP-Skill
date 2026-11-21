#!/usr/bin/env node
// Renders the illustrative terminal mockups used in README.md to docs/images/*.svg.
// All hosts, names and outputs are fictitious (example.com). Run: npm run screenshots
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'docs', 'images');

const COLORS = {
  fg: '#d4d4d8',
  dim: '#71717a',
  green: '#4ade80',
  yellow: '#facc15',
  red: '#f87171',
  cyan: '#67e8f9',
  violet: '#c4b5fd',
  orange: '#fdba74',
  white: '#fafafa',
};

const W = 900;
const LINE = 21;
const PAD_X = 22;
const TOP = 52;
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// A line is a string (fg) or an array of [text, color, bold?] segments.
// Segments flow as <tspan>s so spacing follows the viewer's actual monospace font.
function renderLine(line, y) {
  const segs = typeof line === 'string' ? [[line, 'fg']] : line;
  const spans = segs
    .filter(([text]) => text)
    .map(
      ([text, color = 'fg', bold = false]) =>
        `<tspan fill="${COLORS[color]}"${bold ? ' font-weight="700"' : ''}>${esc(text)}</tspan>`
    )
    .join('');
  return spans ? `<text x="${PAD_X}" y="${y}" xml:space="preserve">${spans}</text>` : '';
}

function renderBoxes(boxes) {
  return (boxes || [])
    .map(
      ({ from, to, color = 'violet' }) =>
        `<rect x="${PAD_X - 10}" y="${TOP + from * LINE - 15}" width="${W - 2 * PAD_X + 20}" height="${(to - from + 1) * LINE + 2}" rx="8" fill="none" stroke="${COLORS[color]}" stroke-opacity="0.55" stroke-width="1.5"/>`
    )
    .join('');
}

function svg({ title, lines, boxes }) {
  const h = TOP + lines.length * LINE + 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" role="img" aria-label="${esc(title)} (illustrative mockup)">
<rect width="${W}" height="${h}" rx="12" fill="#18181b"/>
<rect width="${W}" height="34" rx="12" fill="#27272a"/><rect y="22" width="${W}" height="12" fill="#27272a"/>
<circle cx="22" cy="17" r="6" fill="#f87171"/><circle cx="42" cy="17" r="6" fill="#facc15"/><circle cx="62" cy="17" r="6" fill="#4ade80"/>
<text x="${W / 2}" y="22" text-anchor="middle" fill="#a1a1aa" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="12.5">${esc(title)}</text>
<text x="${W - 14}" y="22" text-anchor="end" fill="#52525b" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="11">illustrative mockup</text>
<g font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace" font-size="13">
${renderBoxes(boxes)}
${lines.map((l, i) => renderLine(l, TOP + i * LINE)).join('\n')}
</g>
</svg>
`;
}

const P = ['> ', 'violet', true];

const SHOTS = {
  '01-install-plugin': {
    title: 'Claude Code — install the plugin',
    lines: [
      [P, ['/plugin marketplace add mccount/ClaudeGravMCP-Skill', 'white']],
      [['  ✔ ', 'green'], ['Marketplace "grav-cms-marketplace" added', 'fg']],
      '',
      [P, ['/plugin install grav-cms@grav-cms-marketplace', 'white']],
      [['  ✔ ', 'green'], ['Installed grav-cms 0.1.0 (2 skills, 2 hooks)', 'fg']],
      '',
      [P, ['/reload-plugins', 'white']],
      [['  ✔ ', 'green'], ['Plugins reloaded', 'fg']],
      '',
      [P, ['/grav', 'white']],
      [['  /grav-cms:grav-cms        ', 'cyan'], ['Connect to and manage a Grav CMS 2.0+ site …', 'dim']],
      [['  /grav-cms:grav-cms-setup  ', 'cyan'], ['Register, list, remove or troubleshoot instances …', 'dim']],
    ],
    boxes: [{ from: 10, to: 11 }],
  },
  '02-register-instance': {
    title: 'Claude Code — /grav-cms:grav-cms-setup',
    lines: [
      [P, ['/grav-cms:grav-cms-setup add blog.example.com', 'white']],
      '',
      [['● ', 'green'], ['Bash', 'white', true], ['  node …/scripts/grav-instances.mjs add --url blog.example.com \\', 'dim']],
      [['                --key blog --label "Company Blog"', 'dim']],
      [['  ⎿ ', 'dim'], ['{ "ok": true, "action": "added",', 'fg']],
      [['      "instance": { "key": "', 'fg'], ['grav-blog', 'yellow'], ['", "url": "https://blog.example.com/mcp",', 'fg']],
      [['                    "toolPrefix": "mcp__grav-blog__" } }', 'fg']],
      '',
      [['● ', 'green'], ['Bash', 'white', true], ['  claude mcp add --transport http --scope user grav-blog \\', 'dim']],
      [['                https://blog.example.com/mcp', 'dim']],
      [['  ⎿ ', 'dim'], ['Added HTTP MCP server grav-blog with URL: https://blog.example.com/mcp to user config', 'fg']],
      '',
      [['● ', 'violet'], ['Registered "Company Blog". Next: reload, then run ', 'fg'], ['/mcp', 'cyan'], [' → grav-blog → Authenticate.', 'fg']],
    ],
  },
  '03-authenticate': {
    title: 'Terminal + Claude Code — OAuth2 login via /mcp',
    lines: [
      [['$ ', 'green', true], ['claude mcp list', 'white']],
      [['  grav-blog: https://blog.example.com/mcp (HTTP) - ', 'fg'], ['! Needs authentication', 'yellow']],
      '',
      [P, ['/mcp', 'white']],
      [['  MCP servers', 'white', true]],
      [['  ❯ grav-blog          ', 'cyan'], ['needs authentication', 'yellow']],
      [['    github             ', 'fg'], ['connected', 'green']],
      '',
      [['  grav-blog  ', 'white', true], ['https://blog.example.com/mcp', 'dim']],
      [['  ❯ Authenticate', 'cyan'], ['   → opens the Grav login & consent page in your browser', 'dim']],
      '',
      [['  ✔ ', 'green'], ['Authentication successful. Connected to grav-blog (68 tools).', 'fg']],
      '',
      [['$ ', 'green', true], ['claude mcp list', 'white']],
      [['  grav-blog: https://blog.example.com/mcp (HTTP) - ', 'fg'], ['✔ Connected', 'green']],
    ],
    boxes: [{ from: 8, to: 9, color: 'cyan' }],
  },
  '04-select-instance': {
    title: 'Claude Code — first use in a session',
    lines: [
      [P, ['/grav-cms:grav-cms list all unpublished blog posts', 'white']],
      '',
      [['● ', 'green'], ['Bash', 'white', true], ['  node …/scripts/grav-lock.mjs status --session 3f9c…', 'dim']],
      [['  ⎿ ', 'dim'], ['{ "locked": false, "instanceCount": 2, … }', 'fg']],
      '',
      [['  Which Grav CMS instance should this session use?', 'white', true]],
      [['  (The choice is locked for the whole session — start a new session to switch.)', 'dim']],
      [['  ❯ 1. Company Blog (Recommended)  ', 'cyan'], ['https://blog.example.com/mcp — key: grav-blog', 'dim']],
      [['    2. Documentation               ', 'fg'], ['claude_ai_Grav_Docs — key: grav-docs', 'dim']],
      [['    3. Other …', 'fg']],
      '',
      [['● ', 'green'], ['Bash', 'white', true], ['  node …/scripts/grav-lock.mjs lock --session 3f9c… --instance grav-blog', 'dim']],
      [['● ', 'violet'], ['🔒 This session is now locked to ', 'fg'], ['Company Blog', 'yellow', true], [' (https://blog.example.com/mcp).', 'fg']],
      [['● ', 'green'], ['grav-blog - list_pages', 'white', true], [' (MCP)(published: false, route: "/blog")', 'dim']],
      [['  ⎿ ', 'dim'], ['3 pages: /blog/roadmap-2027, /blog/launch-recap, /blog/draft-faq', 'fg']],
    ],
    boxes: [{ from: 5, to: 9 }],
  },
  '05-guardrails': {
    title: 'Claude Code — guardrails enforced by the hook',
    lines: [
      [P, ['also check the docs site for broken links', 'white']],
      [['● ', 'red'], ['Grav_Docs - run_reports', 'white', true], [' (MCP)', 'dim']],
      [['  ⎿ ', 'dim'], ['PreToolUse:mcp__claude_ai_Grav_Docs__run_reports hook denied this tool:', 'red']],
      [['     This session is permanently locked to Grav CMS instance "Company Blog" …', 'fg']],
      [['● ', 'violet'], ['This session is locked to Company Blog. Start a new session (/clear) for Documentation.', 'fg']],
      '',
      [P, ['delete the draft FAQ page', 'white']],
      [['  Tool use: ', 'white', true], ['grav-blog - delete_page(route: "/blog/draft-faq")', 'fg']],
      [['  [Grav CMS: Company Blog] "delete_page" changes or deletes data on the Grav CMS site.', 'orange']],
      [['  Please confirm.', 'orange']],
      [['  Do you want to proceed?', 'white']],
      [['  ❯ 1. Yes', 'cyan']],
      [['    2. No, and tell Claude what to do differently', 'fg']],
    ],
    boxes: [
      { from: 2, to: 3, color: 'red' },
      { from: 7, to: 12, color: 'orange' },
    ],
  },
};

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [name, def] of Object.entries(SHOTS)) {
  fs.writeFileSync(path.join(OUT_DIR, `${name}.svg`), svg(def));
  console.log(`docs/images/${name}.svg`);
}
