import { readFileSync } from 'node:fs';

function assertIncludes(file, expected) {
  const content = readFileSync(file, 'utf8');
  if (!content.includes(expected)) {
    throw new Error(`${file} does not include ${expected}`);
  }
}

assertIncludes('dist/client/index.html', 'T-Day 目标日');
assertIncludes('dist/client/index.html', '项目上线');
assertIncludes('dist/client/index.html', 'date-stamp-group');
assertIncludes('dist/client/index.html', '/t-day/_next/');
assertIncludes('.github/workflows/pages.yml', 'actions/deploy-pages');
assertIncludes('.github/workflows/pages.yml', 'DEPLOY_TARGET: github-pages');
assertIncludes('.github/workflows/pages.yml', 'path: dist/client');

console.log('GitHub Pages build artifact check passed');
