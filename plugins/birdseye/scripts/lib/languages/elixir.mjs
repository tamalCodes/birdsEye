// Elixir. `defmodule Foo.Bar` declares; `alias`/`import`/`use` reference.
//
// Imports name a namespace, not a file, so an edge points at every file that
// declares that namespace. Real files, coarser target - edges are `approx`.

import { declarationIndex, namespaceResolver, filesWithExtensions } from './shared.mjs';

const EXTENSIONS = ['.ex', '.exs'];

export default {
  id: 'elixir',
  langs: ['elixir'],
  extensions: EXTENSIONS,
  detect: () => true,

  createResolver(root, { allFiles, declaresOf }) {
    const index = declarationIndex(declaresOf, filesWithExtensions(allFiles, EXTENSIONS));
    return namespaceResolver({ index, separator: '.' });
  },
};
