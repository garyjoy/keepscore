import test from 'node:test';
import assert from 'node:assert/strict';
import { handleScoreEnter } from '../assets/js/keyboard.js';

function fixture() {
  let dialog = false;
  const doc = { activeElement: null, querySelector: () => dialog ? {} : null };
  const fields = Array.from({ length: 8 }, (_, i) => ({
    hidden: i === 4 || i === 5, selected: false,
    matches: () => true,
    getClientRects() { return this.hidden ? [] : [{}]; },
    focus() { doc.activeElement = this; },
    select() { this.selected = true; },
  }));
  const root = { contains: field => fields.includes(field), querySelectorAll: () => fields };
  const press = (from, options = {}) => {
    doc.activeElement = fields[from];
    const event = { key: 'Enter', preventDefault() { this.prevented = true; }, ...options };
    handleScoreEnter(event, root, doc);
    return event;
  };
  return { fields, doc, press, openDialog: () => { dialog = true; } };
}

test('Enter moves home to away, then next game, selecting the value', () => {
  const { fields, doc, press } = fixture();
  assert.equal(press(0).prevented, true);
  assert.equal(doc.activeElement, fields[1]);
  assert.equal(fields[1].selected, true);
  press(1);
  assert.equal(doc.activeElement, fields[2]);
});

test('skips hidden third games in both directions and includes them when shown', () => {
  const { fields, doc, press } = fixture();
  press(3); assert.equal(doc.activeElement, fields[6]);
  press(6, { shiftKey: true }); assert.equal(doc.activeElement, fields[3]);
  fields[4].hidden = fields[5].hidden = false;
  press(3); assert.equal(doc.activeElement, fields[4]);
});

test('boundaries, repeats and unrelated keys do not move focus', () => {
  const { fields, doc, press } = fixture();
  for (const [from, options] of [[0, { shiftKey: true }], [7, {}], [0, { repeat: true }], [0, { isComposing: true }], [0, { key: 'Tab' }], [0, { ctrlKey: true }]]) {
    press(from, options); assert.equal(doc.activeElement, fields[from]);
  }
  assert.equal(press(0, { key: 'Tab' }).prevented, undefined);
  press(0, { key: 'Unidentified', code: 'NumpadEnter' });
  assert.equal(doc.activeElement, fields[1]);
});

test('confirmation dialogs keep control of keyboard focus', () => {
  const f = fixture();
  f.openDialog();
  assert.equal(f.press(0).prevented, undefined);
  assert.equal(f.doc.activeElement, f.fields[0]);
  const g = fixture();
  g.fields[1].focus = () => { g.openDialog(); g.doc.activeElement = {}; };
  g.press(0);
  assert.equal(g.fields[1].selected, false);
});
