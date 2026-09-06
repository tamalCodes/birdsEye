// Finding the code nothing runs.
//
// This is a reachability question, not a "does anything import it" question,
// and the difference matters. A file with one importer looks alive to a
// fan-in count even when its only importer is itself unreachable, so a whole
// abandoned corner of a repo can hide behind a single internal edge. The only
// honest test is: start at the files the runtime actually enters, follow every
// import, and see what is never arrived at.
//
// Everything here is arithmetic over the AST graph. No model call, no guessing.
//
// The two things this deliberately does NOT do:
//
//   1. It does not claim a file is safe to delete. An import graph cannot see
//      `require(name)`, a route table built from strings, a bundler's
//      `import.meta.glob`, or a worker referenced by URL. So the verdict this
//      produces is "nothing here reaches it", which is a lead, not a sentence.
//   2. It does not report files that are loaded by a convention rather than an
//      import - tests, stories, framework file-routes, build config. Those are
//      entered from outside the graph, so calling them unreachable would be
//      false every single time, and a finding that is always wrong trains the
//      reader to ignore the whole section.

import path from 'node:path';
import { readJsonc } from './config.mjs';

/** Files entered by a runner or a bundler, never by an import statement. */
const EXEMPT_PATTERNS = [
  // tests and fixtures
  /(^|\/)__tests__\//,
  /(^|\/)__mocks__\//,
  /(^|\/)(tests?|spec)\//,
  /\.(test|spec)\.[cm]?[jt]sx?$/,
  /_test\.(go|py|rb)$/,
  /(^|\/)test_[^/]+\.py$/,
  /(^|\/)conftest\.py$/,
  /(^|\/)setupTests?\.[cm]?[jt]sx?$/,
  // stories and visual fixtures
  /\.stories\.[cm]?[jt]sx?$/,
  /\.story\.[cm]?[jt]sx?$/,
  // ambient types - never imported, always in scope
  /\.d\.ts$/,
  // build, lint and tooling config, wherever it sits
  /(^|\/)[^/]*\.config\.[cm]?[jt]s$/,
  /(^|\/)[^/]*\.conf\.[cm]?[jt]s$/,
  /(^|\/)(vite|next|nuxt|svelte|astro|rollup|webpack|babel|jest|vitest|playwright|cypress|tailwind|postcss|eslint|prettier|metro)\.[^/]*\.[cm]?[jt]s$/,
  /(^|\/)(gulpfile|gruntfile|karma\.conf)\.[cm]?[jt]s$/,
  // Config that tooling reads and nothing imports: a tsconfig is entered by
  // the compiler, a shell script by a person or a CI job, a Gradle file by
  // Gradle. Calling any of them unreachable would be true of the import graph
  // and useless to the reader.
  /(^|\/)[jt]sconfig(\..+)?\.json$/i,
  /\.(sh|bash)$/,
  /\.(gradle|groovy)$/,
  /\.(tf|tfvars|hcl)$/,
  /\.(ps1|psm1|psd1)$/,
  // A project file is entered by the build system, and a Rakefile by rake.
  /\.(csproj|fsproj|vbproj|props|targets)$/,
  /\.rake$/,
  // A migration is run in order by a tool; the first one imports nothing and
  // is imported by nothing, which is not the same as being dead.
  /(^|\/)migrations?\//,
  /\.sql$/,
  // Python and Go package plumbing
  /(^|\/)__init__\.py$/,
  /(^|\/)setup\.py$/,
  /(^|\/)doc\.go$/,
];

/**
 * Directories a framework loads by filename instead of by import. Only applied
 * when that framework is actually a dependency - in a plain Vite + React app a
 * `pages/` folder is imported by a hand-written route table like anything else,
 * and exempting it there would hide real findings.
 */
const ROUTING_FRAMEWORKS = [
  { dep: 'next', dirs: ['pages', 'app'] },
  { dep: 'nuxt', dirs: ['pages', 'layouts', 'middleware', 'plugins', 'server'] },
  { dep: '@sveltejs/kit', dirs: ['routes'] },
  { dep: 'astro', dirs: ['pages'] },
  { dep: 'gatsby', dirs: ['pages', 'templates'] },
  { dep: '@remix-run/react', dirs: ['routes'] },
  { dep: 'react-router', dirs: [] },
  { dep: 'expo-router', dirs: ['app'] },
  { dep: '@tanstack/react-router', dirs: ['routes'] },
];

/**
 * Names that usually mean "something loads this a way the import graph cannot
 * see". These are still reported - a stale worker is worth knowing about - but
 * they carry the reason the finding might be wrong, so the reader checks
 * instead of deletes.
 */
const CAVEATS = [
  [/\.worker\.[cm]?[jt]s$/, 'workers are usually loaded by URL, not by import'],
  [/(^|\/)(service-worker|sw)\.[cm]?[jt]s$/, 'service workers are registered by path'],
  [/(^|\/)(polyfills?|shim)\.[cm]?[jt]sx?$/, 'polyfills are often side-effect imports'],
  [/(^|\/)index\.[cm]?[jt]sx?$/, 'a folder index may be imported by its directory name'],
  [/(^|\/)register[^/]*\.[cm]?[jt]s$/, 'registration files run for their side effects'],
];

/** Conventional runtime entry filenames, checked only at the code root. */
const ROOT_ENTRY = /^(main|index|app|server|cli|__main__)\.[cm]?[jt]sx?$/;

/** Turn a config glob (`src/legacy/**`, `*.gen.ts`) into a matcher. */
function globToRegExp(glob) {
  const DIRS = '\u0000';
  const ANY = '\u0001';
  const body = String(glob)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, DIRS) // any depth of directories, or none
    .replace(/\*\*/g, ANY) // anything, slashes included
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .split(DIRS).join('(?:.*/)?')
    .split(ANY).join('.*');
  return new RegExp(`^${body}$`);
}

