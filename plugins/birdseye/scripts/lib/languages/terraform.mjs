// Terraform and HCL. Every `.tf` file in one directory is already a single
// module, so the only cross-file reference worth drawing is a module block
// pointing at another directory:
//
//   module "vpc" { source = "./modules/vpc" }
//
// That resolves to every `.tf` file in the target directory, which is exactly
// what Terraform loads. A registry or git source (`hashicorp/vpc/aws`) is a
// third-party module and stays external.

import path from 'node:path';
import { filesWithExtensions } from './shared.mjs';

const EXTENSIONS = ['.tf', '.tfvars', '.hcl'];

export default {
  id: 'terraform',
  langs: ['terraform'],
  extensions: EXTENSIONS,
  detect: () => true,

  createResolver(root, { allFiles }) {
    const byDir = new Map();
    for (const f of filesWithExtensions(allFiles, ['.tf'])) {
      const dir = f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '';
      if (!byDir.has(dir)) byDir.set(dir, []);
      byDir.get(dir).push(f);
    }

    return {
      resolve(spec, fromRel) {
        // Only a local path is ours. Registry ("ns/name/provider"), git and
        // any other protocol source is external by definition.
        if (!spec.startsWith('./') && !spec.startsWith('../')) return { kind: 'external' };
        const fromDir = fromRel.includes('/') ? fromRel.slice(0, fromRel.lastIndexOf('/')) : '';
        const target = path.posix
          .normalize(path.posix.join(fromDir, spec))
          .replace(/^(\.\.\/)+/, '')
          .replace(/\/$/, '');
        const files = byDir.get(target === '.' ? '' : target);
        if (!files || !files.length) return { kind: 'unresolved' };
        const paths = files.filter((f) => f !== fromRel);
        return paths.length ? { kind: 'file', paths } : { kind: 'external' };
      },
    };
  },
};
