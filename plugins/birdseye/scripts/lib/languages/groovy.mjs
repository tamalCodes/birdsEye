// Groovy and Gradle. Two kinds of dependency: `import a.b.C` names a package,
// and Gradle's `apply from: "other.gradle"` names a build file. Package edges
// are approximate, apply-from edges are exact.

import {
  pathResolver, declarationIndex, namespaceResolver, filesWithExtensions,
} from './shared.mjs';

const EXTENSIONS = ['.groovy', '.gradle'];

export default {
  id: 'groovy',
  langs: ['groovy'],
  extensions: EXTENSIONS,
  detect: () => true,

  createResolver(root, { allFiles, declaresOf }) {
    const files = filesWithExtensions(allFiles, EXTENSIONS);
    const byName = namespaceResolver({
      index: declarationIndex(declaresOf, files),
      separator: '.',
    });
    const byPath = pathResolver({
      files: new Set(files),
      extensions: EXTENSIONS,
      roots: ['', 'gradle', 'buildSrc/src/main/groovy'],
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
