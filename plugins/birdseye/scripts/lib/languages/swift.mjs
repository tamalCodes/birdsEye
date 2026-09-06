// Swift. `import Foo` names a module, which in a single repo is usually an external package - most edges here resolve to external, and that is correct.
//
// Imports name a namespace, not a file, so an edge points at every file that
// declares that namespace. Real files, coarser target - edges are `approx`.

import { declarationIndex, namespaceResolver, filesWithExtensions } from './shared.mjs';

const EXTENSIONS = ['.swift'];

export default {
  id: 'swift',
  langs: ['swift'],
  extensions: EXTENSIONS,
  detect: () => true,

  createResolver(root, { allFiles, declaresOf }) {
    const index = declarationIndex(declaresOf, filesWithExtensions(allFiles, EXTENSIONS));
    return namespaceResolver({ index, separator: '.' });
  },
};
