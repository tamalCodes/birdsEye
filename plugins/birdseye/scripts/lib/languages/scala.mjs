// Scala. Package clauses declare, imports reference.
//
// Imports name a namespace, not a file, so an edge points at every file that
// declares that namespace. Real files, coarser target - edges are `approx`.

import { declarationIndex, namespaceResolver, filesWithExtensions } from './shared.mjs';

const EXTENSIONS = ['.scala'];

export default {
  id: 'scala',
  langs: ['scala'],
  extensions: EXTENSIONS,
  detect: () => true,

  createResolver(root, { allFiles, declaresOf }) {
    const index = declarationIndex(declaresOf, filesWithExtensions(allFiles, EXTENSIONS));
    return namespaceResolver({ index, separator: '.' });
  },
};
