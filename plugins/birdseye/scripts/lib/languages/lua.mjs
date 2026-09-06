// Lua. `require "a.b"` is a dotted module name, not a path, so the dots become
// slashes before the usual file probing.

import { pathResolver, filesWithExtensions } from './shared.mjs';

const EXTENSIONS = ['.lua'];

export default {
  id: 'lua',
  langs: ['lua'],
  extensions: EXTENSIONS,
  detect: () => true,

  createResolver(root, { allFiles }) {
    const inner = pathResolver({
      files: new Set(filesWithExtensions(allFiles, EXTENSIONS)),
      extensions: EXTENSIONS,
      roots: ['', 'lua', 'src', 'lib'],
      indexNames: ['init.lua'],
    });
    return {
      resolve(spec, fromRel, kind) {
        // `dofile "path/x.lua"` already is a path; only `require` is dotted.
        const asPath = spec.endsWith('.lua') ? spec : spec.split('.').join('/');
        return inner.resolve(asPath, fromRel, kind);
      },
    };
  },
};
