import { getDeck, indianDay, isDay, isEdition, isSunday, isV2, nonEmpty, sectionIds, sourceLink, validSources } from '../public/edition-format.js';
import { dipCheck, evaluatePick, moatTypes } from '../public/investment-rules.js';
import { DIP_SLOTS } from './stock-selection.js';

export const snapshotNames = [
  'Nifty 50','Sensex','Bank Nifty','Nifty Midcap 150','Nifty Smallcap 250','₹/US$','Brent','Gold (₹/10 g)','India 10-year G-sec yield','India VIX'
];
const banned = /\b(?:watch whether|it remains to be seen|could disrupt|amid|in a significant move)\b/i;
// Words that make a story read like a report or a data pipeline. Each comes with the plain word to use.
// Applies to editions from this date on; earlier ones were published before the rule.
export const plainWordsFrom = '2026-11-25';
export const stiffWords = [
  [/\bprepared (?:data|history|figures?|five-year|earnings|multiple|numbers?|screen|metrics?)\b/i, 'drop "prepared": just give the figure'],
  [/\bverified\b/i, 'drop "verified" (the sources list already shows where figures come from)'],
  [/\brespectively\b/i, 'say each figure next to its own name'],
  [/\battribution\b/i, 'say "who caused it" or "the cause"'],
  [/\bstatistical(?:ly)?\b/i, 'explain it in everyday words'],
  [/\bcommenc(?:e|es|ed|ing)\b/i, 'say "start" or "began"'],
  [/\btrajectory\b/i, 'say "direction" or "path"'],
  [/\bis not automatic\b|\bnone of (?:those|these) (?:effects )?is automatic\b/i, 'say plainly what may or may not happen'],
  [/\bdoes not eliminate\b/i, 'say "doesn\'t remove" or "still leaves"'],
  [/\b(?:aforementioned|notwithstanding|pursuant|whereby|thereby|heretofore)\b/i, 'use an everyday word'],
  [/\butili[sz](?:e|es|ed|ing|ation)\b/i, 'say "use"']
];
const readerText = card => [card.headline, ...prose.map(key => card[key]), card.whyFell, card.moatWhy, card.example, card.useThisWeek,
  card.tryThis, card.insight, card.indiaLink, ...(card.thesis ?? []), ...(card.breakers ?? [])].filter(value => typeof value === 'string').join(' ');
const tokens = value => String(value ?? '').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
const significant = value => tokens(value).filter(word => word.length > 2 &&
  !['the','and','are','was','were','for','from','with','has','have','that','this','its','will','into','their','about'].includes(word));
const prose = ['summary','why','soWhat','take','watch'];
// Stories may run 80–170 words so they can start from the ground and explain terms.
export const proseRange = [80, 170];
// A figure in prose may be rounded ("about 27%" for 26.86%) or written in lakh/crore units, but it must
// sit within 5% (or 0.5) of a dated, sourced figure. An unsourced number is still rejected.
const unitScales = [1, 100, 1000, 1e5, 1e7, 0.01, 1e-3, 1e-5, 1e-7];
export const roughly = (written, source) => unitScales.some(scale => {
  const value = written * scale;
  return Math.abs(value - source) <= Math.max(0.5 * scale, Math.abs(source) * 0.05);
});
// Every figure in a key number or chart must also be stated (roughly) in the story's own text.
export const figuresStated = (text, card) => {
  const stated = numeric(prose.map(key => card[key]).join(' '));
  return numeric(text).every(value => stated.some(source => roughly(value, source)));
};
const ownWords = card => tokens(prose.map(key => card[key]).join(' ')).length;
const unique = values => new Set(values).size === values.length;
const editText = value => Array.isArray(value) ? value.map(editText).join(' ') :
  value && typeof value === 'object' ? Object.entries(value)
    .filter(([key]) => !['url','image','photo','sourceUrl','value','id','cardId'].includes(key)).map(([, val]) => editText(val)).join(' ') :
  typeof value === 'string' ? value : '';
