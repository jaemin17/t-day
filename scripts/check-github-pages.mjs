import { existsSync, readFileSync } from 'node:fs';

function assertExists(file) {
  if (!existsSync(file)) {
    throw new Error(`${file} does not exist`);
  }
}

function assertIncludes(file, expected) {
  const content = readFileSync(file, 'utf8');
  if (!content.includes(expected)) {
    throw new Error(`${file} does not include ${expected}`);
  }
}

assertIncludes('dist/github-pages/index.html', 'T-Day 目标日');
assertIncludes('dist/github-pages/index.html', '项目上线');
assertIncludes('dist/github-pages/index.html', 'date-stamp-group');
assertIncludes('dist/github-pages/index.html', '/t-day/_next/');
assertExists('dist/github-pages/_next');
assertExists('dist/github-pages/.nojekyll');
assertIncludes('.github/workflows/pages.yml', 'actions/deploy-pages');
assertIncludes('.github/workflows/pages.yml', 'DEPLOY_TARGET: github-pages');
assertIncludes('.github/workflows/pages.yml', 'npm run prepare:github-pages');
assertIncludes('.github/workflows/pages.yml', 'path: dist/github-pages');

console.log('GitHub Pages build artifact check passed');
