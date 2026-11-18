import { getDeck, indianDay, isDay, isEdition, isSunday, isV2, nonEmpty, sectionIds, sourceLink, validSources } from '../public/edition-format.js';
import { evaluatePick, moatTypes } from '../public/investment-rules.js';

export const snapshotNames = [
  'Nifty 50','Sensex','Bank Nifty','Nifty Midcap 150','Nifty Smallcap 250','₹/US$','Brent','Gold (₹/10 g)','India 10-year G-sec yield','India VIX'
];
const banned = /\b(?:watch whether|it remains to be seen|could disrupt|amid|in a significant move)\b/i;
const tokens = value => String(value ?? '').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
const significant = value => tokens(value).filter(word => word.length > 2 &&
  !['the','and','are','was','were','for','from','with','has','have','that','this','its','will','into','their','about'].includes(word));
const prose = ['summary','why','soWhat','take','watch'];
const ownWords = card => tokens(prose.map(key => card[key]).join(' ')).length;
const unique = values => new Set(values).size === values.length;
const editText = value => Array.isArray(value) ? value.map(editText).join(' ') :
  value && typeof value === 'object' ? Object.entries(value)
    .filter(([key]) => !['url','image','sourceUrl','value','id','cardId'].includes(key)).map(([, val]) => editText(val)).join(' ') :
  typeof value === 'string' ? value : '';
