import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const clientDir = 'dist/client';
const prefixedAssetsDir = join(clientDir, 't-day');
const pagesDir = 'dist/github-pages';

function assertExists(path) {
  if (!existsSync(path)) {
    throw new Error(`Expected ${path} to exist before preparing GitHub Pages artifact`);
  }
}

assertExists(join(clientDir, 'index.html'));
assertExists(prefixedAssetsDir);

rmSync(pagesDir, { recursive: true, force: true });
mkdirSync(pagesDir, { recursive: true });

for (const file of [
  'index.html',
  '404.html',
  'index.rsc',
  'favicon.svg',
  'vinext-client-entry-manifest.json',
  '_headers',
  '.assetsignore',
]) {
  const source = join(clientDir, file);
  if (existsSync(source)) {
    cpSync(source, join(pagesDir, file), { recursive: true });
  }
}

for (const entry of readdirSync(prefixedAssetsDir)) {
  cpSync(join(prefixedAssetsDir, entry), join(pagesDir, entry), { recursive: true });
}

writeFileSync(join(pagesDir, '.nojekyll'), '');

console.log(`GitHub Pages artifact prepared at ${pagesDir}`);
