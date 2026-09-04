// Rust. Two edge sources:
//
//   1. `mod foo;` declarations - resolved to `foo.rs` / `foo/mod.rs` relative to
//      the declaring file's module directory. Exact file->file edges, and they
//      build the module tree everything else reads.
//   2. `use` paths - resolved against that module tree to the file owning the
//      referenced module. The exact symbol inside that file is not tracked, so
//      these edges are tagged `approx`.
//
// `std`/`core`/`alloc` and external crates resolve to `external`.

import path from 'node:path';
import { stripCLikeComments } from '../comments.mjs';

const dir = (rel) => path.posix.dirname(rel);
const stem = (rel) => path.posix.basename(rel).replace(/\.rs$/, '');
const MOD_RE = /\b(?:pub\s*(?:\([^)]*\)\s*)?)?mod\s+([A-Za-z_]\w*)\s*;/g;
const USE_RE = /\b(?:pub\s*(?:\([^)]*\)\s*)?)?use\s+([^;]+);/g;

/** Flatten `use a::b::{c, d::e, self};` into `['a::b::c','a::b::d::e','a::b']`. */
function expandUse(raw) {
  const s = raw.trim();
  const out = [];
  const clean = (p) =>
    p
      .replace(/\s+as\s+\w+/g, '')
      .replace(/::\s*\*$/, '')
      .replace(/\s/g, '')
      .replace(/::$/, '');
  const brace = s.indexOf('{');
  if (brace === -1) {
    const c = clean(s);
    if (c) out.push(c);
    return out;
  }
  const base = s.slice(0, brace).replace(/\s/g, '');
  const inner = s.slice(brace + 1, s.lastIndexOf('}'));
  if (inner.includes('{')) {
    const c = clean(base);
    if (c) out.push(c);
    return out;
  }
  for (const item of inner.split(',')) {
    const it = item.trim();
    if (!it) continue;
    if (it === 'self' || it === '*') {
      const c = clean(base);
      if (c) out.push(c);
      continue;
    }
    const c = clean(base + it);
    if (c) out.push(c);
  }
  return out;
}

export default {
  id: 'rust',
  extensions: ['.rs'],
  detect: () => true,

  extractImports(src) {
    const code = stripCLikeComments(src);
    const out = [];
    const seen = new Set();
    const add = (spec, kind) => {
      const k = `${kind} ${spec}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push({ spec, kind });
      }
    };
    let m;
    MOD_RE.lastIndex = 0;
    while ((m = MOD_RE.exec(code))) add(`mod ${m[1]}`, 'relative');
    USE_RE.lastIndex = 0;
    while ((m = USE_RE.exec(code))) for (const p of expandUse(m[1])) add(p, 'namespace');
    return out;
  },

  createResolver(root, { allFiles, readFile }) {
    const rsSet = new Set(allFiles.filter((f) => f.endsWith('.rs')));

    const crateRoots = [];
    const addRoot = (p) => {
      if (rsSet.has(p) && !crateRoots.includes(p)) crateRoots.push(p);
    };
    for (const f of allFiles) {
      if (f !== 'Cargo.toml' && !f.endsWith('/Cargo.toml')) continue;
      const base = f === 'Cargo.toml' ? '' : f.slice(0, -'/Cargo.toml'.length);
      const pre = base ? `${base}/` : '';
      addRoot(`${pre}src/lib.rs`);
      addRoot(`${pre}src/main.rs`);
      for (const p of rsSet) if (dir(p) === `${pre}src/bin`) addRoot(p);
    }
    if (!crateRoots.length) {
      addRoot('src/lib.rs');
      addRoot('src/main.rs');
    }

    const childDirOf = (file) => {
      const s = stem(file);
      const d = dir(file) === '.' ? '' : dir(file);
      if (s === 'lib' || s === 'main' || s === 'mod') return d;
      return d ? `${d}/${s}` : s;
    };
    const modChild = (file, name) => {
      const cd = childDirOf(file);
      const a = cd ? `${cd}/${name}.rs` : `${name}.rs`;
      const b = cd ? `${cd}/${name}/mod.rs` : `${name}/mod.rs`;
      if (rsSet.has(a)) return a;
      if (rsSet.has(b)) return b;
      return null;
    };
    const modsIn = (file) => {
      const code = stripCLikeComments(readFile(file) || '');
      const names = [];
      let m;
      const re = new RegExp(MOD_RE.source, 'g');
      while ((m = re.exec(code))) names.push(m[1]);
      return names;
    };

    const pathToFile = new Map();
    const fileToPath = new Map();
    const queue = crateRoots.map((f) => ({ file: f, modPath: 'crate' }));
    const visited = new Set();
    while (queue.length) {
      const { file, modPath } = queue.shift();
      if (visited.has(file)) continue;
      visited.add(file);
      if (!pathToFile.has(modPath)) pathToFile.set(modPath, file);
      if (!fileToPath.has(file)) fileToPath.set(file, modPath);
      for (const name of modsIn(file)) {
        const child = modChild(file, name);
        if (child) queue.push({ file: child, modPath: `${modPath}::${name}` });
      }
    }

    const lookup = (candidate) => {
      let c = candidate;
      while (c) {
        if (pathToFile.has(c)) return pathToFile.get(c);
        const parts = c.split('::');
        if (parts.length <= 1) return null;
        c = parts.slice(0, -1).join('::');
      }
      return null;
    };

    return {
      resolve(spec, fromRel) {
        if (spec.startsWith('mod ')) {
          const child = modChild(fromRel, spec.slice(4));
          return child ? { kind: 'file', paths: [child] } : { kind: 'unresolved' };
        }
        let segs = spec.split('::').filter(Boolean);
        if (!segs.length) return { kind: 'external' };
        const head = segs[0];
        let basePath;
        if (head === 'crate') {
          basePath = 'crate';
          segs = segs.slice(1);
        } else if (head === 'self') {
          basePath = fileToPath.get(fromRel);
          segs = segs.slice(1);
        } else if (head === 'super') {
          basePath = fileToPath.get(fromRel);
          while (segs[0] === 'super' && basePath) {
            basePath = basePath.split('::').slice(0, -1).join('::');
            segs = segs.slice(1);
          }
          if (!basePath) basePath = 'crate';
        } else {
          // `std`/`core`/`alloc` or an external crate from Cargo.toml.
          return { kind: 'external' };
        }
        if (!basePath) return { kind: 'unresolved' };
        const file = lookup([basePath, ...segs].join('::'));
        if (!file || file === fromRel) return file ? { kind: 'external' } : { kind: 'unresolved' };
        return { kind: 'file', paths: [file], approx: true };
      },
    };
  },
};
