#!/usr/bin/env node
// The extraction stage. Deterministic, token-free, no model calls.
//
//   node ast.mjs [repoRoot] [--force] [--json]
//
// Walks the repo, hands every parseable source file to graphify's tree-sitter
// extractor (via lib/graphify.mjs), and writes the file-level dependency graph
// to birdseye/.cache/ast.json. graphify keeps its own per-file content-hash
// cache under birdseye/.cache/graphify/, so a re-run only re-parses what changed.

import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { walkFiles } from './lib/walk.mjs';
import { runExtraction, resolvePython } from './lib/graphify.mjs';
import { writeCacheJson, readManifest, writeManifest, buildStamps, diffStamps } from './lib/cache.mjs';
import { IGNORE_FILE, CACHE_DIR } from './lib/const.mjs';

// Extensions graphify can parse to an AST. A file outside this set still counts
// toward its folder's file total (see build.mjs) - it just has no import edges.
export const CODE_EXTENSIONS = [
  '.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.rb', '.java', '.kt', '.kts', '.scala',
  '.cs', '.php', '.swift', '.c', '.h', '.cc', '.cpp', '.cxx', '.hpp',
  '.lua', '.ex', '.exs', '.jl', '.zig', '.m',
];

const byString = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function buildAst(root, { force = false } = {}) {
  const { config } = loadConfig(root);

  if (force) {
    fs.rmSync(path.join(root, CACHE_DIR, 'graphify'), { recursive: true, force: true });
  }

  const all = walkFiles(root, {
    ignore: config.ignore,
    ignoreFiles: ['.gitignore', IGNORE_FILE],
  });
  const sources = all.filter((rel) => CODE_EXTENSIONS.includes(path.extname(rel).toLowerCase()));

  const python = resolvePython(root); // sets up the managed venv on first run
  const bridge = sources.length
    ? runExtraction(root, { files: sources, python })
    : { graphifyVersion: null, files: [], edges: [], externals: [], unresolved: 0, failed: 0, stats: {} };

  const files = (bridge.files ?? []).slice().sort((a, b) => byString(a.path, b.path));
  const edges = (bridge.edges ?? []).slice().sort(
    (a, b) => byString(a.from, b.from) || byString(a.to, b.to),
  );
  const externals = (bridge.externals ?? []).slice().sort(
    (a, b) => byString(a.from, b.from) || byString(a.module, b.module),
  );
  const languages = [...new Set(files.map((f) => f.lang))].filter(Boolean).sort(byString);

  const result = {
    version: 1,
    graphifyVersion: bridge.graphifyVersion ?? null,
    files,
    edges,
    externals,
    languages,
    stats: {
      files: files.length,
      walked: all.length,
      edges: edges.length,
      externalRefs: externals.reduce((n, e) => n + e.count, 0),
      unresolved: bridge.unresolved ?? 0,
      failed: bridge.failed ?? 0,
      symbols: files.reduce((n, f) => n + (f.symbols ?? 0), 0),
    },
  };

  const stamps = buildStamps(root, sources);
  const manifest = readManifest(root);
  const prevStamps = manifest.stages?.ast?.files;
  const { changed, removed } = diffStamps(stamps, prevStamps);
  manifest.stages = manifest.stages ?? {};
  manifest.stages.ast = { files: stamps, graphifyVersion: result.graphifyVersion };
  writeCacheJson(root, 'ast.json', result);
  writeManifest(root, manifest);

  return { result, stats: { ...result.stats, changed: changed.length, removed: removed.length, python } };
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const root = path.resolve(args.find((a) => !a.startsWith('--')) ?? process.cwd());
  const started = Date.now();
  const { stats } = buildAst(root, { force });
  const ms = Date.now() - started;
  if (args.includes('--json')) {
    console.log(JSON.stringify({ ...stats, ms }, null, 2));
  } else {
    console.log(
      `${path.basename(root)}: ${stats.files} source files, ${stats.symbols} symbols, ` +
        `${stats.edges} import edges, ${stats.externalRefs} external refs, ` +
        `${stats.unresolved} unresolved, ${stats.failed} failed, ${ms}ms` +
        (stats.changed != null ? ` (${stats.changed} changed since last run)` : ''),
    );
  }
}
