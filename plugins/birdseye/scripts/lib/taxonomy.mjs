// Folder taxonomy: the pass every later stage now goes through.
//
// It reads the filesystem and works out, for a repo with *any* directory
// layout, three things:
//
//   1. where the code root is - `src/`, `app/`, a monorepo `packages/*`, or the
//      repo root itself. Never assumes a name, never fails.
//   2. which of that root's folders are product features (they own screens and
//      flows a user navigates) and which are general-purpose infrastructure
//      (components, hooks, redux, styles - imported by the features, no screens
//      of their own).
//   3. which files boot the app.
//
// This file is heuristics only. `extract-structure` layers judgement on top and
// asks the user about anything genuinely ambiguous. The point of the split is
// the same as everywhere else in birdsEye: a script does the mechanical part, a
// model does the one part that needs understanding.

import fs from 'node:fs';
import path from 'node:path';
import { walkFiles } from './walk.mjs';
import { IGNORE_FILE } from './const.mjs';
import { readJsonc } from './config.mjs';

export const CODE_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte', '.astro',
  '.py', '.go', '.rs', '.cs',
];

// A folder whose name *alone* says "shared infrastructure, not a feature".
// Tested case-insensitively against the bare folder name; the value is the kind
// tag the viewer groups by. Singular and plural both match.
const SHARED_NAME_RULES = [
  [/^(components?|ui|widgets?|elements?|primitives?)$/i, 'components'],
  [/^(hooks?)$/i, 'hooks'],
  [/^(utils?|utilities|helpers?|fns?|functions)$/i, 'utils'],
  [/^(lib|libs|common|commons|core|shared|internals?|base)$/i, 'shared'],
  [/^(config|configs|configuration|settings|env)$/i, 'config'],
  [/^(constants?|enums?)$/i, 'constants'],
  [/^(contexts?|providers?)$/i, 'context'],
  [/^(redux|store|stores|state)$/i, 'state'],
  [/^(slices?|reducers?|thunks?|actions?|selectors?|sagas?|atoms?|effects?)$/i, 'state'],
  [/^(styles?|css|scss|sass|less|themes?|styling|tokens?)$/i, 'styles'],
  [/^(services?|api|apis|clients?|sdk|gateways?|http|network|transport)$/i, 'services'],
  [/^(data|db|database|graphql|queries|mutations|fragments?|repositories?|repos?)$/i, 'data'],
  [/^(types?|typings?|models?|schemas?|interfaces?|dto|dtos)$/i, 'types'],
  [/^(middlewares?|interceptors?|guards?|filters?)$/i, 'middleware'],
  [/^(i18n|intl|locales?|translations?|lang|languages?)$/i, 'i18n'],
  [/^(assets?|static|public|images?|img|icons?|fonts?|media|svgs?)$/i, 'assets'],
  [/^(tests?|__tests__|__mocks__|mocks?|fixtures?|e2e|cypress|specs?|stories?)$/i, 'tests'],
  [/^(layouts?)$/i, 'layout'],
  [/^(routes?|router|routing|navigation|navigators?)$/i, 'routing'],
  // Backend-leaning infrastructure folder names (Go, .NET, Rust, Python, JVM).
  [/^(handlers?|controllers?|resolvers?|endpoints?)$/i, 'handlers'],
  [/^(repositories|repos?|dao|daos|persistence)$/i, 'data'],
  [/^(entities|domain|models?)$/i, 'models'],
  [/^(usecases?|use_cases?|interactors?)$/i, 'services'],
  [/^(migrations?)$/i, 'data'],
  [/^(dto|dtos|contracts?|viewmodels?)$/i, 'types'],
  [/^(internal|pkg)$/i, 'shared'],
];

// A subdirectory with one of these names means the candidate owns product
// screens - a feature, not a bucket.
const PAGE_DIR_RE = /^(pages?|screens?|views?|scenes?|routes?|features?|modules?|flows?)$/i;

// Conventional code-root folder names, checked in this order of preference.
// Deliberately excludes Go's `cmd/ internal/ pkg/` - in a Go repo those are
// top-level *modules* and the code root is the repo root itself, which the
// fallback below already lands on.
const CODE_ROOT_NAMES = ['src', 'app', 'source', 'client', 'frontend', 'renderer', 'www', 'lib'];

// Conventional entry-file names, directly under a code root.
const ENTRY_RE =
  /^(main|index|app|bootstrap|entry|root|server)\.(jsx?|tsx?|mjs|cjs|go|rs|py)$|^(Program\.cs|__main__\.py|manage\.py|wsgi\.py|asgi\.py)$/i;

