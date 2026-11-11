// Category-wise daily timings. They apply every day (Monday to Sunday).
// This is the single source for both the DAILY TIMINGS section and the footer's Visit column,
// so the two always match exactly.
export const TIMINGS_DAYS = 'Every day, Monday to Sunday';

export const DAILY_TIMINGS = [
  { key: 'chai', label: 'Chai', open: '5:00 AM', close: '12:00 PM' },
  { key: 'tiffins', label: 'Tiffins', open: '6:00 AM', close: '12:00 PM' },
  { key: 'lunch', label: 'Lunch', open: '12:00 PM', close: '1:00 AM', closeNote: 'next day' },
  { key: 'bakery', label: 'Bakery', open: '5:00 AM', close: '1:00 PM' },
  { key: 'shawarma', label: 'Shawarma', open: '12:00 PM', close: '12:00 AM' },
];

// "5:00 AM – 12:00 PM", or "12:00 PM – 1:00 AM (next day)".
export function formatTiming(item) {
  return `${item.open} – ${item.close}${item.closeNote ? ` (${item.closeNote})` : ''}`;
}
