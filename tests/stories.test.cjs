const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const books = require('../stories.js');
const model = require('../progress.js');
test('illustrated books have all pages, accessible pictures, and questions', () => {
  for (const [id,length] of [[9,8],[10,10],[11,12]]) {
    const book = books.find(b => b.id === id);
    assert.equal(book.pages.length,length);
    assert.equal(book.illustrations.length,length);
    assert.equal(new Set(book.illustrations).size,length);
    assert.equal(book.scenes.length,length);
    for (const path of book.illustrations) assert.match(fs.readFileSync(path,'utf8'),/<svg/);
    assert.ok(book.question.choices[book.question.answer]);
    assert.deepEqual(model.resume({pages:{0:book.pages[0].split(' ').length,1:2}},book),{page:1,word:2});
  }
});
test('database page limits exactly match the published story catalog', () => {
  const sql = fs.readFileSync('supabase/family-profiles.sql','utf8');
  const counts = JSON.parse(sql.match(/catalog jsonb := '([^']+)'/)[1]);
  assert.deepEqual(counts,Object.fromEntries(books.map(b=>[b.id,b.pages.map(p=>p.split(' ').length)])));
  assert.equal(new Set(books.map(b=>b.id)).size,books.length);
});
