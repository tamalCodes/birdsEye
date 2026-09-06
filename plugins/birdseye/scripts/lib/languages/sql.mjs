// SQL. A file's dependencies are the objects it names but does not create: a
// view selecting from a table defined in another migration, a foreign key
// referencing one. The extractor reports created objects as declarations and
// every other object reference as an import, both lower-cased because SQL
// identifiers are not case-sensitive.
//
// An object nothing in the repo creates - a system catalogue, a table made by
// hand or by another service - resolves to external and stays quiet.

import { declarationIndex, namespaceResolver, filesWithExtensions } from './shared.mjs';

const EXTENSIONS = ['.sql'];

export default {
  id: 'sql',
  langs: ['sql'],
  extensions: EXTENSIONS,
  detect: () => true,

  createResolver(root, { allFiles, declaresOf }) {
    const index = declarationIndex(declaresOf, filesWithExtensions(allFiles, EXTENSIONS));
    // `schema.table` falls back to `schema` the way a namespace does, which is
    // right: a file creating the schema is a genuine dependency of one using it.
    return namespaceResolver({ index, separator: '.' });
  },
};
