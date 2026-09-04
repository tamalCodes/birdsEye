<p align="center">
  <img src="../../assets/logo.svg" alt="birdsEye" width="112">
</p>

<h1 align="center">birdsEye</h1>

<p align="center"><em>See the shape of a codebase in five seconds.</em></p>

> [!WARNING]
> **Very early stage - work in progress.** Expect rough edges and breaking changes.

One command, one HTML file: an **interactive flowchart of a repo's structure**.
The top level is a handful of boxes - the major modules. Click one and it expands
in place to the folders and files inside it. Dependency arrows connect whatever
is currently open, so you can see which module leans on which without reading a
line of code.

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

- **Top level**: the code root as an outer frame, each major module as a box.
  Modules birdsEye reads as shared infrastructure (`components`, `hooks`, `lib`,
  `utils`, ...) are grouped under one **General-purpose** frame. Files that sit
  directly in the code root get a synthetic **core** module so the top level
  stays a handful of boxes.
- **Click a box** to expand it in place - its folders, then its files. Click
  again to collapse. **Expand all** / **Collapse** are in the toolbar.
- **Dependency arrows** are drawn between whatever is open, rolled up from the
  file-level import/call graph. Select a node to see exactly what it depends on
  and what depends on it, and to open a file in your editor.
- **Search** jumps to a module or file and expands the path to it.
- Light / dark toggle, warm palette, remembers what you had expanded.

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

Cytoscape.js and fcose are vendored under `scripts/vendor/` and inlined into the
output (MIT; see [`scripts/vendor/LICENSES.txt`](scripts/vendor/LICENSES.txt)).
graphify (`graphifyy`) is installed at runtime, not vendored (Apache-2.0).
