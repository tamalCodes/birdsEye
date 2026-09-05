---
name: birdseye-map
description: Build or refresh a birdsEye repository map from Codex. Use when the user asks to run birdsEye, map a repo, refresh birdseye/index.html, or create an interactive dependency flowchart.
---

# birdsEye Map

Build or refresh the interactive code-structure map for the current repository.
This runs entirely locally and calls no model.
Extraction is graphify's tree-sitter AST parse through the birdsEye scripts.

## Inputs

- Default run: build from cache when possible.
- If the user asks for a clean rebuild or says `--force`, pass `--force` to `ast.mjs`.

## Locate The Plugin Root

This skill lives at:

```text
<plugin-root>/skills/birdseye-map/SKILL.md
```

Use the loaded skill file path to resolve `<plugin-root>`, then run scripts from:

```text
<plugin-root>/scripts
```

Do not use paths relative to the user's repository for birdsEye internals.
The plugin may be installed into a cache directory.

## Run

1. Check setup:

```bash
node "<plugin-root>/scripts/init.mjs" status
```

If `configExists` is false, show the inferred `moduleRoots` and ask only whether to write `birdseye.config.json`.
Ask this as one focused yes/no question.
Only write it after the user says yes:

```bash
node "<plugin-root>/scripts/init.mjs" write
```

After that answer has been handled, if `isGitRepo` is true and `outputIgnored` is false, ask only whether to add `birdseye/` to `.gitignore`.
Ask this as a separate focused yes/no question.
Only write it after the user says yes:

```bash
node "<plugin-root>/scripts/init.mjs" gitignore
```

Never ask both setup questions together.

If `python.ready` is false, tell the user the first run needs Python 3.10+ and will create `birdseye/.cache/py/` plus install `graphifyy` once.
If no Python 3.10+ is found, stop and tell the user to install Python 3.10+.

2. Scan folder taxonomy:

```bash
node "<plugin-root>/scripts/structure.mjs" scan
```

3. Extract AST dependency graph:

```bash
node "<plugin-root>/scripts/ast.mjs"
```

Add `--force` if requested.
If this fails with a Python or graphify error, relay the message and stop.

4. Build and render:

```bash
node "<plugin-root>/scripts/build.mjs"
node "<plugin-root>/scripts/render.mjs"
```

## Report

Print the absolute path to `birdseye/index.html`.
Then summarize the key `build.mjs` output: module count, folder count, file count, dependency edge count, parsed languages, graphify version, and any unresolved or failed counts.
Do not invent nodes, edges, route data, docs, or model-backed analysis.
