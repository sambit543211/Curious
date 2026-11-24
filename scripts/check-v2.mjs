import assert from 'node:assert/strict';
import { figuresStated, stiffWords, lessonProblems, roughly, assembleEdition, eligibleStocks, marketDashboard, publicationErrors, snapshotNames } from '../lib/edition-v2.js';
import { getDeck, isEdition } from '../public/edition-format.js';
import { makeLedger } from '../lib/track-record.js';
import { selectStocks } from '../lib/stock-selection.js';
import { dipCheck } from '../public/investment-rules.js';
import { mergeStockInput, parseBhavcopy, parseRange } from '../lib/stock-input.js';
import { parseCompany } from '../lib/screener.js';
import { evaluatePick } from '../public/investment-rules.js';
import { coverageProblems, parseFeed } from '../lib/trending.js';

const source = {label:'Sandbox source fixture',url:'https://example.org/fixture'};
const date = '2026-11-18';
const evidence = {url:source.url,asOf:'2026-11-17'};
const metrics = {roce5y:18,de:0.2,salesCagr5y:15,profitCagr5y:12,ocfPositiveYears:5,
  pe:12,peMedian5y:18,peg:1,eps:10,divYield:2,promoterHolding:40,pledge:0,marketCap:2300,avgDailyValue:12,
  high52:125,low52:90,profitYoY:8,promoterChange:0};
const bases = [
  {date:'2025-12-31',level:90},{date:'2026-10-18',level:95},
  {date:'2026-11-11',level:98},{date:'2026-11-17',level:100}
];
const market = {
  timestamp:date+'T09:45:00+05:30',
  sources:[source],series:Object.fromEntries(snapshotNames.map(name => [name,{history:bases,level:103,url:source.url}])),
  flows:{...evidence,fii:11,dii:-12,fiiMtd:25,diiMtd:-5},
  niftyPE:{...evidence,now:20,median5y:19}
};
const stockRow = (symbol,sector,price,extra={}) => {
  const values = {...metrics,...extra};
  return {symbol,sector,kind:'non-financial',price,dataDate:evidence.asOf,quoteDate:evidence.asOf,metrics:values,sources:[source],
    metricSources:Object.fromEntries(['price',...Object.keys(values)].map(key => [key,evidence]))};
};
const examples = ['ALPHA','BETA','GAMMA'].map((symbol,index) => stockRow(symbol,['Industrials','Software','Consumer'][index],120,{roce5y:18+index}));
const dipStocks = [stockRow('DIPA','Chemicals',100,{high52:160,low52:95}),stockRow('DIPB','Textiles',101,{high52:150,low52:96})];
const selected = selectStocks([...dipStocks,...examples],date,[]);
assert.deepEqual(selected.dips.map(s => s.symbol),['DIPA','DIPB']);
assert.deepEqual(selected.picks.map(s => s.symbol),['GAMMA','BETA','ALPHA']);
const narratives = {
  summary:'The committee opened a public consultation on new rules for wholesale providers. Companies must submit operational evidence before the public hearing, and the proposal applies to new contracts.',
  why:'An earlier procurement dispute exposed inconsistent bidding criteria. Local officials want clearer requirements because recent audits found large differences between competitive tenders and awards made under emergency procedures.',
  soWhat:'Indian suppliers can estimate which contracts they can compete for before preparing bids. Clearer tender criteria can reduce wasted effort for smaller suppliers.',
  take:'I would support a public register of winning bids so suppliers can challenge inconsistent decisions.',
  watch:'Read the formal notice when the consultation closes.'
};
const card = (id,rank,other={}) => ({
  id,rank,label:'Sandbox only',headline:id.replaceAll('-',' ') + ' decision',
  ...narratives,image:null,terms:[],sources:[source],...other
});
const deck = (topic,beats) => beats.map((beat,i) => card(topic + '-' + ['first','second','third','fourth','fifth'][i],i+1,{beat}));
const stockCard = (symbol,i,extra={}) => card(symbol,i+1,{
  symbol,moat:'Switching cost',moatWhy:'Moving contracts requires a separate migration.',
  thesis:['Renewals support recurring revenue.','New distribution channels widen the addressable market.','The price is below the screened buy-below level.'],
  breakers:['Renewals decline across major cohorts.','A competing standard makes migration cheaper.'],...extra
});
const whyFell = 'Weak demand in export markets hit the whole sector after a large customer cut orders.';
const stockPicks = [stockCard('DIPA',0,{whyFell}),stockCard('DIPB',1,{whyFell}),stockCard('GAMMA',2),stockCard('BETA',3),stockCard('ALPHA',4)];
const draft = {
  date,top3:[{cardId:'india-first',line:'Policy consultation opens'},{cardId:'world-first',line:'Bilateral negotiations begin'},
    {cardId:'markets-dashboard',line:'Markets snapshot'}],
  sections:{
    india:deck('india',['policy','policy','business','society','wildcard']),
    world:deck('world',['geopolitics','geopolitics','economy','us-china','wildcard']).map(item => ({...item,indiaLink:'Monitor shipping demand in India.'})),
    markets:{dashboard:card('markets-dashboard',1),cards:deck('markets',['sector','result','ipo','flows']).map((item,i) => ({...item,rank:i+2}))},
    investing:stockPicks,
    tech:deck('tech',['launch','launch','policy','india','deal']).map(item => ({...item,tryThis:'Try the published demonstration.'})),
    psychology:deck('psychology',['first','second','third','fourth','fifth']).map((item,i) => ({...item,concept:'Unique concept ' + i,
      study:{authors:'Sandbox authors',year:i<3?2012:2025,published:i<3?'2012-05-01':'2025-04-12',sample:50,era:i<3?'classic':'recent'},
      example:'Compare two ordinary decisions.',useThisWeek:'Test the idea in a study session.'})),
    marketing:deck('marketing',['first','second','third','fourth','fifth']).map((item,i) => ({...item,
      region:i<3?'India':'Global',brand:'Sandbox brand',agency:'Sandbox agency',objective:'Increase awareness',insight:'Relevance drives participation',
      channels:'Print and radio',results:'Results have not been published.'}))
  }
};
const dashboard = marketDashboard(market,date);
const prepared = {picks:[...selected.dips,...selected.picks],selection:{dips:selected.dips.map(s => s.symbol),picks:selected.picks.map(s => s.symbol),shortfall:selected.shortfall},
  dashboard,facts:[],watchlist:{entries:[],picks:[],dataDate:evidence.asOf}};
