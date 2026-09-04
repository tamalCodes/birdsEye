<p align="center">
  <img src="../../assets/logo.svg" alt="birdsEye" width="112">
</p>

<h1 align="center">birdsEye</h1>

<p align="center"><em>Find out where your agent will get lost.</em></p>

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
| `structure.mjs` + `extract-structure` | a script finds the code root and guesses feature vs shared folders; a skill confirms the unsure ones and asks you when it cannot | seconds, small model call, once |
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

The Overview is a filesystem-shaped flowchart: a box for the code root, every
feature module hanging off it as its own box of screens and folder pills, and
one "General-purpose" box holding the shared infrastructure modules (components,
hooks, redux, styles, ...). Click a feature to open it in place; double-click to
drop into its files. A repo mapped before the taxonomy pass existed, or one
where the pass could not find a code root, falls back to the flat module cloud.

One view ships: a left-to-right flowchart of the repo's structure, built from
the taxonomy pass.

```
src ─┬─→ askEdi ──→ its screens  +  components· / hooks· / utils· folder chips
     ├─→ transform ─→ ...
     └─→ General-purpose ─→ components / hooks / redux / styles / ...
```

`src` (or whatever the code root is) on the left, every feature module one hop
in, its screens and folders one hop further, and a General-purpose branch for
the shared infrastructure. Elbow connectors, laid out by the same tidy-tree
engine the routes view always used - it just gets fed the containment hierarchy
now instead of only the navigation tree. Orientation (left-to-right / top-down)
and a "show jumps" toggle for the real screen-to-screen navigations are in the
layout menu.

Click a feature to open its full page - every file grouped by folder, its
screens, its docs and guardrails, and what depends on it. Double-click to drop
into **Focus**, a file explorer over the import graph.

A repo mapped before the taxonomy pass (no code root in its graph) falls back to
the plain navigation tree this view used to be.

## Configuration

The folder taxonomy - the code root, and which folders are features versus
shared infrastructure - lives in `birdseye/.cache/structure.json`, written by
the `extract-structure` skill on the first run. Re-run with `--force`, or just
add a new top-level folder, to have it reconsidered.

`birdseye.config.json` is generated from directory shape and is meant to be
edited. It is the fallback the taxonomy uses when `structure.json` is absent;
`moduleRoots` is the one field worth checking there.

```jsonc
{
  "name": "my-app",
  "moduleRoots": ["src/features/*", "src/components", "src/services"],
  "ignore": ["node_modules", ".git", "dist", "build", "android", "ios"],
  "extensions": [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],  // optional - detected per language when omitted
  "docGlobs": ["**/MAP.md", "**/AGENTS.md", "**/specs/*.md", "**/README.md"],
  "editor": "vscode"      // vscode | cursor | idea | none
}
```

`editor` controls the scheme behind every path in the side panel, so clicking a
file opens it where you actually work. `.gitignore` and an optional
`.birdseyeignore` are both respected.

## Languages

Import graphs are built for JavaScript/TypeScript, Go, Python, Rust and C#/.NET.
The active set is detected automatically from the files present - no config. A
repo in any other language still gets module nodes and a doc map, just no
dependency edges.

Go and Python edges are file-exact. Rust `mod` edges are file-exact; Rust `use`
and C# `using` edges are **namespace-granular** - the target is a real file, but
resolved through the namespace it declares rather than the exact symbol, so they
are marked approximate.

## Limitations

- Monorepos are treated as a single root.
- A navigation edge is emitted only when its target is a string literal.
  Coverage is high in practice, but a computed target is skipped rather than
  guessed - a missing edge is cheap, a wrong one destroys trust in the map.

## Third-party

Cytoscape.js and fcose are vendored under `scripts/vendor/` and inlined into the
output. All MIT; see [`scripts/vendor/LICENSES.txt`](scripts/vendor/LICENSES.txt).
