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

Read `docs/RUNBOOK.md` for every build, regeneration, verification, and release command.
It is the single place those commands are recorded, so do not rediscover them by reading scripts.

Read the design specs before changing anything visual:

- `docs/DESIGN_SYSTEM.md` for color, typography, spacing, motion, theming, and accessibility rules across both surfaces.
- `plugins/birdseye/DESIGN_VIEWER.md` for the map viewer's layout geometry, canvas contract, and rejected approaches.

Treat those two files as binding.
If a visual change makes a rule in them untrue, update the rule in the same change.

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
Its design contract is `plugins/birdseye/DESIGN_VIEWER.md`.
The template is baked into a map at render time, so editing it changes nothing in an already generated `birdseye/index.html`.
Re-run the render stage against each map you want the change to appear in; see `docs/RUNBOOK.md`.

## Site Rules

The site is a Next.js 16 App Router project in `site/`.
Before changing site code, read `site/AGENTS.md`.
Next.js 16 behavior may differ from older assumptions, so check local Next docs in `site/node_modules/next/dist/docs/` when changing framework behavior.

Do not start or browse the local site unless the user asks.
When local UI inspection is requested, use the user's already-running Brave browser.
Do not use Codex's internal browser for this repository.
For build verification, prefer `npm run build` from `site/` when site changes are meaningful.

## Documentation And Memory

Keep project memory concise, factual, and current.
Use `docs/AGENT_MEMORY.md` for decisions, active constraints, known verification commands, and recently shipped context that future agents need.
Use focused spec files under `docs/` or `plugins/birdseye/` for larger feature plans.
Prefer updating existing docs over adding scattered notes.

When adding or changing long Markdown docs, put each full sentence on its own physical line.

### Docs Move With The Code

A change is not finished until the files that describe it are true again.
This is binding for every change, not only visual ones, and it happens in the same commit as the change itself.
A doc that lies is worse than no doc, because the next agent trusts it and works from a false picture.

Before finishing any change, check each file below and update the ones the change made untrue:

| File | Covers |
| --- | --- |
| `docs/AGENT_MEMORY.md` | architecture, active constraints, decisions and their reasons, what is dormant |
| `docs/RUNBOOK.md` | every command, what each stage reads and writes, verification steps |
| `docs/DESIGN_SYSTEM.md` | palette, type, spacing, motion, theming, accessibility, density |
| `plugins/birdseye/DESIGN_VIEWER.md` | viewer anatomy, canvas geometry, layout contracts, rejected approaches |
| `plugins/birdseye/README.md` | plugin behaviour, language coverage, command contract |
| `plugins/birdseye/commands/map.md` | what `/birdseye:map` runs and reports |
| `README.md` and `site/app/page.tsx` | user-facing claims: counts, language lists, what the map does |

Two rules that catch most of the drift:

- **Never state a number a repository will change.** A language count, an edge total, a file count in a named repo. Say how to read it off the tool's own output instead. Sample output inside a fenced block is fine; a claim in prose is not.
- **Never describe a capability the code does not have.** Say what is parsed and what is not, and name what was deliberately left out so the next agent does not re-litigate a settled decision.

Do not delete durable reasoning when you supersede it.
Mark it superseded and say what replaced it, so a future agent does not repeat a rejected approach.

## Verification

For plugin code, run the narrowest command that exercises the changed stage.
For end-to-end plugin checks, run the script sequence against a disposable or known target repo and inspect the generated `birdseye/index.html` only if requested.
For site code, run the relevant package script from `site/`.
Do not commit unless verification passes and commit signing is confirmed for the repository identity.
