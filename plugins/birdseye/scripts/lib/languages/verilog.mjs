// Verilog and SystemVerilog. The only textual dependency is `\`include "x.vh"`,
// which is a preprocessor path much like C's. Module instantiation binds by
// name at elaboration rather than by file, so it is left alone: the name is
// resolvable, but drawing every instantiation would bury the include graph.

import { pathResolver, filesWithExtensions } from './shared.mjs';

const EXTENSIONS = ['.v', '.sv', '.svh', '.vh'];

export default {
  id: 'verilog',
  langs: ['verilog'],
  extensions: EXTENSIONS,
  detect: () => true,

  createResolver(root, { allFiles }) {
    return pathResolver({
      files: new Set(filesWithExtensions(allFiles, EXTENSIONS)),
      extensions: EXTENSIONS,
      roots: ['', 'include', 'rtl', 'src'],
    });
  },
};
