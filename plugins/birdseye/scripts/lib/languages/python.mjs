// Python. Dotted module names map to files under a source root (repo root or
// `src/`), relative imports (`from . import x`, `from ..pkg import y`) walk up
// from the importing file's package. Edges are exact files.

import path from 'node:path';

const dir = (rel) => path.posix.dirname(rel);
const join = (...p) => path.posix.join(...p).replace(/^\.\//, '');

// An unresolved absolute import (not on disk under any source root) is treated
// as external and kept quiet, matching the JS resolver's "unknown bare
// specifier is just noise" rule. Only failed *relative* imports are reported.

export default {
  id: 'python',
  langs: ['python'],
  extensions: ['.py'],
  detect: () => true,

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