const istTime = value => new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Kolkata', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'}).format(value);
const sourcesByUrl = sources => new Set((sources ?? []).map(source => source.url));
const numeric = value => String(value ?? '').match(/\d[\d,]*(?:\.\d+)?/g)?.map(x => Number(x.replaceAll(',',''))) ?? [];
const financeText = card => [card.headline, ...prose.map(key => card[key]), card.whyFell ?? '', card.keyNumber?.value ?? '',
  ...(card.chart?.items ?? []).map(item => String(item?.value ?? '')), ...(card.thesis ?? []), ...(card.breakers ?? [])]
  .join(' ').replace(/Nifty (?:50|Midcap 150|Smallcap 250)|10-year G-sec/gi,'');
const validText = list => Array.isArray(list) && list.every(nonEmpty);
const near = (a,b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a-b) < 0.000001;
const evidenceValid = (e, date) => isDay(e?.asOf) && e.asOf <= date && !!sourceLink(e.url);
const canonical = text => tokens(text).join(' ');

export function eligibleStocks(rows, date) {
  if (!Array.isArray(rows) || !isDay(date)) throw new Error('A dated fundamentals export is required');
  const sectors = new Set();
  return rows.filter(stock => stock && nonEmpty(stock.symbol) && nonEmpty(stock.sector) &&
    isDay(stock.dataDate) && stock.dataDate <= date && validSources(stock.sources) &&
    isDay(stock.quoteDate) && stock.quoteDate <= date && ['divYield','promoterHolding'].every(key => Number.isFinite(stock.metrics?.[key])) &&
    ['price', ...Object.keys(stock.metrics ?? {}).filter(key => Number.isFinite(stock.metrics[key]))].every(key =>
      evidenceValid(stock.metricSources?.[key], date) && sourcesByUrl(stock.sources).has(stock.metricSources[key].url)))
    .map(stock => ({...stock, ...evaluatePick(stock)}))
    .filter(stock => stock.pass)
    .sort((a,b) => a.price / a.fairValue - b.price / b.fairValue || a.symbol.localeCompare(b.symbol))
    .filter(stock => {
      const sector = canonical(stock.sector);
      if (sectors.has(sector)) return false;
      sectors.add(sector);
      return true;
    });
}

const diff = (current, previous) => (current / previous - 1) * 100;
const rounded = value => Number(value.toFixed(2));
const clock = (date, hours) => new Date(date + 'T' + hours + '+05:30');
function historyBefore(series, date) {
  return series.filter(item => item.date <= date && isDay(item.date) && Number.isFinite(item.level) && item.level > 0)
    .sort((a,b) => b.date.localeCompare(a.date))[0]?.level;
}

