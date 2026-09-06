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
| 3 | `node ast.mjs [root]` | source files, via the extractor | `birdseye/.cache/ast.json` |
| 4 | `node build.mjs [root]` | `ast.json`, `structure.scan.json` | `birdseye/graph.json` (schema 6) |
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

A target can be re-rendered directly only if it already has a valid
`birdseye/graph.json`. This repository does.
Check before assuming, because a repo gets cleaned out from time to time:

```bash
ls /path/to/target-repo/birdseye/graph.json
```

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
node .../ast.mjs . --force           # ignore the per-file parse cache
node .../ast.mjs . --json            # print the AST result instead of a summary
```

`ast.mjs` needs Python with tree-sitter available; `init.mjs status` is what tells you whether it is.
The extractor keeps a content-hash cache at `birdseye/.cache/extract.cache.json`, so a second run only re-parses changed files.

### Unused code

`build.mjs` also works out which files nothing reaches, and prints a line about it:

```
unused: 33 files nothing reaches (reachability, from 2 entry points, 0 conventionally-loaded files excluded)
```

The analysis lives in `scripts/lib/dead.mjs`. It runs in the build stage, not the AST stage, because the question needs the entry points and those come from `structure.mjs scan`.

Two modes, and the printed line always says which one ran:

- **`reachability`** - real entry points were found, so the walk starts there and anything never arrived at is reported. This is the mode you want: it catches an abandoned island of files that import each other, which a fan-in count would call alive.
- **`unreferenced`** - no entry point could be found (a library, a folder of scripts). Reachability would condemn the whole repo, so it falls back to the weaker claim that nothing imports the file at all.

Tests, stories, `*.d.ts`, build config, and framework file-routes are never reported: they are entered from outside the import graph, so calling them unreachable would be wrong every time.
Framework routes are only exempted when that framework is actually a dependency, and both the repo-root and the code-root `package.json` are read - a `site/` workspace with its own Next install is the common case.

Tune it per repo in `birdseye.config.json`:

```json
{
  "deadCode": {
    "enabled": true,
    "entryPoints": ["src/worker-entry.ts"],
    "exclude": ["src/generated/**", "**/*.gen.ts"]
  }
}
```

**If it reports something obviously alive, that is a resolution bug, not a config problem.** Check the file's importer resolves: `node .../ast.mjs . --json` reports `unresolved`, and a high count there means dead-code output is untrustworthy for that repo.

## 3a. Simulate A Repository To Test Against

Most pipeline bugs are invisible in a single-language repository.
The ones found so far all needed a shape that no repo on this machine had: a Vue script block, a barrel that re-exports a default, a Dart `package:` import, a SQL migration chain, a `.csproj` project reference.
So build a throwaway repo, point the pipeline at it, and read the counts.

Put it in a scratch directory, never inside a real repository.
A fixture is a handful of tiny files, each written to exercise exactly one rule:

```bash
R=/tmp/fixture; rm -rf $R; mkdir -p $R/src/hooks
printf 'export { useThing } from "./useThing";\n'          > $R/src/hooks/index.js
printf 'export function useThing() {}\n'                    > $R/src/hooks/useThing.js
printf 'import { useThing } from "./hooks";\nuseThing();\n' > $R/src/index.js

S=~/Gh/birdsEye/plugins/birdseye/scripts
node $S/structure.mjs scan $R
node $S/ast.mjs $R --force
node $S/build.mjs $R
```

That one is the barrel test: the edge must land on `useThing.js`, not on `hooks/index.js`.

**Always include a trap.** A fixture that only contains valid code cannot catch the failure that matters, which is an edge invented from something that merely looks like an import:

- a `<template>` or JSX block containing the literal text `import Thing from "./NotReal"`
- a commented-out import
- a string that contains an import statement
- a table alias in SQL (`FROM users u`) that must not resolve as a table

**Read the counts, not the picture.** `0 unresolved` and the exact expected edge list is the pass condition; open the map only when the change was visual.

Beware one macOS trap that cost real time: the filesystem is case-insensitive, so `mkdir Modules` inside a fixture that already has `modules/` silently writes into the existing directory and the resulting "bug" is in the fixture, not the code.

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

For a change touching unused code, check it against a repo that has some and one that has none.
This repository has none, and must show no header pill, no legend key, and no
NEEDS A LOOK frame. For the other side, use any application repo and read the
count off `build.mjs`'s own output rather than trusting a number written here -
the count moves whenever the extractor learns a new language.

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
vercel deploy --prod --yes --scope tamal-das-projects-4bdfe0d9

# verify the alias actually serves the new build
curl -s -o /dev/null -w "%{http_code}\n" https://birdseye.tamal.me

# plugin marketplace
# push a SIGNED commit to GitHub main from the repository root
```

A GitHub push does not deploy the site. The Vercel command is the verified route.

`--scope` is not optional.
Without it the deploy fails with `"message": "Not authorized"` even when `vercel whoami` succeeds and the project is linked, because the project belongs to the team `tamal-das-projects-4bdfe0d9` rather than the personal scope.
Run `vercel teams ls` if the scope id ever changes, and `vercel ls birdseye --scope <id>` to see recent deployments and their status.

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
