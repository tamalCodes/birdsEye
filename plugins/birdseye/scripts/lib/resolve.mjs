// Specifier resolution: tsconfig/jsconfig path aliases, package.json subpath
// imports, relative paths, extension and index probing.
//
// Getting this right is the difference between a correct graph and a wrong one,
// so the extends chain, baseUrl and wildcard `paths` are all honoured properly.

import fs from 'node:fs';
import path from 'node:path';
import { readJsonc } from './config.mjs';

const statCache = new Map();
function statOf(abs) {
  if (statCache.has(abs)) return statCache.get(abs);
  let st = null;
  try {
    st = fs.statSync(abs);
  } catch {
    st = null;
  }
  statCache.set(abs, st);
  return st;
}
const isFile = (abs) => statOf(abs)?.isFile() ?? false;
const isDirectory = (abs) => statOf(abs)?.isDirectory() ?? false;

/** Resolve a tsconfig `extends` entry to an absolute file path. */
function resolveExtends(spec, fromDir) {
  if (spec.startsWith('.') || path.isAbsolute(spec)) {
    const abs = path.resolve(fromDir, spec);
    if (isFile(abs)) return abs;
    if (isFile(`${abs}.json`)) return `${abs}.json`;
    if (isDirectory(abs) && isFile(path.join(abs, 'tsconfig.json'))) {
      return path.join(abs, 'tsconfig.json');
    }
    return null;
  }
  // Package specifier: walk node_modules upwards.
  let dir = fromDir;
  for (;;) {
    const candidate = path.join(dir, 'node_modules', spec);
    if (isFile(candidate)) return candidate;
    if (isFile(`${candidate}.json`)) return `${candidate}.json`;
    if (isDirectory(candidate)) {
      const pkg = readJsonc(path.join(candidate, 'package.json'));
      if (typeof pkg?.tsconfig === 'string') {
        const p = path.join(candidate, pkg.tsconfig);
        if (isFile(p)) return p;
      }
      const fallback = path.join(candidate, 'tsconfig.json');
      if (isFile(fallback)) return fallback;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Read a tsconfig/jsconfig and its `extends` ancestry, returning absolute
 * baseUrl and absolute-ised `paths` targets. Nearest config wins.
 */
function readTsConfig(absPath, seen = new Set()) {
  if (!absPath || seen.has(absPath)) return { baseUrl: null, paths: {} };
  seen.add(absPath);
  const json = readJsonc(absPath);
  if (!json) return { baseUrl: null, paths: {} };
  const dir = path.dirname(absPath);

  let inherited = { baseUrl: null, paths: {} };
  const ext = json.extends;
  const extList = Array.isArray(ext) ? ext : ext ? [ext] : [];
  for (const e of extList) {
    const target = resolveExtends(e, dir);
    const parent = readTsConfig(target, seen);
    inherited = { baseUrl: parent.baseUrl ?? inherited.baseUrl, paths: { ...inherited.paths, ...parent.paths } };
  }

  const co = json.compilerOptions ?? {};
  const baseUrl = co.baseUrl ? path.resolve(dir, co.baseUrl) : inherited.baseUrl;
  // `paths` targets are relative to baseUrl when set, otherwise to this config.
  const pathsBase = co.baseUrl ? path.resolve(dir, co.baseUrl) : dir;
  const paths = { ...inherited.paths };
  for (const [pattern, targets] of Object.entries(co.paths ?? {})) {
    paths[pattern] = (targets ?? []).map((t) => path.resolve(pathsBase, t));
  }
  return { baseUrl, paths };
}

/** Absolute-ise package.json `imports` (#subpath) entries. */
function readPackageImports(dir) {
  const pkg = readJsonc(path.join(dir, 'package.json'));
  const out = {};
  const flatten = (value) => {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
      for (const key of ['default', 'import', 'require', 'node']) {
        if (key in value) return flatten(value[key]);
      }
    }
    return null;
  };
  for (const [pattern, target] of Object.entries(pkg?.imports ?? {})) {
    const t = flatten(target);
    if (t) out[pattern] = [path.resolve(dir, t)];
  }
  return out;
}

function knownDependencies(dir) {
  const pkg = readJsonc(path.join(dir, 'package.json')) ?? {};
  return new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
    ...Object.keys(pkg.optionalDependencies ?? {}),
  ]);
}

const packageNameOf = (spec) => {
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
};

/**
 * Every ancestor directory of `fromDir`, nearest first, stopping at `root`.
 * A file outside the repo (which should not happen) yields just its own dir.
 */
function upwards(fromDir, root) {
  const out = [];
  let dir = fromDir;
  for (;;) {
    out.push(dir);
    if (dir === root) break;
    const parent = path.dirname(dir);
    if (parent === dir || !parent.startsWith(root)) break;
    dir = parent;
  }
  return out;
}

