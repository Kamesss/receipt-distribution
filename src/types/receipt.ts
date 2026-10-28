/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ReceiptLineItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  category?: string;
}

export interface ParsedReceiptData {
  merchantName: string;
  receiptDate: string;
  currency: string;
  items: ReceiptLineItem[];
  subtotal: number;
  tax: number;
  tip: number;
  serviceFee: number;
  discount: number;
  total: number;
}

export interface GroupParticipant {
  id: string;
  name: string;
  initials: string;
  colorHex: string;
}

/**
 * Maps each receipt item ID to an array of participant IDs sharing that item.
 */
export type ItemAssignmentMap = Record<string, string[]>;

export interface TaxTipDistributionConfig {
  mode: 'proportional' | 'equal';
  customTaxAmount: number;
  customServiceFeeAmount: number;
  customDiscountAmount: number;
  tipMode: 'percentage' | 'fixed';
  tipPercentage: number;
  tipFixedAmount: number;
}

export interface AssignedItemDetail {
  itemId: string;
  name: string;
  fullPrice: number;
  sharedByCount: number;
  sharePrice: number;
}

export interface ParticipantBreakdown {
  participant: GroupParticipant;
  assignedItems: AssignedItemDetail[];
  itemsSubtotal: number;
  subtotalShareRatio: number;
  taxShare: number;
  serviceFeeShare: number;
  discountShare: number;
  tipShare: number;
  totalOwed: number;
}

export interface BillSplitCalculationResult {
  participants: ParticipantBreakdown[];
  assignedItemsSubtotal: number;
  unassignedItemsSubtotal: number;
  unassignedItemIds: string[];
  receiptSubtotal: number;
  effectiveTax: number;
  effectiveServiceFee: number;
  effectiveDiscount: number;
  effectiveTip: number;
  grandTotal: number;
  isFullyAssigned: boolean;
}
