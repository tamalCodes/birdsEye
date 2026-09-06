// Pascal and Delphi. `uses UnitA, UnitB;` names units, and a unit declares its
// own name in its header. Identifiers are case-insensitive, so both sides are
// folded. Matching on the declared name rather than the filename means a unit
// whose file is named differently still resolves.

import { declarationIndex, namespaceResolver, filesWithExtensions } from './shared.mjs';

const EXTENSIONS = ['.pas', '.pp', '.dpr', '.dpk', '.lpr'];

export default {
  id: 'pascal',
  langs: ['pascal'],
  extensions: EXTENSIONS,
  detect: () => true,

  createResolver(root, { allFiles, declaresOf }) {
    const index = declarationIndex(declaresOf, filesWithExtensions(allFiles, EXTENSIONS));
    return namespaceResolver({ index, separator: '.' });
  },
};
