<p align="center">
  <img src="assets/logo.svg" alt="birdsEye" width="128">
</p>

<h1 align="center">birdsEye</h1>

<p align="center"><em>See a whole codebase at one glance.</em></p>

> [!WARNING]
> **Very early stage - work in progress.**
> birdsEye is under active development.
> Expect rough edges, breaking changes between versions, and views that appear or disappear as the design settles.

This repository is a Claude Code plugin marketplace containing one plugin, [`birdsEye`](plugins/birdseye).

birdsEye maps a codebase to a single self-contained interactive HTML file: its
modules and how they depend on each other, its routes and screens, and the spec
files an agent should read before touching any of it.

From a bird's eye view, you see the whole thing at one glance.

## Install

```
/plugin marketplace add tamalCodes/birdsEye
```

```
/plugin install birdseye@birdseye-marketplace
```

Then, in any repo:

```
/birdseye:map
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

## Layout

```
.claude-plugin/marketplace.json    the catalog
plugins/birdseye/                  the plugin
├── .claude-plugin/plugin.json     manifest
├── commands/map.md                /birdseye:map
├── skills/extract-routes/         router detection
├── skills/extract-docs/           doc attachment
├── skills/extract-flowcharts/     doc -> step-by-step flow
├── scripts/                       deterministic pipeline + vendored libs
└── README.md                      everything else
```

There is nothing to host and no npm package - a marketplace is just a public
GitHub repo.