export function marketDashboard(input, date) {
  const stamp = new Date(input?.timestamp);
  const flexible = input?.mode === 'latest';
  if (!isDay(date) || isSunday(date) || !Number.isFinite(stamp.getTime()) || indianDay(stamp) !== date ||
      (!flexible && istTime(stamp) !== '09:45:00') || !validSources(input.sources)) {
    throw new Error('A sourced market observation with its actual IST timestamp is required');
  }
  const session = input.session ?? 'open';
  const closed = session === 'closed';
  if (!['open','closed','after-close'].includes(session) || (session === 'after-close' && (!flexible || istTime(stamp) < '15:30:00')) || (closed &&
      (!isDay(input.lastSession) || input.lastSession >= date || !sourcesByUrl(input.sources).has(input.calendarUrl)))) {
    throw new Error('Market session status needs a verified session and exchange calendar');
  }
  const anchor = closed ? input.lastSession : date;
  const started = clock(anchor,'12:00:00');
  const priorDay = amount => new Date(started.getTime() - amount * 86400000).toISOString().slice(0,10);
  const previousYear = (Number(anchor.slice(0,4)) - 1) + '-12-31';
  const previousMonth = new Date(started);
  const originalDay = previousMonth.getUTCDate();
  previousMonth.setUTCDate(1);
  previousMonth.setUTCMonth(previousMonth.getUTCMonth() - 1);
  const lastDay = new Date(Date.UTC(previousMonth.getUTCFullYear(), previousMonth.getUTCMonth() + 1, 0)).getUTCDate();
  previousMonth.setUTCDate(Math.min(originalDay,lastDay));
  const urls = sourcesByUrl(input.sources);
  const notes = [];
  const rows = snapshotNames.map((name,index) => {
    const item = input.series?.[name];
    if (!item || !urls.has(item.url)) throw new Error('Missing source for ' + name);
    if (!Number.isFinite(item.level) || item.level <= 0) {
      if (index < 2 || !nonEmpty(item.unavailableReason)) throw new Error('Missing verified level for ' + name);
      notes.push(name + ': ' + item.unavailableReason);
      return {name,level:null,previousClose:null,d1:null,unavailableReason:item.unavailableReason,source:{url:item.url,asOf:anchor}};
    }
    if (!Array.isArray(item.history)) throw new Error('Missing historical observations for ' + name);
    const previousClose = historyBefore(item.history, priorDay(1)) ?? null;
    if (index < 2 && !previousClose) throw new Error('Previous close required for ' + name);
    const bases = index < 5 ? [previousClose,historyBefore(item.history,priorDay(7)),
      historyBefore(item.history,previousMonth.toISOString().slice(0,10)),historyBefore(item.history,previousYear)] : [previousClose];
    const [d1,w1,m1,ytd] = bases.map(value => value ? rounded(diff(item.level,value)) : null);
    if (bases.some(value => !value)) notes.push(name + ': unverified historical comparisons are omitted.');
    const row = {name,level:item.level,previousClose,d1,source:{url:item.url,asOf:anchor},...(item.note ? {note:item.note} : {})};
    return index < 5 ? {...row,w1,m1,ytd} : row;
  });
  const flows = input.flows;
  const niftyPE = input.niftyPE;
  for (const [name,record,keys] of [['Flows',flows,['fii','dii','fiiMtd','diiMtd']],['Nifty valuation',niftyPE,['now','median5y']]]) {
    if (!evidenceValid(record,date) || !urls.has(record.url) || keys.some(key => !Number.isFinite(record[key]) && record[key] !== null) ||
        (keys.some(key => record[key] === null) && !nonEmpty(record.unavailableReason))) throw new Error('Invalid dated ' + name);
    if (record.unavailableReason) notes.push(name + ': ' + record.unavailableReason);
  }
  const asOf = istTime(stamp).slice(0,5) + ' IST';
  return {asOf,timestamp:input.timestamp,mode:flexible ? 'latest' : 'morning',session,
    ...(closed ? {lastSession:anchor,calendarUrl:input.calendarUrl} : {}),rows,flows,niftyPE,sources:input.sources,dataQualityNotes:notes};
}

