// Julia. `include("x.jl")` is an exact file; `using Foo` names a package, which
// in a single repo is nearly always external.

import { pathResolver, declarationIndex, namespaceResolver, filesWithExtensions } from './shared.mjs';

const EXTENSIONS = ['.jl'];

export default {
  id: 'julia',
  langs: ['julia'],
  extensions: EXTENSIONS,
  detect: () => true,

  createResolver(root, { allFiles, declaresOf }) {
    const files = filesWithExtensions(allFiles, EXTENSIONS);
    const byPath = pathResolver({
      files: new Set(files),
      extensions: EXTENSIONS,
      roots: ['', 'src'],
    });
    const byName = namespaceResolver({
      index: declarationIndex(declaresOf, files),
      separator: '.',
    });
    return {
      resolve(spec, fromRel, kind) {
        return kind === 'relative'
          ? byPath.resolve(spec, fromRel, kind)
          : byName.resolve(spec, fromRel, kind);
      },
    };
  },
};
