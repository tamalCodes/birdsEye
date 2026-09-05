<p align="center">
  <img src="assets/logo.svg" alt="birdsEye" width="128">
</p>

<h1 align="center">birdsEye</h1>

<p align="center"><em>Find out where your agent will get lost.</em></p>

> [!WARNING]
> **Very early stage - work in progress.**
> birdsEye is under active development.
> Expect rough edges, breaking changes between versions, and views that appear or disappear as the design settles.

One command audits your repo for stale guardrails, uncovered modules, and the specs an agent should read first.
The whole picture lands as a single self-contained HTML file.

This repository is a Claude Code plugin marketplace containing one plugin, [`birdsEye`](plugins/birdseye).

```
/birdseye:map
```

## What an agent knows before it touches your code

> *Before this agent edits auth - does it know what auth is wired to, which guardrails apply, and which spec to read first?*

Open the map, click the node, get the answer in five seconds.
Every decision in birdsEye was shaped by that one moment.

**Agent-readiness, per module.**
Every module answered on one question: does an agent have what it needs before it touches this code?
The docs that cover it, the guardrails it has to respect, the flow it should follow.
Where those are missing, you get a gap you can actually see.

**Guardrails that went stale.**
Docs are matched to the code they really describe, guardrails quoted verbatim, then glossed in plain English.
Any spec still pointing at a file git has since deleted is flagged.
That is the one an agent will read and confidently act on.

**Modules and dependencies.**
Every module is a node, every import an edge.
Click one to see its fan-in and fan-out, the plain-language version of what would break if you touched it.

**Routes and screens.**
The navigation tree, laid out like an org chart and boxed by feature.
Step-flows like onboarding or checkout show their real order, not a pile of screens.

## The map

One HTML file you can hand to anyone.

- Click any file and it opens where you actually work: VS Code, Cursor, JetBrains.
- Self-contained: it opens from `file://` with no server and no network at all.
- Shape carries the type as much as colour does, so the map reads without colour vision.
- A repo with no router gets a line saying so, not an empty canvas.

## How it works

Mechanical work is code.
Judgement is the model.

Anything a script can do exactly is a script, so it is exact and free.
The model runs only where a person would have to think, and only once, because the result is cached.
Same input, same output, every time.

| Stage | Model | What it does |
| --- | --- | --- |
| `imports.mjs` | no | tsconfig aliases, barrels, comment-stripped parsing. Re-parses only what changed. |
| `extract-routes` | yes | Reads the router and describes it, the one place judgement is genuinely required. |
| `extract-docs` | yes | Attaches docs to the code they describe. Guardrails quoted verbatim, then glossed. |
| `extract-flowcharts` | yes | Turns each module's docs into a step-by-step flow, grounded in what the docs say. |
| `merge.mjs` + `render.mjs` | no | One canonical `graph.json`, re-checked against git, then a single HTML file. |

Later runs take seconds and cost nothing.
The model stages are skipped when nothing they read has changed.

### Where it stops

A map you can trust is a map that admits what it cannot see.

- **A wrong edge is never guessed.**
  When a navigation target is computed, the edge is skipped, not invented.
  A missing edge is cheap; a wrong one destroys trust in the whole map.
- **Import edges are JS and TS only.**
  Another language still gets module nodes and a full doc map, just no dependency edges between files.
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
It runs on your own Claude Code session.
The mechanical stages use no model at all.
The two extraction stages run once and are cached afterwards, so a refresh is effectively free.

**Does my code leave my machine?**
Only what Claude reads during the two extraction stages, exactly like any other Claude Code session.
There is no birdsEye server.
Nothing is uploaded to us, because there is no us to upload to.

**What if the repo has no router or no docs?**
It degrades to what it can see.
No router gets a canvas that says so.
No docs gets a map of modules and dependencies.
One README is a perfectly valid result.
A monorepo is treated as a single root today; per-package roots are on the list.

**How stable is it?**
Very early.
Expect rough edges, breaking changes between versions, and views that appear or disappear as the design settles.

## Layout

```
.claude-plugin/marketplace.json    the catalog
AGENTS.md                          repository rules for coding agents
docs/AGENT_MEMORY.md               durable project memory for agents
plugins/birdseye/                  the plugin
├── .claude-plugin/plugin.json     manifest
├── commands/map.md                /birdseye:map
├── skills/extract-routes/         router detection
├── skills/extract-docs/           doc attachment
├── skills/extract-flowcharts/     doc -> step-by-step flow
├── scripts/                       deterministic pipeline + vendored libs
└── README.md                      everything else
site/                              the marketing site (birdseye.tamal.me)
```

There is nothing to host and no npm package - a marketplace is just a public
GitHub repo.

The plugin and its one vendored library, Cytoscape, are MIT.
