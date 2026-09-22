import { execFileSync } from 'node:child_process';

export function getBuildVersion() {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  if (git('rev-parse', '--is-shallow-repository') === 'true') {
    throw new Error('Versioning needs full Git history. Fetch with --unshallow or use checkout fetch-depth: 0.');
  }
  const count = git('rev-list', '--count', 'HEAD');
  const commit = git('rev-parse', '--short=7', 'HEAD');
  return { version: `1.${count}.${commit}`, local: Boolean(git('status', '--porcelain', '--untracked-files=normal')) };
}

export function stampVersion(html, build) {
  return html.replace('name="app-version" content="development"', `name="app-version" content="${build.version}"`)
    .replace('name="app-local" content="true"', `name="app-local" content="${build.local}"`);
}
