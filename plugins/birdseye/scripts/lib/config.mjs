// Loading, inference and persistence of the repo config file.

import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_FILE, OUT_DIR, CACHE_DIR } from './const.mjs';

/** JSON with comments and trailing commas - what tsconfig.json actually is. */
export function parseJsonc(text) {
  let out = '';
  let inString = false;
  let quote = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inString) {
      out += c;
      if (c === '\\') {
        out += next ?? '';
        i++;
      } else if (c === quote) {
        inString = false;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      quote = c;
      out += c;
      continue;
    }
    if (c === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i++;
      continue;
    }
    out += c;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

export function readJsonc(absPath) {
  try {
    return parseJsonc(fs.readFileSync(absPath, 'utf8'));
  } catch {
    return null;
  }
}

export const DEFAULT_IGNORE = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  'coverage',
  'android',
  'ios',
  '.next',
  '.expo',
  '.turbo',
  '.cache',
  'vendor',
  'graphify-out',
  OUT_DIR,
];

// Every extension birdsEye can parse an import graph for. Keep in sync with the
// language modules in scripts/lib/languages/ (kept as a literal here to avoid an
// import cycle - config <- resolve <- languages/javascript <- config).
export const DEFAULT_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.cs',
];

export const DEFAULT_DOC_GLOBS = [
  '**/MAP.md',
  '**/AGENTS.md',
  '**/CLAUDE.md',
  '**/specs/*.md',
  '**/reference/*.md',
  'docs/**/*.md',
  '**/README.md',
];

const isDir = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

const subdirs = (abs, rel) => {
  try {
    return fs
      .readdirSync(abs, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !DEFAULT_IGNORE.includes(e.name))
      .map((e) => (rel ? `${rel}/${e.name}` : e.name))
      .sort();
  } catch {
    return [];
  }
};

/**
 * Infer module roots.
 *   1. `src/features/*` exists -> those, plus the other immediate children of src/
 *   2. `src/` exists           -> its immediate children
 *   3. otherwise               -> repo-root subdirectories
 * No framework knowledge here - only directory shape.
 */
export function inferModuleRoots(root) {
  const src = path.join(root, 'src');
  if (isDir(path.join(src, 'features'))) {
    const rest = subdirs(src, 'src').filter((d) => d !== 'src/features');
    return ['src/features/*', ...rest];
  }
  if (isDir(src)) {
    const children = subdirs(src, 'src');
    return children.length ? children : ['src'];
  }
  return subdirs(root, '');
}

export function inferConfig(root) {
  const pkg = readJsonc(path.join(root, 'package.json'));
  return {
    name: pkg?.name || path.basename(root),
    moduleRoots: inferModuleRoots(root),
    ignore: DEFAULT_IGNORE,
    extensions: DEFAULT_EXTENSIONS,
    docGlobs: DEFAULT_DOC_GLOBS,
    editor: 'vscode',
  };
}

/** Load the committed config, filling any missing key from inference. */
export function loadConfig(root) {
  const inferred = inferConfig(root);
  const stored = readJsonc(path.join(root, CONFIG_FILE));
  if (!stored) return { config: inferred, existed: false };
  return { config: { ...inferred, ...stored }, existed: true };
}

export function writeConfig(root, config) {
  fs.writeFileSync(path.join(root, CONFIG_FILE), `${JSON.stringify(config, null, 2)}\n`);
}

/**
 * Expand `moduleRoots` (which may contain a single trailing `*`) into concrete
 * modules, ordered longest-path-first so that assignment is unambiguous.
 */
export function resolveModules(root, moduleRoots) {
  const seen = new Map();
  const add = (rel) => {
    if (!isDir(path.join(root, rel))) return;
    let slug = path.basename(rel);
    if (seen.has(slug) && seen.get(slug) !== rel) slug = rel.split('/').slice(-2).join('-');
    if (seen.has(slug)) return;
    seen.set(slug, rel);
  };
  for (const pattern of moduleRoots) {
    if (pattern.endsWith('/*')) {
      const base = pattern.slice(0, -2);
      for (const child of subdirs(path.join(root, base), base)) add(child);
    } else {
      add(pattern);
    }
  }
  return [...seen.entries()]
    .map(([slug, rel]) => ({ slug, path: rel }))
    .sort((a, b) => b.path.length - a.path.length || (a.slug < b.slug ? -1 : 1));
}

/** Owning module for a repo-relative file path, or null. */
export function moduleOf(relPath, modules) {
  for (const m of modules) {
    if (relPath === m.path || relPath.startsWith(`${m.path}/`)) return m.slug;
  }
  return null;
}

/**
 * The folder taxonomy the `extract-structure` skill wrote, or null. This is the
 * new front door: when it exists, it - not `moduleRoots` - decides what the
 * modules are and which of them are shared infrastructure.
 */
export function loadStructure(root) {
  const s = readJsonc(path.join(root, CACHE_DIR, 'structure.json'));
  if (!s || !Array.isArray(s.featureModules) || !Array.isArray(s.sharedModules)) return null;
  return s;
}

/**
 * Modules with their kind attached. From `structure.json` when it exists,
 * otherwise from `moduleRoots` with every module treated as a feature - which
 * is exactly the old behaviour, so a repo mapped before the taxonomy pass
 * existed is unaffected until it is re-mapped.
 *
 * @returns {{ modules: Array<{slug,path,kind,sharedKind}>, structure: object|null }}
 */
export function resolveModulesTagged(root, config) {
  const structure = loadStructure(root);
  if (structure) {
    const raw = [
      ...structure.featureModules.map((m) => ({ slug: m.slug, path: m.path, kind: 'feature', sharedKind: null })),
      ...structure.sharedModules.map((m) => ({
        slug: m.slug,
        path: m.path,
        kind: 'shared',
        sharedKind: m.kind ?? null,
      })),
    ];
    const seen = new Map();
    for (const m of raw) {
      if (!isDir(path.join(root, m.path))) continue;
      if (seen.has(m.slug)) continue;
      seen.set(m.slug, m);
    }
    const modules = [...seen.values()].sort(
      (a, b) => b.path.length - a.path.length || (a.slug < b.slug ? -1 : 1),
    );
    return { modules, structure };
  }
  const modules = resolveModules(root, config.moduleRoots).map((m) => ({
    ...m,
    kind: 'feature',
    sharedKind: null,
  }));
  return { modules, structure: null };
}
