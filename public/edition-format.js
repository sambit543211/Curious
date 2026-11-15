export const topicIds = ['india', 'world', 'markets', 'tech', 'mind', 'marketing'];

const ist = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
});

export function indianDay(date = new Date()) {
  const parts = Object.fromEntries(ist.formatToParts(date).map(part => [part.type, part.value]));
  return [parts.year, parts.month, parts.day].join('-');
}

export function isDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const day = new Date(value + 'T00:00:00Z');
  return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === value;
}

export function isEdition(value) {
  if (!isDay(value?.date) || !value.sections) return false;
  return topicIds.every(id => {
    const deck = value.sections[id];
    if (id === 'marketing' && deck === undefined) return true;
    return Array.isArray(deck) && deck.length === 5 && deck.every(card =>
      ['label','headline','summary','context','source','sourceUrl'].every(key =>
        typeof card?.[key] === 'string' && card[key].trim()
      )
    );
  });
}
