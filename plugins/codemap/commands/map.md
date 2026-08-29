---
description: Build or refresh the interactive code map for this repo
argument-hint: "[--force] [--only=imports|routes|docs]"
allowed-tools: Bash, Read, Glob, Grep, Write, Skill
---

# Build the code map

Produce a single self-contained HTML map of this repo: its modules and how they
depend on each other, its routes and screens, and the spec files an agent should
read before touching any of it.

Arguments: `$ARGUMENTS`

- `--force` - ignore every cache and rebuild from scratch
- `--only=imports|routes|docs` - run one stage, for debugging

`${CLAUDE_PLUGIN_ROOT}/scripts` holds the scripts. Refer to it through that
variable, never a relative path - the plugin is copied to a cache directory on
install and relative paths out of it will not resolve.

## 1. Setup, only on the first run

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/init.mjs" status
```

If `configExists` is false: show the user the `inferred` block - specifically
`moduleRoots`, since that is the one they will want to correct - and ask whether
to write it. Only on a yes:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/init.mjs" write
```

If `isGitRepo` is true and `outputIgnored` is false, ask whether to add the
output directory to `.gitignore`. Only on a yes:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/init.mjs" gitignore
```

Ask both questions in one message. Never write either file without an answer.

## 2. Work out what actually needs to run

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/stages.mjs" plan
```

Add `--force` if the user passed it. The result marks each stage `run` or
`skip`. **Honour `skip`.** A skipped stage keeps its existing cache file, which
is already correct, and skipping is the entire reason a refresh is cheap. If
`--only=` was passed, run only that stage regardless.

## 3. Imports - always, and cheap

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/imports.mjs"
```

Pass `--force` through if given. This re-parses only changed files. It involves
no model calls at all; do not try to help it.

## 4. Routes and docs - the two stages that cost something

If the plan says `run` for routes, invoke the `extract-routes` skill. If it says
`run` for docs, invoke the `extract-docs` skill. After each one completes,
record what it saw so the next run can skip it:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/stages.mjs" record routes
node "${CLAUDE_PLUGIN_ROOT}/scripts/stages.mjs" record docs
```

Record only for the stages that actually ran.

## 5. Merge and render

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/merge.mjs"
node "${CLAUDE_PLUGIN_ROOT}/scripts/render.mjs"
```

`merge.mjs` tolerates missing `routes.json` or `docs.json` - a repo with neither
still produces a valid map with those views switched off.

## 6. Report

Print the absolute path of the generated HTML, then one short paragraph:

- module count, route count, doc count, and how many modules have at least one
  doc attached
- how many docs still name a file git has removed, as a single number with a
  pointer to the side panel. Use `merge.mjs`'s own `doc refs:` line for this and
  quote nothing else from it - the paths that were never in the repo are not
  rot, and reporting them as such is how the number stops being trusted
- which stages were skipped and why, so the user can see the cache working

Do not summarise the architecture. The map is the deliverable; the point is that
the user opens it rather than reads a description of it.

## Rules

- Write nothing into the user's source tree except `codemap.config.json` and the
  `codemap/` directory, and only ever after asking about the former.
- If a stage fails, say so plainly and continue with the rest. A map missing its
  routes is still worth having; a run that aborts halfway is not.
- Never fabricate a node or an edge to fill a gap in the output.
