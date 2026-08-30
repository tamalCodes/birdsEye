# codemap

> `codemap` is a working name. It lives in exactly one place -
> [`scripts/lib/const.mjs`](scripts/lib/const.mjs) - so renaming it renames the
> config file, the output directory and every user-facing string at once.

One command, one HTML file: the modules of a codebase and how they depend on
each other, its routes and screens, and the spec files an agent should read
before touching any of it.

The use case that shaped every decision here:

> *I need to fix a bug in the auth module. What is auth connected to, and which
> spec files should I read first?*

Open the map, click `auth`, get the answer in five seconds.

## Use

```
/codemap:map
```

First run asks two questions - whether to write `codemap.config.json`, and
whether to add `codemap/` to `.gitignore` - then takes a minute or two.
Subsequent runs take a couple of seconds and cost nothing, because the two
stages that involve the model are skipped when nothing they read has changed.

```
/codemap:map --force                 rebuild everything from scratch
/codemap:map --only=imports          run one stage, for debugging
```

The output is `codemap/index.html`. It is self-contained: no CDN, no server, no
network at all. It opens from `file://` on a plane.

## What it writes

```
<repo>/
├── codemap.config.json     committed, human-editable, generated on first run
└── codemap/                gitignored
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
| `extract-docs` | a skill - attaches docs to the code they describe | once |
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

## The four views

- **Overview** - modules only, sized by file count, edges weighted by how many
  underlying imports they represent. This is the landing view on purpose: a
  450-file repo drawn all at once is an unreadable hairball, and that is the
  single most common failure of code visualisers.
- **Focus** - click a module and it expands into its files (or, past ~25 files,
  its folders), with everything else dimmed rather than hidden so you keep your
  bearings. This is the view that answers the bug-fixing question.
- **Routes** - the navigation tree, laid out hierarchically.
- **Docs** - doc nodes over the module map, with the `documents` edges drawn.
  Click a feature section and, if its docs describe an end-to-end flow, the
  page opens straight to a generated flowchart - already built during
  extraction, not something you wait on or generate yourself.

A repo with no router or no docs gets those tabs disabled with a line saying
why, rather than an empty canvas.

## Configuration

`codemap.config.json` is generated from directory shape and is meant to be
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
`.codemapignore` are both respected.

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
