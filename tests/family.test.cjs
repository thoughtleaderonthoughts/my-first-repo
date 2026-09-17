const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
test('family migration preserves reading; children and parent accounts are isolated', async () => {
 const db = new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; insert into auth.users values('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'); set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';`);
  await db.exec(readFileSync('supabase/setup.sql','utf8'));
  await db.query("select public.reading_account('preferences',$1::jsonb)",[JSON.stringify({generation:0,name:'Ari'})]);
  await db.query("select public.reading_account('progress',$1::jsonb)",[JSON.stringify({generation:0,book:1,page:0,words:8})]);
  await db.exec(readFileSync('supabase/family-profiles.sql','utf8'));
  await db.exec('set role authenticated');
  const call = async(action,payload={}) => (await db.query('select public.reading_family($1,$2::jsonb) as state',[action,JSON.stringify(payload)])).rows[0].state;
  let family = await call('load');
  assert.equal(family.children.default.name,'Ari');
  assert.equal(family.children.default.books[1].pages[0],8);
  family = await call('add_child',{generation:0,childId:'child-b',name:'Luna'});
  assert.deepEqual(family.children['child-b'].books,{});
  await call('preferences',{generation:0,childId:'child-b',voice:'voice-b',rate:1});
  await call('progress',{generation:0,childId:'child-b',book:2,page:0,words:1});
  family = await call('add_child',{generation:0,childId:'child-b',name:'Retry'});
  assert.equal(family.children['child-b'].name,'Luna');
  assert.equal(family.children['child-b'].books[2].pages[0],1);
  assert.equal(family.children.default.voice,'');
  assert.equal(family.children.default.books[2],undefined);
  await assert.rejects(call('progress',{generation:0,childId:'unknown',book:1,page:0,words:1}),/Child not found/);
  await assert.rejects(db.query("select public.reading_account('load')"),/reload/);
  await db.exec("set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002'");
  assert.deepEqual((await call('load')).children.default.books,{});
  await assert.rejects(call('preferences',{generation:0,childId:'child-b',name:'Intruder'}),/Child not found/);
  await db.exec("set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'");
  for (let page = 0; page < 3; page++) {
    const b = require('../stories.js').find(b => b.id === 11);
    family = await call('progress',{generation:0,childId:'child-b',book:11,page,words:b.pages[page].split(' ').length});
  }
  assert.equal(family.children['child-b'].books[11].completedAt,undefined);
  const space = require('../stories.js').find(b => b.id === 11);
  await assert.rejects(call('progress',{generation:0,childId:'child-b',book:11,page:12,words:1}),/Invalid page/);
  for (let page = 3; page < 12; page++) family = await call('progress',{generation:0,childId:'child-b',book:11,page,words:space.pages[page].split(' ').length});
  assert.ok(family.children['child-b'].books[11].completedAt);
  family = await call('reset');
  assert.equal(family.generation,1);
  assert.deepEqual(Object.keys(family.children),['default']);
  assert.deepEqual(family.children.default.books,{});
  await assert.rejects(call('progress',{generation:0,childId:'child-b',book:2,page:0,words:3}),/reset on another device/);
 } finally { await db.close(); }
});