// Cards 1-2: quality stocks near their 52-week low ('dip'). Cards 3-5: quality + value picks ('pick').
export function stockProblems(issue, data) {
  const problems = [];
  const stocks = getDeck(issue,'investing');
  const groupOf = index => index < DIP_SLOTS ? 'dip' : 'pick';
  const positions = stocks.filter(card => card.slot === 'dip' || card.slot === 'pick');
  let previous = null;
  stocks.forEach((card,index) => {
    const group = groupOf(index);
    if (![group,'unavailable'].includes(card.slot)) problems.push('Stock cards 1-2 must be 52-week-low picks and cards 3-5 quality picks');
    if (card.slot === 'unavailable' && (!nonEmpty(card.unavailableReason) || card.symbol || card.verdict || card.metrics || card.price != null)) {
      problems.push('Unverified stock slots must be clearly unavailable, without financial claims');
    }
    if (previous && previous.group === group && previous.slot === 'unavailable' && card.slot !== 'unavailable') problems.push('Unavailable stock slots go after the selected stocks in their group');
    if (card.slot === 'unavailable' && data && !nonEmpty(data.selection?.shortfall?.[group])) problems.push(card.id + ': slot left empty although enough stocks qualified');
    previous = {group, slot:card.slot};
  });
  if (!unique(positions.map(card => canonical(card.sector))) || !unique(positions.map(card => card.symbol))) problems.push('Duplicate stock or sector');
  for (const pick of positions) {
    problems.push(...pickProblems(pick, issue, data, ['dip','pick']));
    if (pick.verdict === 'Avoid') problems.push(pick.id + ': Avoid verdicts are not shown as picks');
    if (pick.slot === 'dip') {
      const check = dipCheck(pick);
      if (!check.pass || !near(pick.dip?.fromHigh, check.fromHigh) || !near(pick.dip?.fromLow, check.fromLow) ||
          !['sector-wide','stock-specific','no-peers'].includes(pick.dip?.fall) || !nonEmpty(pick.whyFell)) problems.push(pick.id + ': 52-week-low rules, distances or the reason for the fall are invalid');
    }
    if (data && !(data.selection?.[pick.slot === 'dip' ? 'dips' : 'picks'] ?? []).includes(pick.symbol)) problems.push(pick.id + ': stock was not chosen by the selection code');
  }
  if (data?.selection) {
    const used = new Set(positions.map(card => card.symbol));
    if ([...data.selection.dips, ...data.selection.picks].some(symbol => !used.has(symbol))) problems.push('Every stock chosen by the selection code must get a card');
  }
  const monday = new Date(issue.date + 'T00:00:00Z').getUTCDay() === 1;
  const weeklies = positions.filter(card => card.weekly === true);
  const eligible = positions.filter(card => card.verdict === 'Buy' && card.moat !== 'None');
  if ((monday && eligible.length && (weeklies.length !== 1 || weeklies[0].verdict !== 'Buy' || weeklies[0].moat === 'None')) ||
      ((!monday || !eligible.length) && weeklies.length)) problems.push('Buy of the week must be exactly one Buy on Mondays');
  return problems;
}