const issue = assembleEdition(draft,prepared,[],new Date(date+'T09:57:00+05:30'));
assert.ok(isEdition(issue));
assert.equal(getDeck(issue,'markets').length,5);
assert.equal(getDeck(issue,'mind').length,5);
assert.equal(dashboard.rows[0].previousClose,100);
assert.equal(dashboard.rows[0].d1,3);
assert.equal(dashboard.rows[0].w1,5.1);
assert.equal(evaluatePick(examples[0]).buyBelow,144);
assert.equal(evaluatePick({...examples[0],price:145}).verdict,'Wait');
assert.equal(evaluatePick({...examples[0],price:173}).verdict,'Avoid');
assert.equal(evaluatePick({...examples[0],metrics:{...metrics,pledge:5}}).pass,false);
assert.equal(eligibleStocks([...examples,{...examples[0],symbol:'OTHER'}],date).length,3);
const lateIssue = assembleEdition(draft,prepared,[],new Date(date+'T10:01:00+05:30'));
assert.equal(lateIssue.publicationMode,'late');
const unlabelledLate = structuredClone(lateIssue);
delete unlabelledLate.publicationMode;
assert.ok(publicationErrors(unlabelledLate).some(error => error.includes('timestamp')));
const latestMarket = marketDashboard({...market,mode:'latest',session:'after-close',timestamp:date+'T15:30:00+05:30'},date);
assert.equal(latestMarket.asOf,'15:30 IST');
assert.throws(() => marketDashboard({...market,timestamp:date+'T15:30:00+05:30'},date),/timestamp/);
const noYield = structuredClone(market);
noYield.series['India 10-year G-sec yield'] = {url:source.url,unavailableReason:'Official observation not yet verified'};
assert.equal(marketDashboard(noYield,date).rows[8].level,null);
const noNifty = structuredClone(noYield);
noNifty.series['Nifty 50'] = noYield.series['India 10-year G-sec yield'];
assert.throws(() => marketDashboard(noNifty,date),/level/);
const duplicate = structuredClone(issue);
duplicate.sections.psychology[1].concept = duplicate.sections.psychology[0].concept;
assert.ok(publicationErrors(duplicate).some(error => error.startsWith('Psychology')));
const repeated = structuredClone(issue);
repeated.sections.india[0].why = repeated.sections.india[0].summary;
assert.ok(publicationErrors(repeated).some(error => error.includes('why repeats')));
const invented = structuredClone(issue);
invented.sections.investing[0].summary += ' Profit rose 222%.';
assert.ok(publicationErrors(invented,[],prepared).some(error => error.includes('dated evidence')));
const fabricated = structuredClone(issue);
fabricated.sections.investing[0].price += 1;
assert.ok(publicationErrors(fabricated,[],prepared).some(error => error.includes('fetched fundamentals')));
const missing = structuredClone(issue);
missing.sections.markets.dashboard.rows.pop();
assert.ok(publicationErrors(missing).some(error => error.includes('market dashboard')));
const close = (date, price, benchmark) => ({date,prices:{ALPHA:price},nifty50:benchmark,smallcap250:benchmark,
  equitiesSource:source.url,indicesSource:source.url});
