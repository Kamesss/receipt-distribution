/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure, zero-dependency financial calculation engine for receipt bill splitting.
 * Segregated from HTTP/Worker transport and OCR provider logic for deterministic unit testing.
 */

import {
  AssignedItemDetail,
  BillSplitCalculationResult,
  GroupParticipant,
  ItemAssignmentMap,
  ParticipantBreakdown,
  ReceiptLineItem,
  TaxTipDistributionConfig,
} from '../types/receipt.ts';

/**
 * Converts a dollar float to integer cents safely to avoid IEEE 754 floating-point drift.
 */
export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

/**
 * Converts integer cents back to a two-decimal dollar number.
 */
export function fromCents(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

/**
 * Distributes an integer cent pool across weights using the Largest Remainder Method (Hare-Niemeyer)
 * so that the sum of distributed cents is guaranteed to equal `totalCents` to the exact penny.
 */
export function distributeCentsProportionally(
  totalCents: number,
  weights: number[]
): number[] {
  const count = weights.length;
  if (count === 0) return [];
  if (totalCents === 0) return new Array(count).fill(0);

  const sign = totalCents < 0 ? -1 : 1;
  const absTotalCents = Math.abs(totalCents);
  const totalWeight = weights.reduce((acc, w) => acc + Math.max(0, w), 0);

  if (totalWeight <= 0) {
    // Fallback to equal distribution when all weights are zero
    const baseShare = Math.floor(absTotalCents / count);
    let remainder = absTotalCents - baseShare * count;
    return weights.map(() => {
      if (remainder > 0) {
        remainder -= 1;
        return (baseShare + 1) * sign;
      }
      return baseShare * sign;
    });
  }

  const exactQuotas = weights.map((w) => (Math.max(0, w) / totalWeight) * absTotalCents);
  const flooredShares = exactQuotas.map((q) => Math.floor(q));
  const remainders = exactQuotas.map((q, idx) => ({
    index: idx,
    remainder: q - flooredShares[idx],
    weight: weights[idx],
  }));

  let leftOverCents = absTotalCents - flooredShares.reduce((a, b) => a + b, 0);

  // Sort by largest fractional remainder, breaking ties by larger weight then earlier index
  remainders.sort((a, b) => {
    if (Math.abs(b.remainder - a.remainder) > 1e-9) {
      return b.remainder - a.remainder;
    }
    if (b.weight !== a.weight) {
      return b.weight - a.weight;
    }
    return a.index - b.index;
  });

  for (let i = 0; i < leftOverCents; i++) {
    const targetIdx = remainders[i % count].index;
    flooredShares[targetIdx] += 1;
  }

  return flooredShares.map((s) => s * sign);
}

/**
 * Computes the complete itemized bill split across all group participants.
 */
export function calculateBillSplit(
  items: ReceiptLineItem[],
  participants: GroupParticipant[],
  assignments: ItemAssignmentMap,
  config: TaxTipDistributionConfig
): BillSplitCalculationResult {
  const participantCount = participants.length;

  // Map participant IDs to their index and accumulated item details
  const participantIndexById = new Map<string, number>();
  participants.forEach((p, idx) => participantIndexById.set(p.id, idx));

  const assignedItemsByParticipant: AssignedItemDetail[][] = participants.map(() => []);
  const participantItemCents: number[] = new Array(participantCount).fill(0);

  let assignedItemsCents = 0;
  let unassignedItemsCents = 0;
  const unassignedItemIds: string[] = [];

  for (const item of items) {
    const itemCents = toCents(item.totalPrice);
    const rawAssignees = assignments[item.id] || [];
    const validAssigneeIndices = rawAssignees
      .map((pid) => participantIndexById.get(pid))
      .filter((idx): idx is number => idx !== undefined);

    if (validAssigneeIndices.length === 0) {
      unassignedItemsCents += itemCents;
      unassignedItemIds.push(item.id);
      continue;
    }

    assignedItemsCents += itemCents;

    // Split this single item equally among its selected assignees with exact-cent remainder handling
    const equalWeights = validAssigneeIndices.map(() => 1);
    const itemShareCentsList = distributeCentsProportionally(itemCents, equalWeights);

    validAssigneeIndices.forEach((pIdx, sharePos) => {
      const shareCents = itemShareCentsList[sharePos];
      participantItemCents[pIdx] += shareCents;
      assignedItemsByParticipant[pIdx].push({
        itemId: item.id,
        name: item.name,
        fullPrice: fromCents(itemCents),
        sharedByCount: validAssigneeIndices.length,
        sharePrice: fromCents(shareCents),
      });
    });
  }

  const receiptSubtotalCents = assignedItemsCents + unassignedItemsCents;
  const taxCents = Math.max(0, toCents(config.customTaxAmount));
  const serviceFeeCents = Math.max(0, toCents(config.customServiceFeeAmount));
  const discountCents = Math.max(0, toCents(config.customDiscountAmount));

  const tipCents =
    config.tipMode === 'percentage'
      ? Math.round((receiptSubtotalCents * Math.max(0, config.tipPercentage)) / 100)
      : Math.max(0, toCents(config.tipFixedAmount));

  // Determine weights for tax, service fee, discount, and tip distribution
  // Only participants who have items assigned (or all participants if none assigned yet) participate in equal mode
  const activeEqualWeights = participantItemCents.map((c) => (c > 0 ? 1 : 0));
  const hasAnyAssigned = assignedItemsCents > 0;

  const distributionWeights =
    config.mode === 'proportional'
      ? participantItemCents
      : hasAnyAssigned
        ? activeEqualWeights
        : participants.map(() => 1);

  const taxSharesCents = hasAnyAssigned
    ? distributeCentsProportionally(taxCents, distributionWeights)
    : new Array(participantCount).fill(0);

  const serviceFeeSharesCents = hasAnyAssigned
    ? distributeCentsProportionally(serviceFeeCents, distributionWeights)
    : new Array(participantCount).fill(0);

  const discountSharesCents = hasAnyAssigned
    ? distributeCentsProportionally(discountCents, distributionWeights)
    : new Array(participantCount).fill(0);

  const tipSharesCents = hasAnyAssigned
    ? distributeCentsProportionally(tipCents, distributionWeights)
    : new Array(participantCount).fill(0);

  const breakdowns: ParticipantBreakdown[] = participants.map((participant, idx) => {
    const subCents = participantItemCents[idx];
    const taxShareCents = taxSharesCents[idx];
    const feeShareCents = serviceFeeSharesCents[idx];
    const discShareCents = discountSharesCents[idx];
    const tipShareCents = tipSharesCents[idx];
    const totalOwedCents = Math.max(
      0,
      subCents + taxShareCents + feeShareCents - discShareCents + tipShareCents
    );

    const ratio = assignedItemsCents > 0 ? subCents / assignedItemsCents : 0;

    return {
      participant,
      assignedItems: assignedItemsByParticipant[idx],
      itemsSubtotal: fromCents(subCents),
      subtotalShareRatio: Number(ratio.toFixed(4)),
      taxShare: fromCents(taxShareCents),
      serviceFeeShare: fromCents(feeShareCents),
      discountShare: fromCents(discShareCents),
      tipShare: fromCents(tipShareCents),
      totalOwed: fromCents(totalOwedCents),
    };
  });

  const grandTotalCents = Math.max(
    0,
    receiptSubtotalCents + taxCents + serviceFeeCents - discountCents + tipCents
  );

  return {
    participants: breakdowns,
    assignedItemsSubtotal: fromCents(assignedItemsCents),
    unassignedItemsSubtotal: fromCents(unassignedItemsCents),
    unassignedItemIds,
    receiptSubtotal: fromCents(receiptSubtotalCents),
    effectiveTax: fromCents(taxCents),
    effectiveServiceFee: fromCents(serviceFeeCents),
    effectiveDiscount: fromCents(discountCents),
    effectiveTip: fromCents(tipCents),
    grandTotal: fromCents(grandTotalCents),
    isFullyAssigned: items.length > 0 && unassignedItemIds.length === 0,
  };
}