export function publicationErrors(issue, history = [], data) {
  if (!isV2(issue) || !isEdition(issue)) return ['Edition must have Top 3 and five cards per active section'];
  const problems = [];
  const stamp = new Date(issue.publishedAt);
  if (!Number.isFinite(stamp.getTime()) || indianDay(stamp) !== issue.date || (istTime(stamp) > '10:00:00' && issue.publicationMode !== 'late') ||
      istTime(stamp) < '09:50:00') problems.push('Publication timestamp outside the IST window');
  const all = sectionIds(issue).flatMap(topic => getDeck(issue,topic).map((card,index) => ({topic,card,index})));
  if (!unique(all.map(({card}) => card.id))) problems.push('Card IDs must be unique');
  if (!unique(issue.top3.map(card => card.cardId)) || issue.top3.some(top =>
    !nonEmpty(top.line) || !all.some(({card}) => card.id === top.cardId))) problems.push('Top 3 must point to three different stories');
  if (banned.test(editText(issue))) problems.push('Banned phrase');
  for (const {topic, card, index} of all) {
    if (!nonEmpty(card.label) || !prose.every(key => nonEmpty(card[key])) || !validSources(card.sources)) problems.push(card.id + ': missing editorial or source field');
    if (card.rank !== index + 1) problems.push(card.id + ': invalid rank');
    if (tokens(card.headline).length > 12) problems.push(card.id + ': headline exceeds 12 words');
    if (ownWords(card) < proseRange[0] || ownWords(card) > proseRange[1]) problems.push(card.id + ': narrative outside ' + proseRange.join('–') + ' words');
    const repeated = new Set(significant(card.headline + ' ' + card.summary));
    const why = significant(card.why);
    if (!why.length || why.filter(word => repeated.has(word)).length / why.length > 0.5) {
      problems.push(card.id + ': why repeats headline or summary');
    }
    const key = card.keyNumber;
    if (key !== undefined && (!nonEmpty(key?.value) || key.value.length > 18 || !/\d/.test(key.value) || !nonEmpty(key.label) ||
        tokens(key.label).length > 6 || !figuresStated(key.value, card))) problems.push(card.id + ': key number must be a short figure the story states');
    const chart = card.chart;
    if (chart !== undefined && (!Array.isArray(chart?.items) || chart.items.length < 2 || chart.items.length > 8 ||
        (chart.title !== undefined && (!nonEmpty(chart.title) || tokens(chart.title).length > 8)) ||
        chart.items.some(item => !nonEmpty(item?.label) || tokens(item.label).length > 5 || !Number.isFinite(item.value) ||
          !figuresStated(String(item.value), card)))) problems.push(card.id + ': chart needs 2–8 labelled values the story states');
    if (!Array.isArray(card.terms) || card.terms.some(term =>
      !nonEmpty(term?.term) || !nonEmpty(term.meaning) || tokens(term.meaning).length >= 10)) problems.push(card.id + ': invalid glossary');
    if (issue.date >= plainWordsFrom) for (const [pattern, fix] of stiffWords) {
      const found = readerText(card).match(pattern);
      if (found) problems.push(card.id + ': plain words please: "' + found[0] + '": ' + fix);
    }
    if (card.image !== null && (!sourceLink(card.image?.url) || !nonEmpty(card.image.credit) ||
        !sourcesByUrl(card.sources).has(card.image.sourceUrl))) problems.push(card.id + ': image lacks verified source credit');
    if (topic === 'markets' || topic === 'investing') {
      const refs = sourcesByUrl(card.sources);
      const records = (card.evidence ?? []).filter(entry => evidenceValid(entry,issue.date) && refs.has(entry.url));
      const backed = records.flatMap(entry => numeric(entry.value));
      if (numeric(financeText(card)).some(value => !backed.some(source => roughly(value, source)))) problems.push(card.id + ': financial number lacks dated evidence');
      if (data && records.some(entry => !(data.facts ?? []).some(fact => fact.asOf === entry.asOf && fact.url === entry.url &&
        String(fact.value) === String(entry.value)))) problems.push(card.id + ': evidence not found in fetched data');
    }
  }
  const markets = issue.sections.markets;
  if (!isSunday(issue.date)) {
    const dash = markets?.dashboard;
    const urls = sourcesByUrl(dash?.sources);
    const rows = dash?.rows;
    const observed = new Date(dash?.timestamp);
    const flexible = dash?.mode === 'latest';
    const anchor = dash?.session === 'closed' ? dash.lastSession : issue.date;
    if (!dash || !Array.isArray(rows) || rows.length !== snapshotNames.length || !validSources(dash.sources) ||
        !Number.isFinite(observed.getTime()) || indianDay(observed) !== issue.date || observed > stamp ||
        dash.asOf !== istTime(observed).slice(0,5) + ' IST' || (!flexible && istTime(observed) !== '09:45:00') ||
        !['open','closed','after-close'].includes(dash.session) ||
        (dash.session === 'after-close' && (!flexible || istTime(observed) < '15:30:00')) ||
        (dash.session === 'closed' && (!isDay(dash.lastSession) || dash.lastSession >= issue.date || !urls.has(dash.calendarUrl))) ||
        !evidenceValid(dash.flows,issue.date) || !evidenceValid(dash.niftyPE,issue.date) ||
        !urls.has(dash.flows.url) || !urls.has(dash.niftyPE.url) ||
        [['fii','dii','fiiMtd','diiMtd'],['now','median5y']].some((keys,i) => {
          const record = i ? dash.niftyPE : dash.flows;
          return keys.some(key => !Number.isFinite(record[key]) && record[key] !== null) ||
            (keys.some(key => record[key] === null) && !nonEmpty(record.unavailableReason));
        }) || rows.some((row,i) => row.name !== snapshotNames[i] ||
          !evidenceValid(row.source,issue.date) || !urls.has(row.source.url) || row.source.asOf !== anchor ||
          (row.level === null ? i < 2 || !nonEmpty(row.unavailableReason) || row.d1 !== null || row.previousClose !== null :
            !Number.isFinite(row.level) || row.level <= 0 ||
            (row.previousClose === null ? i < 2 || row.d1 !== null : !Number.isFinite(row.previousClose) || row.previousClose <= 0 || !near(row.d1,rounded(diff(row.level,row.previousClose)))) ||
            (i < 5 && ![row.w1,row.m1,row.ytd].every(value => value === null || Number.isFinite(value)))))) problems.push('Invalid or unsourced market dashboard');
    if (data && ['rows','timestamp','session','lastSession','flows','niftyPE'].some(key =>
      JSON.stringify(dash?.[key]) !== JSON.stringify(data.dashboard?.[key]))) problems.push('Market dashboard differs from fetched data');
  }
  if (issue.stockLayout === 'dip-quality') problems.push(...stockProblems(issue, data));
  else {
    const stocks = getDeck(issue,'investing');
    const slots = stocks.slice(0,3);
    const picks = slots.filter(card => ['pick','weekly'].includes(card.slot));
    if (slots.some(card => !['pick','weekly','unavailable'].includes(card.slot) || (card.slot === 'unavailable' &&
        (!nonEmpty(card.unavailableReason) || card.symbol || card.verdict || card.metrics || card.price != null)))) problems.push('Unverified stock slots must be clearly unavailable, without financial claims');
    if (!unique(picks.map(card => canonical(card.sector))) || !unique(picks.map(card => card.symbol))) problems.push('Duplicate stock or sector');
    const monday = new Date(issue.date + 'T00:00:00Z').getUTCDay() === 1;
    const weeklies = picks.filter(card => card.slot === 'weekly');
    const weeklyRequired = monday && picks.some(card => card.verdict === 'Buy' && card.moat !== 'None');
    if ((weeklyRequired && (weeklies.length !== 1 || slots[0].slot !== 'weekly')) ||
        (!weeklyRequired && weeklies.length) || stocks[3]?.slot !== 'watchlist' || stocks[4]?.slot !== 'learn') problems.push('Stock card order or Monday pick is invalid');
    for (const pick of picks) problems.push(...pickProblems(pick, issue, data, ['pick','weekly']));
  }
  const psychology = getDeck(issue,'mind');
  const cutoff = new Date(clock(issue.date,'12:00:00').getTime() - 60*86400000).toISOString().slice(0,10);
  const old = new Set(history.filter(e => e.date >= cutoff && e.date < issue.date)
    .flatMap(e => getDeck(e,'mind').map(card => canonical(card.concept ?? card.label))));
  const concepts = psychology.map(card => canonical(card.concept));
  if (!unique(concepts) || concepts.some(value => !value || old.has(value)) ||
      psychology.filter(card => card.study?.era === 'classic').length !== 3 ||
      psychology.filter(card => card.study?.era === 'recent').length !== 2 ||
      psychology.some(card => !nonEmpty(card.study?.authors) || !isDay(card.study?.published) || card.study.published > issue.date || !Number.isInteger(card.study?.year) ||
        card.study.year > Number(issue.date.slice(0,4)) || !Number.isInteger(card.study?.sample) || card.study.sample <= 0 ||
        !nonEmpty(card.example) || !nonEmpty(card.useThisWeek) ||
        (card.study.era === 'recent' && Date.parse(issue.date) - Date.parse(card.study.published) > 731*86400000))) problems.push('Psychology mix, study evidence or 60-day concept rule failed');
  const mix = {
    india:['policy','policy','business','society','wildcard'],
    world:['geopolitics','geopolitics','economy','us-china','wildcard'],
    tech:['launch','launch','policy','india','deal']
  };
  for (const [topic, expected] of Object.entries(mix)) {
    if (getDeck(issue,topic).map(card => card.beat).sort().join() !== expected.sort().join()) problems.push(topic + ': invalid section mix');
  }
  if (getDeck(issue,'world').some(card => !nonEmpty(card.indiaLink))) problems.push('World cards need an India link or global relevance');
  if (getDeck(issue,'tech').some(card => !nonEmpty(card.tryThis))) problems.push('Tech cards need a practical action');
  if (getDeck(issue,'india').some(card => card.economicData && (!nonEmpty(card.previousValue) || !nonEmpty(card.trend)))) problems.push('Economic data needs previous value and trend');
  const campaigns = getDeck(issue,'marketing');
  if (campaigns.filter(card => card.region === 'India').length !== 3 || campaigns.filter(card => card.region === 'Global').length !== 2 ||
      campaigns.some(card => !['brand','agency','objective','insight','channels','results'].every(key => nonEmpty(card[key])))) problems.push('Marketing split or campaign facts invalid');
  return problems;
}

