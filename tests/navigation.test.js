import test from 'node:test';
import assert from 'node:assert/strict';
import { createNavigation } from '../assets/js/navigation.js';

function fixture(hash = '') {
  const entries = [hash], handlers = {}, rendered = [];
  let index = 0;
  const browser = {
    location: { hash },
    addEventListener: (type, callback) => { handlers[type] = callback; },
    history: {
      replaceState: (_, __, value) => { entries[index] = browser.location.hash = value; },
      pushState: (_, __, value) => { entries.splice(index + 1); entries.push(value); index++; browser.location.hash = value; },
    },
  };
  const navigation = createNavigation(browser, () => rendered.push(browser.location.hash));
  const traverse = delta => {
    index += delta;
    browser.location.hash = entries[index];
    handlers.popstate();
    handlers.hashchange();
  };
  navigation.start();
  return { navigation, entries, rendered, traverse };
}

test('menu navigation adds entries and Back/Forward restore each view once', () => {
  const f = fixture();
  f.navigation.navigate('teams');
  f.navigation.navigate('players');
  assert.deepEqual(f.entries, ['#matches', '#teams', '#players']);
  f.traverse(-1); f.traverse(-1); f.traverse(1);
  assert.deepEqual(f.rendered, ['#matches', '#teams', '#players', '#teams', '#matches', '#teams']);
});

test('reselecting current view adds no history; navigation after Back replaces forward branch', () => {
  const f = fixture();
  f.navigation.navigate('matches');
  assert.equal(f.entries.length, 1);
  f.navigation.navigate('teams');
  f.navigation.navigate('players');
  f.traverse(-1);
  f.navigation.navigate('#match/example');
  assert.deepEqual(f.entries, ['#matches', '#teams', '#match/example']);
});

test('opening a match URL keeps the initial deep link', () => {
  const f = fixture('#match/example');
  assert.deepEqual(f.entries, ['#match/example']);
  f.navigation.navigate('matches');
  f.traverse(-1);
  assert.equal(f.rendered.at(-1), '#match/example');
});
