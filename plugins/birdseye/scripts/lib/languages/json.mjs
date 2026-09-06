// JSON, and only the `extends` chain of a tsconfig or jsconfig.
//
// A JSON file names no code, so almost every key in one would be an invented
// dependency. `extends` is the exception: it is a real link between two config
// files, and it is the same chain resolve.mjs already walks to work out what a
// path alias means. Which files get here at all is decided in ast.mjs - a
// lockfile is neither parsed nor drawn.

import { pathResolver, filesWithExtensions } from './shared.mjs';

const EXTENSIONS = ['.json'];

export default {
  id: 'json',
  langs: ['json'],
  extensions: EXTENSIONS,
  detect: () => true,

  createResolver(root, { allFiles }) {
    return pathResolver({
      files: new Set(filesWithExtensions(allFiles, EXTENSIONS)),
      extensions: EXTENSIONS,
      roots: [''],
    });
  },
};
