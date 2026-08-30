<p align="center">
  <img src="../../assets/logo.svg" alt="birdsEye" width="112">
</p>

<h1 align="center">birdsEye</h1>

<p align="center"><em>See a whole codebase at one glance.</em></p>

> [!WARNING]
> **Very early stage - work in progress.**
> Expect rough edges and breaking changes.
> Only one of the four planned views is wired up so far (see [The view](#the-view)).

One command, one HTML file: an agent-readiness audit of the repo - which docs
cover each module, which guardrails have gone stale, and which specs an agent
should read before touching the code - over a map of the modules, dependencies,
routes and screens that audit is checked against.

> The name lives in exactly one place -
> [`scripts/lib/const.mjs`](scripts/lib/const.mjs) - so renaming it renames the
> config file, the output directory and every user-facing string at once.

The use case that shaped every decision here:

> *Before this agent edits the auth module - does it know what auth is wired to,
> which guardrails apply, and which spec to read first?*

Open the map, click `auth`, get the answer in five seconds.

## Use

```
/birdseye:map
```

First run asks two questions - whether to write `birdseye.config.json`, and
whether to add `birdseye/` to `.gitignore` - then takes a minute or two.
Subsequent runs take a couple of seconds and cost nothing, because the two
stages that involve the model are skipped when nothing they read has changed.

```
/birdseye:map --force                 rebuild everything from scratch
/birdseye:map --only=imports          run one stage, for debugging
```

The output is `birdseye/index.html`. It is self-contained: no CDN, no server, no
network at all. It opens from `file://` on a plane.

## What it writes

```
<repo>/
├── birdseye.config.json     committed, human-editable, generated on first run
└── birdseye/                gitignored
    ├── index.html          the deliverable
    ├── graph.json          the canonical graph
    └── .cache/             manifest + per-stage output
```

Nothing else in your source tree is ever touched, and no documentation is ever
written into it.

## How it works

| Stage | Who does it | Cost |
|---|---|---|
| `imports.mjs` | plain Node - tsconfig aliases, barrels, comment-stripped parsing | milliseconds, no model |
| `extract-routes` | a skill - reads the router and describes it | ~25 files, once |
| `extract-docs` | a skill - attaches docs to the code they describe, glosses their guardrails in plain English | once |
| `extract-flowcharts` | a skill - turns each module's docs into a step-by-step flow | once, after docs |
| `merge.mjs` | plain Node - one canonical `graph.json` | milliseconds |
| `render.mjs` | plain Node - inlines vendored Cytoscape | milliseconds |

The split is deliberate. Anything mechanical is deterministic code with no model
involvement, so it is exact and free. The model is used only where judgement is
genuinely required, which is also the only place a framework-specific adapter
would otherwise have to live. There is no `if (framework === ...)` anywhere in
the scripts, and there should never be.

Same input produces byte-identical `graph.json` and `index.html`, so the output
diffs cleanly and bugs reproduce.

The same rule decides who gets to call a document out of date. The extractor
hands over the paths it could not place; `merge.mjs` re-checks every one against
the working tree and against `git log`, and only a path git actually removed is
reported as stale - with the commit that removed it. A path that resolves after
all becomes an edge instead of a warning, and one that was never in this repo is
listed as exactly that. A warning nobody can verify is worse than no warning.

## The view

One view ships: the navigation tree, laid out hierarchically and boxed by
feature. Click a section and, if its docs describe an end-to-end flow, the page
opens straight to a generated flowchart - already built during extraction, not
something you wait on or generate yourself.

A repo with no router gets a line saying so, rather than an empty canvas.

Overview, Focus and Docs are built and working behind `setView()` but are not
reachable from the chrome. The toolbar carries what one glance needs and
nothing else: the repo and its counts on the left, the layout menu and the
theme toggle on the right, on a pane of glass the map runs underneath.

## Configuration

`birdseye.config.json` is generated from directory shape and is meant to be
edited. `moduleRoots` is the one worth checking.

```jsonc
{
  "name": "my-app",
  "moduleRoots": ["src/features/*", "src/components", "src/services"],
  "ignore": ["node_modules", ".git", "dist", "build", "android", "ios"],
  "extensions": [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
  "docGlobs": ["**/MAP.md", "**/AGENTS.md", "**/specs/*.md", "**/README.md"],
  "editor": "vscode"      // vscode | cursor | idea | none
}
```

`editor` controls the scheme behind every path in the side panel, so clicking a
file opens it where you actually work. `.gitignore` and an optional
`.birdseyeignore` are both respected.

## Limitations

- Import parsing is JavaScript and TypeScript only. A repo in another language
  still gets module nodes and a doc map, but no dependency edges.
- Monorepos are treated as a single root.
- A navigation edge is emitted only when its target is a string literal.
  Coverage is high in practice, but a computed target is skipped rather than
  guessed - a missing edge is cheap, a wrong one destroys trust in the map.

## Third-party

Cytoscape.js and fcose are vendored under `scripts/vendor/` and inlined into the
output. All MIT; see [`scripts/vendor/LICENSES.txt`](scripts/vendor/LICENSES.txt).
