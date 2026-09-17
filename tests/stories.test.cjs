const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const books = require('../stories.js');
const model = require('../progress.js');
test('illustrated books have all pages, accessible pictures, and questions', () => {
  for (const [id,length] of [[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],[7,3],[8,3],[9,8],[10,10],[11,12],[12,10],[13,10],[14,8]]) {
    const book = books.find(b => b.id === id);
    assert.equal(book.pages.length,length);
    assert.equal(book.illustrations.length,length);
    assert.equal(new Set(book.illustrations).size,length);
    assert.equal(book.scenes.length,length);
    for (const path of book.illustrations) {
      const bytes = fs.readFileSync(path);
      assert.equal(bytes.toString('ascii',0,4),'RIFF');
      assert.equal(bytes.toString('ascii',8,12),'WEBP');
      assert.ok(bytes.length < 200000, 'Page image should stay under 200 KB');
    }
    if (book.question) assert.ok(book.question.choices[book.question.answer]);
    assert.deepEqual(model.resume({pages:{0:book.pages[0].split(' ').length,1:2}},book),{page:1,word:2});
  }
});
test('database page limits exactly match the published story catalog', () => {
  const sql = fs.readFileSync('supabase/family-profiles.sql','utf8');
  const counts = JSON.parse(sql.match(/catalog jsonb := '([^']+)'/)[1]);
  assert.deepEqual(counts,Object.fromEntries(books.map(b=>[b.id,b.pages.map(p=>p.split(' ').length)])));
  assert.equal(new Set(books.map(b=>b.id)).size,books.length);
});
