import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { isDay, isEdition } from '../public/edition-format.js';
import { bundledDates, categories, firstEdition, isHttps, readBundledEdition } from '../lib/edition.js';
import { indianDay } from '../lib/store.js';

assert.deepEqual(categories, ['india','world','markets','tech','mind','marketing']);
const {editions:catalog} = JSON.parse(await readFile(new URL('../public/editions/index.json', import.meta.url)));
assert.ok(catalog.some(item => item.date === firstEdition.date));
assert.deepEqual(catalog.map(item => item.date), bundledDates);
for (const {date,path} of catalog) {
  const edition = JSON.parse(await readFile(new URL('../public'+path, import.meta.url)));
  assert.deepEqual(edition, await readBundledEdition(date));
  assert.ok(isEdition(edition));
  assert.deepEqual(Object.keys(edition.sections).sort(), [...categories].sort());
  assert.deepEqual(edition.sections.marketing.map(card => card.label.match(/^(India|Global)\b/i)?.[1]), ['India','India','India','Global','Global']);
  for (const deck of Object.values(edition.sections)) {
    assert.equal(new Set(deck.map(card => card.headline)).size, 5);
    for (const card of deck) {
      assert.ok(isHttps(card.sourceUrl));
      assert.match(card.image, /^\/images\/[a-z-]+\.jpg$/);
      await access(new URL('../public'+card.image, import.meta.url));
    }
  }
}
assert.equal(indianDay(new Date('2026-11-15T18:30:00Z')), '2026-11-16');
assert.equal(isDay('2026-02-30'), false);
assert.equal(isDay('2026-11-14'), true);

for (const folder of ['api','lib','public']) {
  for (const file of (await readdir(folder)).filter(filename => filename.endsWith('.js'))) {
    const result = spawnSync(process.execPath, ['--check',folder+'/'+file], {encoding:'utf8'});
    assert.equal(result.status, 0, result.stderr);
  }
}
console.log('Validated ' + catalog.length + ' editions, archive index, sources, cover assets, IST rollover and JavaScript syntax.');
