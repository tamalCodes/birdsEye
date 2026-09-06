# birdsEye Agent Memory

This file is durable project memory for future agents and sub-agents.
Read it before non-trivial work, then verify against current code before editing.

## Product

birdsEye is a Claude Code plugin marketplace containing one plugin, `birdsEye`.
The plugin maps a repository into one self-contained HTML file that shows modules, folders, files, and dependency arrows.
Current positioning is agent-readiness and codebase structure: show where an agent may lack context before editing.

## Repository Layout

- `plugins/birdseye/` is the plugin source.
- `plugins/birdseye/commands/map.md` is the `/birdseye:map` command contract.
- `plugins/birdseye/scripts/` holds the deterministic local pipeline.
- `plugins/birdseye/scripts/template/index.html` is the self-contained viewer template.
- `plugins/birdseye/skills/` holds dormant LLM-backed extraction skills for future opt-in stages.
- `site/` is the Next.js marketing site for `birdseye.tamal.me`.
- `birdseye/` at repository root is generated output from running the plugin on this repo.

## Current Architecture

The default `/birdseye:map` flow is zero-token and local.
It does not call a model.
It parses with tree-sitter through its own extractor, then builds and renders a static viewer.

Active stages:

1. `init.mjs` checks config, output ignore status, and Python readiness.
2. `structure.mjs scan` detects code root and first-pass module taxonomy.
3. `ast.mjs` parses source files and produces AST dependency data.
4. `build.mjs` converts the flat graph into containment and dependency graph data.
5. `render.mjs` writes the self-contained HTML viewer.

Dormant stages:

- `extract-routes`
- `extract-docs`
- `extract-flowcharts`
- `extract-structure`

These dormant skills are preserved for a future `--with-llm` style mode.
Do not make them part of the default command unless the user explicitly asks for that product change.

## Product Constraints

The plugin should stay lightweight, deterministic, and offline at output-open time.
The generated viewer must work from `file://` with no server and no network.
Runtime dependencies should not be added to the viewer template.
Same input should produce stable `graph.json` and `index.html` output.
Do not fabricate graph nodes or dependency edges to fill gaps.
First-run setup must ask one yes/no question at a time.
Ask about writing `birdseye.config.json` first, handle that answer, then separately ask about adding `birdseye/` to `.gitignore` if still needed.

## Generated Files

Do not treat generated files as source:

- `birdseye/`
- `site/.next/`
- `site/node_modules/`
- `site/next-env.d.ts`
- `site/tsconfig.tsbuildinfo`

The root `.gitignore` intentionally ignores only `/birdseye/` and does not ignore `plugins/birdseye/`.

## Site Context

The marketing site uses Next.js 16, React 19, Tailwind v4, `motion`, and `lenis`.
It lives under `site/` and has its own generated `site/AGENTS.md` warning.
The copy should lead with the audit and agent-readiness story first, then explain the structural map as evidence.
Theme tokens live in `site/app/globals.css`.
Main page copy lives in arrays and sections inside `site/app/page.tsx`.
Deployment rules and Vercel verification live in `docs/DEPLOYMENT.md`.
Release the site explicitly from `site/`; release the plugin marketplace by pushing signed source to `main`.

## Commands

`docs/RUNBOOK.md` records every command for this repository: the five pipeline stages and what each reads and writes, the cheap template-only re-render, mapping a fresh repository, the inline-script syntax check, site scripts, release, and the commit-signing check.
Treat it as the command reference and keep it current instead of re-deriving commands from the scripts.

A viewer template edit does not change any map that already exists.
The template is inlined at render time, so each generated `birdseye/index.html` must be re-rendered with `node plugins/birdseye/scripts/render.mjs <repoRoot>` before the change is visible.
That stage reads only `graph.json`, so no re-scan or re-parse is needed.

## Design Specs

Visual work is governed by two spec files that are source of truth, not notes.

- `docs/DESIGN_SYSTEM.md` holds the shared design system: warm charcoal and cream palettes for both surfaces, node hue meanings, type scale, radii, elevation, motion, the theming contract, the accessibility floor, and the density rules that keep views from reading as empty.
- `plugins/birdseye/DESIGN_VIEWER.md` holds the viewer surface spec: anatomy, canvas geometry constants, the neighbourhood and INSIDE grid layout contract, detail panel rules, responsive tiers, and the list of approaches already tried and rejected.

Keep them current.
A visual change that breaks a stated rule must update the rule in the same change.

## Known Active Spec

`plugins/birdseye/TASK_MODULE_DETAIL_VIEW.md` describes a module detail view for the generated viewer.
The goal is a centralized, plain-language module story: grouped files, owned screens, docs and guardrails, stale references, fan-in, fan-out, and risky files.
The natural hook point is the module case in `openPanel(id)` inside `plugins/birdseye/scripts/template/index.html`.

## Verification Notes

For site changes:

```bash
cd site
npm run build
```

For plugin template or graph pipeline changes, use targeted Node stages where possible.
The command doc says real-data rebuild can be tested against `/Users/tamalcodes/Gh/perccent-app` with:

```bash
node plugins/birdseye/scripts/merge.mjs /Users/tamalcodes/Gh/perccent-app
node plugins/birdseye/scripts/render.mjs /Users/tamalcodes/Gh/perccent-app
```

That note may be stale because the current active pipeline uses `ast.mjs` and `build.mjs`.
Confirm script entry points before relying on older task specs.

For requested local UI checks, use Tamal's already-running Brave browser.
Do not use Codex's internal browser for this repository.

## Viewer Readability

- Keep per-edge import totals out of the canvas. Exact counts belong in the on-demand Details panel, where they do not overlap import lines.
- Keep Details collapsed on first load behind the small top-right control. Selecting a node updates its detail content without taking canvas space.
- Canvas node and group labels use the main UI font for legibility. The hand-lettered font is not for dense graph text.
- Frame the first map view at 1.35x full-fit zoom. This is a deliberate readability baseline, while wheel zoom and re-centre remain available.
- Keep import-flow SVG paths in model coordinates. Pan and zoom move their group transform, while drag updates only affected path geometry.
- Never open Details as a side effect of selection changes, including when a module is chosen from the tree or canvas. The reader opens it deliberately from its control.
- Clicking a dependency while focused on a module opens a relationship story in Details without changing the selected module or canvas. Show the exact file links, then offer an explicit button to view that dependency's own details.
- Keep file links collapsed where they are supporting context, grouped by source folder, and written as short file-name import relationships.
- Relationship drawers are floating cards, not a full-height rail. Use human-readable code names without extensions, render `index` as the owning module's public API, and group only folders with three or more relationships.

## Working Memory Practices

When starting new substantial work, read this file and the closest `AGENTS.md`.
When a feature decision becomes durable, update this file or a focused spec as part of the same change.
When a task produces temporary investigation notes, either fold the durable part into this file or remove the temporary notes before finishing.
Keep memory short enough that future agents will actually read it.
