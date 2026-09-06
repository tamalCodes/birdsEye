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
4. `build.mjs` converts the flat graph into containment and dependency graph data, and works out which files nothing reaches.
5. `render.mjs` writes the self-contained HTML viewer.

## Extraction

Extraction is birdsEye's own, and splits along one line: parsing knows nothing about repositories, resolution knows everything about them.

- `plugins/birdseye/scripts/lib/py/extract.py` parses with tree-sitter and reports what each file declares and imports exactly as written, plus symbol and line counts. It walks node types by hand rather than using tree-sitter's `Query` API, whose call shape changes between versions.
- `plugins/birdseye/scripts/lib/languages/*.mjs` resolve a specifier to a real file using what only a repo can say: tsconfig path aliases, `go.mod` module paths, Python source roots, declared namespaces.
- `plugins/birdseye/scripts/lib/extractor.mjs` manages the virtualenv and pins tree-sitter plus every grammar exactly.

birdsEye used to shell out to a third-party parser and no longer does.
Do not reintroduce that dependency and do not vendor its source: it is Apache-2.0, so copying it would oblige this repository to carry a `NOTICE` naming that project permanently, which is the opposite of the goal.
tree-sitter itself is MIT parsing infrastructure with no product tie, so depending on it is fine.

Three behaviours worth protecting:

- **Barrel hop-through.** A named import of something an `index.js` merely re-exports is credited to the file that owns the name, so a barrel does not become a false hub and reachability does not call everything it forwards alive. Only named re-exports are followed; `export * from` cannot say which file owns which name.
- **One extension list.** `plugins/birdseye/scripts/lib/extensions.mjs` is the single source, used by both the extractor and the folder taxonomy. When those drifted apart the map did not fail, it lied: a repo whose code is Dart or SQL got a correct dependency graph hung off a folder tree that thought the repo held no code.
- **Core versus optional grammars.** A missing core grammar rejects the interpreter, because silently producing no edges for a mainstream language looks like a real map. A missing optional grammar costs that one language and is reported by name with the command that fixes it.

Deliberately not parsed, so it does not get re-litigated: Apex and R have no tree-sitter grammar available; `.sln`, Razor, Blade and XAML would each need a hand-written parser, which is the class of code this extractor exists to avoid.

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

## Unused Code

`plugins/birdseye/scripts/lib/dead.mjs` answers "what does nothing reach", and it runs in the **build** stage rather than the AST stage, because the question needs entry points and those come from `structure.mjs scan`.

It is a reachability question, not a fan-in count.
A file with one importer looks alive to a fan-in count even when that importer is itself unreachable, so a whole abandoned corner of a repo can hide behind a single internal edge.

Two modes, and the printed line always names the one that ran:

- **`reachability`** - real entry points were found, so the walk starts there and anything never arrived at is reported. This is the mode worth having.
- **`unreferenced`** - no entry point was found, so the claim weakens to "nothing imports it". Honest, but a weaker statement, and the output says so.

**Exemptions are as important as the finding.**
Files entered by a runner or a bundler rather than by an import would otherwise be reported every single time, and a section that is always wrong teaches the reader to ignore the whole thing.
`EXEMPT_PATTERNS` covers tests and fixtures, stories, ambient `.d.ts`, build and tooling config, Python and Go package plumbing, and - added when the extractor learned those languages - tsconfig/jsconfig, shell, Gradle, Terraform, PowerShell, MSBuild project files and SQL migrations.
**Anything added to the parsed set has to be exempted here too, or it is reported as dead code.** A tsconfig was, briefly.

**The verdict always ships with its doubt.**
An import graph cannot see a dynamic import, a route table built from strings, or a worker loaded by URL.
So the finding is "nothing here reaches it" - a lead, never a sentence - and every surface that shows it also shows why it might be wrong.
That is why the viewer offers a **Copy delete command** rather than a delete button: see `plugins/birdseye/DESIGN_VIEWER.md` for how the state is drawn.

## Folder Taxonomy

`plugins/birdseye/scripts/lib/taxonomy.mjs` decides the code root and which folders are features.
Two rules there exist because their absence produced quietly wrong maps:

- A conventional code-root name (`src/`, `lib/`) must hold at least 40% of the repo's non-test code to win. Trusting the name alone dropped everything outside it from the map.
- A folder that *is* a screens directory (`pages`, `screens`, `views`, `scenes`, `flows`, `features`) scores as a feature, the same as one that contains a page directory. The size-based tiebreak only speaks when nothing named or structural already has. `modules/` is excluded because it means reusable infrastructure at least as often as product features, and `routes/` because a shared rule already claims it as routing.

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

## Deferred Ideas

There is no active spec file. `plugins/birdseye/TASK_MODULE_DETAIL_VIEW.md` was deleted on 2026-09-06 because the zero-token pivot had made almost all of it false: it was written against `screen`, `route` and `doc` nodes, `imports`/`navigates`/`renders`/`documents` edges, and five template helpers (`openPanel`, `select`, `nodeLink`, `listSection`, `related`), none of which still exist. Its interaction contract shipped anyway, under different names, and now lives in the Viewer Readability section below.

Two ideas from it survive and are worth building, but neither is buildable today. Both need node types only the dormant LLM stages produce, so both are blocked on a `--with-llm` mode:

- **Screens a module owns, in flow order.** Which screens belong to a module, including step-orchestrated flows where the steps are statically written down, so a reader sees the journey rather than a file list. Needs `screen` nodes from `extract-routes`.
- **Docs that document a module, with their guardrails and stale references.** Which specs cover a module, the rules they state, and how many paths they name that git has since deleted - a doc that points at removed files is the clearest possible signal that it is out of date. Needs `doc` nodes from `extract-docs`, carrying `guardrails[]` and a `refs` verdict split into deleted, unknown and external.

Do not start either by turning the dormant skills back on unilaterally; that is a product decision about whether `/birdseye:map` stays token-free.

## Verification Notes

For site changes:

```bash
cd site
npm run build
```

For plugin template or graph pipeline changes, use targeted Node stages where possible.
`merge.mjs`, `stages.mjs` and `lib/refs.mjs` are dormant and are not part of the active path; do not verify against them.

For a real-data check, run the active stages against any application repository you have locally, and read the counts off the tool's own output:

```bash
node plugins/birdseye/scripts/ast.mjs   /path/to/repo --force
node plugins/birdseye/scripts/build.mjs /path/to/repo
node plugins/birdseye/scripts/render.mjs /path/to/repo
```

A pipeline change should be checked against more than one shape of repository, because most of the bugs found so far were invisible in a single-language one.
When no repository on the machine has the shape you need, build a throwaway fixture with a deliberate trap in it; `docs/RUNBOOK.md` section 3a has the recipe and the pass condition.

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
