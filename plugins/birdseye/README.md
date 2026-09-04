<p align="center">
  <img src="../../assets/logo.svg" alt="birdsEye" width="112">
</p>

<h1 align="center">birdsEye</h1>

<p align="center"><em>See the shape of a codebase in five seconds.</em></p>

> [!WARNING]
> **Very early stage - work in progress.** Expect rough edges and breaking changes.

One command, one HTML file: an **interactive flowchart of a repo's structure**.
A collapsible tree of the whole repo runs down the left. Pick anything - a
module, a folder, a file - and the canvas draws a focused flowchart of it: its
contents fanning out below, the things it depends on to the right, the things
that use it to the left. One node and its neighbours at a time, so it stays
readable no matter how big the repo is.

`/birdseye:map` runs **entirely on your machine and calls no model. Zero tokens.**

## Use

```
/birdseye:map
```

First run asks two questions - whether to write `birdseye.config.json`, and
whether to add `birdseye/` to `.gitignore` - then sets up a Python virtualenv for
the parser (a one-time `pip install`, tens of seconds). After that every run is a
couple of seconds.

```
/birdseye:map --force        re-parse everything from scratch
```

The output is `birdseye/index.html`. It is self-contained: no CDN, no server, no
network. It opens from `file://` on a plane.

## What it writes

```
<repo>/
├── birdseye.config.json     committed, human-editable, generated on first run
└── birdseye/                gitignored
    ├── index.html          the deliverable
    ├── graph.json          the canonical graph (schema v5)
    └── .cache/             AST cache, taxonomy scan, and the managed py/ venv
```

Nothing else in your source tree is ever touched.

## How it works

| Stage | What it does | Cost |
|---|---|---|
| `structure.mjs scan` | finds the code root and makes a first-pass feature-vs-infrastructure guess for each top-level folder | milliseconds, no model |
| `ast.mjs` | hands every source file to [graphify](https://github.com/safishamsi/graphify)'s tree-sitter parser and collapses the symbol graph to a file-level dependency graph | seconds, **no model, no network** (after the one-time install) |
| `build.mjs` | turns that flat graph into the containment tree (root → modules → folders → files) plus rolled-up dependency edges | milliseconds |
| `render.mjs` | inlines the vendored Cytoscape and writes `index.html` | milliseconds |

Extraction is [graphify](https://pypi.org/project/graphifyy/) (`graphifyy` on
PyPI, Apache-2.0), pinned and installed into `birdseye/.cache/py/` on the first
run. It parses ~25 languages to a real AST - deterministic, offline, token-free.
Point `$BIRDSEYE_PYTHON` at your own interpreter to skip the managed venv.

Same input produces the same `graph.json` and `index.html`, so the output diffs
cleanly and bugs reproduce.

## The view

- **The sidebar** is the whole repo as a collapsible tree: the code root, each
  major module, then folders and files. Modules birdsEye reads as shared
  infrastructure (`components`, `hooks`, `lib`, `utils`, ...) are grouped under
  one **General-purpose** entry; files that sit directly in the code root get a
  synthetic **core** module. **Expand** / **Collapse** open and close the lot.
- **Pick anything** - in the sidebar or on the canvas - and the canvas redraws
  around it: the selected node in the centre, its folders and files below, the
  modules it **depends on** to the right, the ones that **use it** to the left.
  Arrow labels are the number of imports. Only ever one node's neighbourhood is
  drawn, and every position is computed once, so it never lags.
- **The detail panel** lists exactly what the selection depends on and what
  depends on it, and opens a file in your editor.
- **The breadcrumb** above the canvas walks back up the tree.
- **Search** filters the sidebar to matches and their parents.
- Light / dark toggle, warm palette, remembers what you had open.

## Configuration

`birdseye.config.json` is generated from directory shape and is meant to be
edited:

```jsonc
{
  "name": "my-app",
  "moduleRoots": ["src/features/*", "src/components", "src/services"],
  "ignore": ["node_modules", ".git", "dist", "build"],
  "editor": "vscode"      // vscode | cursor | zed | idea
}
```

The taxonomy - the code root, and which folders are features versus shared
infrastructure - is written to `birdseye/.cache/structure.scan.json` by the scan.
There is no model pass refining it, so a folder birdsEye calls wrong is fixed by
hand in `birdseye/.cache/structure.json` (same shape as the scan's
`featureModules`/`sharedModules`, wins when present) or by editing `moduleRoots`.

`.gitignore` and an optional `.birdseyeignore` are both respected.

## Languages

Whatever graphify's tree-sitter grammars cover - JavaScript/TypeScript, Python,
Go, Rust, Java, C/C++, C#, Ruby, PHP, Kotlin, Swift, Scala, Elixir, Lua and more.
The set that actually appears in a repo is detected automatically. A file in an
unsupported language still counts toward its folder's totals, it just has no
dependency edges.

## Limitations

- Needs Python 3.10+ on the machine (`uv` recommended). Without it there is
  nothing to run.
- Monorepos with multiple code roots are approximated as one.
- The routes / docs / guardrail views from earlier versions are dormant - their
  code and skills are still in the tree behind a future `--with-llm` flag, but
  `/birdseye:map` no longer runs them.

## Third-party

Cytoscape.js is vendored under `scripts/vendor/` and inlined into the output
(MIT; see [`scripts/vendor/LICENSES.txt`](scripts/vendor/LICENSES.txt)). The
viewer places every node itself, so no force-layout engine is bundled.
graphify (`graphifyy`) is installed at runtime, not vendored (Apache-2.0).
