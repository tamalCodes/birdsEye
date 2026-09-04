// JavaScript / TypeScript. Wraps the original parse.mjs + resolve.mjs so the
// behaviour that shipped before the language registry is byte-for-byte the same.

import path from 'node:path';
import { extractSpecifiers } from '../parse.mjs';
import { createResolver } from '../resolve.mjs';

// The resolver probes these and only these - never `config.extensions`, so a
// `./thing` import is never resolved to `thing.go` in a mixed repo.
const JS_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

export default {
  id: 'javascript',
  extensions: JS_EXTENSIONS,

  // Extension presence in the repo is the only gate - any repo with these files
  // gets a JS import graph.
  detect: () => true,

  extractImports(src) {
    return extractSpecifiers(src).map((spec) => ({
      spec,
      kind: spec.startsWith('.') ? 'relative' : 'absolute',
    }));
  },

  createResolver(root) {
    const inner = createResolver(root, { extensions: JS_EXTENSIONS });
    return {
      resolve(spec, fromRel) {
        const hit = inner.resolve(spec, path.join(root, fromRel));
        if (hit.kind === 'file') {
          const rel = path.relative(root, hit.path).split(path.sep).join('/');
          return { kind: 'file', paths: [rel] };
        }
        return hit;
      },
    };
  },
};