const record = makeLedger([issue],[close(date,100,100),close('2026-11-19',110,103)]);
const first = record.rows.find(row => row.symbol === 'ALPHA');
assert.equal(first.priceAtPick,100);
assert.equal(first.currentPrice,110);
assert.equal(first.performance,10);
assert.equal(first.nifty,3);
assert.equal(record.summary.beating,100);
assert.equal(record.rows.find(row => row.symbol === 'BETA').nifty,null);
const repeatPick = structuredClone(issue);
repeatPick.date = '2026-11-19';
const twoDays = makeLedger([issue,repeatPick],[close(date,100,100),close('2026-11-19',110,103)]);
assert.equal(twoDays.rows.length, 2 * record.rows.length);
assert.equal(twoDays.positions.length, record.positions.length);
assert.deepEqual(twoDays.positions.find(row => row.symbol === 'ALPHA').pickDates, [date,'2026-11-19']);
assert.equal(twoDays.positions.find(row => row.symbol === 'ALPHA').performance, 10);
if (process.argv.includes('--fixture')) console.log(JSON.stringify(issue));
else console.log('Validated v2 edition gates, dashboard calculations, evidence, stock screen, and matched closing returns.');

const evening = structuredClone(issue);
evening.publishedAt = date+'T18:00:00+05:30';
const eveningLedger = makeLedger([evening],[close(date,100,100),close('2026-11-19',110,103)]);
assert.equal(eveningLedger.rows.find(row => row.symbol === 'ALPHA').priceAtPick,110);
assert.equal(eveningLedger.rows.find(row => row.symbol === 'ALPHA').baselineDate,'2026-11-19');
assert.equal(makeLedger([evening],[close(date,100,100)]).rows[0].performance,null);
const sparse = structuredClone(draft);
for (let i=0;i<5;i++) sparse.sections.investing[i] = card('unavailable-'+['first','second','third','fourth','fifth'][i],i+1,{slot:'unavailable',unavailableReason:'Historical valuation and cash-flow evidence were not verified.'});
sparse.top3 = draft.top3;
const gap = 'No verified passing candidates; financial fields remain absent.';
const sparsePrepared = {...prepared,picks:[],selection:{dips:[],picks:[],shortfall:{dip:gap,pick:gap}}};
const sparseIssue = assembleEdition(sparse,sparsePrepared,[],new Date(date+'T10:05:00+05:30'));
assert.equal(sparseIssue.sections.investing[0].slot,'unavailable');
const dishonest = structuredClone(sparse);
dishonest.sections.investing[0].verdict = 'Buy';
assert.throws(() => assembleEdition(dishonest,sparsePrepared,[],new Date(date+'T10:05:00+05:30')),/Stock card 1/);

