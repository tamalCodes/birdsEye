---
description: Build or refresh the interactive code-structure map for this repo
argument-hint: "[--force]"
allowed-tools: Bash, Read, Glob, Grep, Write
---

# Build the code map

Produce a single self-contained HTML map of this repo: an expandable flowchart
of its modules, the folders and files inside them, and the dependency arrows
between them.

**This runs entirely locally and calls no model. Zero tokens.** Extraction is
graphify's tree-sitter AST parse (a Python package birdsEye installs into its
own managed virtualenv on the first run); everything else is plain Node.

Arguments: `$ARGUMENTS`

- `--force` - ignore every cache and re-parse from scratch

`${CLAUDE_PLUGIN_ROOT}/scripts` holds the scripts. Refer to it through that
variable, never a relative path - the plugin is copied to a cache directory on
install and relative paths out of it will not resolve.

## 1. Setup, only on the first run

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/init.mjs" status
```

If `configExists` is false: show the user the `inferred` block - specifically
`moduleRoots` - and ask whether to write it. Only on a yes:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/init.mjs" write
```

If `isGitRepo` is true and `outputIgnored` is false, ask whether to add the
output directory to `.gitignore`. Only on a yes:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/init.mjs" gitignore
```

Ask both questions in one message. Never write either file without an answer.

The `status` output also carries a `python` block. If `python.ready` is false,
tell the user what the first run will do before you start it: birdsEye needs
Python 3.10+ and will create a virtualenv under `birdseye/.cache/py/` and
`pip install graphifyy` into it (a one-time download of tree-sitter grammars,
tens of seconds). If `python.found` is false entirely, stop and tell the user to
install Python 3.10+ (and ideally [`uv`](https://docs.astral.sh/uv/)); there is
nothing to run without it.

## 2. The folder taxonomy

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/structure.mjs" scan
```

This never fails. It works out the code root (`src/`, `app/`, a Python package
dir, a monorepo `packages/*`, or the repo root itself) and a first-pass guess at
which top-level folders are product features and which are shared infrastructure,
and writes `birdseye/.cache/structure.scan.json`. `build.mjs` reads that guess
directly - there is no model pass refining it, so a folder birdsEye calls wrong
is corrected by hand in `birdseye/.cache/structure.json` (same shape, it wins
when present) or by adjusting `moduleRoots` in the config.

## 3. Extraction

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ast.mjs"
```

Pass `--force` through if the user gave it. On the first run this also sets up
the Python virtualenv described in step 1 - if it prints a message about
installing graphify, that is expected and happens once. graphify keeps its own
per-file content-hash cache, so a re-run only re-parses what changed.

If this step fails with a Python or graphify error, relay the message verbatim
and stop - the rest of the pipeline has nothing to work with.

## 4. Build and render

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/build.mjs"
node "${CLAUDE_PLUGIN_ROOT}/scripts/render.mjs"
```

`build.mjs` turns the flat AST graph into the containment tree (root → modules →
folders → files) plus file-level dependency edges. `render.mjs` inlines the
vendored Cytoscape and writes `birdseye/index.html`.

## 5. Report

Print the absolute path of the generated HTML, then one short paragraph from
`build.mjs`'s own output:

- module count split into feature and general-purpose, folder count, file count,
  dependency-edge count
- which languages got parsed (`languages:` line) and the graphify version
- if any modules are marked "unsure", say so in one clause: birdsEye could not
  tell feature from infrastructure for them and defaulted to feature; the user
  can fix that in `structure.json`
- if `unresolved` refs or `failed` files are non-zero, mention the count plainly
  - an import graphify could not resolve to a file, or a file its grammar could
  not parse

Do not summarise the architecture. The map is the deliverable; the point is that
the user opens it rather than reads a description of it.

## Rules

- Write nothing into the user's source tree except `birdseye.config.json` and the
  `birdseye/` directory, and only ever after asking about the former.
- If a stage fails, say so plainly. A partial map is still worth having; a run
  that aborts halfway is not.
- Never fabricate a node or an edge to fill a gap in the output.

<!--
  The routes / docs / flowcharts stages and their skills (extract-routes,
  extract-docs, extract-flowcharts, extract-structure) are intentionally not
  invoked here: birdsEye is currently a zero-token structure map. Their code and
  skill files are kept in the tree for a later opt-in `--with-llm` mode. Do not
  wire them back into this command without that flag.
-->
