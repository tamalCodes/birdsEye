// Zig. `@import("x.zig")` is a path relative to the importing file;
// `@import("std")` and other bare names are the standard library or a build
// dependency.

import { pathResolver, filesWithExtensions } from './shared.mjs';

const EXTENSIONS = ['.zig'];

export default {
  id: 'zig',
  langs: ['zig'],
  extensions: EXTENSIONS,
  detect: () => true,

  createResolver(root, { allFiles }) {
    const inner = pathResolver({
      files: new Set(filesWithExtensions(allFiles, EXTENSIONS)),
      extensions: EXTENSIONS,
      roots: ['', 'src'],
    });
    return {
      resolve(spec, fromRel, kind) {
        if (!spec.endsWith('.zig')) return { kind: 'external' };
        return inner.resolve(spec, fromRel, kind);
      },
    };
  },
};
