#!/usr/bin/env node
// Deterministic import graph. No LLM involvement anywhere in this file.
//
//   node imports.mjs [repoRoot] [--force] [--json]
//
// Writes <repo>/codemap/.cache/imports.json. Same input, same bytes out.

import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, resolveModules, moduleOf } from './lib/config.mjs';
import { walkFiles } from './lib/walk.mjs';
import { createResolver } from './lib/resolve.mjs';
import { extractSpecifiers } from './lib/parse.mjs';
import {
  readCacheJson,
  writeCacheJson,
  readManifest,
  writeManifest,
  buildStamps,
  diffStamps,
} from './lib/cache.mjs';
import { IGNORE_FILE } from './lib/const.mjs';

const byString = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function buildImports(root, { force = false } = {}) {
  const { config } = loadConfig(root);
  const modules = resolveModules(root, config.moduleRoots);
  const resolver = createResolver(root, { extensions: config.extensions });

  const all = walkFiles(root, {
    ignore: config.ignore,
    ignoreFiles: ['.gitignore', IGNORE_FILE],
  });
  const sources = all.filter((rel) => config.extensions.includes(path.extname(rel)));

  const stamps = buildStamps(root, sources);
  const manifest = readManifest(root);
  const previous = force ? null : readCacheJson(root, 'imports.json');
  const stored = force ? null : manifest.stages?.imports?.files;
  const { changed, unchanged } = diffStamps(stamps, stored);

  const cachedByPath = new Map((previous?.files ?? []).map((f) => [f.path, f]));
  const reusable = new Set(previous ? unchanged : []);

  const files = [];
  const unresolved = [];
  let statements = 0;
  let parsed = 0;

  for (const rel of sources) {
    const cached = reusable.has(rel) ? cachedByPath.get(rel) : null;
    if (cached) {
      files.push({ ...cached, module: moduleOf(rel, modules) });
      statements += cached.imports.length + (cached.externalCount ?? 0);
      for (const u of previous.unresolved ?? []) if (u.from === rel) unresolved.push(u);
      continue;
    }

    let src;
    try {
      src = fs.readFileSync(path.join(root, rel), 'utf8');
    } catch {
      continue;
    }
    parsed++;
    const specifiers = extractSpecifiers(src);
    statements += specifiers.length;

    const imports = new Set();
    let externalCount = 0;
    const absFrom = path.join(root, rel);
    for (const spec of specifiers) {
      const hit = resolver.resolve(spec, absFrom);
      if (hit.kind === 'file') {
        const target = path.relative(root, hit.path).split(path.sep).join('/');
        if (target !== rel) imports.add(target);
      } else if (hit.kind === 'unresolved') {
        unresolved.push({ from: rel, specifier: spec });
      } else {
        externalCount++;
      }
    }

    files.push({
      path: rel,
      module: moduleOf(rel, modules),
      imports: [...imports].sort(byString),
      externalCount,
    });
  }

  files.sort((a, b) => byString(a.path, b.path));
  unresolved.sort((a, b) => byString(a.from, b.from) || byString(a.specifier, b.specifier));

  // File counts come from every walked file, not just the parsed ones, so that
  // a repo in a language we do not parse still gets a meaningful module map.
  const counts = new Map(modules.map((m) => [m.slug, { files: 0, code: 0 }]));
  for (const rel of all) {
    const slug = moduleOf(rel, modules);
    if (!slug) continue;
    counts.get(slug).files++;
    if (config.extensions.includes(path.extname(rel))) counts.get(slug).code++;
  }

  const result = {
    files,
    unresolved,
    modules: modules
      .map((m) => ({
        slug: m.slug,
        path: m.path,
        fileCount: counts.get(m.slug).files,
        codeFileCount: counts.get(m.slug).code,
      }))
      .sort((a, b) => byString(a.slug, b.slug)),
    totals: { files: all.length, codeFiles: sources.length },
  };

  manifest.stages = manifest.stages ?? {};
  manifest.stages.imports = { files: stamps };
  writeCacheJson(root, 'imports.json', result);
  writeManifest(root, manifest);

  return {
    result,
    stats: {
      files: files.length,
      parsed,
      reused: files.length - parsed,
      changed: changed.length,
      modules: modules.length,
      statements,
      unresolved: unresolved.length,
      unresolvedPct: statements ? (unresolved.length / statements) * 100 : 0,
      edges: files.reduce((n, f) => n + f.imports.length, 0),
    },
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const root = path.resolve(args.find((a) => !a.startsWith('--')) ?? process.cwd());
  const started = Date.now();
  const { stats } = buildImports(root, { force });
  const ms = Date.now() - started;
  if (args.includes('--json')) {
    console.log(JSON.stringify({ ...stats, ms }, null, 2));
  } else {
    console.log(
      `${path.basename(root)}: ${stats.files} files (${stats.parsed} parsed, ${stats.reused} cached), ` +
        `${stats.modules} modules, ${stats.edges} import edges, ` +
        `${stats.unresolved}/${stats.statements} unresolved (${stats.unresolvedPct.toFixed(2)}%), ${ms}ms`,
    );
  }
}
