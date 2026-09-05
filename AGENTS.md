# Repository Agent Rules

Follow system and developer instructions first.
Then follow this file.
When working inside a nested directory, also read any closer `AGENTS.md` file before editing there.

## Start Here

Read `docs/AGENT_MEMORY.md` at the start of any non-trivial task in this repository.
Use it as project memory, not as a replacement for inspecting current files.
If memory conflicts with code, trust code and update the memory doc only when the user asks or when the change is part of the task.

Read the relevant README before editing:

- `README.md` for repository purpose and layout.
- `plugins/birdseye/README.md` for plugin behavior and command contract.
- `site/README.md` for the marketing site.

## Repository Shape

This repository is a Claude Code plugin marketplace for birdsEye.
The plugin lives in `plugins/birdseye/`.
The marketing site lives in `site/`.
The root `birdseye/` directory is generated output from running `/birdseye:map` on this repository.

## Source Of Truth

Do not edit generated output unless the user explicitly asks for generated artifacts.
Generated or managed paths include:

- `birdseye/`
- `site/.next/`
- `site/node_modules/`
- `site/next-env.d.ts`
- `site/tsconfig.tsbuildinfo`

Do not manually edit `CHANGELOG.md` or any file marked auto-generated.

## Plugin Rules

Keep `/birdseye:map` local, deterministic, and token-free unless the user explicitly asks for future LLM-backed stages.
The active command path is:

1. `plugins/birdseye/scripts/init.mjs`
2. `plugins/birdseye/scripts/structure.mjs`
3. `plugins/birdseye/scripts/ast.mjs`
4. `plugins/birdseye/scripts/build.mjs`
5. `plugins/birdseye/scripts/render.mjs`

The route, docs, and flowchart extraction skills are dormant for future opt-in work.
Do not wire them back into the default `/birdseye:map` flow without an explicit flag and matching docs update.

The viewer template is `plugins/birdseye/scripts/template/index.html`.
It is one self-contained HTML template with CSS, markup, and script.
Keep it dependency-free at runtime and compatible with `file://`.

## Site Rules

The site is a Next.js 16 App Router project in `site/`.
Before changing site code, read `site/AGENTS.md`.
Next.js 16 behavior may differ from older assumptions, so check local Next docs in `site/node_modules/next/dist/docs/` when changing framework behavior.

Do not start or browse the local site unless the user asks.
For build verification, prefer `npm run build` from `site/` when site changes are meaningful.

## Documentation And Memory

Keep project memory concise, factual, and current.
Use `docs/AGENT_MEMORY.md` for decisions, active constraints, known verification commands, and recently shipped context that future agents need.
Use focused spec files under `docs/` or `plugins/birdseye/` for larger feature plans.
Prefer updating existing docs over adding scattered notes.

When adding or changing long Markdown docs, put each full sentence on its own physical line.

## Verification

For plugin code, run the narrowest command that exercises the changed stage.
For end-to-end plugin checks, run the script sequence against a disposable or known target repo and inspect the generated `birdseye/index.html` only if requested.
For site code, run the relevant package script from `site/`.
Do not commit unless verification passes and commit signing is confirmed for the repository identity.