const istTime = value => new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Kolkata', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'}).format(value);
const sourcesByUrl = sources => new Set((sources ?? []).map(source => source.url));
const numeric = value => String(value ?? '').match(/\d[\d,]*(?:\.\d+)?/g)?.map(x => Number(x.replaceAll(',',''))) ?? [];
const financeText = card => [card.headline, ...prose.map(key => card[key]), ...(card.thesis ?? []), ...(card.breakers ?? [])]
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
    if (ownWords(card) < 90 || ownWords(card) > 130) problems.push(card.id + ': narrative outside 90–130 words');
    const repeated = new Set(significant(card.headline + ' ' + card.summary));
    const why = significant(card.why);
    if (!why.length || why.filter(word => repeated.has(word)).length / why.length > 0.5) {
      problems.push(card.id + ': why repeats headline or summary');
    }
    if (!Array.isArray(card.terms) || card.terms.some(term =>
      !nonEmpty(term?.term) || !nonEmpty(term.meaning) || tokens(term.meaning).length >= 10)) problems.push(card.id + ': invalid glossary');
    if (card.image !== null && (!sourceLink(card.image?.url) || !nonEmpty(card.image.credit) ||
        !sourcesByUrl(card.sources).has(card.image.sourceUrl))) problems.push(card.id + ': image lacks verified source credit');
    if (topic === 'markets' || topic === 'investing') {
      const refs = sourcesByUrl(card.sources);
      const records = (card.evidence ?? []).filter(entry => evidenceValid(entry,issue.date) && refs.has(entry.url));
      const lookup = new Set(records.flatMap(entry => numeric(entry.value)));
      if (numeric(financeText(card)).some(value => !lookup.has(value))) problems.push(card.id + ': financial number lacks dated evidence');
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
  for (const pick of picks) {
    const value = evaluatePick(pick);
    const refs = sourcesByUrl(pick.sources);
    const metrics = pick.metricSources;
    const sourceMatched = key => evidenceValid(metrics?.[key],issue.date) && refs.has(metrics[key].url);
    if (!['pick','weekly'].includes(pick.slot) || !nonEmpty(pick.symbol) || !nonEmpty(pick.sector) ||
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

export function assembleEdition(draft, data, history, now = new Date()) {
  const date = draft?.date;
  if (!isDay(date) || indianDay(now) !== date) throw new Error('Draft date must match the IST publishing date');
  const incoming = draft.sections;
  if (!incoming || !Array.isArray(incoming.investing) || incoming.investing.length !== 5) throw new Error('Five stock slots are required');
  const candidates = new Map((data.picks ?? []).map(stock => [stock.symbol,stock]));
  let picks = incoming.investing.slice(0,3).map(written => {
    if (written.slot === 'unavailable') {
      if (!nonEmpty(data.fundamentalsUnavailable) || data.picks.length >= 3 || !nonEmpty(written.unavailableReason) || written.symbol || written.verdict || written.metrics || written.price != null) throw new Error('Unavailable stock slot needs a documented input gap');
      return written;
    }
    const stock = candidates.get(written.symbol);
    if (!stock) throw new Error('No screened source data for ' + written.symbol);
    const sources = [...new Map([...(stock.sources ?? []), ...(written.sources ?? [])].map(source => [source.url,source])).values()];
    return {...written,slot:'pick',symbol:stock.symbol,sector:stock.sector,kind:stock.kind,
      price:stock.price,quoteDate:stock.quoteDate,dataDate:stock.dataDate,metrics:stock.metrics,
      metricSources:stock.metricSources,screen:stock.screen,fairValue:stock.fairValue,buyBelow:stock.buyBelow,verdict:stock.verdict,sources};
  }).sort((a,b) => a.slot === 'unavailable' ? (b.slot === 'unavailable' ? 0 : 1) : b.slot === 'unavailable' ? -1 : a.price/a.fairValue - b.price/b.fairValue || a.symbol.localeCompare(b.symbol));
  if (new Date(date + 'T00:00:00Z').getUTCDay() === 1) {
    const winner = picks.findIndex(pick => pick.verdict === 'Buy' && pick.moat !== 'None');
    if (winner >= 0) {
      const [weekly] = picks.splice(winner,1);
      picks.unshift({...weekly,slot:'weekly'});
    }
  }
  picks = picks.map((pick,index) => ({...pick,rank:index+1}));
  const stockSlots = incoming.investing;
  const lesson = stockSlots[4];
  const example = nonEmpty(lesson.exampleMetric?.symbol) ? picks.find(pick => pick.symbol === lesson.exampleMetric.symbol) : undefined;
  const metric = lesson.exampleMetric?.metric;
  if ((!example || !Number.isFinite(example.metrics?.[metric])) && (picks.some(pick => pick.slot !== 'unavailable') || lesson.exampleMetric != null)) throw new Error('Stock lesson must use a verified metric, or omit its numerical example when all stock data is unavailable');
  const updates = stockSlots[3].thesisEvents ?? [];
  const known = new Set((data.watchlist?.picks ?? []).map(pick => pick.date + ':' + pick.symbol));
  if (!Array.isArray(updates) || updates.some(event => !known.has(event.pickDate + ':' + event.symbol) ||
      !['Thesis broken','Exited'].includes(event.status) || !nonEmpty(event.reason) ||
      !(stockSlots[3].sources ?? []).some(source => source.url === event.sourceUrl))) {
    throw new Error('Watchlist status changes need a matched pick and a primary source');
  }
  const watch = {...stockSlots[3],rank:4,slot:'watchlist',entries:[...updates,...(data.watchlist?.entries ?? [])],dataDate:data.watchlist?.dataDate};
  const learn = {...lesson,rank:5,slot:'learn',exampleMetric:example ? {symbol:example.symbol,metric,value:example.metrics[metric]} : null};
  const sections = {...incoming, investing:[...picks,watch,learn]};
  if (isSunday(date)) delete sections.markets;
  else {
    if (!incoming.markets?.dashboard || !data.dashboard) throw new Error('A market dashboard draft and dated market input are required');
    sections.markets = {...incoming.markets,dashboard:{...incoming.markets.dashboard,...data.dashboard,sources:[...new Map([...data.dashboard.sources,...incoming.markets.dashboard.sources].map(source => [source.url,source])).values()]}};
  }
  const edition = {version:2,date,publishedAt:now.toISOString(),publicationMode:istTime(now) > '10:00:00' ? 'late' : 'morning',top3:draft.top3,sections};
  const problems = publicationErrors(edition,history,data);
  if (problems.length) throw new Error(problems.join('\n'));
  return edition;
}
