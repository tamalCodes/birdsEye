// JavaScript / TypeScript, plus the single-file component formats whose script
// block is JS/TS: Vue, Svelte and Astro. Specifier resolution only - tsconfig
// path aliases, package.json subpath imports, extension and index probing all
// live in resolve.mjs, which this wraps.

import path from 'node:path';
import { createResolver } from '../resolve.mjs';

// The resolver probes these and only these - never `config.extensions`, so a
// `./thing` import is never resolved to `thing.go` in a mixed repo.
const JS_EXTENSIONS = [
  '.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs',
  // Probed as well as owned: `import Card from "./Card.vue"` has to land on
  // the component file, and a bare `./Card` should find it too.
  '.vue', '.svelte', '.astro',
  '.ets',
];

export default {
  id: 'javascript',
  langs: ['javascript', 'typescript', 'vue', 'svelte', 'astro'],
  extensions: JS_EXTENSIONS,

  // Extension presence in the repo is the only gate - any repo with these files
  // gets a JS import graph.
  detect: () => true,

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
