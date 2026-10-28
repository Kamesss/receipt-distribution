/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GroupParticipant, ItemAssignmentMap, ParsedReceiptData } from '../types/receipt.ts';

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

export interface SampleReceiptPreset {
  id: string;
  label: string;
  subtitle: string;
  receipt: ParsedReceiptData;
  defaultAssignments: ItemAssignmentMap;
}

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

export const SAMPLE_RECEIPT_PRESETS: SampleReceiptPreset[] = [
  {
    id: 'manam-bgc',
    label: 'Manam Comfort Filipino',
    subtitle: '7 items · Sisig, Sinigang & Shake',
    receipt: {
      merchantName: 'Manam Netpark BGC',
      receiptDate: '2026-10-28',
      currency: 'PHP',
      items: [
        {
          id: 'item-1',
          name: 'House Crispy Sisig (Large)',
          quantity: 1,
          unitPrice: 545.0,
          totalPrice: 545.0,
          category: 'Shared Pulutan',
        },
        {
          id: 'item-2',
          name: 'Sinigang na Beef Short Rib & Watermelon',
          quantity: 1,
          unitPrice: 795.0,
          totalPrice: 795.0,
          category: 'Shared Main',
        },
        {
          id: 'item-3',
          name: 'Crispy Pancit Palabok',
          quantity: 1,
          unitPrice: 485.0,
          totalPrice: 485.0,
          category: 'Noodles',
        },
        {
          id: 'item-4',
          name: 'Gising-Gising (Medium)',
          quantity: 1,
          unitPrice: 360.0,
          totalPrice: 360.0,
          category: 'Vegetables',
        },
        {
          id: 'item-5',
          name: 'Garlic Rice Platter',
          quantity: 1,
          unitPrice: 240.0,
          totalPrice: 240.0,
          category: 'Rice',
        },
        {
          id: 'item-6',
          name: 'Buko Pandan Shake',
          quantity: 2,
          unitPrice: 195.0,
          totalPrice: 390.0,
          category: 'Beverage',
        },
        {
          id: 'item-7',
          name: 'Calamansi Tart',
          quantity: 2,
          unitPrice: 185.0,
          totalPrice: 370.0,
          category: 'Dessert',
        },
      ],
      subtotal: 3185.0,
      tax: 382.2,
      tip: 318.5,
      serviceFee: 0,
      discount: 0,
      total: 3885.7,
    },
    defaultAssignments: {
      'item-1': ['p-1', 'p-2', 'p-3'],
      'item-2': ['p-1', 'p-2', 'p-3'],
      'item-3': ['p-1', 'p-2'],
      'item-4': ['p-3'],
      'item-5': ['p-1', 'p-2', 'p-3'],
      'item-6': ['p-1', 'p-2'],
      'item-7': ['p-2', 'p-3'],
    },
  },
  {
    id: 'mendokoro-makati',
    label: 'Mendokoro Ramenba',
    subtitle: '6 items · Ramen, Gyoza & Drinks',
    receipt: {
      merchantName: 'Mendokoro Ramenba Salcedo',
      receiptDate: '2026-10-26',
      currency: 'PHP',
      items: [
        {
          id: 'm-1',
          name: 'Super Chashu Tonkotsu Ramen',
          quantity: 1,
          unitPrice: 650.0,
          totalPrice: 650.0,
          category: 'Ramen',
        },
        {
          id: 'm-2',
          name: 'Tantanmen',
          quantity: 1,
          unitPrice: 540.0,
          totalPrice: 540.0,
          category: 'Ramen',
        },
        {
          id: 'm-3',
          name: 'Shoyu Tonkotsu Ramen',
          quantity: 1,
          unitPrice: 490.0,
          totalPrice: 490.0,
          category: 'Ramen',
        },
        {
          id: 'm-4',
          name: 'Maze Soba',
          quantity: 1,
          unitPrice: 520.0,
          totalPrice: 520.0,
          category: 'Dry Noodles',
        },
        {
          id: 'm-5',
          name: 'Handmade Yaki Gyoza (2 Orders)',
          quantity: 2,
          unitPrice: 250.0,
          totalPrice: 500.0,
          category: 'Side',
        },
        {
          id: 'm-6',
          name: 'House Iced Tea Pitcher',
          quantity: 1,
          unitPrice: 280.0,
          totalPrice: 280.0,
          category: 'Beverage',
        },
      ],
      subtotal: 2980.0,
      tax: 357.6,
      tip: 298.0,
      serviceFee: 0,
      discount: 100.0,
      total: 3535.6,
    },
    defaultAssignments: {
      'm-1': ['p-1'],
      'm-2': ['p-2'],
      'm-3': ['p-3'],
      'm-4': ['p-1', 'p-3'],
      'm-5': ['p-1', 'p-2', 'p-3'],
      'm-6': ['p-1', 'p-2', 'p-3'],
    },
  },
];

