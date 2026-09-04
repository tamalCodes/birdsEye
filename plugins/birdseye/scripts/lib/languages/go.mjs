// Go. Imports are package paths, not file paths, so an import edge points at
// every non-test `.go` file in the imported package directory - that is what a
// Go import actually pulls in, so package granularity here is exact, not a
// compromise.

import path from 'node:path';
import { stripCLikeComments } from '../comments.mjs';

const dir = (rel) => path.posix.dirname(rel);

export default {
  id: 'go',
  extensions: ['.go'],
  detect: () => true,

  extractImports(src) {
    const code = stripCLikeComments(src);
    const seen = new Set();
    const out = [];
    const add = (s) => {
      if (s && !seen.has(s)) {
        seen.add(s);
        out.push({ spec: s, kind: 'absolute' });
      }
    };
    // Grouped: import ( "a"; alias "b"; _ "c" )
    const block = code.match(/\bimport\s*\(([\s\S]*?)\)/);
    if (block) {
      for (const line of block[1].split('\n')) {
        const m = line.match(/"([^"]+)"/);
        if (m) add(m[1]);
      }
    }
    // Single: import "a"  /  import alias "a"
    const re = /\bimport\s+(?:[A-Za-z_.]+\s+)?"([^"]+)"/g;
    let m;
    while ((m = re.exec(code))) add(m[1]);
    return out;
  },

  createResolver(root, { allFiles, readFile }) {
    // Every go.mod dir -> its declared module path. Longest module path first so
    // a nested module wins over the repo-root one.
    const mods = [];
    for (const f of allFiles) {
      if (f !== 'go.mod' && !f.endsWith('/go.mod')) continue;
      const base = f === 'go.mod' ? '' : f.slice(0, -'/go.mod'.length);
      const m = (readFile(f) || '').match(/^\s*module\s+(\S+)/m);
      if (m) mods.push({ base, modPath: m[1] });
    }
    mods.sort((a, b) => b.modPath.length - a.modPath.length);

    const goByDir = new Map();
    for (const f of allFiles) {
      if (!f.endsWith('.go') || f.endsWith('_test.go')) continue;
      const d = dir(f);
      if (!goByDir.has(d)) goByDir.set(d, []);
      goByDir.get(d).push(f);
    }

    return {
      resolve(spec) {
        // Standard library: the first path segment has no dot.
        if (!spec.split('/')[0].includes('.')) return { kind: 'external' };
        for (const { base, modPath } of mods) {
          if (spec !== modPath && !spec.startsWith(`${modPath}/`)) continue;
          const sub = spec === modPath ? '' : spec.slice(modPath.length + 1);
          const pkgDir = [base, sub].filter(Boolean).join('/');
          const files = goByDir.get(pkgDir);
          if (files && files.length) return { kind: 'file', paths: files };
          return { kind: 'unresolved' };
        }
        return { kind: 'external' };
      },
    };
  },
};