const matchesAny = (rel, patterns) => patterns.some((re) => re.test(rel));

/**
 * Frameworks in this repo that load whole directories by filename.
 *
 * Both manifests are read, because the code root is often its own package -
 * a `site/` or `app/` workspace inside a repo whose top-level package.json
 * knows nothing about Next. Reading only the top one made every App Router
 * file in this very repository look unused.
 */
function routingDirs(root, codeRoot) {
  const manifests = [path.join(root, 'package.json')];
  if (codeRoot) manifests.push(path.join(root, codeRoot, 'package.json'));
  const deps = {};
  for (const m of manifests) {
    const pkg = readJsonc(m) ?? {};
    Object.assign(deps, pkg.dependencies ?? {}, pkg.devDependencies ?? {});
  }
  const dirs = new Set();
  for (const f of ROUTING_FRAMEWORKS) {
    if (!deps[f.dep]) continue;
    for (const d of f.dirs) dirs.add(d);
  }
  return [...dirs];
}

/**
 * @param {object} opts
 * @param {Array<{path:string}>} opts.files      every code file from ast.json
 * @param {Array<{from:string,to:string}>} opts.edges  resolved import edges
 * @param {string[]} opts.entryPoints            entries the structure scan found
 * @param {string} opts.codeRoot                 '' or e.g. 'src'
 * @param {string} opts.root                     absolute repo root
 * @param {object} opts.config                   the repo config
 * @returns {{ files: Array<{path,reason,caveat}>, entryPoints: string[], exempt: number, mode: string }}
 */
export function analyzeDead({ files, edges, entryPoints = [], codeRoot = '', root, config = {} }) {
  const settings = config.deadCode ?? {};
  if (settings.enabled === false) {
    return { files: [], entryPoints: [], exempt: 0, mode: 'off' };
  }

  const all = files.map((f) => f.path);
  const known = new Set(all);
  const routeDirs = routingDirs(root, codeRoot);
  const routeRe = routeDirs.map((d) => new RegExp(`(^|/)${d}/`));
  const excludeRe = (settings.exclude ?? []).map(globToRegExp);

  // A file the runtime enters from outside the import graph. Both a starting
  // point for the walk and immune to the verdict itself.
  const isExempt = (rel) =>
    matchesAny(rel, EXEMPT_PATTERNS) ||
    matchesAny(rel, routeRe) ||
    matchesAny(rel, excludeRe);

  const inCodeRoot = (rel) => !codeRoot || rel === codeRoot || rel.startsWith(`${codeRoot}/`);
  const atCodeRoot = (rel) => {
    if (!inCodeRoot(rel)) return false;
    const tail = codeRoot ? rel.slice(codeRoot.length + 1) : rel;
    return !tail.includes('/');
  };

  // Two different kinds of seed, and conflating them is how this analysis
  // goes badly wrong. A *real* entry is a file the application is genuinely
  // started at. A seed is merely somewhere the walk may begin - a test, a
  // build script, anything outside the application tree. Seeds alone are not
  // evidence that we know how the app boots, and a reachability verdict drawn
  // from seeds alone condemns almost every file in the repo.
  const realEntries = new Set();
  for (const rel of [...entryPoints, ...(settings.entryPoints ?? [])]) {
    if (known.has(rel)) realEntries.add(rel);
  }
  const roots = new Set(realEntries);
  for (const rel of all) {
    // A conventional entry name sitting directly in the code root counts as a
    // real entry; anything outside the code root, or loaded by convention, is
    // only a seed.
    if (atCodeRoot(rel) && ROOT_ENTRY.test(path.basename(rel))) {
      realEntries.add(rel);
      roots.add(rel);
    }
    if (!inCodeRoot(rel) || isExempt(rel)) roots.add(rel);
  }

  // With no real entry point, reachability has nothing truthful to say. Fall
  // back to the weaker claim that is still certainly true: nothing imports
  // this. A library, or a repo of scripts, lands here - correctly, because in
  // one there is no single front door and in the other every file is one.
  const mode = realEntries.size ? 'reachability' : 'unreferenced';

  const out = new Map();
  const fanIn = new Map();
  for (const e of edges) {
    if (!known.has(e.from) || !known.has(e.to)) continue;
    if (!out.has(e.from)) out.set(e.from, []);
    out.get(e.from).push(e.to);
    fanIn.set(e.to, (fanIn.get(e.to) ?? 0) + 1);
  }

  const reached = new Set(roots);
  const queue = [...roots];
  while (queue.length) {
    for (const next of out.get(queue.pop()) ?? []) {
      if (reached.has(next)) continue;
      reached.add(next);
      queue.push(next);
    }
  }

  const dead = [];
  for (const rel of all) {
    if (!inCodeRoot(rel) || isExempt(rel)) continue;
    if (mode === 'reachability' ? reached.has(rel) : (fanIn.get(rel) ?? 0) > 0) continue;
    const caveat = CAVEATS.find(([re]) => re.test(rel));
    dead.push({
      path: rel,
      // Two genuinely different findings. Nothing at all points at the first.
      // The second is imported - but only from inside the same abandoned
      // island, which is why a fan-in count alone would have missed it.
      reason: (fanIn.get(rel) ?? 0) > 0 ? 'unreachable' : 'unreferenced',
      caveat: caveat ? caveat[1] : null,
    });
  }
  dead.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  return {
    files: dead,
    entryPoints: [...realEntries].sort(),
    exempt: all.filter((rel) => inCodeRoot(rel) && isExempt(rel)).length,
    mode,
  };
}
