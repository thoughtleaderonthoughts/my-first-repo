const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../progress.js');
const catalog = [{ id: 1, pages: ['one two', 'three four', 'five six'] }];
test('new accounts start with honest zero statistics', () => {
  assert.deepEqual(model.summary(model.fresh(), catalog), { completed: 0, pages: 0, words: 0, started: 0 });
});
test('skipping to the final page does not complete a book', () => {
  const state = model.fresh(); state.books[1] = { pages: { 2: 2 } };
  assert.deepEqual(model.summary(state, catalog), { completed: 0, pages: 1, words: 2, started: 1 });
  assert.deepEqual(model.resume(state.books[1], catalog[0]), { page: 0, word: 0 });
});
test('resume uses the first unfinished page and saved word', () => {
  assert.deepEqual(model.resume({ pages: { 0: 2, 1: 1 } }, catalog[0]), { page: 1, word: 1 });
});
test('completed books can be reread without inflating unique statistics', () => {
  const state = model.fresh(); state.books[1] = { pages: { 0: 2, 1: 2, 2: 2 }, completedAt: '2026-09-16T00:00:00Z' };
  assert.deepEqual(model.summary(state, catalog), { completed: 1, pages: 3, words: 6, started: 0 });
  assert.deepEqual(model.resume(state.books[1], catalog[0]), { page: 0, word: 0 });
});
