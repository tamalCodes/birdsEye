// Perl. `use Foo::Bar` maps the package to Foo/Bar.pm under one of the usual
// library roots, which is exactly how @INC finds it. `require "x.pl"` is
// already a path. A package declared in the repo wins over the path guess,
// because a .pm file need not be named for the package it declares.

import {
  pathResolver, declarationIndex, namespaceResolver, filesWithExtensions,
} from './shared.mjs';

const EXTENSIONS = ['.pl', '.pm'];

export default {
  id: 'perl',
  langs: ['perl'],
  extensions: EXTENSIONS,
  detect: () => true,

  createResolver(root, { allFiles, declaresOf }) {
    const files = filesWithExtensions(allFiles, EXTENSIONS);
    const byName = namespaceResolver({
      index: declarationIndex(declaresOf, files),
      separator: '::',
    });
    const byPath = pathResolver({
      files: new Set(files),
      extensions: EXTENSIONS,
      roots: ['', 'lib', 'local/lib/perl5', 't/lib'],
    });
    return {
      resolve(spec, fromRel, kind) {
        if (kind === 'relative') return byPath.resolve(spec, fromRel, kind);
        const declared = byName.resolve(spec, fromRel, kind);
        if (declared.kind === 'file') return declared;
        return byPath.resolve(spec.split('::').join('/'), fromRel, 'absolute');
      },
    };
  },
};
