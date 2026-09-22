import test from 'node:test';
import assert from 'node:assert/strict';
import { playerSuggestions, teamSuggestions } from '../assets/js/players.js';

const players = [
  { name: 'Gary Joy', teamId: 'home' },
  { name: 'Joe Collier', teamId: 'home' },
  { name: 'Jo Smith', teamId: 'home' },
  { name: 'Former Player', teamId: 'home', archived: true },
  { name: 'Visitor', teamId: 'away' },
];
const team = { teamId: 'home', pairs: [[{ name: 'Gary Joy' }, { name: '' }], [{ name: '' }, { name: '' }], [{ name: '' }, { name: '' }]] };

test('only available players from the selected team are suggested', () => {
  assert.deepEqual(playerSuggestions(players, team, 0, 1, '').map(p => p.name), ['Jo Smith', 'Joe Collier']);
});

test('current player remains available when editing their own field', () => {
  assert.equal(playerSuggestions(players, team, 0, 0, 'gary')[0].name, 'Gary Joy');
});

test('search ignores case and outside spaces, ranks prefixes first and permits new names', () => {
  assert.deepEqual(playerSuggestions(players, team, 0, 0, ' JO ').map(p => p.name), ['Jo Smith', 'Joe Collier', 'Gary Joy']);
  assert.deepEqual(playerSuggestions(players, team, 0, 1, 'New Player'), []);
});

// Exercise the real picker handlers, including focusout before touch release.
import { attachNamePicker } from '../assets/js/players.js';
function picker(t, type = 'player') {
  const handlers = {};
  class Element {
    constructor() { this.children = []; this.dataset = {}; this.attrs = {}; this.scrollTop = 0; }
    setAttribute(k, v) { this.attrs[k] = v; }
    removeAttribute(k) { delete this.attrs[k]; }
    append(child) { child.parentElement = this; this.children.push(child); }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(c => c !== this); }
    contains(el) { return this.children.includes(el); }
    closest() { return this.attrs.role === 'option' ? this : null; }
    matches() { return this === field; }
    dispatchEvent(e) { emit(e.type, { target: this }); }
  }
  const parent = new Element(), field = new Element();
  field.dataset = type === 'team' ? { team: 'home' } : { player: 'home', pair: '0', slot: '1' };
  field.value = '';
  parent.append(field);
  const oldDocument = globalThis.document, oldWindow = globalThis.window;
  globalThis.document = { createElement: () => new Element() };
  globalThis.window = { addEventListener() {} };
  t.after(() => { globalThis.document = oldDocument; globalThis.window = oldWindow; });
  function emit(type, props = {}) {
    const event = { target: field, pointerId: 1, pointerType: 'touch', clientX: 30, clientY: 30, preventDefault() { this.prevented = true; }, ...props };
    handlers[type]?.(event);
    return event;
  }
  attachNamePicker({ addEventListener: (type, fn) => { handlers[type] = fn; } }, () => [{ name: type === 'team' ? 'Team One' : 'Joe Collier' }]);
  emit('focusin');
  return { field, parent, emit, list: parent.children[1], option: parent.children[1].children[0] };
}

test('touch selects on release after blur, without requiring a synthetic click', t => {
  const p = picker(t);
  assert.equal(p.emit('pointerdown', { target: p.option }).prevented, true);
  p.emit('focusout');
  assert.equal(p.parent.children.includes(p.list), true);
  p.emit('pointerup', { target: p.option });
  assert.equal(p.field.value, 'Joe Collier');
  assert.equal(p.field.attrs['aria-expanded'], 'false');
  assert.equal(p.parent.children.length, 1);
  p.emit('click', { target: p.option });
  assert.equal(p.parent.children.length, 1);
});

test('scrolling or cancelled touch does not select a player or discard the list', t => {
  const p = picker(t);
  p.emit('pointerdown', { target: p.option });
  p.emit('pointermove', { target: p.option, clientY: 70 });
  p.emit('pointerup', { target: p.option, clientY: 70 });
  p.emit('click', { target: p.option });
  assert.equal(p.field.value, '');
  assert.equal(p.parent.children.includes(p.list), true);
  p.emit('pointerdown', { target: p.option });
  p.emit('pointercancel');
  p.emit('pointerup', { target: p.option });
  assert.equal(p.field.value, '');
});

test('trackpad click still selects a player', t => {
  const p = picker(t);
  assert.equal(p.emit('pointerdown', { target: p.option, pointerType: 'mouse' }).prevented, true);
  p.emit('click', { target: p.option, pointerType: 'mouse' });
  assert.equal(p.field.value, 'Joe Collier');
  assert.equal(p.parent.children.length, 1);
});


test('team suggestions filter archived teams and the opponent, and rank matching names', () => {
  const teams = [{ id: '1', name: 'Club North' }, { id: '2', name: 'North Stars' }, { id: '3', name: 'North Old', archived: true }, { id: '4', name: 'North Away' }];
  assert.deepEqual(teamSuggestions(teams, '4', ' NORTH ').map(t => t.name), ['North Stars', 'Club North']);
  assert.deepEqual(teamSuggestions(teams, '4', 'New club'), []);
});

test('team picker uses the same anchored list and touch selection as players', t => {
  const p = picker(t, 'team');
  assert.equal(p.list.id, 'teams-home');
  assert.equal(p.list.attrs['aria-label'], 'Available teams');
  p.emit('pointerdown', { target: p.option });
  p.emit('focusout');
  p.emit('pointerup', { target: p.option });
  assert.equal(p.field.value, 'Team One');
  assert.equal(p.field.attrs['aria-expanded'], 'false');
  assert.equal(p.parent.children.length, 1);
});
