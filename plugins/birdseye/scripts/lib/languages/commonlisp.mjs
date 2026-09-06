// Common Lisp. `(load "x.lisp")` is an exact file. `(require :other)` names a
// system, which only resolves if a file in the repo is named for it - anything
// else is a library from the implementation or from Quicklisp.

import { pathResolver, filesWithExtensions } from './shared.mjs';

const EXTENSIONS = ['.lisp', '.cl', '.lsp', '.asd'];

export default {
  id: 'commonlisp',
  langs: ['commonlisp'],
  extensions: EXTENSIONS,
  detect: () => true,

  createResolver(root, { allFiles }) {
    return pathResolver({
      files: new Set(filesWithExtensions(allFiles, EXTENSIONS)),
      extensions: EXTENSIONS,
      roots: ['', 'src', 'lib'],
    });
  },
};
