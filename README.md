# codemap marketplace

A Claude Code plugin marketplace containing one plugin, [`codemap`](plugins/codemap).

`codemap` maps a codebase to a single self-contained interactive HTML file: its
modules and how they depend on each other, its routes and screens, and the spec
files an agent should read before touching any of it.

## Install

```
/plugin marketplace add tamalcodes/codemap
```

```
/plugin install codemap@codemap-marketplace
```

Then, in any repo:

```
/codemap:map
```

## Updating

Auto-update is off by default for third-party marketplaces, so a new version
does not arrive on its own. To pull one:

```
/plugin marketplace update codemap-marketplace
```

```
/plugin install codemap@codemap-marketplace
```

## Layout

```
.claude-plugin/marketplace.json    the catalog
plugins/codemap/                   the plugin
├── .claude-plugin/plugin.json     manifest
├── commands/map.md                /codemap:map
├── skills/extract-routes/         router detection
├── skills/extract-docs/           doc attachment
├── skills/extract-flowcharts/     doc -> step-by-step flow
├── scripts/                       deterministic pipeline + vendored libs
└── README.md                      everything else
```

There is nothing to host and no npm package - a marketplace is just a public
GitHub repo.
