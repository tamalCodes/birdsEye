// Python. Dotted module names map to files under a source root (repo root or
// `src/`), relative imports (`from . import x`, `from ..pkg import y`) walk up
// from the importing file's package. Edges are exact files.

import path from 'node:path';
import { stripHashComments } from '../comments.mjs';

const dir = (rel) => path.posix.dirname(rel);
const join = (...p) => path.posix.join(...p).replace(/^\.\//, '');

// An unresolved absolute import (not on disk under any source root) is treated
// as external and kept quiet, matching the JS resolver's "unknown bare
// specifier is just noise" rule. Only failed *relative* imports are reported.

export default {
  id: 'python',
  extensions: ['.py'],
  detect: () => true,

  extractImports(src) {
    const code = stripHashComments(src).replace(/\\\n/g, ' ');
    const out = [];
    const seen = new Set();
    // `weak` = a `from X import name` candidate where `name` might be a
    // submodule or might just be a symbol. If it does not resolve to a file it
    // is a symbol, not a broken import - never reported as unresolved.
    const add = (spec, weak) => {
      if (spec && !seen.has(spec)) {
        seen.add(spec);
        const kind = weak ? 'weak' : spec.startsWith('.') ? 'relative' : 'absolute';
        out.push({ spec, kind });
      }
    };

    for (const raw of code.split('\n')) {
      const line = raw.trim();
      let m = line.match(/^import\s+(.+)$/);
      if (m) {
        for (const part of m[1].split(',')) {
          const name = part.trim().split(/\s+as\s+/)[0].trim();
          if (/^[\w.]+$/.test(name)) add(name);
        }
        continue;
      }
      m = line.match(/^from\s+(\.*[\w.]*)\s+import\s+(.+)$/);
      if (m) {
        const base = m[1];
        add(base);
        const tail = m[2].replace(/[()]/g, '');
        for (const part of tail.split(',')) {
          const name = part.trim().split(/\s+as\s+/)[0].trim();
          if (name && name !== '*' && /^\w+$/.test(name)) {
            add(base.endsWith('.') || base === '' ? `${base}${name}` : `${base}.${name}`, true);
          }
        }
      }
    }
    return out;
  },

  createResolver(root, { allFiles }) {
    const pySet = new Set(allFiles.filter((f) => f.endsWith('.py')));
    const roots = ['', 'src'].filter(
      (r) => r === '' || allFiles.some((f) => f.startsWith(`${r}/`)),
    );
    const has = (p) => pySet.has(p);
    const asModule = (base) => {
      if (has(`${base}.py`)) return `${base}.py`;
      if (has(`${base}/__init__.py`)) return `${base}/__init__.py`;
      return null;
    };

    return {
      resolve(spec, fromRel, kind) {
        const miss = kind === 'weak' || !spec.startsWith('.') ? 'external' : 'unresolved';
        if (spec.startsWith('.')) {
          const dots = spec.match(/^\.+/)[0].length;
          const rest = spec.slice(dots);
          let baseDir = dir(fromRel);
          for (let i = 1; i < dots; i++) baseDir = dir(baseDir);
          if (baseDir === '.') baseDir = '';
          const target = rest ? join(baseDir, rest.split('.').join('/')) : baseDir;
          const hit = rest ? asModule(target) : has(`${baseDir}/__init__.py`) ? `${baseDir}/__init__.py` : null;
          return hit ? { kind: 'file', paths: [hit] } : { kind: miss };
        }
        const parts = spec.split('.');
        for (const r of roots) {
          const hit = asModule(join(r, parts.join('/')));
          if (hit) return { kind: 'file', paths: [hit] };
        }
        return { kind: 'external' };
      },
    };
  },
};