export function sharedKindOf(name) {
  for (const [re, kind] of SHARED_NAME_RULES) if (re.test(name)) return kind;
  return null;
}

/**
 * Weigh a candidate's signals and land on feature | shared | ambiguous.
 * Returns { guess, confidence (0-1), reasons: string[] }.
 */
function classify(c) {
  let feature = 0;
  let shared = 0;
  const reasons = [];

  if (c.nameKind) {
    shared += 3;
    reasons.push(`"${c.name}" is a conventional ${c.nameKind} folder`);
  }
  if (c.hasPageDir) {
    feature += 3;
    reasons.push(`has its own ${c.pageDir}/ directory`);
  }
  if (c.screenFilesHere > 0) {
    feature += 2;
    reasons.push(`${c.screenFilesHere} routed screen file(s) live here`);
  }
  if (c.nestedInfra >= 2 && !c.nameKind) {
    feature += 1;
    reasons.push(`mirrors app structure (${c.nestedInfraNames.slice(0, 3).join(', ')})`);
  }
  if (!c.nameKind && !c.hasPageDir && c.screenFilesHere === 0 && c.codeFileCount <= 4) {
    shared += 1;
    reasons.push(`only ${c.codeFileCount} code file(s), no screens`);
  }
  if (!c.nameKind && !c.hasPageDir && c.screenFilesHere === 0 && c.codeFileCount > 4) {
    reasons.push('no obvious signal either way');
  }

  let guess;
  let confidence;
  if (feature === 0 && shared === 0) {
    guess = 'ambiguous';
    confidence = 0;
  } else if (feature > shared) {
    guess = 'feature';
    confidence = Math.min(1, (feature - shared) / 4);
  } else if (shared > feature) {
    guess = 'shared';
    confidence = Math.min(1, (shared - feature) / 4);
  } else {
    guess = 'ambiguous';
    confidence = 0.15;
  }
  return { guess, confidence: Number(confidence.toFixed(2)), reasons };
}

const exists = (root, rel) => {
  try {
    return fs.existsSync(path.join(root, rel));
  } catch {
    return false;
  }
};

// App-boot files that a directory walk finds anywhere, not just at the code
// root: Go's `cmd/<name>/main.go`, a Rust bin, ASP.NET's `Program.cs`, a
// Django `manage.py`. Matched on the bare filename.
const DEEP_ENTRY_RE = /^(main\.go|main\.rs|Program\.cs|Startup\.cs|manage\.py|asgi\.py|wsgi\.py|__main__\.py)$/i;

