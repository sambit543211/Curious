// What's trending: the top headlines on Google News (India edition) each morning. They become a checklist in
// prepared.json, and the publisher refuses an edition that silently leaves out a big story.
// Used privately as a checklist only; nothing from the feed is shown in the app.

export const feeds = [
  {key:'top', name:'Top stories', url:'https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en'},
  {key:'india', name:'India', url:'https://news.google.com/rss/headlines/section/topic/NATION?hl=en-IN&gl=IN&ceid=IN:en'},
  {key:'world', name:'World', url:'https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-IN&gl=IN&ceid=IN:en'},
  {key:'business', name:'Business', url:'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-IN&gl=IN&ceid=IN:en'},
  {key:'tech', name:'Technology', url:'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-IN&gl=IN&ceid=IN:en'}
];
export const PER_FEED = 5;      // headlines checked from each feed
export const MUST_COVER = 3;    // of each feed's top three, at most one may be skipped
const decode = text => text.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, '\'')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
const words = title => new Set(title.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(word => word.length > 3));
const similar = (a, b) => {
  const x = words(a), y = words(b);
  const shared = [...x].filter(word => y.has(word)).length;
  return shared >= 3 && shared / Math.min(x.size, y.size) >= 0.5;
};

export function parseFeed(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => {
    const raw = decode(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '');
    const source = decode(item.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? '');
    const title = source && raw.endsWith(' - ' + source) ? raw.slice(0, -(source.length + 3)) : raw;
    const related = (item.match(/(?:<|&lt;)li(?:>|&gt;)/g) ?? []).length;
    return {title, source, link:decode(item.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? ''),
      published:decode(item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? ''), related};
  }).filter(item => item.title);
}

export async function fetchTrending(fetcher = fetch) {
  const items = [];
  const failed = [];
  for (const feed of feeds) {
    try {
      const response = await fetcher(feed.url, {headers:{'user-agent':'Mozilla/5.0 (MorningEdition checklist)'}, signal:AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error('HTTP ' + response.status);
      let rank = 0;
      for (const item of parseFeed(await response.text())) {
        if (rank >= PER_FEED) break;
        const same = items.find(other => similar(other.title, item.title));
        if (same) { same.alsoIn = [...new Set([...(same.alsoIn ?? []), feed.name])]; continue; }
        rank += 1;
        items.push({id:feed.key + rank, feed:feed.name, rank, ...item});
      }
    } catch (error) { failed.push(feed.name + ': ' + error.message); }
  }
  return {checkedAt:new Date().toISOString(), source:'Google News (India edition) top headlines', items,
    ...(failed.length ? {unavailable:failed} : {})};
}

// The draft's `coverage` maps every trending id to the id of a card that covers it, or to "skip: <reason>".
export function coverageProblems(trending, coverage, cardIds) {
  if (!trending?.items?.length) return [];
  const problems = [];
  const map = coverage && typeof coverage === 'object' ? coverage : {};
  const skippedTop = new Map();
  for (const item of trending.items) {
    const answer = typeof map[item.id] === 'string' ? map[item.id].trim() : '';
    const label = item.id + ' "' + item.title + '" (' + item.feed + ' #' + item.rank + ')';
    if (!answer) { problems.push('coverage: ' + label + ' is missing. Cover it in a card and map it, or write "skip: <reason>"'); continue; }
    if (/^skip:/i.test(answer)) {
      if (answer.slice(5).trim().split(/\s+/).length < 3) problems.push('coverage: ' + label + ' needs a real reason to skip');
      if (item.rank <= MUST_COVER) skippedTop.set(item.feed, [...(skippedTop.get(item.feed) ?? []), label]);
    } else if (!cardIds.has(answer)) problems.push('coverage: ' + label + ' maps to "' + answer + '", which is not a card id');
  }
  for (const [feed, labels] of skippedTop) if (labels.length > 1) {
    problems.push('coverage: ' + feed + ' top ' + MUST_COVER + ' are big stories; skip at most one. Cover: ' + labels.slice(1).join('; '));
  }
  return problems;
}
