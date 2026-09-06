// Ruby. `require_relative "x"` is exact; `require "x"` is looked up against the
// conventional load paths a Rails or gem layout puts on $LOAD_PATH.

import { pathResolver, filesWithExtensions } from './shared.mjs';

const EXTENSIONS = ['.rb'];

export default {
  id: 'ruby',
  langs: ['ruby'],
  extensions: EXTENSIONS,
  detect: () => true,

  createResolver(root, { allFiles }) {
    return pathResolver({
      files: new Set(filesWithExtensions(allFiles, EXTENSIONS)),
      extensions: EXTENSIONS,
      roots: ['', 'lib', 'app', 'src', 'app/models', 'app/controllers'],
    });
  },
};
