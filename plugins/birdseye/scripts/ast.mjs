#!/usr/bin/env node
// The extraction stage. Deterministic, token-free, no model calls.
//
//   node ast.mjs [repoRoot] [--force] [--json]
//
// Two halves, deliberately separated:
//
//   parse    lib/py/extract.py walks every source file's tree-sitter syntax
//            tree and reports what it declares and what it imports, exactly as
//            written. It knows nothing about this repository.
//   resolve  the modules in lib/languages/ turn each specifier into the file it
//            points at, using the things only a repo can tell you - tsconfig
//            path aliases, go.mod module paths, Python source roots, which
//            namespaces are declared where.
//
// The result is birdseye/.cache/ast.json: a file-level dependency graph. The
// extractor keeps a content-hash cache beside it, so a re-run only re-parses
// what changed.

import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { walkFiles } from './lib/walk.mjs';
import { runExtraction, resolvePython } from './lib/extractor.mjs';
import { LANGUAGES, moduleForLang } from './lib/languages/index.mjs';
import { writeCacheJson, readManifest, writeManifest, buildStamps, diffStamps } from './lib/cache.mjs';
import { IGNORE_FILE, CACHE_DIR } from './lib/const.mjs';

// Extensions birdsEye can parse to an AST. A file outside this set still counts
// toward its folder's file total (see build.mjs) - it just has no import edges.
export const CODE_EXTENSIONS = [
  '.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs',
  '.vue', '.svelte', '.astro',
  '.py', '.go', '.rs', '.rb', '.java', '.kt', '.kts', '.scala',
  '.cs', '.php', '.swift', '.c', '.h', '.cc', '.cpp', '.cxx', '.hpp',
  '.lua', '.ex', '.exs', '.jl', '.zig', '.m',
  '.sh', '.bash', '.groovy', '.gradle',
  '.dart', '.sql', '.tf', '.tfvars', '.hcl', '.ps1', '.psm1', '.psd1',
  '.mm', '.cu', '.cuh', '.metal', '.rake', '.luau', '.ets',
  '.ml', '.mli', '.f', '.f90', '.f95', '.f03', '.f08',
  '.v', '.sv', '.svh', '.vh', '.pas', '.pp', '.dpr', '.dpk', '.lpr',
  '.lisp', '.cl', '.lsp', '.asd', '.pl', '.pm',
  '.csproj', '.fsproj', '.vbproj', '.props', '.targets',
];

// JSON is not a code extension: parsing every `.json` would make a lockfile a
// node in the map and cost more than the whole rest of the repo. Only the
// config files that genuinely point at another config file are read, for their
// `extends` chain.
const EXTRA_PARSE_FILE_RE = /^[jt]sconfig(\..+)?\.json$/i;

const isParseable = (rel) =>
  CODE_EXTENSIONS.includes(path.extname(rel).toLowerCase()) ||
  EXTRA_PARSE_FILE_RE.test(rel.slice(rel.lastIndexOf('/') + 1));

const byString = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Map keys pair two paths. A NUL is the one byte a path cannot contain, so it
// is the only separator that cannot be ambiguous - a space would split a path
// that has one straight down the middle.
const SEP = '\u0000';
const pairKey = (a, b) => `${a}${SEP}${b}`;

/**
 * The package name to credit an external import to. `react/jsx-runtime` is
 * still react; `@scope/pkg/sub` is still `@scope/pkg`. Languages whose
 * specifiers are dotted rather than slashed keep the whole name, because
 * `System.Text.Json` is not usefully shortened to `System`.
 */
