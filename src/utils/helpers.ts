// src/utils/helpers.ts
// Shared utility functions: uid, currency, date formatting

/** Generate a short unique id */
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Format a number as Indian Rupee currency string */
export function formatCurrency(amount: number): string {
  return '₹' + (amount || 0).toFixed(2);
}

/** Return today's date as YYYY-MM-DD */
export function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/** Format a Date object to human-readable Indian locale string */
export function formatDate(date: Date = new Date()): string {
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Format a Date object to short date string */
export function formatShortDate(date: Date = new Date()): string {
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
