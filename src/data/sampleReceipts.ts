/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GroupParticipant, ParsedReceiptData } from '../types/receipt.ts';

export const PARTICIPANT_COLORS = [
  '#2563EB', // Blue
  '#059669', // Emerald
  '#D97706', // Amber
  '#7C3AED', // Violet
  '#DC2626', // Rose
  '#0891B2', // Cyan
  '#4F46E5', // Indigo
  '#EA580C', // Orange
];

export const INITIAL_PARTICIPANTS: GroupParticipant[] = [
  { id: 'p-1', name: 'James', initials: 'JA', colorHex: '#2563EB' },
  { id: 'p-2', name: 'Mikay', initials: 'MI', colorHex: '#059669' },
  { id: 'p-3', name: 'Jason', initials: 'JS', colorHex: '#D97706' },
];

export const EMPTY_RECEIPT: ParsedReceiptData = {
  merchantName: '',
  receiptDate: new Date().toISOString().slice(0, 10),
  currency: 'PHP',
  items: [],
  subtotal: 0,
  tax: 0,
  tip: 0,
  serviceFee: 0,
  discount: 0,
  total: 0,
};

/**
 * Formats a number in Philippine Peso (`₱1,234.50`).
 */
export function formatPhp(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `₱${safe.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
