import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { getBuildVersion, stampVersion } from '../scripts/version.js';
import { loadedVersionMessage, watchForUpdate } from '../assets/js/releases.js';

test('version identifies the actual commit and complete history count', () => {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const build = getBuildVersion();
  assert.equal(build.version, `1.${git('rev-list', '--count', 'HEAD')}.${git('rev-parse', '--short=7', 'HEAD')}`);
  assert.equal(typeof build.local, 'boolean');
});

test('HTML stamping records release identity and distinguishes previews', () => {
  const html = '<meta name="app-version" content="development"><meta name="app-local" content="true">';
  assert.equal(stampVersion(html, { version: '1.12.abcdef0', local: false }), '<meta name="app-version" content="1.12.abcdef0"><meta name="app-local" content="false">');
  assert.ok(stampVersion(html, { version: '1.12.abcdef0', local: true }).includes('name="app-local" content="true"'));
});

test('loaded notices distinguish first visit, new release, and unchanged reload', () => {
  assert.equal(loadedVersionMessage('1.12.abcdef0', null), 'KeepScore version 1.12.abcdef0 loaded.');
  assert.equal(loadedVersionMessage('1.12.abcdef0', '1.12.abcdef0'), null);
  assert.equal(loadedVersionMessage('1.13.1234567', '1.12.abcdef0'), 'KeepScore updated to version 1.13.1234567.');
});

test('watching first installation adds listeners without forcing activation', () => {
  const events = [];
  const registration = { waiting: null, installing: { addEventListener: type => events.push(type) }, addEventListener: type => events.push(type) };
  watchForUpdate(registration);
  assert.deepEqual(events, ['statechange', 'updatefound']);
});
