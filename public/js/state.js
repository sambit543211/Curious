// The one place that holds what the reader is looking at.
export const state = {
  edition:null,    // the edition on screen
  order:[],        // every story in reading order: {topic, index, total, card, key}
  read:new Set(),  // keys of stories read in this edition
  loading:false
};
export const isRead = story => state.read.has(story.key);
export const readCount = (topic) => state.order.filter(story => (!topic || story.topic === topic) && isRead(story)).length;
export const firstUnread = () => state.order.findIndex(story => !isRead(story));
