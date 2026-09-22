import { mkdir, copyFile, cp, readFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'manifest.webmanifest', 'sw.js', '.nojekyll']) await copyFile(file, `dist/${file}`);
await cp('assets', 'dist/assets', { recursive: true, filter: source => !source.endsWith('/.DS_Store') });
// Make a new cache name for each released asset set, with no external tooling.
const { createHash } = await import('node:crypto');
const hash = createHash('sha256');
for (const file of ['index.html', 'assets/styles.css', 'assets/js/app.js', 'assets/js/scoring.js', 'assets/js/keyboard.js', 'assets/js/players.js', 'assets/js/repository.js', 'manifest.webmanifest', 'assets/icon-192.png', 'assets/icon-512.png', 'sw.js']) hash.update(await readFile(file));
const { writeFile } = await import('node:fs/promises');
await writeFile('dist/sw.js', (await readFile('sw.js', 'utf8')).replace('keepscore-v1', `keepscore-${hash.digest('hex').slice(0,12)}`));
console.log('Built static app in dist/. Ready for GitHub Pages, including repository subpaths.');
