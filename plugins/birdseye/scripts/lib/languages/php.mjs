// PHP. Two kinds of dependency: `use App\Models\User` names a namespace, and
// `require __DIR__ . "/x.php"` names a file. Namespace edges are approximate,
// include edges are exact.

import { pathResolver, declarationIndex, namespaceResolver, filesWithExtensions } from './shared.mjs';

const EXTENSIONS = ['.php'];

export default {
  id: 'php',
  langs: ['php'],
  extensions: EXTENSIONS,
  detect: () => true,

  createResolver(root, { allFiles, declaresOf }) {
    const files = filesWithExtensions(allFiles, EXTENSIONS);
    const byName = namespaceResolver({
      index: declarationIndex(declaresOf, files),
      separator: '\\',
    });
    const byPath = pathResolver({
      files: new Set(files),
      extensions: EXTENSIONS,
      roots: ['', 'src', 'app', 'lib'],
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
