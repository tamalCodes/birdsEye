// OCaml. A module name is a file name: `open Core` reads core.ml, and a dotted
// path like `Other.Thing` names the submodule Thing inside other.ml, so only
// the first segment picks the file. Filenames are the module name with a
// lower-cased initial, which is a language rule rather than a convention.

import { pathResolver, filesWithExtensions } from './shared.mjs';

const EXTENSIONS = ['.ml', '.mli'];

export default {
  id: 'ocaml',
  langs: ['ocaml'],
  extensions: EXTENSIONS,
  detect: () => true,

  createResolver(root, { allFiles }) {
    const inner = pathResolver({
      files: new Set(filesWithExtensions(allFiles, EXTENSIONS)),
      extensions: EXTENSIONS,
      roots: ['', 'lib', 'src', 'bin'],
    });
    return {
      resolve(spec, fromRel) {
        const head = spec.split('.')[0];
        if (!head) return { kind: 'external' };
        const file = head.charAt(0).toLowerCase() + head.slice(1);
        return inner.resolve(file, fromRel, 'absolute');
      },
    };
  },
};