// New selection rules
const at = time => new Date(date+'T'+time+'+05:30');
assert.equal(issue.stockLayout,'dip-quality');
assert.deepEqual(getDeck(issue,'investing').map(c => c.slot),['dip','dip','pick','pick','pick']);
assert.equal(getDeck(issue,'investing')[0].dip.fall,'no-peers');
assert.equal(dipCheck(dipStocks[0]).fromHigh,-37.5);
// A value trap (profit down 30% a year on) is not a 52-week-low pick
assert.equal(selectStocks([stockRow('TRAP','Chemicals',100,{high52:160,low52:95,profitYoY:-30})],date).dips.length,0);
// Promoters cutting their stake by more than 2 points disqualifies it too
assert.equal(selectStocks([stockRow('SELL','Chemicals',100,{high52:160,low52:95,promoterChange:-3})],date).dips.length,0);
// A whole sector falling is labelled sector-wide
const peer = (symbol,price) => stockRow(symbol,'Metals',price,{high52:100,low52:40,pe:30});
const sectorFall = selectStocks([stockRow('S1','Metals',100,{high52:160,low52:95}),peer('S2',70),peer('S3',75)],date);
assert.equal(sectorFall.dips[0].dip.fall,'sector-wide');
const aloneFall = selectStocks([stockRow('S1','Metals',100,{high52:160,low52:95}),peer('S2',98),peer('S3',97)],date);
assert.equal(aloneFall.dips[0].dip.fall,'stock-specific');
// Repeats: same verdict within 14 days is held back; a changed verdict comes back labelled
const shown = {...issue,date:'2026-11-12'};
assert.equal(selectStocks([...dipStocks,...examples],date,[shown]).counts.heldBack,5);
const changed = structuredClone(shown);
changed.sections.investing[2].verdict = 'Wait';
const again = selectStocks([...dipStocks,...examples],date,[changed]);
assert.deepEqual(again.picks.map(s => s.symbol),['GAMMA']);
assert.match(again.picks[0].repeat.reason,/Verdict changed/);
assert.equal(selectStocks([...dipStocks,...examples],date,[{...issue,date:'2026-11-01'}]).picks.length,3);
// One stock per sector across all five cards
assert.equal(selectStocks([stockRow('A1','Same',120),stockRow('A2','Same',121)],date).picks.length,1);
// Avoid verdicts are never shown
assert.equal(selectStocks([stockRow('PRICEY','Retail',200)],date).picks.length,0);
// The writer cannot swap in a stock the code did not choose, skip one, or leave out why a dip fell
const swapped = structuredClone(draft);
swapped.sections.investing[4] = stockCard('OTHER',4);
assert.throws(() => assembleEdition(swapped,prepared,[],at('09:57:00')),/not chosen by the selection code/);
const skipped = structuredClone(draft);
skipped.sections.investing[4] = card('unavailable-x',5,{slot:'unavailable',unavailableReason:'Skipped.'});
assert.throws(() => assembleEdition(skipped,prepared,[],at('09:57:00')),/selection code found enough/);
const noReason = structuredClone(draft);
delete noReason.sections.investing[0].whyFell;
assert.throws(() => assembleEdition(noReason,prepared,[],at('09:57:00')),/whyFell/);
// Monday: exactly one Buy of the week
const monday = '2026-11-23';
const mondayDraft = {...structuredClone(draft),date:monday};
const mondayIssue = assembleEdition(mondayDraft,{...prepared,dashboard:marketDashboard({...market,timestamp:monday+'T09:45:00+05:30',
  series:Object.fromEntries(snapshotNames.map(name => [name,{history:bases,level:103,url:source.url}]))},monday)},[],new Date(monday+'T09:57:00+05:30'));
assert.equal(getDeck(mondayIssue,'investing').filter(c => c.weekly).length,1);
// The track record logs 52-week-low picks
assert.ok(makeLedger([issue],[]).rows.some(row => row.symbol === 'DIPA' && row.group === '52-week low'));
// NSE file parsing (real header formats)
const rangeCsv = '"Disclaimer - adjusted"\n"Effective for 18-Nov-2026"\n"SYMBOL","SERIES","Adjusted_52_Week_High","52_Week_High_Date","Adjusted_52_Week_Low","52_Week_Low_DT"\n"POLYCAB","EQ","  10126.00","22-JUN-2026","   6663.00","27-JAN-2026"\n"XYZ","BE","10","-","5","-"\n';
assert.deepEqual(parseRange(rangeCsv,'2026-11-18').get('POLYCAB'),{high52:10126,low52:6663});
assert.equal(parseRange(rangeCsv,'2026-11-18').has('XYZ'),false);
assert.throws(() => parseRange(rangeCsv,'2026-11-17'),/not for/);
const bhavCsv = 'TradDt,TckrSymb,SctySrs,ClsPric,TtlTrfVal\n2026-11-18,POLYCAB,EQ,7307.50,6416129290.50\n2026-11-18,OLD,BE,5,1\n';
assert.equal(parseBhavcopy(bhavCsv,'2026-11-18').get('POLYCAB').close,7307.5);
const merged = mergeStockInput(date,{date:'2026-11-14',source:{label:'Weekly export',url:'https://example.org/weekly'},sources:[{label:'Weekly export',url:'https://example.org/weekly'}],
  stocks:[{symbol:'POLYCAB',sector:'Cables',kind:'non-financial',dataDate:'2026-09-30',metrics:{roce5y:28.4,eps:209.56,pe:99}},{symbol:'GONE',sector:'X',kind:'non-financial',dataDate:'2026-09-30',metrics:{}}]},
  {session:'2026-11-18',urls:{bhavcopy:'https://example.org/bhav',range:'https://example.org/range'},prices:parseBhavcopy(bhavCsv,'2026-11-18'),ranges:parseRange(rangeCsv,'2026-11-18')});