function externalName(spec) {
  if (!spec) return null;
  // Dart writes third-party imports as `package:flutter/material.dart`; the
  // package is `flutter`, and the scheme is noise in a dependency list.
  if (spec.startsWith('package:')) spec = spec.slice('package:'.length);
  if (!spec.includes('/')) return spec;
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

export function buildAst(root, { force = false } = {}) {
  const { config } = loadConfig(root);

  if (force) {
    fs.rmSync(path.join(root, CACHE_DIR, 'extract.cache.json'), { force: true });
  }

  const all = walkFiles(root, {
    ignore: config.ignore,
    ignoreFiles: ['.gitignore', IGNORE_FILE],
  });
  const sources = all.filter(isParseable);

  const python = resolvePython(root); // sets up the managed venv on first run
  const extraction = sources.length
    ? runExtraction(root, { files: sources, python })
    : { extractorVersion: null, files: [], failed: [], missingGrammars: [], stats: {} };

  // ---- index the parse -------------------------------------------------
  const records = new Map();
  for (const rec of extraction.files ?? []) records.set(rec.path, rec);

  // Import specifiers, after any language-specific expansion (Rust's `use`
  // trees are the only thing that needs it today).
  const importsCache = new Map();
  const importsOf = (rel) => {
    if (importsCache.has(rel)) return importsCache.get(rel);
    const rec = records.get(rel);
    let list = rec?.imports ?? [];
    const mod = rec ? moduleForLang(rec.lang) : null;
    if (mod?.expand) list = mod.expand(list);
    importsCache.set(rel, list);
    return list;
  };
  const declaresOf = (rel) => records.get(rel)?.declares ?? [];
  const readFile = (rel) => {
    try {
      return fs.readFileSync(path.join(root, rel), 'utf8');
    } catch {
      return null;
    }
  };

  // ---- one resolver per language module actually present ---------------
  const presentExts = new Set(all.map((f) => path.extname(f).toLowerCase()));
  const resolvers = new Map(); // module id -> resolver
  for (const mod of LANGUAGES) {
    if (!mod.extensions.some((e) => presentExts.has(e))) continue;
    if (!mod.detect(root, all)) continue;
    resolvers.set(mod.id, mod.createResolver(root, { allFiles: all, readFile, importsOf, declaresOf }));
  }

  // ---- resolve every import -------------------------------------------
  const known = new Set(sources);
  const resolved = new Map(); // rel -> [{ imp, targets, external, unresolved }]

  for (const rel of sources) {
    const rec = records.get(rel);
    if (!rec) continue;
    const mod = moduleForLang(rec.lang);
    const resolver = mod ? resolvers.get(mod.id) : null;
    if (!resolver) continue;
    const out = [];
    for (const imp of importsOf(rel)) {
      let hit;
      try {
        hit = resolver.resolve(imp.spec, rel, imp.kind);
      } catch {
        // A resolver throwing on one odd specifier must not lose the file's
        // other edges, let alone the whole run.
        hit = { kind: 'unresolved' };
      }
      if (hit.kind === 'file') {
        const targets = (hit.paths ?? []).filter((t) => t !== rel && known.has(t));
        out.push({ imp, targets });
      } else if (hit.kind === 'external') {
        // A `weak` specifier is a guess the language forced on us - Python's
        // `from pkg import thing`, where `thing` may be a submodule or may be
        // an ordinary symbol. When it does not resolve to a file it was a
        // symbol, so it is neither an edge nor a third-party package; calling
        // it a dependency would invent one named `pkg.thing`.
        out.push({ imp, targets: [], external: imp.kind === 'weak' ? null : externalName(imp.spec) });
      } else if (hit.kind === 'unresolved') {
        out.push({ imp, targets: [], unresolved: true });
      }
      // `asset` - a real file that is not code (a stylesheet, an image). Not an
      // edge, not a failure, and deliberately not counted as unresolved.
    }
    resolved.set(rel, out);
  }

  // ---- barrel hop-through ---------------------------------------------
  // An `index.js` that only re-exports is a signpost, not a dependency. Left
  // alone it becomes a false hub in the viewer - every consumer of any hook
  // pointing at one node - and it makes reachability lie, because touching the
  // barrel would mark every file it forwards as reached.
  //
  // So a named import of something the target merely re-exports is credited to
  // the file that actually owns the name. Only *named* re-exports are followed:
  // `export * from "./x"` does not say which file owns which name, and guessing
  // would invent edges rather than find them.
  const reexports = new Map(); // barrel file -> Map(name -> owning file)
  for (const [rel, list] of resolved) {
    for (const { imp, targets } of list) {
      if (!imp.reexport || !targets.length) continue;
      let map = reexports.get(rel);
      if (!map) reexports.set(rel, (map = new Map()));
      for (const name of imp.names ?? []) {
        if (name !== '*' && !map.has(name)) map.set(name, targets[0]);
      }
    }
  }

  const MAX_BARREL_DEPTH = 8;
  const ownerOf = (file, name) => {
    let current = file;
    const seen = new Set([file]);
    for (let depth = 0; depth < MAX_BARREL_DEPTH; depth += 1) {
      const next = reexports.get(current)?.get(name);
      if (!next || seen.has(next)) break;
      seen.add(next);
      current = next;
    }
    return current;
  };

  // ---- tally ------------------------------------------------------------
  const dep = new Map(); // "from to" -> { weight, kinds }
  const ext = new Map(); // "from module" -> count
  let unresolved = 0;
  let hops = 0;

  const addEdge = (from, to, kind) => {
    if (from === to) return;
    const key = pairKey(from, to);
    const entry = dep.get(key) ?? { weight: 0, kinds: {} };
    entry.weight += 1;
    entry.kinds[kind] = (entry.kinds[kind] ?? 0) + 1;
    dep.set(key, entry);
  };

  for (const [rel, list] of resolved) {
    for (const { imp, targets, external, unresolved: missed } of list) {
      if (missed) {
        unresolved += 1;
        continue;
      }
      if (external) {
        const key = pairKey(rel, external);
        ext.set(key, (ext.get(key) ?? 0) + 1);
        continue;
      }
      for (const target of targets) {
        const names = imp.reexport ? [] : imp.names ?? [];
        if (!names.length) {
          // A default import, a side-effect import, or a language whose
          // imports name no bindings: the module itself is the dependency.
          addEdge(rel, target, imp.kind);
          continue;
        }
        let forwarded = 0;
        for (const name of names) {
          if (name === '*') continue;
          const owner = ownerOf(target, name);
          if (owner !== target) {
            forwarded += 1;
            hops += 1;
          }
          addEdge(rel, owner, imp.kind);
        }
        // Every name came from somewhere else, so the barrel itself is not a
        // dependency of this file - only a route to one. A partly-forwarded
        // import keeps its edge, because the rest really does live there.
        if (forwarded < names.filter((n) => n !== '*').length) addEdge(rel, target, imp.kind);
      }
    }
  }

  const files = (extraction.files ?? [])
    .map((r) => ({ path: r.path, symbols: r.symbols ?? 0, loc: r.loc ?? 0, lang: r.lang }))
    .sort((a, b) => byString(a.path, b.path));

  const edges = [...dep.entries()]
    .map(([key, v]) => {
      const [from, to] = key.split(SEP);
      return { from, to, weight: v.weight, kinds: Object.fromEntries(Object.entries(v.kinds).sort()) };
    })
    .sort((a, b) => byString(a.from, b.from) || byString(a.to, b.to));

  const externals = [...ext.entries()]
    .map(([key, count]) => {
      const [from, module] = key.split(SEP);
      return { from, module, count };
    })
    .sort((a, b) => byString(a.from, b.from) || byString(a.module, b.module));

  const languages = [...new Set(files.map((f) => f.lang))].filter(Boolean).sort(byString);

  const result = {
    version: 2,
    extractorVersion: extraction.extractorVersion ?? null,
    files,
    edges,
    externals,
    languages,
    stats: {
      files: files.length,
      walked: all.length,
      edges: edges.length,
      externalRefs: externals.reduce((n, e) => n + e.count, 0),
      unresolved,
      failed: (extraction.failed ?? []).length,
      symbols: files.reduce((n, f) => n + (f.symbols ?? 0), 0),
      parsed: extraction.stats?.parsed ?? 0,
      cached: extraction.stats?.cached ?? 0,
      barrelHops: hops,
    },
    missingGrammars: extraction.missingGrammars ?? [],
    failures: (extraction.failed ?? []).slice(0, 50),
  };

  const stamps = buildStamps(root, sources);
  const manifest = readManifest(root);
  const prevStamps = manifest.stages?.ast?.files;
  const { changed, removed } = diffStamps(stamps, prevStamps);
  manifest.stages = manifest.stages ?? {};
  manifest.stages.ast = { files: stamps, extractorVersion: result.extractorVersion };
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
  const { result, stats } = buildAst(root, { force });
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
    if (result.missingGrammars.length) {
      // Name the languages that lost their edges and the one command that
      // fixes it. A bare list of module names tells the reader something is
      // wrong without telling them it is fixable.
      console.log(
        `no parser for ${result.missingGrammars.join(', ')} - those files have no ` +
          'dependency edges. Delete birdseye/.cache/py and re-run to install them.',
      );
    }
  }
}
