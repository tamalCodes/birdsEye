// C, C++ and Objective-C. `#include "local.h"` resolves against the including
// file's directory and then the usual header roots. `#include <system.h>`
// never resolves to a repo file, and is not meant to.

import { pathResolver, filesWithExtensions } from './shared.mjs';

const EXTENSIONS = ['.c', '.h', '.cc', '.cpp', '.cxx', '.hpp', '.m'];

export default {
  id: 'cfamily',
  langs: ['c', 'cpp', 'objc'],
  extensions: EXTENSIONS,
  detect: () => true,

  createResolver(root, { allFiles }) {
    const inner = pathResolver({
      files: new Set(filesWithExtensions(allFiles, EXTENSIONS)),
      extensions: EXTENSIONS,
      roots: ['', 'include', 'src', 'lib'],
    });
    return {
      resolve(spec, fromRel, kind) {
        if (kind === 'system') return { kind: 'external' };
        // A quoted include is relative to the includer first, then the roots -
        // which is what `relative` already means to the shared resolver.
        return inner.resolve(spec, fromRel, 'relative');
      },
    };
  },
};
