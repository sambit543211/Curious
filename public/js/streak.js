// A day counts toward the streak once that edition's top stories have been read.
// Days are edition dates, so a day without an edition never breaks a streak.
import { indianDay } from '../edition-format.js';

const key = 'morning-edition:streak';
function load() {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return new Set(Array.isArray(value) ? value.filter(day => typeof day === 'string') : []);
  } catch { return new Set(); }
}
function save(days) {
  try { localStorage.setItem(key, JSON.stringify([...days].sort().slice(-400))); } catch { /* Streak still shows for this visit. */ }
}

export function recordDay(day, topKeys, read) {
  if (!topKeys.length || !topKeys.every(storyKey => read.has(storyKey))) return false;
  const days = load();
  if (days.has(day)) return false;
  days.add(day);
  save(days);
  return true;
}

// `dates` is the edition catalog, newest first.
export function streakSummary(dates) {
  const days = load();
  let current = 0;
  let started = false;
  for (const [index, day] of dates.entries()) {
    if (days.has(day)) { current++; started = true; continue; }
    // Today's edition not read yet doesn't break yesterday's streak.
    if (!started && index === 0) continue;
    break;
  }
  let best = 0;
  let run = 0;
  for (const day of [...dates].reverse()) {
    run = days.has(day) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  const today = indianDay();
  const week = Array.from({length:7}, (_, offset) => {
    const date = new Date(today + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() - (6 - offset));
    const day = date.toISOString().slice(0, 10);
    return {day, on:days.has(day), today:day === today,
      label:new Intl.DateTimeFormat('en-GB', {weekday:'short', timeZone:'UTC'}).format(date)};
  });
  return {current, best, week};
}