export function createResolver(root, { extensions }) {
  // Configuration is resolved per importing file, nearest first, which is what
  // TypeScript and Node both do. A repo whose real project lives in a
  // subdirectory - `site/`, `packages/web/`, an examples app - has its tsconfig
  // and its dependencies there, not at the repo root, so a single root-level
  // read would silently drop every aliased import in it.
  const contexts = new Map();

  const contextFor = (fromFileAbs) => {
    const fromDir = path.dirname(fromFileAbs);
    const cached = contexts.get(fromDir);
    if (cached) return cached;

    const chain = upwards(fromDir, root);
    const tsPath =
      chain
        .flatMap((dir) => ['tsconfig.json', 'jsconfig.json'].map((f) => path.join(dir, f)))
        .find((f) => isFile(f)) ?? null;
    const ts = readTsConfig(tsPath);

    const pkgDir = chain.find((dir) => isFile(path.join(dir, 'package.json'))) ?? root;
    const aliases = { ...ts.paths, ...readPackageImports(pkgDir) };
    const deps = knownDependencies(pkgDir);

    // Longest pattern prefix wins, matching TypeScript's own tie-break.
    const exact = [];
    const wildcard = [];
    for (const [pattern, targets] of Object.entries(aliases)) {
      if (pattern.includes('*')) {
        const [prefix, suffix = ''] = pattern.split('*');
        wildcard.push({ prefix, suffix, targets });
      } else {
        exact.push({ pattern, targets });
      }
    }
    wildcard.sort((a, b) => b.prefix.length - a.prefix.length);

    // node_modules is searched from the owning package upwards, the way Node
    // itself does, so a hoisted monorepo dependency still reads as external.
    const nodeModuleDirs = chain.map((dir) => path.join(dir, 'node_modules'));
    const ctx = { ts, exact, wildcard, deps, nodeModuleDirs, aliasCount: Object.keys(aliases).length };
    contexts.set(fromDir, ctx);
    return ctx;
  };

  const tryFile = (abs) => {
    if (isFile(abs) && extensions.includes(path.extname(abs))) return abs;
    for (const ext of extensions) if (isFile(abs + ext)) return abs + ext;
    for (const ext of extensions) {
      const idx = path.join(abs, `index${ext}`);
      if (isFile(idx)) return idx;
    }
    return null;
  };

  /** A path that exists but is not code (an asset, a stylesheet, JSON). */
  const isNonCodeFile = (abs) => isFile(abs) && !extensions.includes(path.extname(abs));

  const isExternal = (spec, ctx) => {
    const name = packageNameOf(spec);
    return ctx.deps.has(name) || ctx.nodeModuleDirs.some((d) => isDirectory(path.join(d, name)));
  };

  /**
   * @returns {{kind:'file', path:string} | {kind:'external'} | {kind:'asset'} | {kind:'unresolved'}}
   */
  const resolve = (spec, fromFileAbs) => {
    if (!spec || spec.startsWith('data:') || /^[a-z]+:\/\//i.test(spec)) return { kind: 'external' };
    if (spec.startsWith('node:')) return { kind: 'external' };

    if (spec.startsWith('.') || path.isAbsolute(spec)) {
      const abs = path.resolve(path.dirname(fromFileAbs), spec);
      const hit = tryFile(abs);
      if (hit) return { kind: 'file', path: hit };
      if (isNonCodeFile(abs)) return { kind: 'asset' };
      return { kind: 'unresolved' };
    }

    const ctx = contextFor(fromFileAbs);
    const candidates = [];
    for (const { pattern, targets } of ctx.exact) {
      if (spec === pattern) candidates.push(...targets);
    }
    for (const { prefix, suffix, targets } of ctx.wildcard) {
      if (spec.length < prefix.length + suffix.length) continue;
      if (!spec.startsWith(prefix) || !spec.endsWith(suffix)) continue;
      const star = spec.slice(prefix.length, spec.length - (suffix.length || 0));
      candidates.push(...targets.map((t) => t.replace('*', star)));
    }
    const aliasMatched = candidates.length > 0;
    if (ctx.ts.baseUrl) candidates.push(path.resolve(ctx.ts.baseUrl, spec));

    for (const abs of candidates) {
      const hit = tryFile(abs);
      if (hit) return { kind: 'file', path: hit };
    }
    if (candidates.some(isNonCodeFile)) return { kind: 'asset' };
    if (isExternal(spec, ctx)) return { kind: 'external' };
    // An alias that matched a configured pattern but resolved to nothing is a
    // real problem worth reporting; an unknown bare specifier is just noise.
    return aliasMatched ? { kind: 'unresolved' } : { kind: 'external' };
  };

  return { resolve };
}
