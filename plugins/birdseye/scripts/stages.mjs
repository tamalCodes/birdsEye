#!/usr/bin/env node
// DORMANT: stage planning for the routes/docs/flowcharts model passes. The
// zero-token /birdseye:map does not use it - ast.mjs + build.mjs always run and
// are cheap. Kept for the future --with-llm mode.
//
// Decides which stages actually need to run, and records what each one saw.
//
//   node stages.mjs plan   [repoRoot] [--force]
//   node stages.mjs record [repoRoot] <routes|docs>
//
// The two skill stages are the only expensive parts of the pipeline. Skipping
// them when nothing they read has changed is what turns a two-minute first run
// into a fifteen-second second run.

import path from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { walkFiles } from './lib/walk.mjs';
import { readCacheJson, readManifest, writeManifest, buildStamps, diffStamps } from './lib/cache.mjs';
import { IGNORE_FILE, CACHE_DIR } from './lib/const.mjs';

function inventory(root) {
  const { config } = loadConfig(root);
  const all = walkFiles(root, { ignore: config.ignore, ignoreFiles: ['.gitignore', IGNORE_FILE] });
  return { config, all };
}

/**
 * Files the routes stage depends on: whatever it reported reading, plus every
 * sibling of those files. A new navigator dropped next to an existing one has
 * to invalidate the cache, and watching the directory is how that is noticed.
 */
function routeWatchSet(all, routes) {
  const sources = routes?.sourceFiles ?? [];
  if (!sources.length) return null;
  const dirs = new Set(sources.map((f) => path.posix.dirname(f)));
  const watched = new Set(sources);
  for (const f of all) if (dirs.has(path.posix.dirname(f))) watched.add(f);
  return [...watched].sort();
}

const isDoc = (f) => f.endsWith('.md');

export function plan(root, { force = false } = {}) {
  const { all } = inventory(root);
  const manifest = readManifest(root);
  const routes = readCacheJson(root, 'routes.json');
  const docs = readCacheJson(root, 'docs.json');
  const flowcharts = readCacheJson(root, 'flowcharts.json');

  const structure = readCacheJson(root, 'structure.json');

  const out = { structure: 'run', imports: 'run', routes: 'run', docs: 'run', flowcharts: 'run', reasons: {} };
  if (force) {
    out.reasons = {
      structure: 'forced', imports: 'forced', routes: 'forced', docs: 'forced', flowcharts: 'forced',
    };
    return out;
  }

  // The taxonomy only re-runs when it has never run, or when the code root's
  // top-level folder list changed - a new feature folder is exactly the kind of
  // thing it needs to see. Everything else it decided still holds.
  if (structure) {
    const topDirs = [
      ...new Set(
        all
          .filter((f) => !structure.codeRoot || f.startsWith(`${structure.codeRoot}/`))
          .map((f) => {
            const rest = structure.codeRoot ? f.slice(structure.codeRoot.length + 1) : f;
            const slash = rest.indexOf('/');
            return slash === -1 ? null : rest.slice(0, slash);
          })
          .filter(Boolean),
      ),
    ].sort();
    const known = [...(structure.featureModules ?? []), ...(structure.sharedModules ?? [])]
      .map((m) => m.path.split('/').pop())
      .sort();
    const isNew = topDirs.filter((d) => !known.includes(d));
    out.structure = isNew.length ? 'run' : 'skip';
    out.reasons.structure = isNew.length
      ? `new top-level folder(s): ${isNew.join(', ')}`
      : 'structure.json covers every folder';
  } else {
    out.reasons.structure = 'no structure.json yet';
  }

  const watched = routeWatchSet(all, routes);
  if (!routes) {
    out.reasons.routes = 'no routes.json yet';
  } else if (!watched) {
    out.reasons.routes = 'previous run recorded no source files';
  } else {
    const d = diffStamps(buildStamps(root, watched), manifest.stages?.routes?.files);
    out.routes = d.dirty ? 'run' : 'skip';
    out.reasons.routes = d.dirty
      ? `${d.changed.length} changed, ${d.removed.length} removed`
      : `${watched.length} router files unchanged`;
  }

  const docFiles = all.filter(isDoc);
  if (!docs) {
    out.reasons.docs = 'no docs.json yet';
  } else {
    const d = diffStamps(buildStamps(root, docFiles), manifest.stages?.docs?.files);
    out.docs = d.dirty ? 'run' : 'skip';
    out.reasons.docs = d.dirty
      ? `${d.changed.length} changed, ${d.removed.length} removed`
      : `${docFiles.length} docs unchanged`;
  }

  // Flowcharts are built from docs.json, not from source files, so their
  // dirty check watches that one file instead of the doc files themselves.
  // If docs is about to run this pass, docs.json is stale by definition and
  // flowcharts must run right after it regardless of what the old stamp says.
  const willHaveDocs = (docs?.docs ?? []).length > 0 || out.docs === 'run';
  if (!willHaveDocs) {
    out.flowcharts = 'skip';
    out.reasons.flowcharts = 'no docs to build a flowchart from';
  } else if (out.docs === 'run') {
    out.reasons.flowcharts = 'docs are being refreshed first';
  } else if (!flowcharts) {
    out.reasons.flowcharts = 'no flowcharts.json yet';
  } else {
    const d = diffStamps(buildStamps(root, [`${CACHE_DIR}/docs.json`]), manifest.stages?.flowcharts?.files);
    out.flowcharts = d.dirty ? 'run' : 'skip';
    out.reasons.flowcharts = d.dirty ? 'docs changed since the last flowchart pass' : 'docs unchanged';
  }

  // imports.mjs does its own per-file caching and is cheap enough to always run.
  out.reasons.imports = 'always runs, caches per file';
  return out;
}

export function record(root, stage) {
  const { all } = inventory(root);
  const manifest = readManifest(root);
  manifest.stages = manifest.stages ?? {};
  if (stage === 'routes') {
    const watched = routeWatchSet(all, readCacheJson(root, 'routes.json')) ?? [];
    manifest.stages.routes = { files: buildStamps(root, watched) };
    writeManifest(root, manifest);
    return watched.length;
  }
  if (stage === 'docs') {
    const docFiles = all.filter(isDoc);
    manifest.stages.docs = { files: buildStamps(root, docFiles) };
    writeManifest(root, manifest);
    return docFiles.length;
  }
  if (stage === 'flowcharts') {
    manifest.stages.flowcharts = { files: buildStamps(root, [`${CACHE_DIR}/docs.json`]) };
    writeManifest(root, manifest);
    return 1;
  }
  throw new Error(`unknown stage: ${stage}`);
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const args = process.argv.slice(2);
  const cmd = args[0];
  let positional = args.slice(1).filter((a) => !a.startsWith('--'));
  // `record routes` and `record <root> routes` are both accepted.
  const stageFirst = positional[0] === 'routes' || positional[0] === 'docs' || positional[0] === 'flowcharts';
  const root = path.resolve(stageFirst ? process.cwd() : positional[0] ?? process.cwd());
  if (!stageFirst) positional = positional.slice(1);
  if (cmd === 'plan') {
    console.log(JSON.stringify(plan(root, { force: args.includes('--force') }), null, 2));
  } else if (cmd === 'record') {
    const stage = positional[0];
    const n = record(root, stage);
    console.log(`recorded ${n} files for stage ${stage}`);
  } else {
    console.error('usage: stages.mjs plan|record [repoRoot] [stage] [--force]');
    process.exit(2);
  }
}
