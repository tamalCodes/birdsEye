// C# / .NET. `using` names a namespace, and namespaces are decoupled from file
// paths, so there is no exact file to resolve to without a compiler. Instead we
// scan every `.cs` file for its `namespace` declarations, build a
// namespace -> files index, and an import of a namespace draws an edge to every
// file that declares it. Real files, coarser target - the edges are tagged
// `approx`.

import { stripCLikeComments } from '../comments.mjs';

const NS_DECL_RE = /\bnamespace\s+([A-Za-z_][\w.]*)/g;
// `using X.Y;` / `global using X.Y;` / `using static X.Y.Z;` / `using A = X.Y;`
const USING_RE =
  /^\s*(?:global\s+)?using\s+(?:static\s+)?(?:[A-Za-z_]\w*\s*=\s*)?([A-Za-z_][\w.]*)\s*;/gm;

export default {
  id: 'csharp',
  extensions: ['.cs'],
  detect: () => true,

  extractImports(src) {
    const code = stripCLikeComments(src);
    const out = [];
    const seen = new Set();
    let m;
    USING_RE.lastIndex = 0;
    while ((m = USING_RE.exec(code))) {
      if (!seen.has(m[1])) {
        seen.add(m[1]);
        out.push({ spec: m[1], kind: 'namespace' });
      }
    }
    return out;
  },

  createResolver(root, { allFiles, readFile }) {
    const nsToFiles = new Map();
    for (const f of allFiles) {
      if (!f.endsWith('.cs')) continue;
      const code = stripCLikeComments(readFile(f) || '');
      let m;
      const re = new RegExp(NS_DECL_RE.source, 'g');
      while ((m = re.exec(code))) {
        if (!nsToFiles.has(m[1])) nsToFiles.set(m[1], new Set());
        nsToFiles.get(m[1]).add(f);
      }
    }

    return {
      resolve(spec, fromRel) {
        // Exact namespace, else the longest declared prefix (covers
        // `using static Some.Namespace.TypeName`).
        let ns = spec;
        while (ns && !nsToFiles.has(ns)) {
          const cut = ns.lastIndexOf('.');
          if (cut === -1) {
            ns = null;
            break;
          }
          ns = ns.slice(0, cut);
        }
        if (ns) {
          const paths = [...nsToFiles.get(ns)].filter((p) => p !== fromRel);
          return paths.length ? { kind: 'file', paths, approx: true } : { kind: 'external' };
        }
        // Not a namespace declared anywhere in the repo - System.*, a NuGet
        // package, or a namespace with no files of its own. All external.
        return { kind: 'external' };
      },
    };
  },
};
