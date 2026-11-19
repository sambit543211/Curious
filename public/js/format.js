const number = new Intl.NumberFormat('en-IN', {maximumFractionDigits:2});
export const formatNumber = value => Number.isFinite(value) ? number.format(value) : '—';
export const rupees = value => Number.isFinite(value) ? '₹' + formatNumber(value) : '—';
export const signed = value => Number.isFinite(value) ? (value > 0 ? '+' : value < 0 ? '−' : '') + formatNumber(Math.abs(value)) : '—';
export const percent = value => Number.isFinite(value) ? signed(value) + '%' : '—';
export const trend = value => Number.isFinite(value) && value !== 0 ? (value > 0 ? 'up' : 'down') : '';

const fmt = options => new Intl.DateTimeFormat('en-GB', {...options, timeZone:'UTC'});
const at = day => new Date(day + 'T12:00:00Z');
const longDay = fmt({weekday:'long', day:'numeric', month:'long'});
const shortDay = fmt({weekday:'short', day:'numeric', month:'short'});
const dayMonth = fmt({day:'numeric', month:'short'});
const month = fmt({month:'long', year:'numeric'});
const releaseTime = new Intl.DateTimeFormat('en-IN', {hour:'numeric', minute:'2-digit', timeZone:'Asia/Kolkata'});

export const longDate = day => longDay.format(at(day)).replace(',', '');
export const shortDate = day => shortDay.format(at(day)).replace(',', '');
export const dayAndMonth = day => dayMonth.format(at(day));
export const monthName = day => month.format(at(day));
export const istTime = timestamp => releaseTime.format(new Date(timestamp)).replace(/\s?([ap])m$/i, (_, x) => ' ' + x.toUpperCase() + 'M');

const istParts = new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Kolkata', hour:'2-digit', minute:'2-digit', hourCycle:'h23'});
export const istMinutes = (date = new Date()) => {
  const [hours, minutes] = istParts.format(date).split(':').map(Number);
  return hours * 60 + minutes;
};

const weekdayFmt = fmt({weekday:'long'});
const longDayMonth = fmt({day:'numeric', month:'long'});
export const weekday = day => weekdayFmt.format(at(day));
export const dayMonthLong = day => longDayMonth.format(at(day));
export const fullDate = day => weekday(day) + ' ' + dayMonthLong(day);