function pickProblems(pick, issue, data, slots) {
  const problems = [];
  const value = evaluatePick(pick);
  const refs = sourcesByUrl(pick.sources);
  const metrics = pick.metricSources;
  const sourceMatched = key => evidenceValid(metrics?.[key],issue.date) && refs.has(metrics[key].url);
  if (!slots.includes(pick.slot) || !nonEmpty(pick.symbol) || !nonEmpty(pick.sector) ||
      !moatTypes.includes(pick.moat) || !nonEmpty(pick.moatWhy) || !validText(pick.thesis) || pick.thesis.length !== 3 ||
      !validText(pick.breakers) || pick.breakers.length !== 2 || !isDay(pick.dataDate) || pick.dataDate > issue.date ||
      !isDay(pick.quoteDate) || pick.quoteDate > issue.date ||
      !value.pass || !near(pick.fairValue,value.fairValue) || !near(pick.buyBelow,value.buyBelow) || pick.verdict !== value.verdict ||
      JSON.stringify(Object.entries(pick.screen ?? {}).sort()) !== JSON.stringify(Object.entries(value.screen).sort()) ||
      (pick.slot === 'weekly' && (pick.verdict !== 'Buy' || pick.moat === 'None')) ||
      !['price', ...Object.keys(pick.metrics ?? {}).filter(key => Number.isFinite(pick.metrics[key]))].every(sourceMatched)) {
    problems.push(pick.id + ': invalid screen, inputs or computed verdict');
  }
  if (data) {
    const actual = data.picks?.find(stock => stock.symbol === pick.symbol);
    if (!actual || !near(pick.price,actual.price) || pick.kind !== actual.kind || canonical(pick.sector) !== canonical(actual.sector) ||
        Object.keys(actual.metrics).some(key => pick.metrics?.[key] !== actual.metrics[key]) ||
        Object.keys(pick.metrics ?? {}).length !== Object.keys(actual.metrics).length) problems.push(pick.id + ': inputs differ from fetched fundamentals');
  }
  return problems;
}

