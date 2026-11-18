import assert from 'node:assert/strict';
import { assembleEdition, eligibleStocks, marketDashboard, publicationErrors, snapshotNames } from '../lib/edition-v2.js';
import { getDeck, isEdition } from '../public/edition-format.js';
import { evaluatePick } from '../public/investment-rules.js';
import { makeLedger } from '../lib/track-record.js';

const source = {label:'Sandbox source fixture',url:'https://example.org/fixture'};
const date = '2026-11-18';
const evidence = {url:source.url,asOf:'2026-11-17'};
const metrics = {roce5y:18,de:0.2,salesCagr5y:15,profitCagr5y:12,ocfPositiveYears:5,
  pe:12,peMedian5y:18,peg:1,eps:10,divYield:2,promoterHolding:40,pledge:0,marketCap:2300,avgDailyValue:12};
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
const examples = ['ALPHA','BETA','GAMMA'].map((symbol,index) => ({
  symbol,sector:['Industrials','Software','Consumer'][index],kind:'non-financial',price:120+index,
  dataDate:evidence.asOf,quoteDate:evidence.asOf,metrics,sources:[source],
  metricSources:Object.fromEntries(['price',...Object.keys(metrics)].map(key => [key,evidence]))
}));
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
const stockPicks = examples.map(({symbol},i) => card(symbol,i+1,{
  symbol,moat:'Switching cost',moatWhy:'Moving contracts requires a separate migration.',
  thesis:['Renewals support recurring revenue.','New distribution channels widen the addressable market.','The price is below the screened buy-below level.'],
  breakers:['Renewals decline across major cohorts.','A competing standard makes migration cheaper.']
}));
const draft = {
  date,top3:[{cardId:'india-first',line:'Policy consultation opens'},{cardId:'world-first',line:'Bilateral negotiations begin'},
    {cardId:'markets-dashboard',line:'Markets snapshot'}],
  sections:{
    india:deck('india',['policy','policy','business','society','wildcard']),
    world:deck('world',['geopolitics','geopolitics','economy','us-china','wildcard']).map(item => ({...item,indiaLink:'Monitor shipping demand in India.'})),
    markets:{dashboard:card('markets-dashboard',1),cards:deck('markets',['sector','result','ipo','flows']).map((item,i) => ({...item,rank:i+2}))},
    investing:[...stockPicks,card('stock-watchlist',4),card('stock-lesson',5,{exampleMetric:{symbol:'ALPHA',metric:'roce5y'}})],
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
const prepared = {picks:eligibleStocks(examples,date),dashboard,facts:[],watchlist:{entries:[],dataDate:evidence.asOf}};
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
if (process.argv.includes('--fixture')) console.log(JSON.stringify(issue));
else console.log('Validated v2 edition gates, dashboard calculations, evidence, stock screen, and matched closing returns.');

const evening = structuredClone(issue);
evening.publishedAt = date+'T18:00:00+05:30';
const eveningLedger = makeLedger([evening],[close(date,100,100),close('2026-11-19',110,103)]);
assert.equal(eveningLedger.rows.find(row => row.symbol === 'ALPHA').priceAtPick,110);
assert.equal(eveningLedger.rows.find(row => row.symbol === 'ALPHA').baselineDate,'2026-11-19');
assert.equal(makeLedger([evening],[close(date,100,100)]).rows[0].performance,null);
const sparse = structuredClone(draft);
for (let i=0;i<3;i++) sparse.sections.investing[i] = card('unavailable-'+['first','second','third'][i],i+1,{slot:'unavailable',unavailableReason:'Historical valuation and cash-flow evidence were not verified.'});
sparse.top3 = draft.top3;
sparse.sections.investing[4].exampleMetric = null;
const sparsePrepared = {...prepared,picks:[],fundamentalsUnavailable:'No verified passing candidates; financial fields remain absent.'};
const sparseIssue = assembleEdition(sparse,sparsePrepared,[],new Date(date+'T10:05:00+05:30'));
assert.equal(sparseIssue.sections.investing[0].slot,'unavailable');
assert.equal(sparseIssue.sections.investing[4].exampleMetric,null);
const dishonest = structuredClone(sparse);
dishonest.sections.investing[0].verdict = 'Buy';
assert.throws(() => assembleEdition(dishonest,sparsePrepared,[],new Date(date+'T10:05:00+05:30')),/documented input gap/);