/**
 * Generates a realistic high-resolution Philippine thermal receipt image on an HTML5 `<canvas>`
 * and returns a base64 PNG data URL so users can test real Gemini Vision OCR `/api/receipt/parse`
 * on their phone even without a physical paper receipt in front of their camera.
 */
export function renderSampleReceiptImageBase64(receipt: ParsedReceiptData): string {
  const canvas = document.createElement('canvas');
  canvas.width = 680;
  canvas.height = 980;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Paper background
  ctx.fillStyle = '#FCFBF7';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle thermal paper grain border
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  ctx.fillStyle = '#0F172A';
  ctx.textAlign = 'center';
  ctx.font = 'bold 28px monospace';
  ctx.fillText(receipt.merchantName.toUpperCase(), canvas.width / 2, 85);

  ctx.font = '16px monospace';
  ctx.fillStyle = '#475569';
  ctx.fillText(`DATE: ${receipt.receiptDate}   CURRENCY: PHP`, canvas.width / 2, 120);
  ctx.fillText('------------------------------------------------', canvas.width / 2, 150);

  ctx.textAlign = 'left';
  ctx.font = 'bold 16px monospace';
  ctx.fillStyle = '#0F172A';
  ctx.fillText('QTY   ITEM DESCRIPTION', 55, 182);
  ctx.textAlign = 'right';
  ctx.fillText('AMOUNT (PHP)', canvas.width - 55, 182);

  ctx.textAlign = 'center';
  ctx.font = '16px monospace';
  ctx.fillStyle = '#475569';
  ctx.fillText('------------------------------------------------', canvas.width / 2, 206);

  let y = 245;
  ctx.font = '18px monospace';
  ctx.fillStyle = '#0F172A';

  for (const item of receipt.items) {
    ctx.textAlign = 'left';
    const qtyLabel = `${item.quantity}x`.padEnd(5, ' ');
    ctx.fillText(`${qtyLabel} ${item.name}`, 55, y);

    ctx.textAlign = 'right';
    ctx.fillText(`PHP ${item.totalPrice.toFixed(2)}`, canvas.width - 55, y);
    y += 42;
  }

  y += 10;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#475569';
  ctx.fillText('------------------------------------------------', canvas.width / 2, y);

  y += 38;
  const drawSummaryRow = (label: string, val: number, bold = false) => {
    ctx.font = bold ? 'bold 22px monospace' : '18px monospace';
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'left';
    ctx.fillText(label, 55, y);
    ctx.textAlign = 'right';
    ctx.fillText(`${val < 0 ? '-' : ''}PHP ${Math.abs(val).toFixed(2)}`, canvas.width - 55, y);
    y += 36;
  };

  drawSummaryRow('SUBTOTAL', receipt.subtotal);
  drawSummaryRow('12% VAT / TAX', receipt.tax);
  if (receipt.serviceFee > 0) {
    drawSummaryRow('SERVICE FEE', receipt.serviceFee);
  }
  if (receipt.discount > 0) {
    drawSummaryRow('DISCOUNT', -receipt.discount);
  }
  if (receipt.tip > 0) {
    drawSummaryRow('SERVICE CHARGE / TIP', receipt.tip);
  }

  y += 8;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0F172A';
  ctx.fillText('================================================', canvas.width / 2, y);
  y += 40;
  drawSummaryRow('TOTAL', receipt.total, true);

  y += 35;
  ctx.textAlign = 'center';
  ctx.font = '14px monospace';
  ctx.fillStyle = '#64748B';
  ctx.fillText('MARAMING SALAMAT PO · OFFICIAL RECEIPT', canvas.width / 2, y);

  return canvas.toDataURL('image/png');
}
