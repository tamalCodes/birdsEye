// Fortran. `use mymod` names a module declared by `module mymod` in some file.
// The language is case-insensitive, so both the declaration and the reference
// are folded before matching.

import { declarationIndex, namespaceResolver, filesWithExtensions } from './shared.mjs';

const EXTENSIONS = ['.f', '.f90', '.f95', '.f03', '.f08'];

export default {
  id: 'fortran',
  langs: ['fortran'],
  extensions: EXTENSIONS,
  detect: () => true,

  createResolver(root, { allFiles, declaresOf }) {
    const index = declarationIndex(declaresOf, filesWithExtensions(allFiles, EXTENSIONS));
    return namespaceResolver({ index, separator: '.' });
  },
};
