// Shell. `source x.sh` and `. x.sh` pull another script into the current one,
// which is a real dependency and the only one a shell script declares.

import { pathResolver, filesWithExtensions } from './shared.mjs';

const EXTENSIONS = ['.sh', '.bash'];

export default {
  id: 'bash',
  langs: ['bash'],
  extensions: EXTENSIONS,
  detect: () => true,

  createResolver(root, { allFiles }) {
    return pathResolver({
      files: new Set(filesWithExtensions(allFiles, EXTENSIONS)),
      extensions: EXTENSIONS,
      roots: ['', 'scripts', 'bin', 'lib'],
    });
  },
};
