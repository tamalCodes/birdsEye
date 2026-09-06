<p align="center">
  <img src="assets/logo.svg" alt="birdsEye" width="128">
</p>

<h1 align="center">birdsEye</h1>

<p align="center"><em>Find out where your agent will get lost.</em></p>

> [!WARNING]
> **Very early stage - work in progress.**
> birdsEye is under active development.
> Expect rough edges, breaking changes between versions, and views that appear or disappear as the design settles.

One command turns any repo into an interactive flowchart of its structure: the modules, the folders and files inside them, and the imports between them.
The whole picture lands as a single self-contained HTML file.
It runs entirely on your machine and calls no model, so it costs nothing to run.

This repository is a Claude Code plugin marketplace containing one plugin, [`birdsEye`](plugins/birdseye).

```
/birdseye:map
```

## What an agent knows before it touches your code

> *Before this agent edits auth - does it know what auth is wired to, and what breaks if it changes?*

Open the map, pick the node, get the answer in five seconds.
Every decision in birdsEye was shaped by that one moment.

**The spine of the repo, up front.**
The top level is a handful of boxes: the feature modules, plus one general-purpose group for the shared code everything imports.
You see how the repo is organised before you read a line of it.

**One node and its neighbours at a time.**
Pick anything - a module, a folder, a file - and the canvas draws that node alone with what it depends on, what uses it, and what lives inside it.
The whole graph is never dumped on screen, so a big repo stays as readable as a small one.

**Blast radius, in plain language.**
Every import is an edge, rolled up to whatever level you are looking at.
The detail panel names the files on both ends of a dependency, so "what breaks if I touch this" is a list, not a guess.

**Parsed, not guessed.**
Around 25 languages through tree-sitter.
An import resolves to a real file or it is left out, and the same repo always produces the same map.

## The map

One HTML file you can hand to anyone.

- Click any file and it opens where you actually work: VS Code, Cursor, JetBrains.
- Self-contained: it opens from `file://` with no server and no network at all.
- A collapsible tree of the whole repo on the left, the focused flowchart on the right.
- Light and dark themes, and it remembers what you had open.

## How it works

No model is in the loop.
Every stage is a script on your machine, so a map is exact, private, and free to build.

| Stage | What it does |
| --- | --- |
| `init.mjs` | Checks config, output ignore status, and that Python is ready. Asks one setup question at a time. |
| `structure.mjs scan` | Finds the code root and makes a first-pass guess at which folders are features and which are shared infrastructure. |
| `ast.mjs` | Hands every source file to [graphify](https://github.com/safishamsi/graphify)'s tree-sitter parser and collapses the symbol graph to a file-level dependency graph. |
| `build.mjs` | Rolls that flat graph into the containment tree the viewer draws: root, modules, folders, files. |
| `render.mjs` | Inlines the vendored Cytoscape and both fonts into one self-contained HTML file. No CDN, no server. |

graphify keeps a per-file content hash, so a re-run only re-parses what changed, usually a second or two.

### Where it stops

A map you can trust is a map that admits what it cannot see.

- **Python 3.10+ is required.**
  The parser is a Python package (graphify, Apache-2.0) that birdsEye installs into its own virtualenv on the first run.
  No Python, no map.
- **A wrong edge is never guessed.**
  An import resolves to a real file or it is left out.
  A missing edge is cheap; a wrong one destroys trust in the whole map.
- **Your source tree is left alone.**
  Nothing is written into it except `birdseye.config.json`, and only after it asks.
  The map lives in a gitignored folder.

## Install

Two commands, once per machine.
The first registers this repo as a plugin marketplace, the second installs the plugin from it.

```
/plugin marketplace add tamalCodes/birdsEye
```

```
/plugin install birdseye@birdseye-marketplace
```

Then, in any repo you want a map of:

```
/birdseye:map
```

Everything runs inside Claude Code.
There is nothing to download by hand and no npm package.
The first run in a repo asks one setup question at a time - first whether to write `birdseye.config.json`, then whether to gitignore the output - then takes a minute or two.
Every run after that is seconds.

### If adding the marketplace fails

Claude Code refuses the first command with `its network source differs from the one declared for it in settings` when the name `birdseye-marketplace` is already registered on your machine from a different source, usually a local clone of this repo.
Marketplace names are global, so drop the old registration first, then add it again:

```
/plugin marketplace remove birdseye-marketplace
```

## Updating

Auto-update is off by default for third-party marketplaces, so a new version
does not arrive on its own. To pull one:

```
/plugin marketplace update birdseye-marketplace
```

```
/plugin install birdseye@birdseye-marketplace
```

## Releasing

The plugin marketplace releases from the signed GitHub `main` branch.
The marketing site is a separate Vercel release from `site/`.
Follow the [deployment guide](docs/DEPLOYMENT.md) for the exact build, production, verification, and rollback steps.

## FAQ

**What does it cost to run?**
Nothing.
No stage calls a model, so building a map costs zero tokens no matter how large the repo is.

**Does my code leave my machine?**
No.
The parse is a local Python process and the viewer is a local file.
There is no birdsEye server, and nothing is uploaded to us, because there is no us to upload to.

**What does it do with an unfamiliar repo?**
It degrades to what it can see.
Around 25 languages parse; anything else still appears in the tree as folders and files, just without import edges.
A monorepo is treated as a single root today; per-package roots are on the list.

**How stable is it?**
Very early.
Expect rough edges, breaking changes between versions, and views that appear or disappear as the design settles.

## Layout

```
.claude-plugin/marketplace.json    the catalog
AGENTS.md                          repository rules for coding agents
docs/AGENT_MEMORY.md               durable project memory for agents
docs/RUNBOOK.md                    every build, regenerate, verify and release command
docs/DESIGN_SYSTEM.md              palette, type, motion and layout rules
plugins/birdseye/                  the plugin
├── .claude-plugin/plugin.json     manifest
├── commands/map.md                /birdseye:map
├── scripts/                       the deterministic pipeline + vendored libs
├── scripts/template/index.html    the viewer, one self-contained file
├── skills/                        dormant LLM stages, not part of the default flow
├── DESIGN_VIEWER.md               the viewer layout contract
└── README.md                      everything else
site/                              the marketing site (birdseye.tamal.me)
```

There is nothing to host and no npm package - a marketplace is just a public
GitHub repo.

The plugin and its one vendored library, Cytoscape, are MIT.
