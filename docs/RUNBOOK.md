# birdsEye Runbook

Every command needed to build, regenerate, verify, and release birdsEye, with the reason each one exists.

This file is written to be read cold, with no chat history and no memory of a previous session.
If you find yourself about to answer "how do I regenerate that", the answer belongs here.

Related docs:

- `docs/DESIGN_SYSTEM.md` and `plugins/birdseye/DESIGN_VIEWER.md` for visual rules.
- `docs/DEPLOYMENT.md` for release paths.
- `docs/AGENT_MEMORY.md` for project decisions.

All paths below assume the repository is checked out at `~/Gh/birdsEye`.

## 1. The Mental Model

A generated map is **one self-contained HTML file with the viewer template baked into it at render time**.

That has one consequence that matters constantly:

> Editing `plugins/birdseye/scripts/template/index.html` changes nothing in any map that already exists on disk.
> An existing `index.html` keeps whatever template it was rendered with.
> Every viewer change requires a re-render of each map you want to see it in.

The pipeline is five stages and each writes a file the next one reads:

| Stage | Command | Reads | Writes |
| --- | --- | --- | --- |
| 1 | `node init.mjs status [root]` | config, `.gitignore`, Python | nothing (reports only) |
| 2 | `node structure.mjs scan [root]` | the filesystem | `birdseye/.cache/structure.scan.json` |
| 3 | `node ast.mjs [root]` | source files, via graphify | `birdseye/.cache/ast.json` |
| 4 | `node build.mjs [root]` | `ast.json`, `structure.scan.json` | `birdseye/graph.json` (schema 5) |
| 5 | `node render.mjs [root]` | `graph.json`, template, vendor | `birdseye/index.html` |

Only stage 5 reads the template.
So a template-only change is a stage 5 re-run, not a rebuild.

Every stage takes the target repository root as its last argument and defaults to the current working directory.
`init.mjs` and `structure.mjs` take a subcommand before the root.

## 2. Regenerate After A Viewer Change

This is the command you want after editing the template.
It is cheap: no filesystem walk, no tree-sitter parse, no model call.

```bash
node ~/Gh/birdsEye/plugins/birdseye/scripts/render.mjs /path/to/target-repo
```

It prints the output path and size, for example
`/Users/tamalcodes/Gh/edilitics/birdseye/index.html  (2514 KB)`.

Then hard-reload the open `file://` tab. A plain reload can serve the cached copy.

This repository's own map:

```bash
node plugins/birdseye/scripts/render.mjs .
```

Known targets that have a valid `birdseye/graph.json` and can be re-rendered directly:

- `~/Gh/birdsEye` (this repository)
- `~/Gh/edilitics` (edilitics-frontend, 18 modules, 1079 files)

If `graph.json` is missing, run the full pipeline in section 3 instead.

## 3. Map A Repository From Scratch

The normal user-facing path is the plugin command `/birdseye:map` inside the target repository.
The manual equivalent, in order:

```bash
cd /path/to/target-repo
node ~/Gh/birdsEye/plugins/birdseye/scripts/init.mjs status .
node ~/Gh/birdsEye/plugins/birdseye/scripts/structure.mjs scan .
node ~/Gh/birdsEye/plugins/birdseye/scripts/ast.mjs .
node ~/Gh/birdsEye/plugins/birdseye/scripts/build.mjs .
node ~/Gh/birdsEye/plugins/birdseye/scripts/render.mjs .
```

Useful variants:

```bash
node .../init.mjs write .            # write birdseye.config.json
node .../init.mjs gitignore .        # add birdseye/ to .gitignore
node .../structure.mjs check .       # validate a hand-written structure.json
node .../structure.mjs estimate .    # rough token cost of a full map build
node .../ast.mjs . --force           # ignore the graphify per-file cache
node .../ast.mjs . --json            # print the AST result instead of a summary
```

`ast.mjs` needs Python with graphify available; `init.mjs status` is what tells you whether it is.
graphify keeps a content-hash cache under `birdseye/.cache/graphify/`, so a second run only re-parses changed files.

## 4. Verify A Template Change

The viewer is one HTML file with inline CSS, markup, and script, so there is no build step and no type checker guarding it.
Use these three checks in order.

**Syntax-check the inline scripts.** A stray brace in the template silently produces a blank map.

```bash
python3 - <<'EOF'
import io, re, subprocess
s = io.open('plugins/birdseye/scripts/template/index.html', encoding='utf-8').read()
for i, b in enumerate(re.findall(r'<script(?![^>]*src=)[^>]*>(.*?)</script>', s, re.S)):
    open('/tmp/blk%d.js' % i, 'w').write(b)
    r = subprocess.run(['node', '--check', '/tmp/blk%d.js' % i], capture_output=True, text=True)
    print(i, r.returncode, r.stderr[:400])
EOF
```

Every block must report `0`.

**Re-render and confirm the change actually reached the output.** Grep for something you introduced.

```bash
node plugins/birdseye/scripts/render.mjs .
grep -c "CHILD_ROWY" birdseye/index.html
```

**Look at a real generated map, not a mockup.**
Open the regenerated `birdseye/index.html` in the already-running Brave browser.
Never build a standalone preview or a mockup page to check a viewer change; the real artifact is the only honest check, and preview files rot immediately.

Check both themes and all three responsive tiers listed in `plugins/birdseye/DESIGN_VIEWER.md`.

## 5. Site Commands

Run from `site/`.

```bash
cd site
npm run dev      # local dev server, only when explicitly asked for
npm run build    # verification for any meaningful site change
npm run start    # serve a production build locally
```

Do not start or browse the local site unless asked.
For UI inspection use the user's already-running Brave browser.

## 6. Release

Full detail lives in `docs/DEPLOYMENT.md`. The short form:

```bash
# marketing site (birdseye.tamal.me)
cd site && npm run build
vercel deploy --prod --yes

# plugin marketplace
# push a SIGNED commit to GitHub main from the repository root
```

A GitHub push does not deploy the site. The Vercel command is the verified route.

## 7. Commit Safety

Never produce an unverified commit. Check that signing is actually active before committing:

```bash
git config commit.gpgsign
git config user.signingkey
git config gpg.format
git config user.email
```

All must resolve, and the signing key must belong to the account that `user.email` identifies.
This machine runs multiple identities, so do not assume which key belongs to which repository.
If signing is not configured, stop and ask rather than committing unsigned.

## 8. What Never Gets Committed

Generated or managed paths:

- `birdseye/` at the repository root
- `site/.next/`, `site/node_modules/`, `site/next-env.d.ts`, `site/tsconfig.tsbuildinfo`
- any `CHANGELOG.md` or file marked auto-generated

The root `.gitignore` ignores `/birdseye/` only, and deliberately does not ignore `plugins/birdseye/`.
