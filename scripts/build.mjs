// Builds dist/module (ESM), dist/commonjs (CJS) and dist/typescript (.d.ts) with plain tsc.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');

rmSync(join(root, 'dist'), { recursive: true, force: true });
for (const project of ['tsconfig.build.json', 'tsconfig.build.cjs.json']) {
  execFileSync(process.execPath, [tsc, '-p', join(root, project)], { stdio: 'inherit' });
}
for (const [dir, type] of [
  ['module', 'module'],
  ['commonjs', 'commonjs'],
]) {
  mkdirSync(join(root, 'dist', dir), { recursive: true });
  writeFileSync(join(root, 'dist', dir, 'package.json'), `${JSON.stringify({ type })}\n`);
}
