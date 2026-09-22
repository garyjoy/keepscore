import { mkdir, copyFile, cp, readFile, rm } from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';
import { getBuildVersion, stampVersion } from './version.js';
const build = getBuildVersion();
// Recreate generated output so removed source files cannot linger in a release.
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'manifest.webmanifest', 'sw.js', '.nojekyll']) await copyFile(file, `dist/${file}`);
await cp('assets', 'dist/assets', { recursive: true, filter: source => !source.endsWith('/.DS_Store') });
await writeFile('dist/index.html', stampVersion(await readFile('index.html', 'utf8'), build));
// Make a new cache name for each released asset set, with no external tooling.
const { createHash } = await import('node:crypto');
const hash = createHash('sha256');
for (const file of ['index.html', 'assets/styles.css', 'assets/js/app.js', 'assets/js/scoring.js', 'assets/js/navigation.js', 'assets/js/players.js', 'assets/js/repository.js', 'assets/js/releases.js', 'manifest.webmanifest', 'assets/icon-192.png', 'assets/icon-512.png', 'sw.js']) hash.update(await readFile(`dist/${file}`));
await writeFile('dist/sw.js', (await readFile('sw.js', 'utf8')).replace('keepscore-v1', `keepscore-${hash.digest('hex').slice(0,12)}`));
console.log('Built static app in dist/. Ready for GitHub Pages, including repository subpaths.');
console.log(`Version: ${build.version}${build.local ? ' (local changes)' : ''}`);
