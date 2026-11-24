// Gives each news card a real photo: the lead image (og:image) of the article it cites, credited to
// that publisher and linked back to the article. If no article photo can be read, it falls back to the lead
// image of the Wikipedia article the writer named in the card's optional `photo` field (Wikimedia Commons).
// Runs after publishing; a page that can't be read is skipped.
// Usage: node scripts/add-photos.mjs public/editions/<date>.json [...]
import { readFile, writeFile } from 'node:fs/promises';

const skipSections = new Set(['markets', 'investing']);
const skipHosts = /(^|\.)(nseindia\.com|bseindia\.com|screener\.in|rbi\.org\.in|fbil\.org\.in|sebi\.gov\.in)$/;
const agent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

const meta = (html, names) => {
  for (const name of names) {
    const tag = html.match(new RegExp('<meta[^>]+(?:property|name)=["\']' + name + '["\'][^>]*>', 'i'))?.[0];
    const value = tag?.match(/content=["']([^"']+)["']/i)?.[1];
    if (value) return value.replace(/&amp;/g, '&').trim();
  }
  return null;
};
const publisher = (html, host) => meta(html, ['og:site_name', 'application-name']) ?? host.replace(/^www\./, '');

async function photoFor(source) {
  let page;
  try { page = new URL(source.url); } catch { return null; }
  if (page.protocol !== 'https:' || skipHosts.test(page.hostname) || /\.(pdf|zip|csv)$/i.test(page.pathname)) return null;
  try {
    const response = await fetch(page, {headers:{'user-agent':agent, accept:'text/html'}, redirect:'follow', signal:AbortSignal.timeout(10000)});
    if (!response.ok || !/html/i.test(response.headers.get('content-type') ?? '')) return null;
    const html = (await response.text()).slice(0, 400000);
    const raw = meta(html, ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src']);
    if (!raw) return null;
    const image = new URL(raw, response.url);
    const width = Number(meta(html, ['og:image:width']));
    if (image.protocol !== 'https:' || /logo|favicon|default|placeholder|sprite|emblem|card-share|share-card|og-default|\.svg(\?|$)/i.test(image.href) || (width && width < 400)) return null;
    const alt = meta(html, ['og:image:alt', 'twitter:image:alt']) ?? meta(html, ['og:title']) ?? '';
    return {url:image.href, credit:'Photo: ' + publisher(html, page.hostname).slice(0, 60), alt:alt.slice(0, 160), sourceUrl:source.url, auto:true};
  } catch { return null; }
}

async function wikiPhoto(title) {
  if (typeof title !== 'string' || !title.trim()) return null;
  try {
    const response = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.trim().replace(/ /g, '_')),
      {headers:{'user-agent':'MorningEdition/1.0 (news reader)'}, signal:AbortSignal.timeout(10000)});
    if (!response.ok) return null;
    const page = await response.json();
    const src = page.originalimage?.source ?? page.thumbnail?.source;
    const href = page.content_urls?.desktop?.page;
    if (!src || !href || page.type === 'disambiguation') return null;
    const url = page.thumbnail?.source && (page.originalimage?.width ?? 0) > 960 ? page.thumbnail.source.replace(/\/\d+px-/, '/960px-') : src;
    // Only freely licensed Commons files: /wikipedia/en/ holds non-free posters and logos used under fair use.
    if (!/\/wikipedia\/commons\//.test(src) || /\.svg/i.test(src) || /logo|flag_of|coat_of_arms|emblem/i.test(src)) return null;
    return {image:{url, credit:'Photo: Wikimedia Commons', alt:page.title, sourceUrl:href, auto:true}, source:{label:'Wikipedia · ' + page.title, url:href}};
  } catch { return null; }
}

export async function addPhotos(edition) {
  const cards = Object.entries(edition.sections ?? {}).filter(([id]) => !skipSections.has(id))
    .flatMap(([, deck]) => Array.isArray(deck) ? deck : deck.cards ?? []).filter(card => card.image == null && card.sources?.length);
  let added = 0;
  await Promise.all(cards.map(async card => {
    for (const source of card.sources.slice(0, 3)) {
      const image = await photoFor(source);
      if (image) { card.image = image; added += 1; return; }
    }
    const wiki = await wikiPhoto(card.photo);
    if (wiki) { card.image = wiki.image; card.sources.push(wiki.source); added += 1; }
  }));
  // An image used by two cards is a site-wide default, not a news photo.
  const counts = new Map();
  for (const card of cards) if (card.image) counts.set(card.image.url, (counts.get(card.image.url) ?? 0) + 1);
  for (const card of cards) if (card.image && counts.get(card.image.url) > 1) { card.image = null; added -= 1; }
  return {added, of:cards.length};
}

if (import.meta.url === 'file://' + process.argv[1]) {
  for (const path of process.argv.slice(2)) {
    const edition = JSON.parse(await readFile(path, 'utf8'));
    const {added, of} = await addPhotos(edition);
    if (added) await writeFile(path, JSON.stringify(edition, null, 2) + '\n');
    console.log(path + ': added ' + added + ' photos for ' + of + ' cards without one');
  }
}
