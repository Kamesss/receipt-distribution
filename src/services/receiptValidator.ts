/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure validation and normalization module for receipt OCR payloads and calculation requests.
 * Decoupled from HTTP framework and AI SDKs for deterministic unit testing.
 */

import {
  GroupParticipant,
  ItemAssignmentMap,
  ParsedReceiptData,
  ReceiptLineItem,
  TaxTipDistributionConfig,
} from '../types/receipt.ts';
import { fromCents, toCents } from './billSplitCalculator.ts';

export interface OcrParseRequestPayload {
  imageBase64: string;
  mimeType: string;
}

export interface CalculateSplitRequestPayload {
  items: ReceiptLineItem[];
  participants: GroupParticipant[];
  assignments: ItemAssignmentMap;
  config: TaxTipDistributionConfig;
}

/**
 * Validates and normalizes incoming base64 receipt image payloads.
 */
export function validateOcrRequest(body: unknown): OcrParseRequestPayload {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body must be a JSON object.');
  }

  const record = body as Record<string, unknown>;
  const rawImage = typeof record.imageBase64 === 'string' ? record.imageBase64.trim() : '';
  const rawMime = typeof record.mimeType === 'string' ? record.mimeType.trim() : 'image/jpeg';

  if (!rawImage) {
    throw new Error('Missing receipt image payload (imageBase64).');
  }

  // Strip optional data URI prefix if present
  const base64Clean = rawImage.includes(',') ? rawImage.split(',')[1] : rawImage;

  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  const normalizedMime = allowedMimes.includes(rawMime.toLowerCase())
    ? rawMime.toLowerCase()
    : 'image/jpeg';

  return {
    imageBase64: base64Clean,
    mimeType: normalizedMime,
  };
}

/**
 * Sanitizes and reconciles raw structured JSON returned from the OCR model into a clean `ParsedReceiptData`.
 */
export function normalizeParsedReceipt(raw: unknown): ParsedReceiptData {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  const merchantName =
    typeof obj.merchantName === 'string' && obj.merchantName.trim().length > 0
      ? obj.merchantName.trim()
      : 'Merchant Receipt';

  const receiptDate =
    typeof obj.receiptDate === 'string' && obj.receiptDate.trim().length > 0
      ? obj.receiptDate.trim()
      : new Date().toISOString().slice(0, 10);

  const currency =
    typeof obj.currency === 'string' && obj.currency.trim().length > 0
      ? obj.currency.trim().toUpperCase()
      : 'PHP';

  const rawItems = Array.isArray(obj.items) ? obj.items : [];
  const items: ReceiptLineItem[] = rawItems
    .map((entry, index): ReceiptLineItem | null => {
      if (!entry || typeof entry !== 'object') return null;
      const itemObj = entry as Record<string, unknown>;
      const name =
        typeof itemObj.name === 'string' && itemObj.name.trim().length > 0
          ? itemObj.name.trim()
          : `Item ${index + 1}`;

      const quantity =
        typeof itemObj.quantity === 'number' && Number.isFinite(itemObj.quantity) && itemObj.quantity > 0
          ? Math.round(itemObj.quantity * 100) / 100
          : 1;

      const rawTotal =
        typeof itemObj.totalPrice === 'number' && Number.isFinite(itemObj.totalPrice)
          ? itemObj.totalPrice
          : typeof itemObj.unitPrice === 'number' && Number.isFinite(itemObj.unitPrice)
            ? itemObj.unitPrice * quantity
            : 0;

      const totalPrice = fromCents(Math.max(0, toCents(rawTotal)));
      const unitPrice =
        quantity > 0 ? fromCents(Math.round(toCents(totalPrice) / quantity)) : totalPrice;

      if (totalPrice <= 0) return null;

      return {
        id:
          typeof itemObj.id === 'string' && itemObj.id.trim().length > 0
            ? itemObj.id.trim()
            : `item-${index + 1}`,
        name,
        quantity,
        unitPrice,
        totalPrice,
        category: typeof itemObj.category === 'string' ? itemObj.category.trim() : undefined,
      };
    })
    .filter((item): item is ReceiptLineItem => item !== null);

  const computedItemsSubtotalCents = items.reduce((sum, item) => sum + toCents(item.totalPrice), 0);
  const computedSubtotal = fromCents(computedItemsSubtotalCents);

  const tax =
    typeof obj.tax === 'number' && Number.isFinite(obj.tax) && obj.tax >= 0
      ? fromCents(toCents(obj.tax))
      : 0;

  const tip =
    typeof obj.tip === 'number' && Number.isFinite(obj.tip) && obj.tip >= 0
      ? fromCents(toCents(obj.tip))
      : 0;

  const serviceFee =
    typeof obj.serviceFee === 'number' && Number.isFinite(obj.serviceFee) && obj.serviceFee >= 0
      ? fromCents(toCents(obj.serviceFee))
      : 0;

  const discount =
    typeof obj.discount === 'number' && Number.isFinite(obj.discount) && obj.discount >= 0
      ? fromCents(toCents(obj.discount))
      : 0;

  const total = fromCents(
    Math.max(
      0,
      computedItemsSubtotalCents +
        toCents(tax) +
        toCents(tip) +
        toCents(serviceFee) -
        toCents(discount)
    )
  );

  return {
    merchantName,
    receiptDate,
    currency,
    items,
    subtotal: computedSubtotal,
    tax,
    tip,
    serviceFee,
    discount,
    total,
  };
}

/**
 * Validates incoming calculation payload for the `/api/split/calculate` route.
 */
export function validateCalculateSplitRequest(body: unknown): CalculateSplitRequestPayload {
  if (!body || typeof body !== 'object') {
    throw new Error('Calculation payload must be a JSON object.');
  }

  const record = body as Record<string, unknown>;
  if (!Array.isArray(record.items)) {
    throw new Error('Calculation payload requires an items array.');
  }
  if (!Array.isArray(record.participants)) {
    throw new Error('Calculation payload requires a participants array.');
  }

  return {
    items: record.items as ReceiptLineItem[],
    participants: record.participants as GroupParticipant[],
    assignments: (record.assignments as ItemAssignmentMap) || {},
    config: (record.config as TaxTipDistributionConfig) || {
      mode: 'proportional',
      customTaxAmount: 0,
      customServiceFeeAmount: 0,
      customDiscountAmount: 0,
      tipMode: 'percentage',
      tipPercentage: 18,
      tipFixedAmount: 0,
    },
  };
}
