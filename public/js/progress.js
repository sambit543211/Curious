// Reading progress lives on this device only, keyed by edition date.
import { matchProgress } from '../edition-format.js';

const legacyKey = day => 'morning-edition:read:' + day;
export const progressKey = day => 'morning-edition:read:v2:' + day;
const totalsKey = 'morning-edition:totals';

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Progress still works for this visit. */ }
}
const strings = key => {
  const value = readJSON(key, []);
  return new Set(Array.isArray(value) ? value.filter(entry => typeof entry === 'string') : []);
};

export const isProgressKey = (key, day) => key === null || key === progressKey(day) || key === legacyKey(day);
export const loadProgress = issue => matchProgress(issue, strings(progressKey(issue.date)), strings(legacyKey(issue.date)));
export const saveProgress = (issue, read) => writeJSON(progressKey(issue.date), [...read]);

// Totals let the archive show "Done" without downloading every edition.
export function rememberTotal(day, total) {
  const totals = readJSON(totalsKey, {});
  if (totals[day] === total) return;
  writeJSON(totalsKey, {...totals, [day]:total});
}
export function savedSummary(day) {
  const read = Math.max(strings(progressKey(day)).size, strings(legacyKey(day)).size);
  const total = readJSON(totalsKey, {})[day];
  return {read, total:Number.isInteger(total) ? total : null};
}