/** Files that boot the app, relative to the repo root, sorted. */
export function findEntryPoints(root, codeRoot, looseFiles, allFiles = []) {
  const out = new Set();
  for (const f of allFiles) {
    if (DEEP_ENTRY_RE.test(f.split('/').pop())) out.add(f);
  }
  const pkg = readJsonc(path.join(root, 'package.json'));
  for (const key of ['main', 'module', 'source']) {
    const v = pkg && pkg[key];
    if (typeof v !== 'string') continue;
    const norm = v.replace(/^\.\//, '');
    if (exists(root, norm) && CODE_EXTENSIONS.includes(path.extname(norm))) out.add(norm);
  }
  for (const f of looseFiles) {
    if (ENTRY_RE.test(f.split('/').pop())) out.add(f);
  }
  const htmls = ['index.html', 'public/index.html'];
  if (codeRoot) htmls.push(`${codeRoot}/index.html`);
  for (const htmlRel of htmls) {
    let html;
    try {
      html = fs.readFileSync(path.join(root, htmlRel), 'utf8');
    } catch {
      continue;
    }
    const dir = path.posix.dirname(htmlRel);
    const re = /<script[^>]+src=["']([^"']+)["']/gi;
    let m;
    while ((m = re.exec(html))) {
      if (/^[a-z]+:\/\//i.test(m[1])) continue;
      const joined = path.posix.join(dir === '.' ? '' : dir, m[1].replace(/^\//, ''));
      const resolved = path.posix.normalize(joined).replace(/^(\.\.\/)+/, '');
      if (exists(root, resolved) && CODE_EXTENSIONS.includes(path.extname(resolved))) out.add(resolved);
    }
  }
  return [...out].sort();
}

/**
 * @param {string} root  absolute repo root
 * @param {{ ignore?: string[], routes?: object|null }} opts
 *        `routes` is birdseye/.cache/routes.json if it already exists - it
 *        sharpens the "does this folder own screens" signal, but is optional.
 */
export function analyzeStructure(root, { ignore = [], routes = null } = {}) {
  const files = walkFiles(root, { ignore: [...ignore], ignoreFiles: ['.gitignore', IGNORE_FILE] });
  const codeFiles = files.filter((f) => CODE_EXTENSIONS.includes(path.extname(f)));

  const dirAll = new Map();
  const dirCode = new Map();
  const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  for (const f of files) {
    const parts = f.split('/');
    for (let i = 1; i < parts.length; i++) bump(dirAll, parts.slice(0, i).join('/'));
  }
  for (const f of codeFiles) {
    const parts = f.split('/');
    for (let i = 1; i < parts.length; i++) bump(dirCode, parts.slice(0, i).join('/'));
  }
  const codeIn = (dir) => dirCode.get(dir) || 0;

  const childrenOf = (dir) => {
    const prefix = dir === '' ? '' : `${dir}/`;
    const depth = dir === '' ? 1 : dir.split('/').length + 1;
    const set = new Set();
    for (const d of dirAll.keys()) {
      if (dir !== '' && !d.startsWith(prefix)) continue;
      if (d.split('/').length !== depth) continue;
      set.add(d);
    }
    return [...set].sort();
  };

  // ---- code root(s) ----
  let codeRoots = [];
  for (const holder of ['packages', 'apps', 'libs', 'modules']) {
    if (!dirAll.has(holder)) continue;
    const kids = childrenOf(holder).filter((d) => exists(root, `${d}/package.json`));
    if (kids.length >= 2) codeRoots.push(...kids);
  }
  if (!codeRoots.length) {
    const named = CODE_ROOT_NAMES.filter((n) => codeIn(n) >= 3).sort((a, b) => codeIn(b) - codeIn(a));
    if (named.length) {
      codeRoots = [named[0]];
    } else {
      const top = childrenOf('').slice().sort((a, b) => codeIn(b) - codeIn(a));
      const best = top[0];
      if (best && codeIn(best) >= Math.max(5, codeFiles.length * 0.4)) codeRoots = [best];
      else codeRoots = ['']; // flat repo - modules are the repo-root folders
    }
  }

  const analyzeRoot = (codeRoot) => {
    const prefix = codeRoot === '' ? '' : `${codeRoot}/`;
    // A folder is a module candidate if it holds code, or if it holds files and
    // its name marks it as infrastructure (a `styles/` of pure CSS still counts).
    // Pure doc/config/ops folders - `docs/`, `k8s/`, `.github/` - are neither.
    const kids = childrenOf(codeRoot).filter((d) => {
      const name = d.split('/').pop();
      if (name.startsWith('.')) return false;
      return codeIn(d) > 0 || ((dirAll.get(d) || 0) > 0 && sharedKindOf(name));
    });
    const candidates = kids.map((dirPath) => {
      const name = dirPath.split('/').pop();
      const subs = childrenOf(dirPath).map((s) => s.split('/').pop()).sort();
      const pageDir = subs.find((s) => PAGE_DIR_RE.test(s)) || null;
      const nestedInfra = subs.filter((s) => sharedKindOf(s)).sort();
      let screenFilesHere = 0;
      if (routes && Array.isArray(routes.routes)) {
        screenFilesHere = routes.routes.filter(
          (r) => r.screenFile && r.screenFile.startsWith(`${dirPath}/`),
        ).length;
      }
      const base = {
        path: dirPath,
        name,
        codeFileCount: codeIn(dirPath),
        fileCount: dirAll.get(dirPath) || 0,
        subdirs: subs,
        pageDir,
        hasPageDir: !!pageDir,
        nestedInfra: nestedInfra.length,
        nestedInfraNames: nestedInfra,
        screenFilesHere,
        nameKind: sharedKindOf(name),
      };
      return { ...base, ...classify(base) };
    });

    const looseFiles = codeFiles
      .filter((f) => {
        if (codeRoot === '') return !f.includes('/');
        if (!f.startsWith(prefix)) return false;
        return !f.slice(prefix.length).includes('/');
      })
      .sort();

    return {
      codeRoot,
      entryPoints: findEntryPoints(root, codeRoot, looseFiles, files),
      looseFiles,
      candidates,
    };
  };

  const roots = codeRoots.map(analyzeRoot);
  return {
    repoRoot: root,
    totals: { files: files.length, codeFiles: codeFiles.length },
    codeRoots,
    roots,
    primary: roots.length === 1 ? roots[0] : null,
  };
}
