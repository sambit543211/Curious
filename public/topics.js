// The single definition of the briefing's topics: order, names and reader wording.
// `aliases` are words a card label may repeat that add nothing inside that topic.
export const topics = [
  {id:'india', name:'India', aliases:['india'], color:'#ff9f43'},
  {id:'world', name:'World', aliases:['world'], color:'#5aa9ff'},
  {id:'markets', name:'Indian Markets', aliases:['indian markets', 'markets'], color:'#4fd28a',
    context:'Why it matters for markets'},
  {id:'investing', name:'Stock Investing', aliases:['stock investing', 'investing'], color:'#f5b54a',
    why:'The backstory', context:'Cheap or expensive?'},
  {id:'tech', name:'AI & Tech', aliases:['ai & tech', 'tech'], color:'#a78bfa'},
  {id:'mind', name:'Psychology', aliases:['psychology', 'mind'], color:'#f472b6'},
  {id:'marketing', name:'Marketing', aliases:['marketing'], color:'#2dd4bf',
    why:'Why this approach', context:'Why it matters for marketers'}
];
export const topicIds = topics.map(topic => topic.id);
export const topicById = Object.fromEntries(topics.map(topic => [topic.id, {
  why:'Why it happened', context:'Why it matters', ...topic
}]));
export const topicName = id => topicById[id]?.name ?? id;