export function assembleEdition(draft, data, history, now = new Date()) {
  const date = draft?.date;
  if (!isDay(date) || indianDay(now) !== date) throw new Error('Draft date must match the IST publishing date');
  const incoming = draft.sections;
  if (!incoming || !Array.isArray(incoming.investing) || incoming.investing.length !== 5) throw new Error('Five stock slots are required');
  const candidates = new Map((data.picks ?? []).map(stock => [stock.symbol,stock]));
  const selection = data.selection ?? {dips:[], picks:[], shortfall:{dip:data.fundamentalsUnavailable, pick:data.fundamentalsUnavailable}};
  const order = [...selection.dips, ...selection.picks];
  const groupOf = index => index < DIP_SLOTS ? 'dip' : 'pick';
  const cards = incoming.investing.map((written,index) => {
    const group = groupOf(index);
    if (written.slot === 'unavailable') {
      if (!nonEmpty(selection.shortfall?.[group]) || !nonEmpty(written.unavailableReason) || written.symbol || written.verdict || written.metrics || written.price != null) {
        throw new Error('Stock card ' + (index + 1) + ' is empty, but the selection code found enough ' + (group === 'dip' ? '52-week-low' : 'quality') + ' stocks');
      }
      return {...written, group};
    }
    const list = group === 'dip' ? selection.dips : selection.picks;
    if (!list.includes(written.symbol)) throw new Error((written.symbol ?? 'Stock card ' + (index + 1)) + ' was not chosen by the selection code for the ' + (group === 'dip' ? '52-week-low cards (1-2)' : 'quality cards (3-5)') + '. Chosen: ' + (list.join(', ') || 'none'));
    const stock = candidates.get(written.symbol);
    if (group === 'dip' && !nonEmpty(written.whyFell)) throw new Error(written.symbol + ': explain why the stock fell (whyFell)');
    const sources = [...new Map([...(stock.sources ?? []), ...(written.sources ?? [])].map(source => [source.url,source])).values()];
    const {weekly, ...rest} = written;
    return {...rest,slot:group,group,symbol:stock.symbol,sector:stock.sector,kind:stock.kind,
      price:stock.price,quoteDate:stock.quoteDate,dataDate:stock.dataDate,metrics:stock.metrics,
      metricSources:stock.metricSources,screen:stock.screen,fairValue:stock.fairValue,buyBelow:stock.buyBelow,verdict:stock.verdict,sources,
      ...(stock.dip ? {dip:stock.dip} : {}), ...(Number.isFinite(stock.score) ? {score:stock.score} : {}), ...(stock.repeat ? {repeat:stock.repeat} : {})};
  });
  const placed = new Set(cards.map(card => card.symbol).filter(Boolean));
  const skipped = order.filter(symbol => !placed.has(symbol));
  if (skipped.length) throw new Error('Write a card for every selected stock. Missing: ' + skipped.join(', '));
  const rankWithin = group => cards.filter(card => card.group === group)
    .sort((x,y) => (x.slot === 'unavailable') - (y.slot === 'unavailable') || order.indexOf(x.symbol) - order.indexOf(y.symbol));
  let stockCards = [...rankWithin('dip'), ...rankWithin('pick')];
  if (new Date(date + 'T00:00:00Z').getUTCDay() === 1) {
    const best = stockCards.filter(card => card.verdict === 'Buy' && card.moat !== 'None')
      .sort((x,y) => x.price / x.fairValue - y.price / y.fairValue)[0];
    if (best) stockCards = stockCards.map(card => card === best ? {...card, weekly:true} : card);
  }
  stockCards = stockCards.map(({group, ...card},index) => ({...card,rank:index+1}));
  const events = draft.stockEvents ?? [];
  const known = new Set((data.watchlist?.picks ?? []).map(pick => pick.date + ':' + pick.symbol));
  if (!Array.isArray(events) || events.some(event => !known.has(event.pickDate + ':' + event.symbol) ||
      !['Thesis broken','Exited'].includes(event.status) || !nonEmpty(event.reason) || !sourceLink(event.sourceUrl))) {
    throw new Error('Stock status changes need a matched earlier pick, a reason and a primary source URL');
  }
  const sections = {...incoming, investing:stockCards};
  if (isSunday(date)) delete sections.markets;
  else {
    if (!incoming.markets?.dashboard || !data.dashboard) throw new Error('A market dashboard draft and dated market input are required');
    sections.markets = {...incoming.markets,dashboard:{...incoming.markets.dashboard,...data.dashboard,sources:[...new Map([...data.dashboard.sources,...incoming.markets.dashboard.sources].map(source => [source.url,source])).values()]}};
  }
  const edition = {version:2,stockLayout:'dip-quality',date,publishedAt:now.toISOString(),publicationMode:istTime(now) > '10:00:00' ? 'late' : 'morning',top3:draft.top3,
    ...(events.length ? {stockEvents:events} : {}),
    ...(data.selection ? {stockSelection:{session:data.selection.session,fundamentalsDate:data.selection.fundamentalsDate,counts:data.selection.counts}} : {}),sections};
  const problems = publicationErrors(edition,history,data);
  if (problems.length) throw new Error(problems.join('\n'));
  return edition;
}
