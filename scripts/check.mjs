import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { baseTopics, isDay, isEdition, isV2, matchProgress, nextUnread, sourceLink, stockTopic, storyKey } from '../public/edition-format.js';
import { bundledDates, categories, firstEdition, isHttps, readBundledEdition } from '../lib/edition.js';
import { indianDay } from '../lib/store.js';

assert.deepEqual(categories, ['india','world','markets','investing','tech','mind','marketing']);
const {editions:catalog} = JSON.parse(await readFile(new URL('../public/editions/index.json', import.meta.url)));
assert.ok(catalog.some(item => item.date === firstEdition.date));
assert.deepEqual(catalog.map(item => item.date), bundledDates);
for (const {date,path} of catalog) {
  const edition = JSON.parse(await readFile(new URL('../public'+path, import.meta.url)));
  assert.deepEqual(edition, await readBundledEdition(date));
  assert.ok(isEdition(edition));
  if (isV2(edition)) continue;
  const expected = edition.sections[stockTopic] ? categories : baseTopics;
  assert.deepEqual(Object.keys(edition.sections).sort(), [...expected].sort());
  assert.deepEqual(edition.sections.marketing.map(card => card.label.match(/^(India|Global)\b/i)?.[1]), ['India','India','India','Global','Global']);
  for (const deck of Object.values(edition.sections)) {
    assert.equal(new Set(deck.map(card => card.headline)).size, 5);
    for (const card of deck) {
      assert.ok(isHttps(card.sourceUrl));
      for (const source of card.sources ?? []) assert.ok(source.label && sourceLink(source.url));
      assert.match(card.image, /^\/images\/[a-z-]+\.jpg$/);
      await access(new URL('../public'+card.image, import.meta.url));
    }
  }
}
const legacyCard = {headline:'Original headline', sourceUrl:'https://example.org/story?PRID=42'};
const renamedCard = {...legacyCard, headline:'Edited headline'};
const issue = {sections:{india:[legacyCard]}};
const migrated = matchProgress(issue, new Set(), new Set(['india:Original headline', 'india:Stale entry']));
assert.equal(migrated.size, 1);
assert.deepEqual(matchProgress({sections:{india:[renamedCard]}}, migrated, new Set()), migrated);
assert.notEqual(storyKey('india', legacyCard, [legacyCard]), storyKey('india', {...legacyCard, sourceUrl:'https://example.org/story?PRID=43'}, [legacyCard]));
const triplet = ['zero','one','two'].map(key => ({key}));
assert.equal(nextUnread(triplet, 0, new Set(['one'])), 2);
assert.equal(nextUnread(triplet, 2, new Set(['one'])), 0);
assert.equal(nextUnread(triplet, 2, new Set(['zero','one'])), -1);
assert.equal(indianDay(new Date('2026-11-15T18:30:00Z')), '2026-11-16');
assert.equal(isDay('2026-02-30'), false);
assert.equal(isDay('2026-11-14'), true);

for (const folder of ['api','lib','public','public/js']) {
  for (const file of (await readdir(folder)).filter(filename => filename.endsWith('.js'))) {
    const result = spawnSync(process.execPath, ['--check',folder+'/'+file], {encoding:'utf8'});
    assert.equal(result.status, 0, result.stderr);
  }
}
console.log('Validated ' + catalog.length + ' editions, archive index, sources, cover assets, IST rollover and JavaScript syntax.');