assert.equal(merged.stocks[0].price,7307.5);
assert.equal(merged.stocks[0].metrics.low52,6663);
assert.equal(merged.stocks[0].metricSources.roce5y.url,'https://example.org/weekly');
assert.deepEqual(merged.missingFromNse,['GONE']);
assert.equal(merged.stocks[0].metrics.pe,34.87); // recomputed from the NSE close, not the stale weekly 99
assert.equal(merged.stocks[0].metricSources.pe.url,'https://example.org/bhav');
console.log('Validated stock selection: 52-week-low rules, value-trap guards, quality ranking, sector and repeat limits, writer guards and NSE parsing.');

// Pledge missing from free sources: shown as not checked (null), never blocks or passes silently
const noPledge = stockRow('NOPLEDGE','Paper',100,{high52:160,low52:95});
delete noPledge.metrics.pledge;
assert.equal(evaluatePick(noPledge).screen.pledge,null);
assert.equal(evaluatePick(noPledge).pass,true);
assert.equal(evaluatePick({...noPledge,metrics:{...noPledge.metrics,pledge:12}}).pass,false);
// Screener page parsing (synthetic page in Screener's structure)
const row = (label,cells) => '<tr><td class="text">' + label + '</td>' + cells.map(c => '<td>' + c + '</td>').join('') + '</tr>';
const tbl = (id,heads,rows,extra='') => '<section id="' + id + '"><table class="data-table"><thead><tr><th></th>' + heads.map(h => '<th>' + h + '</th>').join('') +
  '</tr></thead><tbody>' + rows.join('') + '</tbody></table>' + extra + '</section>';
const years = ['Mar 2022','Mar 2023','Mar 2024','Mar 2025','Mar 2026'];
const qtrs = ['Sep 2025','Dec 2025','Mar 2026','Jun 2026','Sep 2026'];
const page = '<div data-company-id="42"></div><ul id="top-ratios"><li><span class="name">Market Cap</span><span class="nowrap value">₹ <span class="number">1,234</span> Cr.</span></li>' +
  '<li><span class="name">Dividend Yield</span><span class="nowrap value"><span class="number">1.50</span> %</span></li></ul>' +
  tbl('quarters',qtrs,[row('Sales&nbsp;+',[1,2,3,4,5]),row('Net Profit&nbsp;+',[100,110,120,130,150])]) +
  tbl('profit-loss',years,[row('Sales',[1,2,3,4,5])],'<table class="ranges-table"><tr><th>Compounded Sales Growth</th></tr><tr><td>10 Years:</td><td>9%</td></tr><tr><td>5 Years:</td><td>12%</td></tr></table>' +
    '<table class="ranges-table"><tr><th>Compounded Profit Growth</th></tr><tr><td>5 Years:</td><td>-4%</td></tr></table>') +
  tbl('balance-sheet',years,[row('Equity Capital',[10,10,10,10,10]),row('Reserves',[80,85,88,89,90]),row('Borrowings&nbsp;+',[30,20,10,5,25])]) +
  tbl('cash-flow',years,[row('Cash from Operating Activity&nbsp;+',[5,-2,7,8,9])]) +
  tbl('ratios',years,[row('ROCE %',['10%','15%','20%','25%','30%'])]) +
  tbl('shareholding',qtrs,[row('Promoters&nbsp;+',['50.00%','50.00%','50.00%','51.00%','50.50%'])]);
