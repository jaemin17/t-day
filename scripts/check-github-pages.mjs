import { readFileSync } from 'node:fs';

function assertIncludes(file, expected) {
  const content = readFileSync(file, 'utf8');
  if (!content.includes(expected)) {
    throw new Error(`${file} does not include ${expected}`);
  }
}

assertIncludes('github-pages/index.html', 'T-Day');
assertIncludes('github-pages/index.html', 'localStorage');
assertIncludes('github-pages/index.html', '选择目标日期');
assertIncludes('github-pages/index.html', '添加待办');
assertIncludes('.github/workflows/pages.yml', 'actions/deploy-pages');

console.log('GitHub Pages static bundle check passed');