const peHistory = from => ({metric:'Price to Earning',values:[[from,20],['2026-11-19',22]]});
const parsed = parseCompany(page,{datasets:[{metric:'EPS',values:[['2026-10-01',12.5]]},peHistory('2021-11-26'),{metric:'Median PE',values:[['2026-11-19','30.4']]}]});
const young = parseCompany(page,{datasets:[{metric:'EPS',values:[['2026-10-01',12.5]]},peHistory('2024-11-01'),{metric:'Median PE',values:[['2026-11-19','80']]}]});
assert.equal(young.metrics.peMedian5y,undefined); // under 4.5 years of P/E history: no 5-year median
assert.deepEqual(parsed.metrics,{marketCap:1234,divYield:1.5,roce5y:20,de:0.25,salesCagr5y:12,profitCagr5y:-4,ocfPositiveYears:4,
  profitYoY:50,promoterHolding:50.5,promoterChange:-0.5,eps:12.5,peMedian5y:30.4});
assert.equal(parsed.dataDate,'2026-09-30');
const noPromoters = parseCompany(page.replace(/Promoters/,'Public'),null);
assert.deepEqual([noPromoters.metrics.promoterHolding,noPromoters.metrics.pledge],[0,0]);
console.log('Validated pledge handling and Screener page parsing.');

assert.ok(roughly(27, 26.86) && roughly(35, 34.87) && roughly(7600, 7599.48) && roughly(1.1, 110131), 'rounded figures pass');
assert.ok(!roughly(222, 25.04) && !roughly(40, 34.87), 'unsourced or wrong figures fail');
assert.ok(figuresStated('7.6%', {summary:'Economists expect 7.6% growth.'}) && figuresStated('90–100 km/h', {summary:'Winds of 90–100 km/h.'}), 'stated figures pass');
assert.ok(!figuresStated('9%', {summary:'Economists expect 7.6% growth.'}), 'a key number the story never states fails');

// The big-story checklist: every trending headline is covered by a card or skipped for a reason.
const feedXml = '<rss><channel><item><title>Jensen Huang Is Back At Nvidia - NDTV</title><link>https://news.google.com/a</link><source url="https://ndtv.com">NDTV</source><description>&lt;ol&gt;&lt;li&gt;x&lt;/li&gt;&lt;li&gt;y&lt;/li&gt;&lt;/ol&gt;</description></item></channel></rss>';
assert.deepEqual(parseFeed(feedXml).map(item => [item.title, item.source, item.related]), [['Jensen Huang Is Back At Nvidia', 'NDTV', 2]], 'Google News items parse');
const trend = {items:[{id:'world1', feed:'World', rank:1, title:'A'}, {id:'world2', feed:'World', rank:2, title:'B'}, {id:'world3', feed:'World', rank:3, title:'C'}, {id:'world4', feed:'World', rank:4, title:'D'}]};
const ids = new Set(['c1', 'c2']);
assert.deepEqual(coverageProblems(trend, {world1:'c1', world2:'c2', world3:'skip: a celebrity rumour only', world4:'skip: minor local sports score'}, ids), [], 'covered or reasoned skips pass');
assert.equal(coverageProblems(trend, {world1:'c1', world2:'c2', world3:'skip: a celebrity rumour only'}, ids).length, 1, 'a missing headline fails');
assert.equal(coverageProblems(trend, {world1:'skip: not important really', world2:'skip: not important either', world3:'c1', world4:'c2'}, ids).length, 1, 'skipping two of a feed\'s top three fails');
assert.equal(coverageProblems(trend, {world1:'c9', world2:'c2', world3:'c1', world4:'skip: no'}, ids).length, 2, 'unknown card ids and empty reasons fail');
assert.deepEqual(coverageProblems(null, {}, ids), [], 'no checklist, no check');
console.log('Validated the big-story checklist.');
const stiff = text => stiffWords.filter(([pattern]) => pattern.test(text)).length;
assert.equal(stiff('Its prepared five-year history shows verified growth of 22% and 27% respectively.'), 3, 'report-speak is caught');
assert.equal(stiff('Sales grew about 22% a year. The plan was prepared by the ministry.'), 0, 'plain words pass');
console.log('Validated the plain-words check.');
const lessonCard = JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../public/editions/2026-11-24.json', import.meta.url), 'utf8')).sections.psychology[0];
assert.deepEqual(lessonProblems(lessonCard), [], 'a full psychology lesson passes');
assert.ok(lessonProblems({...lessonCard, experiment:undefined, examples:['one']}).length >= 2, 'a lesson without the experiment or enough examples fails');
console.log('Validated the psychology lesson format.');
